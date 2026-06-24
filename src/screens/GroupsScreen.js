import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView, TextInput, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, radius, font, courseColor } from '../theme';
import { useApp } from '../context/AppContext';
import { hubClubs } from '../data';
import { EmptyState } from '../components/EmptyState';
import { BookOpen } from 'lucide-react-native';

const COURSES = ['All', 'BCom IAF', 'BCom IBA', 'BCom F&A'];

const EMOJI_OPTIONS = ['📚', '⚡', '🧠', '💡', '🎯', '📊', '💼', '🔬', '💻', '📝', '🌏', '🎓'];

export default function GroupsScreen() {
  const navigation = useNavigation();
  const { teacherGroups, studentGroups, addStudentGroup, userProfile, joinedGroupIds, toggleGroupJoin, createdGroupIds, trackCreatedGroup, clubMemberships } = useApp();
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newGroup, setNewGroup] = useState({ name: '', course: '', desc: '', emoji: '📚' });

  // Teacher groups visible to this student's course
  const visibleTeacherGroups = useMemo(() =>
    teacherGroups.filter(g =>
      !userProfile?.course ||
      g.visibleTo.includes(userProfile.course) ||
      g.visibleTo.includes(userProfile.class)
    ),
    [teacherGroups, userProfile]
  );

  const groups = useMemo(
    () => [...visibleTeacherGroups, ...studentGroups],
    [visibleTeacherGroups, studentGroups]
  );

  const filtered = useMemo(() => groups.filter(g => {
    const q = search.toLowerCase();
    const mq = !q || g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q) || g.course.toLowerCase().includes(q);
    const mc = course === 'All' || g.course === course;
    return mq && mc;
  }), [groups, search, course]);

  const myGroups = filtered.filter(g => joinedGroupIds.has(String(g.id)));
  const discoverGroups = filtered.filter(g => !joinedGroupIds.has(String(g.id)));

  const myClubGroups = hubClubs.filter(c => clubMemberships && clubMemberships.has(c.id));

  const handleCreate = () => {
    if (!newGroup.name.trim()) return;
    if (createdGroupIds.size >= 3) {
      setCreateError('You can only create up to 3 groups.');
      return;
    }
    const id = Date.now();
    const created = {
      id,
      name: newGroup.name.trim(),
      course: newGroup.course || 'All',
      emoji: newGroup.emoji,
      members: 1,
      active: true,
      desc: newGroup.desc.trim() || `A study group for ${newGroup.name.trim()}.`,
      recentMessages: [],
    };
    addStudentGroup(created);
    toggleGroupJoin(id);
    trackCreatedGroup(id);
    setNewGroup({ name: '', course: '', desc: '', emoji: '📚' });
    setCreateError('');
    setShowCreate(false);
  };

  function FilterPills() {
    return (
      <View style={styles.pillRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
        >
          {COURSES.map(c => {
            const active = course === c;
            return (
              <TouchableOpacity
                key={c}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => setCourse(c)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  function ClubGroupCard({ club }) {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('GroupDetail', { groupId: `club_${club.id}` })}
      >
        <View style={[styles.cardStripe, { backgroundColor: colors.primary }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={[styles.emojiBox, { backgroundColor: colors.primaryLight }]}>
              <Text style={styles.emoji}>{club.emoji || '🎯'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{club.name}</Text>
                <View style={styles.clubBadge}>
                  <Text style={styles.clubBadgeText}>🏛 Club</Text>
                </View>
              </View>
              <Text style={styles.course}>{club.category || 'Club Group'}</Text>
            </View>
          </View>
          <Text style={styles.desc} numberOfLines={2}>{club.desc || `Members-only group for ${club.name}.`}</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.members}>✓ Member</Text>
            <View style={[styles.joinBtn, styles.joinBtnActive]}>
              <Text style={[styles.joinBtnText, styles.joinBtnTextActive]}>Open →</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  function GroupCard({ group }) {
    const isJoined = joinedGroupIds.has(String(group.id));
    const cc = courseColor(group.course);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
      >
        <View style={[styles.cardStripe, { backgroundColor: cc.text }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={[styles.emojiBox, { backgroundColor: cc.bg }]}>
              <Text style={styles.emoji}>{group.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
                {group.active && <View style={styles.activeDot} />}
                {group.createdByTeacher && (
                  <View style={styles.teacherBadge}>
                    <Text style={styles.teacherBadgeText}>👩‍🏫 Teacher</Text>
                  </View>
                )}
              </View>
              <Text style={styles.course}>{group.course}</Text>
            </View>
          </View>
          <Text style={styles.desc} numberOfLines={2}>{group.desc}</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.members}>👥 {group.members} member{group.members !== 1 ? 's' : ''}</Text>
            <TouchableOpacity
              style={[styles.joinBtn, isJoined && styles.joinBtnActive]}
              onPress={() => toggleGroupJoin(group.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.joinBtnText, isJoined && styles.joinBtnTextActive]}>
                {isJoined ? '✓ Joined' : '+ Join'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search groups..."
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowCreate(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.createBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FilterPills />

      <FlatList
        data={[]}
        keyExtractor={() => 'x'}
        renderItem={null}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {myClubGroups.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>🏛 MY CLUBS ({myClubGroups.length})</Text>
                {myClubGroups.map(c => <ClubGroupCard key={c.id} club={c} />)}
              </>
            )}
            {myGroups.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>📌 YOUR GROUPS ({myGroups.length})</Text>
                {myGroups.map(g => <GroupCard key={g.id} group={g} />)}
              </>
            )}
            <Text style={styles.sectionLabel}>✨ DISCOVER ({discoverGroups.length})</Text>
            {discoverGroups.map(g => <GroupCard key={g.id} group={g} />)}
            {discoverGroups.length === 0 && myGroups.length === 0 && (
              <EmptyState
                icon={BookOpen}
                heading="No groups yet"
                subtext="Create the first study group for your class"
              />
            )}
            <View style={{ height: 30 }} />
          </>
        }
      />

      {/* Create Group Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✨ Create Study Group</Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary }}>{createdGroupIds.size}/3 created</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>GROUP NAME</Text>
            <TextInput
              value={newGroup.name}
              onChangeText={t => setNewGroup({ ...newGroup, name: t })}
              placeholder="e.g. ACCA AA — Audit Procedures"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />

            <Text style={styles.modalLabel}>EMOJI</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiOption, newGroup.emoji === e && styles.emojiOptionActive]}
                  onPress={() => setNewGroup({ ...newGroup, emoji: e })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emojiOptionText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>COURSE</Text>
            <View style={styles.modalCoursePills}>
              {COURSES.slice(1).map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.modalPill, newGroup.course === c && styles.modalPillActive]}
                  onPress={() => setNewGroup({ ...newGroup, course: c })}
                >
                  <Text style={[styles.modalPillText, newGroup.course === c && styles.modalPillTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>DESCRIPTION</Text>
            <TextInput
              value={newGroup.desc}
              onChangeText={t => setNewGroup({ ...newGroup, desc: t })}
              placeholder="What will this group focus on?"
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              multiline
            />

            {createError ? <Text style={{ fontSize: 13, color: '#EF4444', marginTop: 8, textAlign: 'center' }}>{createError}</Text> : null}
            <TouchableOpacity
              style={[styles.modalSubmit, (!newGroup.name.trim() || createdGroupIds.size >= 3) && { opacity: 0.45 }]}
              onPress={handleCreate}
              disabled={!newGroup.name.trim() || createdGroupIds.size >= 3}
              activeOpacity={0.85}
            >
              <Text style={styles.modalSubmitText}>Create Group</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },

  topBar: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, padding: 0 },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  createBtnText: { color: '#fff', fontSize: 13, ...font.bold },

  pillRowWrap: { marginBottom: spacing.sm },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingRight: spacing.lg, paddingVertical: 2 },
  pill: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: 14, height: 32, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.card,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 12, color: colors.textSecondary, ...font.medium, lineHeight: 16 },
  pillTextActive: { color: '#fff', ...font.semibold },

  sectionLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.semibold, marginBottom: spacing.sm, marginTop: spacing.md,
  },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  cardStripe: { height: 3, width: '100%' },
  cardBody: { padding: spacing.md },
  cardHeader: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  emojiBox: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 14, ...font.bold, color: colors.textPrimary, flexShrink: 1 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  teacherBadge: {
    backgroundColor: colors.amberLight,
    borderWidth: 1, borderColor: colors.amber,
    borderRadius: radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  teacherBadgeText: { fontSize: 9, color: colors.amber, ...font.semibold },
  clubBadge: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  clubBadgeText: { fontSize: 9, color: colors.primary, ...font.semibold },
  course: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  desc: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginBottom: spacing.sm },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  members: { fontSize: 12, color: colors.textSecondary },
  joinBtn: {
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  joinBtnActive: {
    backgroundColor: colors.greenLight, borderWidth: 1, borderColor: colors.greenBorder,
  },
  joinBtnText: { fontSize: 12, color: '#fff', ...font.semibold },
  joinBtnTextActive: { color: colors.green },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 14, color: colors.textSecondary, marginBottom: 8 },
  emptyLink: { fontSize: 13, color: colors.primary, ...font.semibold },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: '92%',
    borderWidth: 1, borderColor: colors.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: 18, ...font.bold, color: colors.textPrimary },
  modalClose: { fontSize: 22, color: colors.textSecondary, padding: 4 },
  modalLabel: { fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.semibold, marginBottom: 6, marginTop: spacing.sm },
  modalInput: {
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 14,
  },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiOption: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  emojiOptionText: { fontSize: 22 },
  modalCoursePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  modalPill: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: colors.bg,
  },
  modalPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modalPillText: { fontSize: 12, color: colors.textSecondary, ...font.medium },
  modalPillTextActive: { color: '#fff' },
  modalSubmit: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  modalSubmitText: { color: '#fff', fontSize: 15, ...font.bold },
});
