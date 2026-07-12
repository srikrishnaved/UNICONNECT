import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from 'react-native';
import { students, hubClubs } from '../data';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { APP_CONFIG } from '../config/appConfig';
import { colors, spacing, radius, font, avatarColor, initials, courseColor } from '../theme';
import { Users, Sparkles, MessageCircle, Unlock, Ban, Flag, CircleCheck, Check, X } from 'lucide-react-native';

const REPORT_REASONS = [
  'Harassment or bullying',
  'Spam or fake account',
  'Impersonation',
  'Inappropriate content',
  'Other',
];

const SOCIAL_PROVIDERS = [
  { name: 'Instagram', abbr: 'ig', color: '#E1306C', bg: 'rgba(225,48,108,0.18)' },
  { name: 'LinkedIn',  abbr: 'in', color: '#0A66C2', bg: 'rgba(10,102,194,0.18)'  },
  { name: 'Twitter',   abbr: '𝕏',  color: '#6B7280', bg: 'rgba(107,114,128,0.22)' },
  { name: 'GitHub',    abbr: 'gh', color: colors.primary, bg: colors.primaryLight  },
];

function getStudentSocialLinks(student) {
  const s = student.id * 17;
  const idx1 = s % SOCIAL_PROVIDERS.length;
  const idx2 = (s + 2) % SOCIAL_PROVIDERS.length;
  const providers = idx1 === idx2
    ? [SOCIAL_PROVIDERS[idx1]]
    : [SOCIAL_PROVIDERS[idx1], SOCIAL_PROVIDERS[idx2]];
  const handle = student.name.toLowerCase().replace(/\s+/g, '_');
  return providers.map((p, i) => {
    const url = {
      Instagram: `instagram.com/${handle}`,
      LinkedIn:  `linkedin.com/in/${handle}`,
      Twitter:   `x.com/${handle}`,
      GitHub:    `github.com/${handle}`,
    }[p.name];
    return { id: i, provider: p, url };
  });
}

// Auto-generates extra profile info based on student data
function getProfileExtras(student) {
  const seed = student.id * 7;
  return {
    bio: `${student.year} ${student.course} student at ${APP_CONFIG.universityName || 'your university'}, ${student.campus || APP_CONFIG.campusName || 'your campus'} campus. Passionate about ${student.interest.toLowerCase()}, always open to study sprints and chai chats.`,
    interests: [student.interest, 'Music', 'Movies', 'Sports', 'Reading'].slice(0, 4),
    stats: {
      connections: 20 + ((seed * 3) % 60),
      groups: 2 + (seed % 4),
      sessions: 5 + (seed % 15),
    },
    activity: [
      { text: `Joined a ${student.course} study group`, time: '2 days ago', Icon: Users },
      { text: 'Updated profile interests', time: '5 days ago', Icon: Sparkles },
      { text: 'Connected with new students', time: '1 week ago', Icon: Users },
    ],
  };
}

export default function ProfileScreen({ route, navigation }) {
  const { studentId, studentData } = route.params;
  const student = studentData || students.find(s => s.id === studentId);
  const { isConnected, toggleConnect, userProfile, blockUser, unblockUser, isBlocked, submitReport, sendConnectionRequest, hasPendingRequest, cancelConnectionRequest, disconnectUser } = useApp();
  const isRealUser = !!studentData;
  const isSelf = userProfile?.id === student?.id;
  const connected = isConnected(student?.id);
  const pending = isRealUser && !connected && hasPendingRequest(student?.id);

  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportNote, setReportNote] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  const profileId = studentData?.id ?? student?.id;
  const isOwnProfile = userProfile?.id && studentData?.id === userProfile.id;
  const blocked = isBlocked(profileId);

  const [theirClubs, setTheirClubs] = useState([]);

  useEffect(() => {
    if (!studentData?.id) return;
    supabase
      .from('club_memberships')
      .select('club_id')
      .eq('user_id', studentData.id)
      .then(({ data }) => {
        if (!data) return;
        const clubIds = new Set(data.map(r => r.club_id));
        setTheirClubs(hubClubs.filter(c => clubIds.has(c.id)));
      });
  }, [studentData?.id]);

  useEffect(() => {
    if (isOwnProfile || !userProfile?.id) return;
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setShowMenu(true)} style={{ paddingRight: 16, paddingVertical: 8 }}>
          <Text style={{ fontSize: 22, color: colors.textSecondary, lineHeight: 24 }}>⋯</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, isOwnProfile, userProfile?.id]);

  const handleBlock = async () => {
    setShowMenu(false);
    if (blocked) {
      await unblockUser(profileId);
    } else {
      await blockUser(profileId);
    }
  };

  const handleSubmitReport = async () => {
    if (!reportReason) return;
    setReportSubmitting(true);
    await submitReport({
      reportedId: profileId,
      reportedName: student?.name ?? 'Unknown',
      reason: reportReason,
      note: reportNote,
    });
    setReportSubmitting(false);
    setReportDone(true);
  };

  if (!student) {
    return <View style={styles.container}><Text style={styles.bodyText}>Profile not found</Text></View>;
  }

  const isRealProfile = !!studentData;
  const extras = isRealProfile ? null : getProfileExtras(student);
  const bio = isRealProfile
    ? (student.bio || `${student.class || student.year || ''} student at ${APP_CONFIG.universityName || 'your university'}${student.campus ? ', ' + student.campus + ' campus' : ''}.`.trim())
    : extras.bio;
  const interests = isRealProfile ? ['Studies', 'Music', 'Movies', 'Sports'] : extras.interests;
  const profileSocialLinks = isRealProfile ? (student.social_links || []) : getStudentSocialLinks(student);
  const av = avatarColor(student.name);
  const cc = courseColor(student.course);

  return (
    <>
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Cover + avatar */}
      <View style={[styles.cover, { backgroundColor: cc.bg }]}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: av.bg }]}>
            <Text style={styles.avatarText}>{initials(student.name)}</Text>
          </View>
        </View>
      </View>

      {/* Name + meta */}
      <View style={styles.nameBlock}>
        <Text style={styles.name}>{student.name}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.courseBadge, { backgroundColor: cc.bg }]}>
            <Text style={[styles.courseText, { color: cc.text }]}>{student.class || student.course}</Text>
          </View>
          <Text style={styles.meta}> · {student.campus}</Text>
        </View>
      </View>

      {/* Stats */}
      {!isRealProfile && (
        <View style={styles.statsRow}>
          {[
            { val: extras.stats.connections, label: 'Connections' },
            { val: extras.stats.groups, label: 'Groups' },
            { val: extras.stats.sessions, label: 'Sessions' },
          ].map(s => (
            <View key={s.label} style={styles.stat}>
              <Text style={styles.statVal}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Connect + Message buttons */}
      <View style={styles.actions}>
        {!isSelf && (
        <TouchableOpacity
          style={[
            styles.connectBtn,
            connected && styles.connectBtnActive,
            pending && styles.connectBtnPending,
          ]}
          onPress={() => {
            if (isRealUser) {
              if (connected) {
                Alert.alert('Disconnect', `Disconnect from ${student.name}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Disconnect', style: 'destructive', onPress: () => disconnectUser(student.id) },
                ]);
              } else if (pending) {
                cancelConnectionRequest(student.id);
              } else {
                sendConnectionRequest(student.id, student.name);
              }
            } else {
              toggleConnect(student.id);
            }
          }}
          activeOpacity={0.8}
        >
          {connected ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Check size={15} color={colors.success} />
              <Text style={[styles.connectBtnText, styles.connectBtnTextActive]}>Connected</Text>
            </View>
          ) : (
            <Text style={[
              styles.connectBtnText,
              pending && styles.connectBtnTextPending,
            ]}>
              {pending ? 'Pending' : '+ Connect'}
            </Text>
          )}
        </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.messageBtn}
          onPress={() => navigation.navigate('DM', {
            personKey: `student-${student.id}`,
            name: student.name,
            isTeacher: false,
            recipientId: studentData?.id,
          })}
          activeOpacity={0.8}
        >
          <MessageCircle size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* About */}
      <Section label="ABOUT">
        <Text style={styles.bodyText}>{bio}</Text>
      </Section>

      {/* Interests */}
      <Section label="INTERESTS">
        <View style={styles.pillsRow}>
          {interests.map(i => (
            <View key={i} style={styles.interestPill}>
              <Text style={styles.interestText}>{i}</Text>
            </View>
          ))}
        </View>
      </Section>

      {/* Social Links */}
      {profileSocialLinks.length > 0 && (
        <Section label="SOCIAL LINKS">
          {profileSocialLinks.map((link, idx) => (
            <View key={link.id ?? idx} style={styles.socialRow}>
              <View style={[styles.providerBadge, { backgroundColor: link.provider.bg }]}>
                <Text style={[styles.providerAbbr, { color: link.provider.color }]}>{link.provider.abbr}</Text>
              </View>
              <Text style={styles.socialUrl} numberOfLines={1}>{link.url}</Text>
            </View>
          ))}
        </Section>
      )}

      {/* Clubs */}
      {theirClubs.length > 0 && (
        <Section label="CLUBS">
          <View style={styles.clubsRow}>
            {theirClubs.map(club => (
              <View key={club.id} style={[styles.clubChip, { borderColor: club.color, backgroundColor: `${club.color}18` }]}>
                <Text style={styles.clubChipEmoji}>{club.emoji}</Text>
                <Text style={[styles.clubChipName, { color: club.color }]}>{club.name}</Text>
              </View>
            ))}
          </View>
        </Section>
      )}


      {/* Recent activity — only for seed profiles */}
      {!isRealProfile && extras.activity.length > 0 && (
        <Section label="RECENT ACTIVITY">
          {extras.activity.map((a, i) => (
            <View key={i} style={styles.activityRow}>
              <a.Icon size={14} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activityText}>{a.text}</Text>
                <Text style={styles.activityTime}>{a.time}</Text>
              </View>
            </View>
          ))}
        </Section>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>

    {/* ── ⋯ Menu ───────────────────────────────────────────────────── */}
    <Modal visible={showMenu} transparent animationType="fade">
      <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
        <View style={styles.menuSheet}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={handleBlock}
          >
            {blocked ? <Unlock size={18} color={colors.textSecondary} /> : <Ban size={18} color={colors.error} />}
            <Text style={styles.menuItemText}>{blocked ? 'Unblock user' : 'Block user'}</Text>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => { setShowMenu(false); setReportReason(''); setReportNote(''); setReportDone(false); setShowReport(true); }}
          >
            <Flag size={16} color={colors.error} />
            <Text style={[styles.menuItemText, { color: colors.red }]}>Report user</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>

    {/* ── Report Modal ─────────────────────────────────────────────── */}
    <Modal visible={showReport} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Report User</Text>
            <TouchableOpacity onPress={() => setShowReport(false)}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {reportDone ? (
            <View style={styles.reportDone}>
              <CircleCheck size={32} color={colors.success} />
              <Text style={styles.reportDoneTitle}>Report submitted</Text>
              <Text style={styles.reportDoneSub}>Our admin team will review this and take action if needed.</Text>
              <TouchableOpacity style={styles.reportDoneBtn} onPress={() => setShowReport(false)} activeOpacity={0.8}>
                <Text style={styles.reportDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.modalLabel}>REASON</Text>
              {REPORT_REASONS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonRow, reportReason === r && styles.reasonRowActive]}
                  onPress={() => setReportReason(r)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.reasonDot, reportReason === r && styles.reasonDotActive]} />
                  <Text style={[styles.reasonText, reportReason === r && styles.reasonTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.modalLabel, { marginTop: spacing.md }]}>ADDITIONAL DETAILS (optional)</Text>
              <TextInput
                value={reportNote}
                onChangeText={setReportNote}
                placeholder="Any extra context for our team..."
                placeholderTextColor={colors.textTertiary}
                style={[styles.noteInput, { textAlignVertical: 'top' }]}
                multiline
                maxLength={300}
              />

              <TouchableOpacity
                style={[styles.submitBtn, (!reportReason || reportSubmitting) && { opacity: 0.45 }]}
                onPress={handleSubmitReport}
                disabled={!reportReason || reportSubmitting}
                activeOpacity={0.85}
              >
                <Text style={styles.submitBtnText}>{reportSubmitting ? 'Submitting…' : 'Submit Report'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
    </>
  );
}

function Section({ label, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  cover: { height: 110, position: 'relative' },
  avatarWrap: { position: 'absolute', bottom: -46, left: 0, right: 0, alignItems: 'center' },
  avatar: {
    width: 92, height: 92, borderRadius: 46,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: colors.bg,
  },
  avatarText: { fontSize: 28, color: '#fff', ...font.bold },
  nameBlock: { alignItems: 'center', marginTop: 56, paddingHorizontal: spacing.lg },
  name: { fontSize: 20, ...font.bold, color: colors.textPrimary, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  courseBadge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  courseText: { fontSize: 12, ...font.semibold },
  meta: { fontSize: 13, color: colors.textSecondary },

  statsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  stat: {
    flex: 1, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, alignItems: 'center',
  },
  statVal: { fontSize: 20, ...font.bold, color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  actions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  connectBtn: {
    flex: 1, backgroundColor: colors.primary,
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
  },
  connectBtnActive: {
    backgroundColor: colors.greenLight,
    borderWidth: 1, borderColor: colors.greenBorder,
  },
  connectBtnPending: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  connectBtnText: { fontSize: 15, color: '#fff', ...font.bold },
  connectBtnTextActive: { color: colors.green },
  connectBtnTextPending: { color: colors.textSecondary },
  messageBtn: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center',
  },
  messageBtnText: { fontSize: 16 },

  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionLabel: {
    fontSize: 11, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.semibold, marginBottom: spacing.sm,
  },
  bodyText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

  clubsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clubChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  clubChipEmoji: { fontSize: 14 },
  clubChipName: { fontSize: 12, ...font.semibold },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  interestPill: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5,
  },
  interestText: { fontSize: 12, color: colors.textSecondary },

  socialRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, marginBottom: spacing.sm,
  },
  providerBadge: {
    width: 34, height: 34, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  providerAbbr: { fontSize: 11, fontWeight: '700' },
  socialUrl: { fontSize: 13, color: colors.textSecondary, flex: 1 },

  activityRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 8, alignItems: 'flex-start' },
  activityIcon: { fontSize: 16, marginTop: 1 },
  activityText: { fontSize: 13, color: colors.textPrimary },
  activityTime: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },


  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: colors.border, paddingBottom: 32,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  menuItemIcon: { fontSize: 18 },
  menuItemText: { fontSize: 15, ...font.semibold, color: colors.textPrimary },
  menuDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg, paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: { fontSize: 17, ...font.bold, color: colors.textPrimary },
  modalClose: { fontSize: 20, color: colors.textSecondary, padding: 4 },
  modalLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold, marginBottom: spacing.sm,
  },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 10, paddingHorizontal: spacing.sm,
    borderRadius: radius.md, marginBottom: 4,
  },
  reasonRowActive: { backgroundColor: colors.redLight },
  reasonDot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: colors.border,
  },
  reasonDotActive: { borderColor: colors.red, backgroundColor: colors.red },
  reasonText: { fontSize: 14, color: colors.textSecondary },
  reasonTextActive: { color: colors.red, ...font.semibold },
  noteInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary,
    fontSize: 14, height: 80,
  },
  submitBtn: {
    backgroundColor: colors.red, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg,
  },
  submitBtnText: { fontSize: 15, color: '#fff', ...font.bold },
  reportDone: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  reportDoneIcon: { fontSize: 40 },
  reportDoneTitle: { fontSize: 16, ...font.bold, color: colors.textPrimary },
  reportDoneSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  reportDoneBtn: {
    marginTop: spacing.md, backgroundColor: colors.primary,
    borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 32,
  },
  reportDoneBtnText: { fontSize: 14, color: '#fff', ...font.bold },
});