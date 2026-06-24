import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Animated, Alert, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { students, hubClubs } from '../data';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius, font, avatarColor, initials, courseColor } from '../theme';
import { EmptyState } from '../components/EmptyState';
import { Users, Star } from 'lucide-react-native';

const COURSES = ['All', 'BCom IAF', 'BCom F&A', 'BCom IBA'];
const YEARS = ['All', '1st Year', '2nd Year', '3rd Year'];

export default function DiscoverScreen() {
  const { isConnected, toggleConnect, isBlocked, userProfile, sendConnectionRequest, hasPendingRequest, cancelConnectionRequest, disconnectUser } = useApp();
  const navigation = useNavigation();
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('All');
  const [year, setYear] = useState('All');
  const [realUsers, setRealUsers] = useState([]);
  const [loadingReal, setLoadingReal] = useState(true);
  const [dbClubs, setDbClubs] = useState([]);
  const [loadingClubs, setLoadingClubs] = useState(false);

  // Undo toast
  const [undoToast, setUndoToast] = useState(null); // { studentId, name }
  const undoTimer = useRef(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showUndo = (studentId, name) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoToast({ studentId, name });
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    undoTimer.current = setTimeout(() => dismissUndo(), 5000);
  };

  const dismissUndo = () => {
    Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setUndoToast(null));
    if (undoTimer.current) { clearTimeout(undoTimer.current); undoTimer.current = null; }
  };

  const handleUndo = () => {
    if (undoToast) cancelConnectionRequest(undoToast.studentId);
    dismissUndo();
  };

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, course, year, class, campus, bio, interests')
      .order('name', { ascending: true })
      .then(({ data }) => {
        setRealUsers(data || []);
        setLoadingReal(false);
      });
  }, []);

  const filteredReal = useMemo(() => {
    const me = userProfile;
    const myInterests = me?.interests || [];

    function score(s) {
      let n = 0;
      const shared = myInterests.filter(i => (s.interests || []).includes(i)).length;
      n += shared * 3;
      if (me?.campus && s.campus === me.campus) n += 4;
      if (me?.year   && s.year   === me.year)   n += 2;
      if (me?.course && s.course === me.course)  n += 1;
      return n;
    }

    return realUsers
      .filter(s => {
        if (isBlocked(s.id)) return false;
        if (s.id === me?.id) return false;
        const q = search.toLowerCase();
        const mq = !q || s.name?.toLowerCase().includes(q);
        const mc = course === 'All' || s.course === course || (s.class && s.class.includes(course.replace('BCom ', '')));
        const my = year === 'All' || s.year === year || (s.class && s.class.startsWith({ '1st Year': '1', '2nd Year': '3', '3rd Year': '5' }[year] || '__'));
        return mq && mc && my;
      })
      .sort((a, b) => score(b) - score(a));
  }, [realUsers, search, course, year, isBlocked, userProfile]);

  const filteredSeed = useMemo(() => students.filter(s => {
    if (isBlocked(s.id)) return false;
    const q = search.toLowerCase();
    const mq = !q || s.name.toLowerCase().includes(q) || s.interest.toLowerCase().includes(q);
    const mc = course === 'All' || s.course === course;
    const my = year === 'All' || s.year === year;
    return mq && mc && my;
  }), [search, course, year, isBlocked]);

  const handleSearch = useCallback(async (text) => {
    setSearch(text);
    const trimmed = text.trim();
    if (trimmed.length < 2) { setDbClubs([]); return; }
    setLoadingClubs(true);
    const { data } = await supabase
      .from('user_clubs')
      .select('id, name, description, emoji, color, logo_url')
      .ilike('name', `%${trimmed}%`)
      .limit(10);
    setDbClubs(data || []);
    setLoadingClubs(false);
  }, []);

  const q = search.trim().toLowerCase();
  const staticClubs = q.length >= 2
    ? hubClubs.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.fullName.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      )
    : [];
  const allMatchedClubs = [...staticClubs, ...dbClubs];
  const showClubs = q.length >= 2;

  function FilterPills({ options, selected, onSelect }) {
    return (
      <View style={styles.pillRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
          {options.map(o => {
            const active = selected === o;
            return (
              <TouchableOpacity
                key={o}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => onSelect(o)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{o}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  function RealCard({ student }) {
    const av = avatarColor(student.name);
    const cc = courseColor(student.course);
    const connected = isConnected(student.id);
    const pending = !connected && hasPendingRequest(student.id);
    const isSelf = userProfile?.id === student.id;
    const connectLabel = connected ? '✓ Connected' : pending ? '⏳ Pending' : '+ Connect';
    const connectStyle = connected
      ? [styles.connectBtn, styles.connectBtnActive]
      : pending
        ? [styles.connectBtn, styles.connectBtnPending]
        : [styles.connectBtn];
    const connectTextStyle = connected
      ? [styles.connectBtnText, styles.connectBtnTextActive]
      : pending
        ? [styles.connectBtnText, styles.connectBtnTextPending]
        : [styles.connectBtnText];

    const handleConnectPress = () => {
      if (connected) {
        Alert.alert('Disconnect', `Disconnect from ${student.name}?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disconnect', style: 'destructive', onPress: () => disconnectUser(student.id) },
        ]);
      } else if (pending) {
        cancelConnectionRequest(student.id);
      } else {
        sendConnectionRequest(student.id, student.name);
        showUndo(student.id, student.name);
      }
    };

    const myInterests = userProfile?.interests || [];
    const shared = myInterests.filter(i => (student.interests || []).includes(i));
    const shownShared = shared.slice(0, 2);
    const extraShared = shared.length - shownShared.length;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('Profile', { studentId: student.id, studentData: student })}
      >
        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: av.bg }]}>
            <Text style={[styles.avatarText, { color: av.text }]}>{initials(student.name)}</Text>
          </View>
          {!isSelf && (
            <TouchableOpacity
              style={connectStyle}
              onPress={handleConnectPress}
              activeOpacity={0.7}
            >
              <Text style={connectTextStyle}>{connectLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.realBadge}>
          <Text style={styles.realBadgeText}>REAL</Text>
        </View>
        <Text style={styles.name}>{student.name}</Text>
        <View style={[styles.courseBadge, { backgroundColor: cc.bg }]}>
          <Text style={[styles.courseText, { color: cc.text }]}>{student.class || student.course}</Text>
        </View>
        {student.campus ? <Text style={styles.meta}>🏛 {student.campus}</Text> : null}
        {shownShared.length > 0 && (
          <View style={styles.sharedRow}>
            {shownShared.map(i => (
              <View key={i} style={styles.sharedChip}>
                <Text style={styles.sharedChipText}>{i}</Text>
              </View>
            ))}
            {extraShared > 0 && (
              <View style={styles.sharedChip}>
                <Text style={styles.sharedChipText}>+{extraShared}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  function SeedCard({ student }) {
    const connected = isConnected(student.id);
    const av = avatarColor(student.name);
    const cc = courseColor(student.course);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('Profile', { studentId: student.id })}
      >
        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: av.bg }]}>
            <Text style={[styles.avatarText, { color: av.text }]}>{initials(student.name)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.connectBtn, connected && styles.connectBtnActive]}
            onPress={() => toggleConnect(student.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.connectBtnText, connected && styles.connectBtnTextActive]}>
              {connected ? '✓ Connected' : '+ Connect'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>{student.name}</Text>
        <View style={[styles.courseBadge, { backgroundColor: cc.bg }]}>
          <Text style={[styles.courseText, { color: cc.text }]}>{student.class || student.course}</Text>
        </View>
        <Text style={styles.meta}>🏛 {student.campus}</Text>
        <Text style={styles.interest}>✨ {student.interest}</Text>
      </TouchableOpacity>
    );
  }

  const totalCount = filteredReal.length + filteredSeed.length;

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={search}
          onChangeText={handleSearch}
          placeholder="Search students, clubs, interests..."
          placeholderTextColor={colors.textTertiary}
          style={styles.searchInput}
        />
      </View>

      <FilterPills options={COURSES} selected={course} onSelect={setCourse} />
      <FilterPills options={YEARS} selected={year} onSelect={setYear} />

      <FlatList
        data={[]}
        keyExtractor={() => ''}
        renderItem={null}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListHeaderComponent={
          <>
            <Text style={styles.sectionLabel}>
              {totalCount} STUDENT{totalCount !== 1 ? 'S' : ''} FOUND
            </Text>

            {/* Real users from Supabase */}
            {loadingReal ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
            ) : filteredReal.length > 0 ? (
              <>
                <Text style={styles.subLabel}>✅ SIGNED-UP STUDENTS</Text>
                <View style={styles.grid}>
                  {filteredReal.map(s => <RealCard key={s.id} student={s} />)}
                </View>
              </>
            ) : null}

            {/* Seed students */}
            {filteredSeed.length > 0 && (
              <>
                <Text style={styles.subLabel}>👥 SAMPLE PROFILES</Text>
                <View style={styles.grid}>
                  {filteredSeed.map(s => <SeedCard key={s.id} student={s} />)}
                </View>
              </>
            )}

            {totalCount === 0 && !loadingReal && (
              <EmptyState
                icon={Users}
                heading="No students yet"
                subtext="Be the first to join and connect with your batchmates"
              />
            )}

            {/* Clubs section — shown when query is active */}
            {showClubs && (
              <>
                <Text style={[styles.subLabel, { marginTop: spacing.lg }]}>🏛️ CLUBS & TEAMS</Text>
                {loadingClubs ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
                ) : allMatchedClubs.length === 0 ? (
                  <EmptyState icon={Star} heading="No clubs found" subtext={`No clubs match "${search.trim()}"`} />
                ) : (
                  allMatchedClubs.map(c => (
                    <TouchableOpacity
                      key={String(c.id)}
                      style={styles.clubRow}
                      onPress={() => navigation.navigate('ClubDetail', { club: c })}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.clubEmoji, { backgroundColor: (c.color || colors.primary) + '25', overflow: 'hidden' }]}>
                        {c.logo_url
                          ? <Image source={{ uri: c.logo_url }} style={styles.clubLogoImg} />
                          : <Text style={{ fontSize: 20 }}>{c.emoji}</Text>
                        }
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.clubRowName}>{c.fullName || c.name}</Text>
                        {!!c.description && (
                          <Text style={styles.clubRowDesc} numberOfLines={1}>{c.description}</Text>
                        )}
                      </View>
                      <Text style={styles.clubChevron}>›</Text>
                    </TouchableOpacity>
                  ))
                )}
              </>
            )}
          </>
        }
      />

      {/* Undo toast */}
      {undoToast && (
        <Animated.View style={[styles.undoToast, { opacity: toastOpacity }]}>
          <Text style={styles.undoToastText}>Request sent to {undoToast.name}</Text>
          <TouchableOpacity onPress={handleUndo} activeOpacity={0.8} style={styles.undoBtn}>
            <Text style={styles.undoBtnText}>Undo</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    marginBottom: spacing.md,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, padding: 0 },

  pillRowWrap: { marginBottom: spacing.sm },
  pillRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.xs, paddingRight: spacing.lg, paddingVertical: 2,
  },
  pill: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: 14, height: 32, justifyContent: 'center',
    alignItems: 'center', backgroundColor: colors.card,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 12, color: colors.textSecondary, ...font.medium, lineHeight: 16 },
  pillTextActive: { color: '#fff', ...font.semibold },

  sectionLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.semibold, marginBottom: spacing.xs, marginTop: spacing.xs,
  },
  subLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.semibold, marginBottom: spacing.sm, marginTop: spacing.md,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  card: {
    width: '48%',
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: 0,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: spacing.sm,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, ...font.bold },

  realBadge: {
    backgroundColor: colors.greenLight, borderWidth: 1, borderColor: colors.greenBorder,
    borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2,
  },
  realBadgeText: { fontSize: 9, ...font.bold, color: colors.green, letterSpacing: 0.5 },

  connectBtn: {
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  connectBtnActive: {
    backgroundColor: colors.greenLight, borderWidth: 1, borderColor: colors.greenBorder,
  },
  connectBtnPending: {
    backgroundColor: colors.cardAlt || colors.card, borderWidth: 1, borderColor: colors.border,
  },
  connectBtnText: { fontSize: 11, color: '#fff', ...font.semibold },
  connectBtnTextActive: { color: colors.green },
  connectBtnTextPending: { color: colors.textSecondary },

  name: { fontSize: 13, ...font.semibold, color: colors.textPrimary, marginBottom: 4 },
  courseBadge: {
    alignSelf: 'flex-start', borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6,
  },
  courseText: { fontSize: 11, ...font.semibold },
  meta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  interest: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },

  sharedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  sharedChip: {
    backgroundColor: colors.primaryLight, borderRadius: radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  sharedChipText: { fontSize: 10, color: colors.primary, ...font.semibold },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 14, color: colors.textSecondary },

  clubRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  clubEmoji: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  clubLogoImg: { width: 44, height: 44, borderRadius: radius.md },
  clubRowName: { fontSize: 14, ...font.semibold, color: colors.textPrimary, marginBottom: 2 },
  clubRowDesc: { fontSize: 11, color: colors.textTertiary },
  clubChevron: { fontSize: 20, color: colors.textTertiary },

  undoToast: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    backgroundColor: '#1E1E2E',
    borderRadius: radius.md,
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    gap: 12,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  undoToastText: { flex: 1, fontSize: 13, color: '#fff', ...font.medium },
  undoBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: radius.sm,
  },
  undoBtnText: { fontSize: 13, color: '#fff', ...font.bold },
});
