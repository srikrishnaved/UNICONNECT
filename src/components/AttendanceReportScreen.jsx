import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, StyleSheet, TextInput,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors as tColors, typography, spacing as tSpacing, radius as tRadius } from '../theme/tokens';
import { ALL_CLASSES } from '../lib/subjectUtils';

export default function AttendanceReportScreen({ visible, onClose, mode, defaultClass, userProfile }) {
  const [records, setRecords] = useState([]);
  const [summaryMap, setSummaryMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastError, setToastError] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null); // session_id being confirmed for delete
  const [deleting, setDeleting] = useState(false);

  // Filters — default to first class, never "All Classes"
  const [filterClass, setFilterClass] = useState(defaultClass || ALL_CLASSES[0] || '');
  const [filterDate, setFilterDate] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');

  useEffect(() => {
    if (visible) {
      setFilterClass(defaultClass || ALL_CLASSES[0] || '');
      setFilterDate('');
      setFilterTeacher('');
      setError('');
    }
  }, [visible, defaultClass]);

  useEffect(() => {
    if (visible) load();
  }, [visible, filterClass, filterDate, filterTeacher]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      let flat = [];

      if (mode === 'student' && userProfile?.name) {
        let q = supabase
          .from('attendance_records')
          .select('status, class_students!inner(name, identifier), attendance_sessions!inner(class_name, subject, period_label, session_date)')
          .ilike('class_students.name', `%${userProfile.name}%`)
          .limit(200);

        if (filterDate) q = q.eq('attendance_sessions.session_date', filterDate);

        const { data, error: dbErr } = await q;
        if (dbErr) throw new Error(dbErr.message);

        flat = (data || []).map(r => ({
          date:         r.attendance_sessions?.session_date ?? '',
          period_name:  r.attendance_sessions?.period_label ?? '',
          class_name:   r.attendance_sessions?.class_name ?? '',
          course_name:  r.attendance_sessions?.subject ?? '',
          teacher_name: null,
          status:       r.status,
          student_name: r.class_students?.name ?? '',
          identifier:   r.class_students?.identifier ?? null,
          student_id:   null,
        }));

        flat.sort((a, b) => b.date.localeCompare(a.date));
        setSummaryMap({});
      } else {
        let q = supabase
          .from('attendance_sessions')
          .select('id, teacher_id, class_name, subject, period_label, session_date, attendance_records(status, student_id, class_students(name, identifier))')
          .order('session_date', { ascending: false })
          .order('period_label', { ascending: true })
          .limit(50);

        if (filterClass) q = q.eq('class_name', filterClass);
        if (filterDate)  q = q.eq('session_date', filterDate);

        const { data, error: dbErr } = await q;
        if (dbErr) throw new Error(dbErr.message);

        (data || []).forEach(session => {
          (session.attendance_records || []).forEach(rec => {
            flat.push({
              date:               session.session_date,
              period_name:        session.period_label ?? '',
              class_name:         session.class_name,
              course_name:        session.subject ?? '',
              teacher_name:       null,
              status:             rec.status,
              student_name:       rec.class_students?.name ?? '',
              identifier:         rec.class_students?.identifier ?? null,
              student_id:         rec.student_id ?? null,
              session_id:         session.id,
              session_teacher_id: session.teacher_id ?? null,
            });
          });
        });

        // Compute per-student per-subject cumulative attendance from raw records
        if (filterClass) {
          const { data: allRecs } = await supabase
            .from('attendance_records')
            .select('student_id, status, attendance_sessions!inner(subject, class_name)')
            .eq('attendance_sessions.class_name', filterClass);

          const counts = {};
          (allRecs || []).forEach(rec => {
            const subject = rec.attendance_sessions?.subject;
            if (rec.student_id == null || !subject) return;
            const key = `${rec.student_id}||${subject}`;
            if (!counts[key]) counts[key] = { present: 0, total: 0 };
            counts[key].total++;
            if (rec.status === 'present') counts[key].present++;
          });

          const map = {};
          Object.entries(counts).forEach(([key, { present, total }]) => {
            map[key] = total > 0 ? Math.round((present / total) * 100) : 0;
          });
          setSummaryMap(map);
        } else {
          setSummaryMap({});
        }
      }

      setRecords(flat);
    } catch (e) {
      setError(e?.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  };

  const grouped = records.reduce((acc, r) => {
    const key = `${r.date}||${r.period_name || '—'}||${r.class_name}`;
    if (!acc[key]) acc[key] = { date: r.date, period: r.period_name, class_name: r.class_name, course_name: r.course_name, teacher_name: r.teacher_name, session_id: r.session_id, teacher_id: r.session_teacher_id, rows: [] };
    acc[key].rows.push(r);
    return acc;
  }, {});
  const sessions = Object.values(grouped);

  const presentTotal = records.filter(r => r.status === 'present').length;
  const absentTotal  = records.filter(r => r.status === 'absent').length;

  const title = mode === 'teacher' ? '📋 My Attendance Records'
    : mode === 'admin' ? '📋 Attendance Reports'
    : '📋 My Attendance';

  const cumBadgeColor = (p) =>
    p >= 85 ? tColors.success : p >= 75 ? tColors.warning : tColors.error;
  const cumBadgeBg = (p) =>
    p >= 85 ? tColors.successDim : p >= 75 ? tColors.warningDim : tColors.errorDim;

  const showToast = (msg, isError = false) => {
    setToastMsg(msg);
    setToastError(isError);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const confirmDelete = async (session) => {
    setDeleting(true);
    try {
      // Delete records first to avoid FK constraint issues
      const { error: recErr } = await supabase
        .from('attendance_records')
        .delete()
        .eq('session_id', session.session_id);
      if (recErr) throw new Error(recErr.message);

      const { error: sesErr } = await supabase
        .from('attendance_sessions')
        .delete()
        .eq('id', session.session_id);
      if (sesErr) throw new Error(sesErr.message);

      setRecords(prev => prev.filter(r => r.session_id !== session.session_id));
      setConfirmingId(null);
      showToast('Session deleted');
    } catch (e) {
      showToast(e?.message ?? 'Delete failed', true);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {userProfile?.name && mode !== 'admin' && (
                <Text style={styles.subtitle}>{userProfile.name}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Filters */}
          <View style={styles.filtersRow}>
            {mode !== 'student' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: tSpacing.sm }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {ALL_CLASSES.map(cls => (
                    <TouchableOpacity
                      key={cls}
                      style={[styles.chip, filterClass === cls && styles.chipActive]}
                      onPress={() => setFilterClass(cls)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, filterClass === cls && styles.chipTextActive]}>{cls}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: tSpacing.sm }}>
              <TextInput
                value={filterDate}
                onChangeText={setFilterDate}
                placeholder="Filter by date (YYYY-MM-DD)"
                placeholderTextColor={tColors.textTertiary}
                style={[styles.filterInput, { flex: 1 }]}
              />
              {mode === 'admin' && (
                <TextInput
                  value={filterTeacher}
                  onChangeText={setFilterTeacher}
                  placeholder="Teacher name"
                  placeholderTextColor={tColors.textTertiary}
                  style={[styles.filterInput, { flex: 1 }]}
                />
              )}
            </View>
          </View>

          {/* Summary bar */}
          {records.length > 0 && (
            <View style={styles.summaryBar}>
              <Text style={[styles.summaryNum, { color: tColors.success }]}>{presentTotal}</Text>
              <Text style={styles.summaryLabel}> Present</Text>
              <Text style={styles.summarySep}>·</Text>
              <Text style={[styles.summaryNum, { color: tColors.error }]}>{absentTotal}</Text>
              <Text style={styles.summaryLabel}> Absent</Text>
            </View>
          )}

          {/* Content */}
          {loading ? (
            <View style={styles.centeredBody}>
              <ActivityIndicator color={tColors.student.primary} size="large" />
            </View>
          ) : error ? (
            <View style={styles.centeredBody}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={load} activeOpacity={0.8} style={[styles.chip, styles.chipActive, { marginTop: 16 }]}>
                <Text style={styles.chipTextActive}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : sessions.length === 0 ? (
            <View style={styles.centeredBody}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>📭</Text>
              <Text style={styles.emptyText}>No records found</Text>
              <Text style={styles.emptySubtext}>
                {mode === 'student'
                  ? 'Your teacher hasn\'t recorded attendance yet'
                  : 'No attendance has been recorded for this selection'}
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {sessions.map((session, si) => {
                const canDelete = userProfile?.is_super_admin === true || session.teacher_id === userProfile?.id;
                const isConfirming = confirmingId === si;
                return (
                  <View key={si} style={styles.sessionCard}>
                    {/* Session header */}
                    <View style={styles.sessionHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sessionClass}>{session.class_name}</Text>
                        {session.course_name ? (
                          <Text style={styles.sessionCourse} numberOfLines={1}>{session.course_name}</Text>
                        ) : null}
                        <Text style={styles.sessionMeta}>
                          {session.date}{session.period ? ` · ${session.period}` : ''}
                          {mode === 'admin' && session.teacher_name ? ` · ${session.teacher_name}` : ''}
                        </Text>
                      </View>
                    </View>

                    {mode === 'student' ? (
                      session.rows.map((r, i) => (
                        <View key={i} style={styles.studentRow}>
                          <Text style={styles.studentName}>{r.class_name}{r.period_name ? ` · ${r.period_name}` : ''}</Text>
                          <View style={[styles.statusBadge, r.status === 'present' ? styles.statusPresent : styles.statusAbsent]}>
                            <Text style={[styles.statusText, { color: r.status === 'present' ? tColors.success : tColors.error }]}>
                              {r.status === 'present' ? 'Present' : 'Absent'}
                            </Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      session.rows.map((r, i) => {
                        const cumPct = r.student_id != null ? summaryMap[`${r.student_id}||${session.course_name}`] : undefined;
                        return (
                          <View key={i} style={[styles.studentRow, i % 2 === 1 && { backgroundColor: tColors.cardAlt }]}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.studentName}>{r.student_name}</Text>
                              {r.identifier ? <Text style={styles.studentId}>{r.identifier}</Text> : null}
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              {cumPct != null && (
                                <View style={[styles.cumBadge, { backgroundColor: cumBadgeBg(cumPct), borderColor: cumBadgeColor(cumPct) }]}>
                                  <Text style={[styles.cumBadgeText, { color: cumBadgeColor(cumPct) }]}>{cumPct}%</Text>
                                </View>
                              )}
                              <View style={[styles.statusBadge, r.status === 'present' ? styles.statusPresent : styles.statusAbsent]}>
                                <Text style={[styles.statusText, { color: r.status === 'present' ? tColors.success : tColors.error }]}>
                                  {r.status === 'present' ? 'Present' : 'Absent'}
                                </Text>
                              </View>
                            </View>
                          </View>
                        );
                      })
                    )}

                    {/* Delete footer — rendered outside the overflow:hidden header */}
                    {canDelete && (
                      isConfirming ? (
                        <View style={styles.deleteFooter}>
                          <Text style={styles.deleteFooterWarning}>Delete this session? This cannot be undone.</Text>
                          <View style={styles.deleteFooterBtns}>
                            <TouchableOpacity
                              style={styles.confirmCancel}
                              onPress={() => setConfirmingId(null)}
                              activeOpacity={0.7}
                              disabled={deleting}
                            >
                              <Text style={styles.confirmCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.confirmDelete, deleting && { opacity: 0.5 }]}
                              onPress={() => confirmDelete(session)}
                              activeOpacity={0.7}
                              disabled={deleting}
                            >
                              {deleting
                                ? <ActivityIndicator color="#fff" size="small" style={{ width: 50 }} />
                                : <Text style={styles.confirmDeleteText}>Confirm Delete</Text>
                              }
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.deleteFooterBtn}
                          onPress={() => setConfirmingId(si)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.deleteFooterBtnText}>🗑 Delete session</Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                );
              })}
              <View style={{ height: 32 }} />
            </ScrollView>
          )}
          {!!toastMsg && (
            <View style={[styles.toast, toastError && { backgroundColor: tColors.error }]} pointerEvents="none">
              <Text style={styles.toastText}>{toastError ? '✕' : '✓'} {toastMsg}</Text>
            </View>
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
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: tSpacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tColors.border,
  },
  title: { fontSize: typography.md, fontWeight: typography.bold, color: tColors.textPrimary },
  subtitle: { fontSize: 12, color: tColors.textSecondary, marginTop: 2 },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 20, color: tColors.textSecondary },

  filtersRow: { paddingHorizontal: tSpacing.base, paddingTop: tSpacing.sm },
  filterInput: {
    backgroundColor: tColors.bg,
    borderWidth: 1,
    borderColor: tColors.border,
    borderRadius: tRadius.md,
    padding: tSpacing.sm,
    fontSize: 13,
    color: tColors.textPrimary,
  },

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

  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tSpacing.base,
    paddingVertical: tSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tColors.border,
  },
  summaryNum: { fontSize: 15, fontWeight: typography.bold },
  summaryLabel: { fontSize: 13, color: tColors.textSecondary },
  summarySep: { fontSize: 13, color: tColors.textTertiary, marginHorizontal: 6 },

  sessionCard: {
    marginHorizontal: tSpacing.base,
    marginTop: tSpacing.base,
    borderRadius: tRadius.md,
    borderWidth: 1,
    borderColor: tColors.border,
    overflow: 'hidden',        // keeps stripe rows clipped to radius
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tSpacing.md,
    backgroundColor: tColors.cardAlt,
    gap: tSpacing.sm,
  },
  sessionClass: { fontSize: 14, fontWeight: typography.bold, color: tColors.textPrimary },
  sessionCourse: { fontSize: 12, color: tColors.textSecondary, marginTop: 1 },
  sessionMeta: { fontSize: 11, color: tColors.textTertiary, marginTop: 2 },
  deleteFooterBtn: {
    paddingVertical: 10,
    paddingHorizontal: tSpacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: tColors.border,
    alignItems: 'center',
  },
  deleteFooterBtnText: { fontSize: 12, color: tColors.error, fontWeight: typography.medium },

  deleteFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: tColors.border,
    padding: tSpacing.md,
    gap: 8,
  },
  deleteFooterWarning: { fontSize: 12, color: tColors.textSecondary, textAlign: 'center' },
  deleteFooterBtns: { flexDirection: 'row', justifyContent: 'center', gap: 8 },

  confirmCancel: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: tRadius.sm,
    borderWidth: 1,
    borderColor: tColors.border,
  },
  confirmCancelText: { fontSize: 13, color: tColors.textSecondary, fontWeight: typography.medium },
  confirmDelete: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: tRadius.sm,
    backgroundColor: tColors.error,
  },
  confirmDeleteText: { fontSize: 13, color: '#fff', fontWeight: typography.semibold },

  toast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: tColors.success,
    borderRadius: tRadius.full,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: typography.semibold },

  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tSpacing.md,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: tColors.border,
  },
  studentName: { fontSize: 13, fontWeight: typography.medium, color: tColors.textPrimary },
  studentId: { fontSize: 11, color: tColors.textTertiary, marginTop: 1 },

  cumBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: tRadius.full,
    borderWidth: 1,
  },
  cumBadgeText: { fontSize: 10, fontWeight: typography.bold },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tRadius.full,
    borderWidth: 1,
  },
  statusPresent: { backgroundColor: tColors.successDim, borderColor: tColors.success },
  statusAbsent: { backgroundColor: tColors.errorDim, borderColor: tColors.error },
  statusText: { fontSize: 11, fontWeight: typography.semibold },

  errorText: { color: tColors.error, fontSize: 13 },

  centeredBody: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: typography.md, fontWeight: typography.bold, color: tColors.textPrimary },
  emptySubtext: { fontSize: 13, color: tColors.textSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: tSpacing.xl },
});
