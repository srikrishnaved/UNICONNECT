import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, StyleSheet, Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { colors as tColors, typography, spacing as tSpacing, radius as tRadius } from '../theme/tokens';
import { BarChart2, CircleCheck, FolderOpen, X } from 'lucide-react-native';
import { useUniversityConfig } from '../hooks/useUniversityConfig';

export default function RosterUploadModal({ visible, onClose, defaultClassName, classOptions }) {
  const { classes } = useUniversityConfig();
  const [selectedClass, setSelectedClass] = useState(defaultClassName ?? '');
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fileName, setFileName] = useState('');
  const [step, setStep] = useState('pick');
  const [error, setError] = useState('');
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    if (visible) {
      setSelectedClass(defaultClassName ?? '');
      setRows([]);
      setHeaders([]);
      setFileName('');
      setStep('pick');
      setError('');
      setSavedCount(0);
    }
  }, [visible, defaultClassName]);

  const handleClose = () => {
    onClose();
  };

  const pickFile = async () => {
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
               'application/vnd.ms-excel', 'text/csv', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setFileName(asset.name ?? 'file');

      // On web, asset.file is a native File object — read as ArrayBuffer directly.
      // On native, fall back to expo-file-system base64.
      let wb;
      if (asset.file) {
        const buffer = await asset.file.arrayBuffer();
        wb = XLSX.read(buffer, { type: 'array' });
      } else {
        const b64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        wb = XLSX.read(b64, { type: 'base64' });
      }
      const ws = wb.Sheets[wb.SheetNames[0]];
      // Parse as 2D array first so we can detect whether row 0 is headers or data
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (!raw.length) {
        setError('File appears empty or could not be parsed.');
        return;
      }

      const firstRow = raw[0].map(c => String(c).trim());
      const HEADER_WORDS = /name|roll|reg|usn|prn|\bid\b|no\b|number|sl|email|class|course/i;
      const firstRowIsHeaders = firstRow.some(cell => HEADER_WORDS.test(cell));

      let hdrs, dataRows;
      if (firstRowIsHeaders) {
        hdrs = firstRow;
        dataRows = raw.slice(1);
      } else {
        // No header row — assign positional names; all rows are data
        hdrs = firstRow.map((_, i) => `col_${i}`);
        dataRows = raw;
        console.log('[RosterUploadModal] no header row detected — using positional col_0, col_1, …');
      }

      const parsed = dataRows
        .filter(row => row.some(cell => String(cell).trim() !== ''))
        .map(row => {
          const obj = {};
          hdrs.forEach((h, i) => { obj[h] = row[i] ?? ''; });
          return obj;
        });

      if (!parsed.length) {
        setError('File appears empty or could not be parsed.');
        return;
      }
      setHeaders(hdrs);
      setRows(parsed);
      setStep('preview');
    } catch (e) {
      setError(e?.message ?? 'Failed to read file.');
    }
  };

  const detectColumns = (hdrs, data) => {
    console.log('[RosterUploadModal] headers:', hdrs);

    // Positional layout (headerless file) — col_0 = identifier, col_1 = name
    const isPositional = hdrs.length > 0 && hdrs.every(h => /^col_\d+$/.test(h));
    if (isPositional) {
      const rollKey  = hdrs[0] ?? '';
      const nameKey  = hdrs[1] ?? '';
      const emailKey = hdrs[2] ?? '';
      console.log('[RosterUploadModal] positional layout →', { rollKey, nameKey, emailKey });
      return { nameKey, rollKey, emailKey };
    }

    // Named-header layout
    const nameKey = hdrs.find(k => /name/i.test(k)) ?? '';

    const identifierByHeader = hdrs.find(k =>
      /roll|reg|usn|prn|\bid\b|no\b|number|sl\b/i.test(k)
    );

    const sample = data.slice(0, 10);
    const identifierByValue = hdrs.find(k =>
      k !== nameKey &&
      sample.filter(r => /^\d{5,}$/.test(String(r[k] ?? '').trim())).length >= Math.min(3, sample.length)
    );

    // Last-resort: first column that isn't the name column
    const fallback = hdrs.find(h => h !== nameKey) ?? '';
    const rollKey  = identifierByHeader || identifierByValue || fallback || '';
    const emailKey = hdrs.find(k => /email/i.test(k)) ?? '';

    console.log('[RosterUploadModal] detection →', {
      nameKey, identifierByHeader, identifierByValue, fallback, rollKey, emailKey,
    });
    return { nameKey, rollKey, emailKey };
  };

  const saveRoster = async () => {
    if (!selectedClass) { setError('Please select a class before saving.'); return; }
    setStep('saving');
    setError('');
    try {
      const { nameKey, rollKey, emailKey } = detectColumns(headers, rows);

      const records = rows
        .map(row => ({
          class_name:  selectedClass,
          name:        String(row[nameKey] ?? '').trim(),
          identifier:  rollKey && rollKey !== nameKey
            ? (String(row[rollKey] ?? '').trim() || null)
            : null,
          email:       emailKey && emailKey !== nameKey
            ? (String(row[emailKey] ?? '').trim().toLowerCase() || null)
            : null,
        }))
        .filter(r => r.name);

      console.log('[RosterUploadModal] records to upsert:', records.length, records.slice(0, 3));

      const { error: dbErr } = await supabase
        .from('class_students')
        .upsert(records, { onConflict: 'class_name,identifier' });

      if (dbErr) throw new Error(dbErr.message);
      setSavedCount(records.length);
      setStep('done');
    } catch (e) {
      setError(e?.message ?? 'Save failed.');
      setStep('preview');
    }
  };

  const PREVIEW_LIMIT = 6;
  const showClassPicker = !defaultClassName;
  const pickerClasses = classOptions ?? classes;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={handleClose} activeOpacity={1} />
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.header}>
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}><BarChart2 size={18} color={tColors.textPrimary} /><Text style={styles.title}>Upload Roster</Text></View>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.7} style={styles.closeBtn}>
              <X size={18} color={tColors.textSecondary} />
            </TouchableOpacity>
          </View>

          {step === 'done' ? (
            <View style={styles.centeredBody}>
              <CircleCheck size={40} color={tColors.success} />
              <Text style={styles.doneText}>{savedCount} student{savedCount !== 1 ? 's' : ''} saved</Text>
              <Text style={styles.doneSubtext}>Roster uploaded for {selectedClass}</Text>
              <TouchableOpacity style={[styles.primaryBtn, { marginTop: 24 }]} onPress={handleClose} activeOpacity={0.8}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : step === 'saving' ? (
            <View style={styles.centeredBody}>
              <ActivityIndicator color={tColors.student.primary} size="large" />
              <Text style={[styles.doneSubtext, { marginTop: 16 }]}>Saving roster…</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Class selector — only when no defaultClassName is passed */}
              {showClassPicker && (
                <View style={styles.section}>
                  <Text style={styles.label}>Class</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                    <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                      {pickerClasses.map(cls => (
                        <TouchableOpacity
                          key={cls}
                          style={[styles.chip, selectedClass === cls && styles.chipActive]}
                          onPress={() => setSelectedClass(cls)}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.chipText, selectedClass === cls && styles.chipTextActive]}>{cls}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  {!selectedClass && <Text style={styles.hint}>Select a class to link this roster</Text>}
                </View>
              )}

              {defaultClassName && (
                <View style={styles.section}>
                  <Text style={styles.label}>Class</Text>
                  <View style={[styles.chip, styles.chipActive, { alignSelf: 'flex-start', marginTop: 6 }]}>
                    <Text style={styles.chipTextActive}>{defaultClassName}</Text>
                  </View>
                </View>
              )}

              {/* File picker */}
              <View style={styles.section}>
                <Text style={styles.label}>Excel / CSV File</Text>
                <TouchableOpacity style={styles.filePicker} onPress={pickFile} activeOpacity={0.8}>
                  <FolderOpen size={24} color={tColors.textSecondary} />
                  <Text style={styles.filePickerText}>
                    {fileName ? fileName : 'Tap to choose file (.xlsx · .xls · .csv)'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Preview */}
              {step === 'preview' && rows.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.previewHeader}>
                    <Text style={styles.label}>Preview</Text>
                    <Text style={styles.rowCount}>{rows.length} rows</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: 8 }}>
                    <View>
                      {/* Column headers */}
                      <View style={styles.tableRow}>
                        {headers.map(h => (
                          <Text key={h} style={[styles.tableCell, styles.tableHeader]}>{h}</Text>
                        ))}
                      </View>
                      {/* Data rows */}
                      {rows.slice(0, PREVIEW_LIMIT).map((row, i) => (
                        <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                          {headers.map(h => (
                            <Text key={h} style={styles.tableCell} numberOfLines={1}>{String(row[h] ?? '')}</Text>
                          ))}
                        </View>
                      ))}
                      {rows.length > PREVIEW_LIMIT && (
                        <Text style={styles.moreRows}>… and {rows.length - PREVIEW_LIMIT} more rows</Text>
                      )}
                    </View>
                  </ScrollView>
                </View>
              )}

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              {step === 'preview' && (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setStep('pick'); setRows([]); setFileName(''); }} activeOpacity={0.8}>
                    <Text style={styles.secondaryBtnText}>Re-pick</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryBtn} onPress={saveRoster} activeOpacity={0.8}>
                    <Text style={styles.primaryBtnText}>Save Roster</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ height: Platform.OS === 'ios' ? 32 : 16 }} />
            </ScrollView>
          )}
        </View>
      </View>
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
    borderWidth: 1,
    borderColor: tColors.border,
    paddingHorizontal: tSpacing.base,
    paddingTop: tSpacing.base,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tSpacing.base,
  },
  title: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: tColors.textPrimary,
  },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 20, color: tColors.textSecondary },

  section: { marginBottom: tSpacing.base },
  label: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    color: tColors.textSecondary,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  hint: { fontSize: 11, color: tColors.textTertiary, marginTop: 4 },

  chip: {
    paddingHorizontal: tSpacing.md,
    paddingVertical: 6,
    borderRadius: tRadius.full,
    backgroundColor: tColors.bg,
    borderWidth: 1,
    borderColor: tColors.border,
  },
  chipActive: {
    backgroundColor: tColors.student.primaryDim,
    borderColor: tColors.student.primary,
  },
  chipText: { fontSize: 12, color: tColors.textSecondary, fontWeight: typography.medium },
  chipTextActive: { color: tColors.student.primary, fontWeight: typography.semibold },

  filePicker: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tColors.bg,
    borderWidth: 1,
    borderColor: tColors.border,
    borderRadius: tRadius.md,
    padding: tSpacing.base,
    borderStyle: 'dashed',
  },
  filePickerIcon: { fontSize: 20 },
  filePickerText: { flex: 1, fontSize: 13, color: tColors.textSecondary },

  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowCount: { fontSize: 12, color: tColors.student.primary, fontWeight: typography.semibold },

  tableRow: { flexDirection: 'row' },
  tableRowAlt: { backgroundColor: tColors.cardAlt },
  tableHeader: { backgroundColor: tColors.cardAlt, fontWeight: typography.bold, color: tColors.textSecondary, fontSize: 11 },
  tableCell: {
    width: 120,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: tColors.textPrimary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tColors.border,
  },
  moreRows: { fontSize: 11, color: tColors.textTertiary, padding: 8, fontStyle: 'italic' },

  errorText: {
    color: tColors.error,
    fontSize: 13,
    marginBottom: tSpacing.md,
    paddingHorizontal: 4,
  },

  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: tSpacing.md,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: tColors.student.primary,
    borderRadius: tRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: typography.bold },
  secondaryBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: tColors.border,
    borderRadius: tRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryBtnText: { color: tColors.textSecondary, fontSize: 14, fontWeight: typography.semibold },

  centeredBody: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: tSpacing.base,
  },
  doneText: { fontSize: typography.lg, fontWeight: typography.bold, color: tColors.textPrimary },
  doneSubtext: { fontSize: 13, color: tColors.textSecondary, marginTop: 4 },
});
