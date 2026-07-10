import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import {
  colors as tColors,
  typography,
  spacing as tSpacing,
  radius as tRadius,
  shadows,
} from '../theme/tokens';
import { ChevronLeft, X, Sparkles, Check } from 'lucide-react-native';
import { NAAC_MASTER_TEMPLATE } from '../data/naacMasterTemplate';

const CRITERION_IDS = Object.keys(NAAC_MASTER_TEMPLATE).map(Number).sort((a, b) => a - b);

const STATUS_COLORS = {
  not_started: { label: 'Not Started', color: tColors.textTertiary,  bg: tColors.cardAlt },
  draft:       { label: 'Draft',       color: tColors.warning,        bg: tColors.warningDim },
  complete:    { label: 'Complete',    color: tColors.success,        bg: tColors.successDim },
};

const CHECKLIST_OPTIONS = ['A', 'B', 'C', 'D'];

// ── Component ────────────────────────────────────────────────────────────────
export default function NAACScreen({ visible, onClose, userProfile }) {
  const [universityId, setUniversityId] = useState(null);
  const [submissions, setSubmissions] = useState({});   // metric id → row
  const [loadingData, setLoadingData] = useState(true);

  // Criterion tab
  const [activeCriterion, setActiveCriterion] = useState(1);

  // Metric detail panel
  const [selectedMetric, setSelectedMetric] = useState(null); // { id, title, type, criterion }
  const [inputData, setInputData] = useState({});
  const [generatedText, setGeneratedText] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Resolve university_id on open ─────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (userProfile?.is_super_admin) {
      setUniversityId(userProfile.id);
    } else {
      supabase
        .from('university_setup_progress')
        .select('university_id')
        .maybeSingle()
        .then(({ data }) => { if (data?.university_id) setUniversityId(data.university_id); });
    }
  }, [visible, userProfile?.id]);

  // ── Load submissions once universityId is known ───────────────────────────
  useEffect(() => {
    if (!visible || !universityId) return;
    loadSubmissions();
  }, [visible, universityId]);

  const loadSubmissions = async () => {
    setLoadingData(true);
    const { data } = await supabase
      .from('naac_submissions')
      .select('metric, status, input_data, generated_content')
      .eq('university_id', universityId);
    const map = {};
    (data || []).forEach(row => { map[row.metric] = row; });
    setSubmissions(map);
    setLoadingData(false);
  };

  // ── Open metric detail ────────────────────────────────────────────────────
  const openMetric = (metricDef, criterionId) => {
    const row = submissions[metricDef.id];
    setSelectedMetric({ ...metricDef, criterion: criterionId });
    setInputData(row?.input_data ?? {});
    setGeneratedText(row?.generated_content ?? '');
    setSaveError('');
  };

  const closeDetail = () => {
    setSelectedMetric(null);
    setInputData({});
    setGeneratedText('');
    setSaveError('');
  };

  // ── Save draft ────────────────────────────────────────────────────────────
  const saveDraft = async () => {
    if (!selectedMetric) return;
    setSaving(true); setSaveError('');
    try {
      const payload = {
        university_id: universityId,
        criterion: selectedMetric.criterion,
        metric: selectedMetric.id,
        metric_title: selectedMetric.title,
        status: 'draft',
        input_data: inputData,
        generated_content: generatedText || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('naac_submissions')
        .upsert(payload, { onConflict: 'university_id,metric' });
      if (error) throw error;
      setSubmissions(prev => ({ ...prev, [selectedMetric.id]: { ...payload, status: 'draft' } }));
    } catch (e) {
      setSaveError(e.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  // ── Mark complete ─────────────────────────────────────────────────────────
  const markComplete = async () => {
    if (!selectedMetric) return;
    setSaving(true); setSaveError('');
    try {
      const payload = {
        university_id: universityId,
        criterion: selectedMetric.criterion,
        metric: selectedMetric.id,
        metric_title: selectedMetric.title,
        status: 'complete',
        input_data: inputData,
        generated_content: generatedText || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('naac_submissions')
        .upsert(payload, { onConflict: 'university_id,metric' });
      if (error) throw error;
      setSubmissions(prev => ({ ...prev, [selectedMetric.id]: { ...payload, status: 'complete' } }));
      closeDetail();
    } catch (e) {
      setSaveError(e.message || 'Could not mark complete.');
    } finally {
      setSaving(false);
    }
  };

  // ── Generate AI content ───────────────────────────────────────────────────
  const generateContent = async () => {
    if (!selectedMetric) return;
    setGenerating(true); setSaveError('');
    try {
      const { data, error } = await supabase.functions.invoke('generate-naac-content', {
        body: {
          university_id: universityId,
          metric: selectedMetric.id,
          metric_title: selectedMetric.title,
          criterion: selectedMetric.criterion,
          notes: inputData.notes ?? JSON.stringify(inputData),
        },
      });
      if (error) throw error;
      if (data?.content) setGeneratedText(data.content);
    } catch (e) {
      setSaveError('AI generation failed: ' + (e.message || 'Unknown error'));
    } finally {
      setGenerating(false);
    }
  };

  // ── Toggle checklist option ───────────────────────────────────────────────
  const toggleChecklistOption = (opt) => {
    setInputData(prev => {
      const current = prev.selected ?? [];
      const next = current.includes(opt)
        ? current.filter(o => o !== opt)
        : [...current, opt];
      return { ...prev, selected: next };
    });
  };

  // ── Render input based on metric type ────────────────────────────────────
  const renderMetricInput = () => {
    const type = selectedMetric?.type;

    if (type === 'simple_number') {
      return (
        <>
          <Text style={styles.fieldLabel}>VALUE</Text>
          <TextInput
            value={inputData.value ?? ''}
            onChangeText={v => setInputData(prev => ({ ...prev, value: v }))}
            keyboardType="numeric"
            placeholder="Enter number…"
            placeholderTextColor={tColors.textTertiary}
            style={[styles.textArea, { minHeight: 48 }]}
          />
        </>
      );
    }

    if (type === 'two_numbers_ratio' || type === 'ratio') {
      const labelA = type === 'ratio' ? 'NUMERATOR (Count)' : 'FIRST NUMBER';
      const labelB = type === 'ratio' ? 'DENOMINATOR (Total)' : 'SECOND NUMBER';
      const num = parseFloat(inputData.numerator);
      const den = parseFloat(inputData.denominator);
      const computed = !isNaN(num) && !isNaN(den) && den !== 0
        ? type === 'ratio'
          ? `${((num / den) * 100).toFixed(1)}%`
          : `${(num / den).toFixed(1)} : 1`
        : null;
      return (
        <>
          <Text style={styles.fieldLabel}>{labelA}</Text>
          <TextInput
            value={inputData.numerator ?? ''}
            onChangeText={v => setInputData(prev => ({ ...prev, numerator: v }))}
            keyboardType="numeric"
            placeholder="e.g. 120"
            placeholderTextColor={tColors.textTertiary}
            style={[styles.textArea, { minHeight: 48 }]}
          />
          <Text style={styles.fieldLabel}>{labelB}</Text>
          <TextInput
            value={inputData.denominator ?? ''}
            onChangeText={v => setInputData(prev => ({ ...prev, denominator: v }))}
            keyboardType="numeric"
            placeholder="e.g. 200"
            placeholderTextColor={tColors.textTertiary}
            style={[styles.textArea, { minHeight: 48 }]}
          />
          {computed && (
            <View style={styles.computedBadge}>
              <Text style={styles.computedBadgeText}>{computed}</Text>
            </View>
          )}
        </>
      );
    }

    if (type === 'checklist') {
      const selected = inputData.selected ?? [];
      return (
        <>
          <Text style={styles.fieldLabel}>SELECT ALL THAT APPLY</Text>
          <View style={styles.chipRow}>
            {CHECKLIST_OPTIONS.map(opt => {
              const active = selected.includes(opt);
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleChecklistOption(opt)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      );
    }

    if (type === 'link_or_score') {
      return (
        <>
          <Text style={styles.fieldLabel}>SURVEY / REPORT URL</Text>
          <TextInput
            value={inputData.url ?? ''}
            onChangeText={v => setInputData(prev => ({ ...prev, url: v }))}
            keyboardType="url"
            autoCapitalize="none"
            placeholder="https://…"
            placeholderTextColor={tColors.textTertiary}
            style={[styles.textArea, { minHeight: 48 }]}
          />
          <Text style={styles.fieldLabel}>SCORE (optional)</Text>
          <TextInput
            value={inputData.score ?? ''}
            onChangeText={v => setInputData(prev => ({ ...prev, score: v }))}
            keyboardType="numeric"
            placeholder="e.g. 3.75"
            placeholderTextColor={tColors.textTertiary}
            style={[styles.textArea, { minHeight: 48 }]}
          />
        </>
      );
    }

    // Default: narrative
    return (
      <>
        <Text style={styles.fieldLabel}>NOTES / INPUT DATA</Text>
        <TextInput
          value={inputData.notes ?? ''}
          onChangeText={v => setInputData(prev => ({ ...prev, notes: v }))}
          placeholder="Enter data, statistics, or notes for this metric…"
          placeholderTextColor={tColors.textTertiary}
          style={[styles.textArea, { minHeight: 120 }]}
          multiline
          textAlignVertical="top"
        />
      </>
    );
  };

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalMetrics = CRITERION_IDS.reduce((acc, id) => acc + NAAC_MASTER_TEMPLATE[id].metrics.length, 0);
  const completeCount = Object.values(submissions).filter(r => r.status === 'complete').length;
  const draftCount = Object.values(submissions).filter(r => r.status === 'draft').length;

  // ── Active criterion data ─────────────────────────────────────────────────
  const activeCriterionData = NAAC_MASTER_TEMPLATE[activeCriterion];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: tColors.bg }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={selectedMetric ? closeDetail : onClose} activeOpacity={0.7} style={{ padding: 4 }}>
            {selectedMetric ? <ChevronLeft size={20} color={tColors.textPrimary} /> : <X size={20} color={tColors.textPrimary} />}
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>
              {selectedMetric ? `${selectedMetric.id} — ${selectedMetric.title}` : 'NAAC Documentation'}
            </Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        {loadingData ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={tColors.student.primary} />
            <Text style={{ color: tColors.textSecondary, marginTop: 12, fontSize: 13 }}>Loading submissions…</Text>
          </View>
        ) : selectedMetric ? (
          // ── Metric detail view ───────────────────────────────────────────
          <ScrollView contentContainerStyle={{ padding: tSpacing.base, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
            {/* Status badge */}
            {submissions[selectedMetric.id] && (() => {
              const cfg = STATUS_COLORS[submissions[selectedMetric.id].status] ?? STATUS_COLORS.not_started;
              return (
                <View style={[styles.statusPill, { backgroundColor: cfg.bg, alignSelf: 'flex-start', marginBottom: tSpacing.md }]}>
                  <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              );
            })()}

            {renderMetricInput()}

            {/* AI generate — only relevant for narrative */}
            {selectedMetric.type === 'narrative' && (
              <TouchableOpacity
                style={[styles.generateBtn, generating && { opacity: 0.6 }]}
                onPress={generateContent}
                disabled={generating}
                activeOpacity={0.85}
              >
                {generating
                  ? <ActivityIndicator size="small" color={tColors.student.primary} />
                  : <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Sparkles size={14} color={tColors.student.primary} /><Text style={styles.generateBtnText}>Generate AI Content</Text></View>}
              </TouchableOpacity>
            )}

            {!!generatedText && (
              <>
                <Text style={styles.fieldLabel}>GENERATED CONTENT</Text>
                <View style={styles.generatedBox}>
                  <Text style={{ fontSize: 13, color: tColors.textPrimary, lineHeight: 20 }}>{generatedText}</Text>
                </View>
              </>
            )}

            {!!saveError && (
              <Text style={{ fontSize: 12, color: tColors.error, textAlign: 'center', marginBottom: tSpacing.sm }}>{saveError}</Text>
            )}

            <View style={{ flexDirection: 'row', gap: tSpacing.sm, marginTop: tSpacing.md }}>
              <TouchableOpacity
                style={[styles.draftBtn, saving && { opacity: 0.6 }]}
                onPress={saveDraft}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? <ActivityIndicator size="small" color={tColors.warning} /> : <Text style={styles.draftBtnText}>Save Draft</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.completeBtn, saving && { opacity: 0.6 }]}
                onPress={markComplete}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Text style={styles.completeBtnText}>Mark Complete</Text><Check size={14} color={tColors.success} /></View>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          // ── Criteria list view ───────────────────────────────────────────
          <>
            {/* Progress summary */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, { color: tColors.success }]}>{completeCount}</Text>
                <Text style={styles.summaryLabel}>Complete</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, { color: tColors.warning }]}>{draftCount}</Text>
                <Text style={styles.summaryLabel}>Draft</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, { color: tColors.textTertiary }]}>{totalMetrics - completeCount - draftCount}</Text>
                <Text style={styles.summaryLabel}>Not Started</Text>
              </View>
            </View>

            {/* Criterion tabs */}
            <View style={styles.criterionTabBarWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.criterionTabBar} contentContainerStyle={{ paddingHorizontal: tSpacing.md, alignItems: 'center' }}>
              {CRITERION_IDS.map(cId => (
                <TouchableOpacity
                  key={cId}
                  style={[styles.criterionTab, activeCriterion === cId && styles.criterionTabActive]}
                  onPress={() => setActiveCriterion(cId)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.criterionTabText, activeCriterion === cId && styles.criterionTabTextActive]}>
                    C{cId}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            </View>

            {/* Criterion title */}
            <Text style={styles.criterionTitle}>{activeCriterion}. {activeCriterionData?.name}</Text>

            {/* Metrics list */}
            <ScrollView contentContainerStyle={{ padding: tSpacing.base, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
              {activeCriterionData?.metrics.map(m => {
                const row = submissions[m.id];
                const status = row?.status ?? 'not_started';
                const cfg = STATUS_COLORS[status] ?? STATUS_COLORS.not_started;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.metricCard}
                    onPress={() => openMetric(m, activeCriterion)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.metricCode}>{m.id}</Text>
                      <Text style={styles.metricTitle}>{m.title}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <Text style={{ fontSize: 16, color: tColors.textTertiary, marginLeft: 6 }}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: tSpacing.base, paddingTop: Platform.OS === 'ios' ? 56 : tSpacing.base,
    paddingBottom: tSpacing.md,
    borderBottomWidth: 1, borderBottomColor: tColors.border,
    backgroundColor: tColors.card,
  },
  headerTitle: {
    fontSize: 15, fontWeight: typography.bold,
    color: tColors.textPrimary, textAlign: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  summaryRow: {
    flexDirection: 'row', backgroundColor: tColors.card,
    borderBottomWidth: 1, borderBottomColor: tColors.border,
    paddingVertical: tSpacing.md,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryCount: { fontSize: 22, fontWeight: typography.bold },
  summaryLabel: { fontSize: 11, color: tColors.textTertiary, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: tColors.border, marginVertical: 4 },

  criterionTabBarWrapper: {
    height: 48, flexShrink: 0,
    backgroundColor: tColors.card, borderBottomWidth: 1, borderBottomColor: tColors.border,
    zIndex: 1, elevation: 1,
  },
  criterionTabBar: {
    flex: 1,
  },
  criterionTab: {
    paddingHorizontal: tSpacing.md, paddingVertical: tSpacing.md,
    borderBottomWidth: 2, borderBottomColor: 'transparent', marginRight: 4,
  },
  criterionTabActive: { borderBottomColor: tColors.student.primary },
  criterionTabText: { fontSize: 13, color: tColors.textSecondary, fontWeight: typography.medium },
  criterionTabTextActive: { color: tColors.student.primary, fontWeight: typography.bold },

  criterionTitle: {
    fontSize: 13, fontWeight: typography.semibold,
    color: tColors.textSecondary, paddingHorizontal: tSpacing.base,
    paddingVertical: tSpacing.sm,
  },

  metricCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.lg, padding: tSpacing.base, marginBottom: tSpacing.md,
    ...shadows.card,
  },
  metricCode: { fontSize: 11, color: tColors.student.primary, fontWeight: typography.bold, marginBottom: 3 },
  metricTitle: { fontSize: 14, color: tColors.textPrimary, fontWeight: typography.semibold },

  statusPill: {
    borderRadius: tRadius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusPillText: { fontSize: 10, fontWeight: typography.bold },

  fieldLabel: {
    fontSize: 10, color: tColors.textSecondary, letterSpacing: 0.8,
    fontWeight: typography.bold, marginBottom: 6, marginTop: tSpacing.sm,
  },
  textArea: {
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md,
    color: tColors.textPrimary, fontSize: 14, marginBottom: tSpacing.md,
  },

  computedBadge: {
    alignSelf: 'flex-start', backgroundColor: tColors.student.primaryDim,
    borderRadius: tRadius.full, paddingHorizontal: 12, paddingVertical: 5,
    marginBottom: tSpacing.md,
  },
  computedBadgeText: { fontSize: 13, color: tColors.student.primary, fontWeight: typography.bold },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tSpacing.sm, marginBottom: tSpacing.md },
  chip: {
    borderWidth: 1, borderColor: tColors.border, borderRadius: tRadius.full,
    paddingHorizontal: 18, paddingVertical: 8, backgroundColor: tColors.card,
  },
  chipActive: { borderColor: tColors.student.primary, backgroundColor: tColors.student.primaryDim },
  chipText: { fontSize: 14, color: tColors.textSecondary, fontWeight: typography.medium },
  chipTextActive: { color: tColors.student.primary, fontWeight: typography.bold },

  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: tColors.student.primary, borderRadius: tRadius.md,
    paddingVertical: 11, marginBottom: tSpacing.base,
    backgroundColor: tColors.student.primaryDim,
  },
  generateBtnText: { fontSize: 14, color: tColors.student.primary, fontWeight: typography.semibold },

  generatedBox: {
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md, marginBottom: tSpacing.md,
    borderLeftWidth: 3, borderLeftColor: tColors.student.primary,
  },

  draftBtn: {
    flex: 1, paddingVertical: 13, borderRadius: tRadius.md,
    borderWidth: 1, borderColor: tColors.warning, alignItems: 'center',
  },
  draftBtnText: { fontSize: 14, color: tColors.warning, fontWeight: typography.semibold },
  completeBtn: {
    flex: 1, paddingVertical: 13, borderRadius: tRadius.md,
    backgroundColor: tColors.success, alignItems: 'center',
  },
  completeBtnText: { fontSize: 14, color: '#fff', fontWeight: typography.semibold },
});
