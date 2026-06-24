import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { students, studyGroups, hubClubs, tutors, teachers, pendingClubs as seedPending } from '../data';
import { colors, spacing, radius, font } from '../theme';
import { EmptyState } from '../components/EmptyState';
import { Shield } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

const STATS = [
  { label: 'Students',     value: students.length,                              icon: '👥' },
  { label: 'Study Groups', value: studyGroups.length,                           icon: '📚' },
  { label: 'Clubs',        value: hubClubs.filter(c => c.type === 'Club').length, icon: '🏛️' },
  { label: 'Teams',        value: hubClubs.filter(c => c.type === 'Team').length, icon: '⚡' },
  { label: 'Tutors',       value: tutors.length,                                icon: '🎓' },
  { label: 'Teachers',     value: teachers.length,                              icon: '📖' },
];

export default function AdminDashboardScreen({ onEnterApp, onSignOut }) {
  const { clubAdminRequests, resolveClubAdminRequest, userProfile } = useApp();
  const [pending, setPending] = useState(seedPending);
  const [approved, setApproved] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [rememberMe, setRememberMe] = useState(true);
  const [facultyRequests, setFacultyRequests] = useState([]);
  const [permRooms, setPermRooms] = useState([]);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [reports, setReports] = useState([]);
  const [roomName, setRoomName] = useState('');
  const [roomSubject, setRoomSubject] = useState('');
  const [roomEmoji, setRoomEmoji] = useState('📚');
  const [roomCreating, setRoomCreating] = useState(false);

  const ROOM_EMOJIS = ['📚', '✏️', '🧮', '📊', '💡', '🔬', '📖', '🎯'];

  const loadPermRooms = () => {
    supabase
      .from('study_rooms')
      .select('*')
      .eq('is_permanent', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPermRooms(data || []));
  };

  const loadReports = () => {
    supabase
      .from('reports')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data }) => setReports(data || []));
  };

  const resolveReport = async (id, action) => {
    await supabase.from('reports').update({ status: action }).eq('id', id);
    setReports(prev => prev.filter(r => r.id !== id));
  };

  useEffect(() => {
    supabase
      .from('faculty_club_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data }) => setFacultyRequests(data || []));
    loadPermRooms();
    loadReports();
  }, []);

  const resolveFacultyRequest = async (req, action) => {
    const status = action === 'approve' ? 'approved' : 'rejected';
    await supabase
      .from('faculty_club_requests')
      .update({ status })
      .eq('id', req.id);
    if (action === 'approve') {
      await supabase.from('faculty_coordinators').upsert(
        {
          teacher_name: req.teacher_name,
          teacher_id: req.teacher_id ? String(req.teacher_id) : null,
          club_id: String(req.club_id),
          club_name: req.club_name || null,
          assigned_by: userProfile?.id ?? null,
        },
        { onConflict: 'teacher_name,club_id' },
      );
    }
    setFacultyRequests(prev => prev.filter(r => r.id !== req.id));
  };

  const createPermRoom = async () => {
    if (!roomName.trim()) return;
    setRoomCreating(true);
    const { error } = await supabase.from('study_rooms').insert({
      name: roomName.trim(),
      subject: roomSubject.trim() || null,
      emoji: roomEmoji,
      creator_id: null,
      creator_name: 'Admin',
      is_permanent: true,
    });
    setRoomCreating(false);
    if (!error) {
      setShowRoomModal(false);
      setRoomName('');
      setRoomSubject('');
      setRoomEmoji('📚');
      loadPermRooms();
    }
  };

  const deletePermRoom = async (id) => {
    await supabase.from('study_rooms').delete().eq('id', id);
    setPermRooms(prev => prev.filter(r => r.id !== id));
  };

  const handleApprove = (item) => {
    setPending(prev => prev.filter(p => p.id !== item.id));
    setApproved(prev => prev + 1);
  };

  const handleReject = (item) => {
    setPending(prev => prev.filter(p => p.id !== item.id));
    setRejected(prev => prev + 1);
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>✦</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Admin Panel</Text>
            <Text style={styles.headerSub}>ChristConnect · Christ University</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut} activeOpacity={0.7}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Stats */}
        <Text style={styles.sectionLabel}>📊 OVERVIEW</Text>
        <View style={styles.statsGrid}>
          {STATS.map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statIcon}>{s.icon}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Pending approvals */}
        <View style={styles.approvalHeader}>
          <Text style={styles.sectionLabel}>⏳ PENDING APPROVALS</Text>
          <View style={styles.approvalPills}>
            <View style={[styles.countPill, { borderColor: colors.amber }]}>
              <Text style={[styles.countPillText, { color: colors.amber }]}>{pending.length} pending</Text>
            </View>
            <View style={[styles.countPill, { borderColor: colors.green }]}>
              <Text style={[styles.countPillText, { color: colors.green }]}>{approved} approved</Text>
            </View>
            <View style={[styles.countPill, { borderColor: colors.red }]}>
              <Text style={[styles.countPillText, { color: colors.red }]}>{rejected} rejected</Text>
            </View>
          </View>
        </View>

        {pending.length === 0 ? (
          <EmptyState icon={Shield} heading="Nothing to review" subtext="All requests have been handled" />
        ) : (
          pending.map(item => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>{item.type.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.cardApplicant}>
                Applied by{' '}
                <Text style={styles.cardApplicantBold}>{item.applicant}</Text>
              </Text>
              <Text style={styles.cardMeta}>
                {item.course} · {item.year} · Submitted {item.submitted}
              </Text>
              <Text style={styles.cardDesc}>{item.desc}</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => handleApprove(item)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.approveBtnText}>✓ Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleReject(item)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.rejectBtnText}>✗ Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Club Admin Requests */}
        <View style={styles.approvalHeader}>
          <Text style={styles.sectionLabel}>🛡️ CLUB ADMIN REQUESTS</Text>
          <View style={styles.approvalPills}>
            <View style={[styles.countPill, { borderColor: colors.amber }]}>
              <Text style={[styles.countPillText, { color: colors.amber }]}>{clubAdminRequests.length} pending</Text>
            </View>
          </View>
        </View>

        {clubAdminRequests.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyTitle}>No requests</Text>
            <Text style={styles.emptyDesc}>Students haven't requested club admin access yet.</Text>
          </View>
        ) : (
          clubAdminRequests.map(req => (
            <View key={req.id} style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>{req.clubName}</Text>
                <View style={[styles.typePill, { backgroundColor: colors.amberLight }]}>
                  <Text style={[styles.typePillText, { color: colors.amber }]}>STUDENT REQUEST</Text>
                </View>
              </View>
              <Text style={styles.cardApplicant}>
                Requested by <Text style={styles.cardApplicantBold}>{req.studentName}</Text>
              </Text>
              <Text style={styles.cardMeta}>{req.course} · {req.year} · Submitted {req.submitted}</Text>
              <Text style={styles.cardDesc}>"{req.reason}"</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => resolveClubAdminRequest(req.id, 'approve')} activeOpacity={0.85}>
                  <Text style={styles.approveBtnText}>✓ Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => resolveClubAdminRequest(req.id, 'reject')} activeOpacity={0.85}>
                  <Text style={styles.rejectBtnText}>✗ Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Faculty Coordinator Requests */}
        <View style={styles.approvalHeader}>
          <Text style={styles.sectionLabel}>👩‍🏫 FACULTY COORDINATOR REQUESTS</Text>
          <View style={styles.approvalPills}>
            <View style={[styles.countPill, { borderColor: colors.primary }]}>
              <Text style={[styles.countPillText, { color: colors.primary }]}>{facultyRequests.length} pending</Text>
            </View>
          </View>
        </View>

        {facultyRequests.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>👩‍🏫</Text>
            <Text style={styles.emptyTitle}>No faculty requests</Text>
            <Text style={styles.emptyDesc}>Teachers haven't requested coordinator access yet.</Text>
          </View>
        ) : (
          facultyRequests.map(req => (
            <View key={req.id} style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>{req.club_name}</Text>
                <View style={[styles.typePill, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.typePillText, { color: colors.primary }]}>FACULTY</Text>
                </View>
              </View>
              <Text style={styles.cardApplicant}>
                Requested by <Text style={styles.cardApplicantBold}>{req.teacher_name}</Text>
              </Text>
              <Text style={styles.cardDesc}>"{req.reason}"</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => resolveFacultyRequest(req, 'approve')} activeOpacity={0.85}>
                  <Text style={styles.approveBtnText}>✓ Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => resolveFacultyRequest(req, 'reject')} activeOpacity={0.85}>
                  <Text style={styles.rejectBtnText}>✗ Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Reports */}
        <View style={styles.approvalHeader}>
          <Text style={styles.sectionLabel}>🚨 USER REPORTS</Text>
          <View style={styles.approvalPills}>
            <View style={[styles.countPill, { borderColor: colors.red }]}>
              <Text style={[styles.countPillText, { color: colors.red }]}>{reports.length} pending</Text>
            </View>
          </View>
        </View>

        {reports.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyTitle}>No reports</Text>
            <Text style={styles.emptyDesc}>No pending user reports at the moment.</Text>
          </View>
        ) : (
          reports.map(report => (
            <View key={report.id} style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>{report.reported_name}</Text>
                <View style={[styles.typePill, { backgroundColor: colors.redLight }]}>
                  <Text style={[styles.typePillText, { color: colors.red }]}>REPORT</Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>Reason: {report.reason}</Text>
              {report.note ? (
                <Text style={styles.cardDesc}>"{report.note}"</Text>
              ) : null}
              <Text style={[styles.cardMeta, { marginTop: 0 }]}>
                Reported {new Date(report.created_at).toLocaleDateString()}
              </Text>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => resolveReport(report.id, 'dismissed')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.rejectBtnText}>Dismiss</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => resolveReport(report.id, 'reviewed')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.approveBtnText}>✓ Mark Reviewed</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Featured Study Rooms */}
        <View style={styles.approvalHeader}>
          <Text style={styles.sectionLabel}>📌 FEATURED STUDY ROOMS</Text>
          <View style={styles.approvalPills}>
            <View style={[styles.countPill, { borderColor: colors.amber }]}>
              <Text style={[styles.countPillText, { color: colors.amber }]}>{permRooms.length} rooms</Text>
            </View>
          </View>
        </View>

        {permRooms.map(room => (
          <View key={room.id} style={[styles.card, { flexDirection: 'row', alignItems: 'center' }]}>
            <Text style={{ fontSize: 24, marginRight: spacing.sm }}>{room.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{room.name}</Text>
              {room.subject ? <Text style={styles.cardMeta}>{room.subject}</Text> : null}
            </View>
            <TouchableOpacity
              onPress={() => deletePermRoom(room.id)}
              style={styles.roomDeleteBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.roomDeleteBtnText}>🗑</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={styles.addRoomBtn}
          onPress={() => setShowRoomModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.addRoomBtnText}>+ Add Featured Room</Text>
        </TouchableOpacity>

        {/* Create Room Modal */}
        <Modal visible={showRoomModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              onPress={() => setShowRoomModal(false)}
              activeOpacity={1}
            />
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>📌 New Featured Room</Text>
                <TouchableOpacity onPress={() => setShowRoomModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>ROOM NAME *</Text>
              <TextInput
                value={roomName}
                onChangeText={setRoomName}
                placeholder="e.g. Open Study Hall"
                placeholderTextColor={colors.textTertiary}
                style={styles.modalInput}
                autoCapitalize="words"
                maxLength={50}
              />

              <Text style={styles.modalLabel}>SUBJECT (optional)</Text>
              <TextInput
                value={roomSubject}
                onChangeText={setRoomSubject}
                placeholder="e.g. General · All Years"
                placeholderTextColor={colors.textTertiary}
                style={styles.modalInput}
                maxLength={60}
              />

              <Text style={styles.modalLabel}>EMOJI</Text>
              <View style={styles.emojiRow}>
                {ROOM_EMOJIS.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.emojiBtn, roomEmoji === e && styles.emojiBtnActive]}
                    onPress={() => setRoomEmoji(e)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 20 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.createConfirmBtn, (!roomName.trim() || roomCreating) && { opacity: 0.45 }]}
                onPress={createPermRoom}
                disabled={!roomName.trim() || roomCreating}
                activeOpacity={0.85}
              >
                <Text style={styles.createConfirmBtnText}>
                  {roomCreating ? 'Creating…' : 'Create Featured Room'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Remember Me + Enter app */}
        <TouchableOpacity
          style={styles.rememberRow}
          onPress={() => setRememberMe(v => !v)}
          activeOpacity={0.7}
        >
          <Switch
            value={rememberMe}
            onValueChange={setRememberMe}
            trackColor={{ false: colors.border, true: colors.amberLight }}
            thumbColor={rememberMe ? colors.amber : colors.textTertiary}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.rememberLabel}>Remember me on this device</Text>
            <Text style={styles.rememberSub}>Skip admin login next time</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.enterBtn} onPress={() => onEnterApp(rememberMe)} activeOpacity={0.85}>
          <Text style={styles.enterBtnText}>Enter App as Admin →</Text>
        </TouchableOpacity>
        <Text style={styles.enterHint}>
          The App Admin button in the Hub tab stays available once you're inside.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoBox: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: colors.amber,
    alignItems: 'center', justifyContent: 'center',
  },
  logoIcon: { color: '#1A1A00', fontSize: 17, fontWeight: '700' },
  headerTitle: { fontSize: 16, ...font.bold, color: colors.textPrimary },
  headerSub: { fontSize: 11, color: colors.textSecondary },

  signOutBtn: {
    borderWidth: 1, borderColor: colors.red,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.full,
  },
  signOutText: { fontSize: 12, color: colors.red, ...font.semibold },

  scroll: { padding: spacing.md, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold, marginBottom: spacing.sm, marginTop: spacing.md,
  },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    width: '31%',
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statValue: { fontSize: 22, ...font.bold, color: colors.textPrimary },
  statLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },

  approvalHeader: { marginTop: spacing.md },
  approvalPills: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  countPill: {
    borderWidth: 1, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  countPillText: { fontSize: 10, ...font.semibold },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 4, flexWrap: 'wrap',
  },
  cardTitle: { fontSize: 15, ...font.bold, color: colors.textPrimary },
  typePill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full,
  },
  typePillText: { fontSize: 9, ...font.bold, color: colors.primary, letterSpacing: 0.6 },
  cardApplicant: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  cardApplicantBold: { ...font.semibold, color: colors.textPrimary },
  cardMeta: { fontSize: 10, color: colors.textTertiary, marginBottom: spacing.sm },
  cardDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginBottom: spacing.md },

  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { flex: 1, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  approveBtn: { backgroundColor: colors.green },
  approveBtnText: { fontSize: 13, ...font.bold, color: '#0F0F1A' },
  rejectBtn: { borderWidth: 1, borderColor: colors.red },
  rejectBtnText: { fontSize: 13, ...font.bold, color: colors.red },

  emptyBox: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.xl,
    alignItems: 'center', marginBottom: spacing.sm,
  },
  emptyIcon: { fontSize: 30, marginBottom: 8 },
  emptyTitle: { fontSize: 14, ...font.bold, color: colors.textPrimary, marginBottom: 4 },
  emptyDesc: { fontSize: 12, color: colors.textSecondary },

  rememberRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  rememberLabel: { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  rememberSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  enterBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  enterBtnText: { fontSize: 15, ...font.bold, color: '#fff' },
  enterHint: {
    fontSize: 11, color: colors.textTertiary,
    textAlign: 'center', marginTop: spacing.sm,
  },

  roomDeleteBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.redLight, borderWidth: 1, borderColor: colors.red,
    alignItems: 'center', justifyContent: 'center',
  },
  roomDeleteBtnText: { fontSize: 16 },

  addRoomBtn: {
    borderWidth: 1, borderColor: colors.amber, borderRadius: radius.md,
    paddingVertical: 11, alignItems: 'center', marginBottom: spacing.sm,
  },
  addRoomBtnText: { fontSize: 13, color: colors.amber, ...font.bold },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  modal: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: { fontSize: 17, ...font.bold, color: colors.textPrimary },
  modalClose: { fontSize: 20, color: colors.textSecondary, padding: 4 },
  modalLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold,
    marginBottom: 6, marginTop: spacing.sm,
  },
  modalInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, fontSize: 14,
  },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  emojiBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiBtnActive: { borderColor: colors.amber, backgroundColor: colors.amberLight },
  createConfirmBtn: {
    backgroundColor: colors.amber, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg,
  },
  createConfirmBtnText: { fontSize: 15, color: '#1A1A00', ...font.bold },
});
