import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, avatarColor, initials, courseColor } from '../theme';
import { EmptyState } from '../components/EmptyState';
import { Search, Compass, Users, Star, Landmark } from 'lucide-react-native';
import { ClubLucideIcon } from './HubScreen';
import { supabase } from '../lib/supabase';
import { hubClubs } from '../data';
import { useApp } from '../context/AppContext';

export default function SearchScreen({ navigation }) {
  const { studentGroups } = useApp();
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [dbClubs, setDbClubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const q = query.trim().toLowerCase();

  const matchedGroups = q.length >= 2
    ? studentGroups.filter(g =>
        g.name.toLowerCase().includes(q) ||
        (g.course || '').toLowerCase().includes(q)
      ).slice(0, 5)
    : [];

  const staticClubs = q.length >= 2
    ? hubClubs.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.fullName.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      )
    : [];

  const allMatchedClubs = [...staticClubs, ...dbClubs];

  const search = useCallback(async (text) => {
    setQuery(text);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setStudents([]);
      setDbClubs([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    const [studentsRes, clubsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, course, year, class')
        .ilike('name', `%${trimmed}%`)
        .limit(20),
      supabase
        .from('user_clubs')
        .select('id, name, description, emoji, color, logo_url')
        .ilike('name', `%${trimmed}%`)
        .limit(10),
    ]);
    setStudents(studentsRes.data || []);
    setDbClubs(clubsRes.data || []);
    setLoading(false);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Search size={18} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={search}
          placeholder="Search students, groups, clubs…"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          autoFocus
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setStudents([]); setDbClubs([]); setSearched(false); }}>
            <X size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        {!searched && (
          <View style={styles.hint}>
            <Search size={36} color={colors.textSecondary} />
            <Text style={styles.hintText}>Search for students, study groups, or clubs</Text>
          </View>
        )}

        {/* Students */}
        {searched && (
          <View>
            <View style={{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:spacing.lg,paddingTop:spacing.lg,paddingBottom:spacing.xs}}><User size={13} color={colors.textTertiary} /><Text style={[styles.sectionLabel,{paddingHorizontal:0,paddingTop:0,paddingBottom:0}]}>STUDENTS</Text></View>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
            ) : students.length === 0 ? (
              <EmptyState icon={Users} heading="No students found" subtext={`No students match "${query.trim()}"`} />
            ) : (
              students.map(s => {
                const av = avatarColor(s.name);
                const cc = courseColor(s.course);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.row}
                    onPress={() => navigation.navigate('Profile', { studentId: s.id, studentData: s })}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.avatar, { backgroundColor: av.bg }]}>
                      <Text style={[styles.avatarText, { color: av.text }]}>{initials(s.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{s.name}</Text>
                    </View>
                    <View style={[styles.coursePill, { backgroundColor: cc.bg }]}>
                      <Text style={[styles.coursePillText, { color: cc.text }]}>{s.class || s.course}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* Clubs */}
        {searched && (
          <View>
            <View style={{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:spacing.lg,paddingTop:spacing.lg,paddingBottom:spacing.xs}}><Landmark size={13} color={colors.textTertiary} /><Text style={[styles.sectionLabel,{paddingHorizontal:0,paddingTop:0,paddingBottom:0}]}>CLUBS & TEAMS</Text></View>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
            ) : allMatchedClubs.length === 0 ? (
              <EmptyState icon={Star} heading="No clubs found" subtext={`No clubs match "${query.trim()}"`} />
            ) : (
              allMatchedClubs.map(c => (
                <TouchableOpacity
                  key={String(c.id)}
                  style={styles.row}
                  onPress={() => navigation.navigate('ClubDetail', { clubId: c.id })}
                  activeOpacity={0.75}
                >
                  <View style={[styles.emojiBox, { backgroundColor: (c.color || colors.primary) + '25', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }]}>
                    {c.logo_url
                      ? <Image source={{ uri: c.logo_url }} style={styles.clubLogo} />
                      : <ClubLucideIcon emoji={c.emoji} size={20} color={c.color || colors.primary} />
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{c.fullName || c.name}</Text>
                    {!!c.description && (
                      <Text style={styles.rowSub} numberOfLines={1}>{c.description}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Groups */}
        {matchedGroups.length > 0 && (
          <View>
            <View style={{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:spacing.lg,paddingTop:spacing.lg,paddingBottom:spacing.xs}}><Users size={13} color={colors.textTertiary} /><Text style={[styles.sectionLabel,{paddingHorizontal:0,paddingTop:0,paddingBottom:0}]}>GROUPS</Text></View>
            {matchedGroups.map(g => (
              <TouchableOpacity
                key={g.id}
                style={styles.row}
                onPress={() => navigation.navigate('GroupDetail', { groupId: g.id })}
                activeOpacity={0.75}
              >
                <View style={[styles.emojiBox, { backgroundColor: colors.primaryLight }]}>
                  <Text style={{ fontSize: 20 }}>{g.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{g.name}</Text>
                  <Text style={styles.rowSub}>{g.course} · {g.members} members</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  input: {
    flex: 1, fontSize: 15, color: colors.textPrimary,
    paddingVertical: 8,
    outlineWidth: 0,
  },
  clearBtn: { fontSize: 14, color: colors.textTertiary, padding: 4 },
  hint: { alignItems: 'center', paddingTop: 64, gap: 10 },
  hintIcon: { fontSize: 36 },
  hintText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  sectionLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold,
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, ...font.bold },
  emojiBox: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  clubLogo: { width: 44, height: 44, borderRadius: radius.md },
  rowName: { fontSize: 14, ...font.semibold, color: colors.textPrimary, marginBottom: 2 },
  rowSub: { fontSize: 11, color: colors.textTertiary },
  coursePill: {
    borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  coursePillText: { fontSize: 10, ...font.semibold },
});
