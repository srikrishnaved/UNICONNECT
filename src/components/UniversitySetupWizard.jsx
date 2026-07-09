import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import {
  colors as tColors,
  typography,
  spacing as tSpacing,
  radius as tRadius,
} from '../theme/tokens';

const STEPS = [
  { number: 1, title: 'Details' },
  { number: 2, title: 'Classes' },
  { number: 3, title: 'Periods' },
];

const DEFAULT_PERIODS = [
  { label: 'M1', start_time: '', end_time: '', is_break: false },
  { label: 'M2', start_time: '', end_time: '', is_break: false },
  { label: 'P1', start_time: '', end_time: '', is_break: false },
  { label: 'P2', start_time: '', end_time: '', is_break: false },
  { label: 'P3', start_time: '', end_time: '', is_break: false },
  { label: 'P4', start_time: '', end_time: '', is_break: false },
];

export default function UniversitySetupWizard({
  visible,
  onClose,
  onComplete,
  universityId,
  initialStep = 1,
}) {
  const [step, setStep] = useState(initialStep);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1
  const [uniName, setUniName] = useState('');
  const [uniAddress, setUniAddress] = useState('');
  const [uniWebsite, setUniWebsite] = useState('');
  const [uniPhone, setUniPhone] = useState('');

  // Step 2 — blank slate, admin-defined classes
  const [classes, setClasses] = useState([]);
  const [classInput, setClassInput] = useState('');
  const [importing, setImporting] = useState(false);
  const classInputRef = useRef(null);

  // Step 3 — periods
  const [periods, setPeriods] = useState(DEFAULT_PERIODS);

  useEffect(() => {
    if (visible) {
      setStep(initialStep);
      setError('');
      loadExistingProgress();
    }
  }, [visible, initialStep]);

  const loadExistingProgress = async () => {
    if (!universityId) return;
    const [{ data }, { data: savedPeriods }] = await Promise.all([
      supabase
        .from('university_setup_progress')
        .select('*')
        .eq('university_id', universityId)
        .maybeSingle(),
      supabase
        .from('university_periods')
        .select('label, start_time, end_time, is_break, period_order')
        .eq('university_id', universityId)
        .order('period_order'),
    ]);
    if (data) {
      if (data.university_name) setUniName(data.university_name);
      if (data.university_address) setUniAddress(data.university_address);
      if (data.university_website) setUniWebsite(data.university_website);
      if (data.university_phone) setUniPhone(data.university_phone);
      if (data.enabled_classes) setClasses(data.enabled_classes);
    }
    if (savedPeriods?.length) {
      setPeriods(savedPeriods.map(p => ({
        label: p.label,
        start_time: p.start_time ?? '',
        end_time: p.end_time ?? '',
        is_break: !!p.is_break,
      })));
    }
  };

  const upsert = async (payload) => {
    const { error: err } = await supabase
      .from('university_setup_progress')
      .upsert(
        { university_id: universityId, ...payload, updated_at: new Date().toISOString() },
        { onConflict: 'university_id' },
      );
    if (err) throw err;
  };

  const saveStep1 = async () => {
    if (!uniName.trim()) { setError('University name is required.'); return; }
    setSaving(true); setError('');
    try {
      await upsert({
        university_name: uniName.trim(),
        university_address: uniAddress.trim(),
        university_website: uniWebsite.trim(),
        university_phone: uniPhone.trim(),
        step_details_done: true,
      });
      setStep(2);
    } catch (e) {
      setError(e.message || 'Could not save details.');
    } finally {
      setSaving(false);
    }
  };

  const saveStep2 = async () => {
    if (classes.length === 0) { setError('Add at least one class.'); return; }
    setSaving(true); setError('');
    try {
      await upsert({ enabled_classes: classes, step_classes_done: true });
      setStep(3);
    } catch (e) {
      setError(e.message || 'Could not save classes.');
    } finally {
      setSaving(false);
    }
  };

  const completeSetup = async () => {
    const namedPeriods = periods.filter(p => p.label.trim());
    if (namedPeriods.length === 0) { setError('Add at least one period.'); return; }
    setSaving(true); setError('');
    try {
      const periodsToUpsert = namedPeriods.map((p, i) => ({
        university_id: universityId,
        label: p.label.trim(),
        start_time: p.start_time.trim() || null,
        end_time: p.end_time.trim() || null,
        is_break: p.is_break,
        period_order: i,
        applies_to_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      }));
      const { error: perErr } = await supabase
        .from('university_periods')
        .upsert(periodsToUpsert, { onConflict: 'university_id,label' });
      if (perErr) throw perErr;
      await upsert({ is_setup_complete: true });
      onComplete?.();
    } catch (e) {
      setError(e.message || 'Could not complete setup.');
    } finally {
      setSaving(false);
    }
  };

  const commitClassInput = () => {
    const name = classInput.trim();
    if (!name) return;
    if (!classes.includes(name)) {
      setClasses(prev => [...prev, name]);
      setError('');
    }
    setClassInput('');
    classInputRef.current?.focus();
  };

  const removeClass = (name) => {
    setClasses(prev => prev.filter(c => c !== name));
  };

  const updatePeriod = (index, field, value) => {
    setPeriods(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const addPeriod = () => {
    setPeriods(prev => [...prev, { label: '', start_time: '', end_time: '', is_break: false }]);
  };

  const removePeriod = (index) => {
    setPeriods(prev => prev.filter((_, i) => i !== index));
  };

  const handleImportFile = async () => {
    setImporting(true);
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'text/plain',
          'text/comma-separated-values',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) return;

      // On web, asset.file is a native File object — read as ArrayBuffer directly.
      // On native, fall back to expo-file-system base64.
      let workbook;
      if (asset.file) {
        const buffer = await asset.file.arrayBuffer();
        workbook = XLSX.read(buffer, { type: 'array' });
      } else {
        const b64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        workbook = XLSX.read(b64, { type: 'base64' });
      }
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      const HEADER_PATTERN = /^(class\s*name|class|name|section|batch|program|programme)$/i;
      const looksLikeHeader = (val) =>
        HEADER_PATTERN.test(val) || (!/\d/.test(val) && val.split(/\s+/).length <= 3 && val.length <= 20);

      const allValues = rows.map(row => String(row[0] ?? '').trim()).filter(Boolean);
      // Skip the first row if it looks like a column header
      const dataValues = allValues.length > 0 && looksLikeHeader(allValues[0])
        ? allValues.slice(1)
        : allValues;

      const imported = dataValues.filter(val => !HEADER_PATTERN.test(val));

      if (imported.length === 0) {
        setError('No class names found. Make sure each class is in the first column.');
        return;
      }

      setClasses(prev => {
        const merged = [...prev];
        for (const name of imported) {
          if (!merged.includes(name)) merged.push(name);
        }
        return merged;
      });
    } catch (e) {
      setError(e.message || 'Could not read file.');
    } finally {
      setImporting(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepRow}>
      {STEPS.map((s, i) => (
        <React.Fragment key={s.number}>
          <View style={styles.stepItem}>
            <View style={[
              styles.stepCircle,
              step >= s.number && styles.stepCircleActive,
              step > s.number && styles.stepCircleDone,
            ]}>
              {step > s.number
                ? <Text style={styles.stepCircleText}>✓</Text>
                : <Text style={[styles.stepCircleText, step < s.number && styles.stepCircleTextInactive]}>
                    {s.number}
                  </Text>
              }
            </View>
            <Text style={[styles.stepLabel, step === s.number && styles.stepLabelActive]}>
              {s.title}
            </Text>
          </View>
          {i < STEPS.length - 1 && (
            <View style={[styles.stepLine, step > s.number && styles.stepLineActive]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepHeading}>University Details</Text>
      <Text style={styles.stepDesc}>Enter basic information about your institution.</Text>

      <Text style={styles.fieldLabel}>UNIVERSITY NAME *</Text>
      <TextInput
        value={uniName}
        onChangeText={t => { setUniName(t); setError(''); }}
        placeholder="e.g. Christ University"
        placeholderTextColor={tColors.textTertiary}
        style={styles.input}
      />

      <Text style={styles.fieldLabel}>ADDRESS</Text>
      <TextInput
        value={uniAddress}
        onChangeText={setUniAddress}
        placeholder="e.g. Hosur Road, Bengaluru"
        placeholderTextColor={tColors.textTertiary}
        style={styles.input}
      />

      <Text style={styles.fieldLabel}>WEBSITE</Text>
      <TextInput
        value={uniWebsite}
        onChangeText={setUniWebsite}
        placeholder="e.g. https://christuniversity.in"
        placeholderTextColor={tColors.textTertiary}
        style={styles.input}
        autoCapitalize="none"
        keyboardType="url"
      />

      <Text style={styles.fieldLabel}>PHONE</Text>
      <TextInput
        value={uniPhone}
        onChangeText={setUniPhone}
        placeholder="e.g. +91 80 4012 9100"
        placeholderTextColor={tColors.textTertiary}
        style={styles.input}
        keyboardType="phone-pad"
      />

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
        onPress={saveStep1}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.primaryBtnText}>Next: Classes →</Text>
        }
      </TouchableOpacity>
      <View style={{ height: 20 }} />
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepHeading}>Classes & Programs</Text>
      <Text style={styles.stepDesc}>Add each class your institution offers.</Text>

      {/* Input row */}
      <View style={styles.classInputRow}>
        <TextInput
          ref={classInputRef}
          value={classInput}
          onChangeText={setClassInput}
          onSubmitEditing={commitClassInput}
          returnKeyType="done"
          placeholder="Type a class name and press Add"
          placeholderTextColor={tColors.textTertiary}
          style={styles.classInput}
          blurOnSubmit={false}
        />
        {/* Voice input — coming soon */}
        <TouchableOpacity style={styles.addBtn} onPress={commitClassInput} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.inputHint}>
        e.g. CS-A, MBA Year 2, BBA Section B — use whatever naming convention your university uses
      </Text>

      {/* Bulk import */}
      <TouchableOpacity
        style={[styles.importBtn, importing && { opacity: 0.6 }]}
        onPress={handleImportFile}
        disabled={importing}
        activeOpacity={0.8}
      >
        {importing
          ? <ActivityIndicator size="small" color={tColors.student.primary} />
          : <Text style={styles.importBtnText}>📄 Import from Excel / CSV</Text>
        }
      </TouchableOpacity>

      {/* Chips */}
      {classes.length > 0 && (
        <View style={styles.chipsWrap}>
          {classes.map(cls => (
            <View key={cls} style={styles.chip}>
              <Text style={styles.chipText}>{cls}</Text>
              <TouchableOpacity
                onPress={() => removeClass(cls)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Text style={styles.chipRemove}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {classes.length === 0 && (
        <View style={styles.emptyClasses}>
          <Text style={styles.emptyClassesText}>No classes added yet</Text>
        </View>
      )}

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.navRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)} activeOpacity={0.75}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, { flex: 1 }, saving && { opacity: 0.6 }]}
          onPress={saveStep2}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>Next: Finish →</Text>
          }
        </TouchableOpacity>
      </View>
      <View style={{ height: 20 }} />
    </ScrollView>
  );

  const renderStep3 = () => (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepHeading}>Periods & Schedule</Text>
      <Text style={styles.stepDesc}>
        Define your institution's class periods. Edit labels, times, and mark breaks.
      </Text>

      {/* Column headers */}
      <View style={styles.periodHeaderRow}>
        <Text style={[styles.periodColHeader, { flex: 1.2 }]}>PERIOD</Text>
        <Text style={[styles.periodColHeader, { flex: 1.5 }]}>START</Text>
        <Text style={[styles.periodColHeader, { flex: 1.5 }]}>END</Text>
        <Text style={[styles.periodColHeader, { flex: 1.2, textAlign: 'center' }]}>BREAK</Text>
        <View style={{ width: 28 }} />
      </View>

      {periods.map((p, i) => (
        <View key={i} style={styles.periodRow}>
          <TextInput
            value={p.label}
            onChangeText={v => updatePeriod(i, 'label', v)}
            placeholder="M1"
            placeholderTextColor={tColors.textTertiary}
            style={[styles.periodInput, { flex: 1.2 }]}
            maxLength={8}
          />
          <TextInput
            value={p.start_time}
            onChangeText={v => updatePeriod(i, 'start_time', v)}
            placeholder="08:40"
            placeholderTextColor={tColors.textTertiary}
            style={[styles.periodInput, { flex: 1.5 }]}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <TextInput
            value={p.end_time}
            onChangeText={v => updatePeriod(i, 'end_time', v)}
            placeholder="09:30"
            placeholderTextColor={tColors.textTertiary}
            style={[styles.periodInput, { flex: 1.5 }]}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <TouchableOpacity
            style={[styles.breakToggle, p.is_break && styles.breakToggleActive, { flex: 1.2 }]}
            onPress={() => updatePeriod(i, 'is_break', !p.is_break)}
            activeOpacity={0.75}
          >
            <Text style={[styles.breakToggleText, p.is_break && styles.breakToggleTextActive]}>
              {p.is_break ? 'Break' : 'Class'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => removePeriod(i)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 28, alignItems: 'center' }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 15, color: tColors.error }}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.addPeriodBtn} onPress={addPeriod} activeOpacity={0.8}>
        <Text style={styles.addPeriodBtnText}>+ Add Period</Text>
      </TouchableOpacity>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.navRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)} activeOpacity={0.75}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, { flex: 1 }, saving && { opacity: 0.6 }]}
          onPress={completeSetup}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>Complete Setup ✓</Text>
          }
        </TouchableOpacity>
      </View>
      <View style={{ height: 20 }} />
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>University Setup</Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <Text style={{ fontSize: 22, color: tColors.textSecondary, padding: 4 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {renderStepIndicator()}

            <View style={{ flex: 1, paddingHorizontal: tSpacing.base }}>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: tColors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: tColors.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: tSpacing.base,
    borderBottomWidth: 1,
    borderBottomColor: tColors.border,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: typography.bold,
    color: tColors.textPrimary,
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tSpacing.base,
    paddingVertical: tSpacing.md,
  },
  stepItem: { alignItems: 'center', flex: 1 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: tColors.cardAlt,
    borderWidth: 2, borderColor: tColors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepCircleActive: { borderColor: tColors.student.primary, backgroundColor: tColors.student.primaryDim },
  stepCircleDone: { borderColor: tColors.success, backgroundColor: tColors.successDim },
  stepCircleText: { fontSize: 12, fontWeight: typography.bold, color: tColors.student.primary },
  stepCircleTextInactive: { color: tColors.textTertiary },
  stepLabel: { fontSize: 10, color: tColors.textTertiary, marginTop: 4, fontWeight: typography.medium },
  stepLabelActive: { color: tColors.student.primary, fontWeight: typography.bold },
  stepLine: { flex: 1, height: 2, backgroundColor: tColors.border, marginBottom: 12 },
  stepLineActive: { backgroundColor: tColors.success },

  stepHeading: {
    fontSize: 17, fontWeight: typography.bold,
    color: tColors.textPrimary, marginBottom: 6, marginTop: tSpacing.sm,
  },
  stepDesc: { fontSize: 13, color: tColors.textSecondary, marginBottom: tSpacing.md, lineHeight: 19 },

  fieldLabel: {
    fontSize: 10, color: tColors.textSecondary, letterSpacing: 0.8,
    fontWeight: typography.bold, marginBottom: 6, marginTop: tSpacing.sm,
  },
  input: {
    backgroundColor: tColors.bg, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md,
    color: tColors.textPrimary, fontSize: 14, marginBottom: tSpacing.sm,
  },

  // ── Step 2 ─────────────────────────────────────────────────────────────────
  classInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tSpacing.sm,
    marginBottom: tSpacing.xs ?? 4,
  },
  classInput: {
    flex: 1,
    backgroundColor: tColors.bg, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, paddingHorizontal: tSpacing.md, paddingVertical: 12,
    color: tColors.textPrimary, fontSize: 14,
  },
  addBtn: {
    backgroundColor: tColors.student.primary,
    borderRadius: tRadius.md,
    paddingHorizontal: tSpacing.md,
    paddingVertical: 12,
  },
  addBtnText: {
    fontSize: 14, fontWeight: typography.bold, color: '#fff',
  },
  inputHint: {
    fontSize: 11, color: tColors.textTertiary,
    fontStyle: 'italic', marginBottom: tSpacing.md, lineHeight: 16,
  },
  importBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: tColors.border, borderRadius: tRadius.md,
    paddingVertical: 11, marginBottom: tSpacing.md,
    backgroundColor: tColors.cardAlt,
  },
  importBtnText: {
    fontSize: 14, color: tColors.textSecondary, fontWeight: typography.medium,
  },
  chipsWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: tSpacing.sm,
    marginBottom: tSpacing.md,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: tColors.student.primaryDim,
    borderWidth: 1, borderColor: tColors.student.primary,
    borderRadius: tRadius.full,
    paddingHorizontal: tSpacing.md, paddingVertical: 6,
  },
  chipText: {
    fontSize: 13, color: tColors.student.primary, fontWeight: typography.semibold,
  },
  chipRemove: {
    fontSize: 11, color: tColors.student.primary, fontWeight: typography.bold,
  },
  emptyClasses: {
    borderWidth: 1, borderColor: tColors.border, borderRadius: tRadius.md,
    paddingVertical: tSpacing.lg, alignItems: 'center',
    marginBottom: tSpacing.md, backgroundColor: tColors.bg,
  },
  emptyClassesText: {
    fontSize: 13, color: tColors.textTertiary, fontStyle: 'italic',
  },

  // ── Step 3 ─────────────────────────────────────────────────────────────────
  periodHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 4,
  },
  periodColHeader: {
    fontSize: 9, color: tColors.textTertiary,
    fontWeight: typography.bold, letterSpacing: 0.6,
  },
  periodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 6,
  },
  periodInput: {
    backgroundColor: tColors.bg, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.sm, paddingHorizontal: 8, paddingVertical: 9,
    color: tColors.textPrimary, fontSize: 13,
  },
  breakToggle: {
    borderWidth: 1, borderColor: tColors.border, borderRadius: tRadius.sm,
    paddingVertical: 9, alignItems: 'center',
    backgroundColor: tColors.bg,
  },
  breakToggleActive: {
    borderColor: tColors.warning, backgroundColor: tColors.warningDim,
  },
  breakToggleText: {
    fontSize: 11, color: tColors.textSecondary, fontWeight: typography.medium,
  },
  breakToggleTextActive: { color: tColors.warning, fontWeight: typography.bold },
  addPeriodBtn: {
    borderWidth: 1, borderColor: tColors.border, borderRadius: tRadius.md,
    paddingVertical: 10, alignItems: 'center',
    marginTop: tSpacing.sm, marginBottom: tSpacing.md,
    backgroundColor: tColors.cardAlt,
  },
  addPeriodBtnText: { fontSize: 13, color: tColors.textSecondary, fontWeight: typography.medium },

  errorText: { fontSize: 12, color: tColors.error, textAlign: 'center', marginVertical: tSpacing.sm },

  primaryBtn: {
    backgroundColor: tColors.student.primary, borderRadius: tRadius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: tSpacing.md,
  },
  primaryBtnText: { fontSize: 15, fontWeight: typography.bold, color: '#fff' },

  navRow: { flexDirection: 'row', gap: tSpacing.sm, marginTop: tSpacing.md },
  backBtn: {
    paddingVertical: 14, paddingHorizontal: tSpacing.md,
    borderRadius: tRadius.md, borderWidth: 1, borderColor: tColors.border, alignItems: 'center',
  },
  backBtnText: { fontSize: 14, color: tColors.textSecondary, fontWeight: typography.medium },
});
