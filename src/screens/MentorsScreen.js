import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, SafeAreaView,
} from 'react-native';
import {
  teachers, students, myProfile,
  mentorAssignments, mentorVisitCounts, myMentorSessions,
} from '../data';
import { colors, spacing, radius, font, avatarColor } from '../theme';
import { EmptyState } from '../components/EmptyState';
import { Heart, User, ClipboardList, X, Check } from 'lucide-react-native';

const REQUIRED_VISITS = 5;
const MY_ID = 0; // Srikrishna

function getStudentName(sid) {
  if (sid === MY_ID) return myProfile.name;
  return students.find(s => s.id === sid)?.name || '—';
}

function VisitDots({ done, total = REQUIRED_VISITS, size = 11 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: size, height: size, borderRadius: size / 2,
            backgroundColor: i < done ? colors.primary : colors.border,
          }}
        />
      ))}
    </View>
  );
}

function VisitStatusText({ done }) {
  const remaining = REQUIRED_VISITS - done;
  if (done >= REQUIRED_VISITS) return <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Text style={[styles.visitNote, { color: colors.green }]}>All required visits complete</Text><Check size={13} color={colors.success} /></View>;
  return <Text style={styles.visitNote}>{remaining} visit{remaining > 1 ? 's' : ''} remaining this semester</Text>;
}

export default function MentorsScreen() {
  const [selected, setSelected] = useState(null);

  const enriched = mentorAssignments.map(a => ({
    ...a,
    teacher: teachers.find(t => t.id === a.teacherId),
    isMyMentor: a.studentIds.includes(MY_ID),
  }));

  const myMentor = enriched.find(m => m.isMyMentor);
  const otherMentors = enriched.filter(m => !m.isMyMentor);
  const myVisits = mentorVisitCounts[MY_ID];
  const myMentorTeacher = myMentor?.teacher;
  const myMentorAv = myMentorTeacher ? avatarColor(myMentorTeacher.name) : { bg: colors.primary, text: '#fff' };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Programme banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Mentorship Programme</Text>
          <Text style={styles.bannerSub}>
            Sem 2 · 2025–26 · {REQUIRED_VISITS} meetings required per student
          </Text>
        </View>

        {/* My Mentor */}
        {!myMentor && (
          <EmptyState icon={Heart} heading="No mentor assigned yet" subtext="Your mentor will appear here once assigned" />
        )}
        {myMentor && myMentorTeacher && (
          <>
            <View style={{flexDirection:'row',alignItems:'center',gap:6}}><User size={13} color={colors.textTertiary} /><Text style={styles.sectionLabel}>MY MENTOR</Text></View>
            <TouchableOpacity style={styles.myCard} onPress={() => setSelected(myMentor)} activeOpacity={0.85}>
              <View style={styles.myCardTop}>
                <View style={[styles.avatarLg, { backgroundColor: myMentorAv.bg }]}>
                  <Text style={[styles.avatarLgText, { color: myMentorAv.text }]}>
                    {myMentorTeacher.initials}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.myName}>{myMentorTeacher.name}</Text>
                  <Text style={styles.mySpec}>{myMentorTeacher.specialisation}</Text>
                  <View style={styles.groupBadge}>
                    <Text style={styles.groupBadgeText}>
                      {myMentor.course} · Group {myMentor.group}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Progress */}
              <View style={styles.progressBox}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>SEMESTER VISITS</Text>
                  <Text style={[
                    styles.progressCount,
                    myVisits >= REQUIRED_VISITS ? { color: colors.green } : { color: colors.primary },
                  ]}>
                    {myVisits} / {REQUIRED_VISITS}
                  </Text>
                </View>
                <VisitDots done={myVisits} size={14} />
                <VisitStatusText done={myVisits} />
              </View>

              {/* Latest session preview */}
              {myMentorSessions.length > 0 && (
                <View style={styles.lastSession}>
                  <Text style={styles.lastSessionLabel}>Latest session</Text>
                  <Text style={styles.lastSessionTopic}>
                    {myMentorSessions[myMentorSessions.length - 1].topic}
                  </Text>
                  <Text style={styles.lastSessionDate}>
                    {myMentorSessions[myMentorSessions.length - 1].date}
                  </Text>
                </View>
              )}

              <Text style={styles.tapHint}>Tap to view full session history →</Text>
            </TouchableOpacity>
          </>
        )}

        {/* All other mentors */}
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}><ClipboardList size={13} color={colors.textTertiary} /><Text style={styles.sectionLabel}>ALL MENTORS ({enriched.length})</Text></View>
        {otherMentors.map(m => {
          const av = avatarColor(m.teacher?.name || '');
          // avg visits across their group
          const groupVisits = m.studentIds.map(sid => mentorVisitCounts[sid] ?? 0);
          const avgVisit = Math.round(groupVisits.reduce((a, b) => a + b, 0) / groupVisits.length);
          return (
            <TouchableOpacity
              key={m.teacherId}
              style={styles.mentorCard}
              onPress={() => setSelected(m)}
              activeOpacity={0.85}
            >
              <View style={[styles.avatarSm, { backgroundColor: av.bg }]}>
                <Text style={[styles.avatarSmText, { color: av.text }]}>
                  {m.teacher?.initials || '?'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mentorName}>{m.teacher?.name}</Text>
                <Text style={styles.mentorSpec}>{m.teacher?.specialisation}</Text>
                <Text style={styles.mentorMeta}>
                  {m.course} · Group {m.group} · {m.studentIds.length} mentees
                </Text>
              </View>
              <View style={styles.mentorRight}>
                <VisitDots done={avgVisit} size={7} />
                <Text style={styles.mentorAvg}>avg {avgVisit}/{REQUIRED_VISITS}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Detail modal */}
      <Modal visible={selected !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} activeOpacity={1} />
          <SafeAreaView style={styles.sheet}>
            {selected && <DetailSheet mentor={selected} onClose={() => setSelected(null)} />}
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

function DetailSheet({ mentor, onClose }) {
  const teacher = mentor.teacher;
  const av = teacher ? avatarColor(teacher.name) : { bg: colors.primary, text: '#fff' };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Header */}
      <View style={styles.sheetHeader}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
          <X size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Teacher info */}
      <View style={styles.sheetProfile}>
        <View style={[styles.avatarLg, { backgroundColor: av.bg, width: 64, height: 64, borderRadius: 32 }]}>
          <Text style={[styles.avatarLgText, { color: av.text, fontSize: 22 }]}>
            {teacher?.initials || '?'}
          </Text>
        </View>
        <Text style={styles.sheetName}>{teacher?.name}</Text>
        <Text style={styles.sheetSpec}>{teacher?.specialisation}</Text>
        <View style={styles.groupBadge}>
          <Text style={styles.groupBadgeText}>{mentor.course} · Group {mentor.group}</Text>
        </View>
      </View>

      {mentor.isMyMentor ? (
        <MyMentorDetail mentor={mentor} />
      ) : (
        <OtherMentorDetail mentor={mentor} />
      )}
    </ScrollView>
  );
}

function MyMentorDetail({ mentor }) {
  const myVisits = mentorVisitCounts[MY_ID];

  return (
    <>
      {/* Progress */}
      <View style={styles.sheetSection}>
        <Text style={styles.sheetSectionLabel}>SEMESTER VISITS</Text>
        <View style={styles.sheetProgressRow}>
          <VisitDots done={myVisits} size={16} />
          <Text style={[
            styles.sheetProgressCount,
            myVisits >= REQUIRED_VISITS ? { color: colors.green } : { color: colors.primary },
          ]}>
            {myVisits} / {REQUIRED_VISITS}
          </Text>
        </View>
        <VisitStatusText done={myVisits} />
      </View>

      {/* Session log */}
      <View style={styles.sheetSection}>
        <Text style={styles.sheetSectionLabel}>SESSION HISTORY</Text>

        {myMentorSessions.map((s, i) => (
          <View key={s.id} style={styles.sessionRow}>
            <View style={styles.sessionNumberBox}>
              <Text style={styles.sessionNumber}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.sessionTopRow}>
                <Text style={styles.sessionTopic}>{s.topic}</Text>
              </View>
              <Text style={styles.sessionDate}>{s.date}</Text>
              <Text style={styles.sessionNotes}>{s.notes}</Text>
            </View>
          </View>
        ))}

        {/* Remaining visits */}
        {Array.from({ length: REQUIRED_VISITS - myMentorSessions.length }).map((_, i) => (
          <View key={`empty-${i}`} style={[styles.sessionRow, styles.sessionRowEmpty]}>
            <View style={[styles.sessionNumberBox, styles.sessionNumberBoxEmpty]}>
              <Text style={[styles.sessionNumber, { color: colors.textTertiary }]}>
                {myMentorSessions.length + i + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sessionEmptyText}>Not yet scheduled</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Group members */}
      <View style={styles.sheetSection}>
        <Text style={styles.sheetSectionLabel}>YOUR GROUP ({mentor.studentIds.length} students)</Text>
        {mentor.studentIds.map(sid => {
          const name = getStudentName(sid);
          const visits = mentorVisitCounts[sid] ?? 0;
          const isMe = sid === MY_ID;
          return (
            <View key={sid} style={styles.groupMemberRow}>
              <View style={styles.memberDot} />
              <Text style={[styles.memberName, isMe && { color: colors.primary }]}>
                {name}{isMe ? ' (you)' : ''}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <VisitDots done={visits} size={7} />
                <Text style={[
                  styles.memberVisits,
                  visits >= REQUIRED_VISITS && { color: colors.green },
                ]}>
                  {visits}/{REQUIRED_VISITS}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </>
  );
}

function OtherMentorDetail({ mentor }) {
  return (
    <View style={styles.sheetSection}>
      <Text style={styles.sheetSectionLabel}>
        MENTEES ({mentor.studentIds.length})
      </Text>
      {mentor.studentIds.map(sid => {
        const name = getStudentName(sid);
        const visits = mentorVisitCounts[sid] ?? 0;
        const done = visits >= REQUIRED_VISITS;
        return (
          <View key={sid} style={styles.menteeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menteeName}>{name}</Text>
              <VisitDots done={visits} size={9} />
            </View>
            <Text style={[styles.menteeCount, done && { color: colors.green }]}>
              {visits}/{REQUIRED_VISITS}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },

  banner: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerTitle: { fontSize: 14, ...font.bold, color: colors.textPrimary, marginBottom: 3 },
  bannerSub: { fontSize: 11, color: colors.textSecondary },

  sectionLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold, marginBottom: spacing.sm, marginTop: spacing.xs,
  },

  // My mentor card
  myCard: {
    backgroundColor: colors.card,
    borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  myCardTop: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  avatarLg: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLgText: { fontSize: 16, ...font.bold },
  myName: { fontSize: 15, ...font.bold, color: colors.textPrimary, marginBottom: 2 },
  mySpec: { fontSize: 11, color: colors.textSecondary, marginBottom: 6 },
  groupBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  groupBadgeText: { fontSize: 10, ...font.bold, color: colors.primary },

  progressBox: {
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 6,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 10, ...font.bold, color: colors.textSecondary, letterSpacing: 0.6 },
  progressCount: { fontSize: 15, ...font.bold },
  visitNote: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },

  lastSession: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: spacing.sm, marginTop: spacing.xs,
  },
  lastSessionLabel: { fontSize: 9, ...font.bold, color: colors.textTertiary, letterSpacing: 0.6, marginBottom: 3 },
  lastSessionTopic: { fontSize: 13, ...font.semibold, color: colors.textPrimary },
  lastSessionDate: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
  tapHint: { fontSize: 11, color: colors.primary, marginTop: spacing.sm, textAlign: 'right', ...font.medium },

  // Other mentor cards
  mentorCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatarSm: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarSmText: { fontSize: 13, ...font.bold },
  mentorName: { fontSize: 13, ...font.bold, color: colors.textPrimary, marginBottom: 2 },
  mentorSpec: { fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
  mentorMeta: { fontSize: 10, color: colors.textTertiary },
  mentorRight: { alignItems: 'flex-end', gap: 4 },
  mentorAvg: { fontSize: 9, color: colors.textTertiary },
  arrow: { fontSize: 20, color: colors.textTertiary, marginLeft: 2 },

  // Modal / sheet
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: colors.border,
    maxHeight: '90%',
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },

  sheetProfile: { alignItems: 'center', paddingVertical: spacing.md, gap: 6 },
  sheetName: { fontSize: 18, ...font.bold, color: colors.textPrimary, marginTop: 4 },
  sheetSpec: { fontSize: 12, color: colors.textSecondary },

  sheetSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  sheetSectionLabel: {
    fontSize: 10, ...font.bold, color: colors.textSecondary,
    letterSpacing: 0.8, marginBottom: spacing.md,
  },
  sheetProgressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 6 },
  sheetProgressCount: { fontSize: 20, ...font.bold },

  // Session rows
  sessionRow: {
    flexDirection: 'row', gap: spacing.sm,
    marginBottom: spacing.md, alignItems: 'flex-start',
  },
  sessionRowEmpty: { opacity: 0.45 },
  sessionNumberBox: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  sessionNumberBoxEmpty: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sessionNumber: { fontSize: 12, ...font.bold, color: '#fff' },
  sessionTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  sessionTopic: { fontSize: 13, ...font.bold, color: colors.textPrimary },
  sessionDate: { fontSize: 10, color: colors.primary, marginBottom: 4 },
  sessionNotes: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  sessionEmptyText: { fontSize: 13, color: colors.textTertiary, marginTop: 5 },

  // Group members
  groupMemberRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  memberDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border, flexShrink: 0,
  },
  memberName: { flex: 1, fontSize: 13, ...font.medium, color: colors.textPrimary },
  memberVisits: { fontSize: 11, color: colors.textSecondary, ...font.semibold },

  // Other mentor mentees
  menteeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  menteeName: { fontSize: 13, ...font.medium, color: colors.textPrimary, marginBottom: 5 },
  menteeCount: { fontSize: 13, ...font.bold, color: colors.textSecondary, flexShrink: 0 },
});
