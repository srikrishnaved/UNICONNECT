import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, StyleSheet, Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors as tColors, typography, spacing as tSpacing, radius as tRadius } from '../theme/tokens';

export default function TakeAttendanceScreen({ visible, onClose, slot, teacherName, subject, periodLabel }) {
  const className = slot?.class_name;
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && className) {
      loadStudents();
      setSubmitted(false);
      setError('');
    }
  }, [visible, className]);

  const loadStudents = async () => {
    setLoading(true);
    const { data, error: dbErr } = await supabase
      .from('class_students')
      .select('id, name, identifier, email')
      .eq('class_name', className)
      .order('name');
    if (dbErr) {
      setError(dbErr.message);
      setLoading(false);
      return;
    }
    const rows = data || [];
    setStudents(rows);
    const init = {};
    rows.forEach(s => { init[s.id] = 'present'; });
    setAttendance(init);
    setLoading(false);
  };

  const toggle = (id) => {
    setAttendance(prev => ({ ...prev, [id]: prev[id] === 'present' ? 'absent' : 'present' }));
  };

  const markAll = (status) => {
    const next = {};
    students.forEach(s => { next[s.id] = status; });
    setAttendance(next);
  };

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const teacherId = user?.id ?? null;
      const sessionDate = new Date().toLocaleDateString('en-CA');

      // Step 1 — create the session
      const { data: sessionRows, error: sessionErr } = await supabase
        .from('attendance_sessions')
        .insert({
          teacher_id:   teacherId,
          class_name:   className,
          subject:      subject || null,
          period_label: periodLabel || null,
          session_date: sessionDate,
          is_finalized: true,
        })
        .select('id')
        .single();

      if (sessionErr) throw new Error(sessionErr.message);

      const sessionId = sessionRows.id;

      // Step 2 — bulk insert one record per student
      // student_id is the UUID id from class_students, keyed in the attendance map
      const attendanceRecords = students.map(s => ({
        session_id: sessionId,
        student_id: s.id,
        status:     attendance[s.id] || 'absent',
        marked_by:  teacherId,
      }));

      const { error: recordsErr } = await supabase
        .from('attendance_records')
        .insert(attendanceRecords);

      if (recordsErr) throw new Error(recordsErr.message);

      setSubmitted(true);
    } catch (e) {
      setError(e?.message ?? 'Submit failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const presentCount = Object.values(attendance).filter(v => v === 'present').length;
  const absentCount = students.length - presentCount;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>🎯 Attendance</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {className}{subject ? ` · ${subject}` : ''}{periodLabel ? ` · ${periodLabel}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {submitted ? (
            <View style={styles.centeredBody}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
              <Text style={styles.doneText}>Attendance Saved</Text>
              <Text style={styles.doneSubtext}>{presentCount} present · {absentCount} absent</Text>
              <TouchableOpacity style={[styles.primaryBtn, { marginTop: 24 }]} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : loading ? (
            <View style={styles.centeredBody}>
              <ActivityIndicator color={tColors.student.primary} size="large" />
              <Text style={[styles.doneSubtext, { marginTop: 16 }]}>Loading students…</Text>
            </View>
          ) : students.length === 0 && !loading ? (
            <View style={styles.centeredBody}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>📋</Text>
              <Text style={styles.doneText}>No students found</Text>
              <Text style={styles.doneSubtext}>Upload a roster for {className} first</Text>
              <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 24 }]} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.secondaryBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Summary bar + bulk actions */}
              <View style={styles.summaryBar}>
                <View style={styles.summaryCount}>
                  <Text style={[styles.summaryNum, { color: tColors.success }]}>{presentCount}</Text>
                  <Text style={styles.summaryLabel}>Present</Text>
                </View>
                <View style={styles.summaryCount}>
                  <Text style={[styles.summaryNum, { color: tColors.error }]}>{absentCount}</Text>
                  <Text style={styles.summaryLabel}>Absent</Text>
                </View>
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={styles.bulkBtn} onPress={() => markAll('present')} activeOpacity={0.7}>
                  <Text style={styles.bulkBtnText}>All Present</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bulkBtn, { marginLeft: 6, borderColor: tColors.error }]}
                  onPress={() => markAll('absent')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.bulkBtnText, { color: tColors.error }]}>All Absent</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {students.map((s, i) => {
                  const isPresent = attendance[s.id] === 'present';
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.studentRow, i % 2 === 1 && styles.studentRowAlt]}
                      onPress={() => toggle(s.id)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.studentName}>{s.name}</Text>
                        {s.identifier ? (
                          <Text style={styles.studentId}>{s.identifier}</Text>
                        ) : null}
                      </View>
                      <View style={[styles.statusBadge, isPresent ? styles.statusPresent : styles.statusAbsent]}>
                        <Text style={[styles.statusText, { color: isPresent ? tColors.success : tColors.error }]}>
                          {isPresent ? 'Present' : 'Absent'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <View style={{ height: Platform.OS === 'ios' ? 32 : 16 }} />
              </ScrollView>

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[styles.primaryBtn, { margin: tSpacing.base }, submitting && { opacity: 0.6 }]}
                onPress={submit}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.primaryBtnText}>Submit Attendance</Text>
                }
              </TouchableOpacity>
            </>
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
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: tSpacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tColors.border,
  },
  title: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: tColors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: tColors.textSecondary,
    marginTop: 2,
  },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 20, color: tColors.textSecondary },

  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tSpacing.base,
    paddingVertical: tSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tColors.border,
    gap: tSpacing.md,
  },
  summaryCount: { alignItems: 'center' },
  summaryNum: { fontSize: 20, fontWeight: typography.bold },
  summaryLabel: {
    fontSize: 10,
    color: tColors.textTertiary,
    fontWeight: typography.semibold,
    letterSpacing: 0.5,
  },
  bulkBtn: {
    borderWidth: 1,
    borderColor: tColors.success,
    borderRadius: tRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bulkBtnText: {
    fontSize: 11,
    fontWeight: typography.semibold,
    color: tColors.success,
  },

  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tSpacing.base,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tColors.border,
  },
  studentRowAlt: { backgroundColor: tColors.cardAlt },
  studentName: {
    fontSize: 14,
    fontWeight: typography.medium,
    color: tColors.textPrimary,
  },
  studentId: {
    fontSize: 11,
    color: tColors.textTertiary,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tRadius.full,
    borderWidth: 1,
  },
  statusPresent: {
    backgroundColor: tColors.successDim,
    borderColor: tColors.success,
  },
  statusAbsent: {
    backgroundColor: tColors.errorDim,
    borderColor: tColors.error,
  },
  statusText: { fontSize: 12, fontWeight: typography.semibold },

  errorText: {
    color: tColors.error,
    fontSize: 13,
    paddingHorizontal: tSpacing.base,
    marginBottom: tSpacing.sm,
  },

  primaryBtn: {
    backgroundColor: tColors.student.primary,
    borderRadius: tRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: typography.bold },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: tColors.border,
    borderRadius: tRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    paddingHorizontal: tSpacing.xl,
  },
  secondaryBtnText: {
    color: tColors.textSecondary,
    fontSize: 14,
    fontWeight: typography.semibold,
  },

  centeredBody: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: tSpacing.base,
  },
  doneText: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: tColors.textPrimary,
  },
  doneSubtext: {
    fontSize: 13,
    color: tColors.textSecondary,
    marginTop: 4,
  },
});
