import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius, font, avatarColor, initials } from '../theme';
import { EmptyState } from '../components/EmptyState';
import { GraduationCap, Search, Landmark, MessageCircle, UserCheck } from 'lucide-react-native';

export default function TeachersScreen() {
  const [search, setSearch] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, email, campus, teacher_profiles(subjects, faculty_type, available_days)')
      .eq('role', 'teacher')
      .eq('status', 'active')
      .order('name', { ascending: true })
      .then(({ data }) => {
        setTeachers(data || []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.teacher_profiles?.faculty_type || '').toLowerCase().includes(q) ||
      (t.teacher_profiles?.subjects || []).some(s => s.toLowerCase().includes(q))
    );
  }, [teachers, search]);

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Department of Professional Studies</Text>
        <Text style={styles.bannerSub}>Yeshwanthpur Campus · {teachers.length} Faculty Member{teachers.length !== 1 ? 's' : ''}</Text>
      </View>

      <View style={styles.searchBar}>
        <Search size={18} color={colors.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or specialisation..."
          placeholderTextColor={colors.textTertiary}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => 'x'}
          renderItem={null}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
          ListHeaderComponent={
            <>
              {filtered.length > 0 && (
                <>
                  <View style={{flexDirection:'row',alignItems:'center',gap:6}}><UserCheck size={13} color={colors.textTertiary} /><Text style={styles.sectionLabel}>FACULTY ({filtered.length})</Text></View>
                  {filtered.map(t => <TeacherCard key={t.id} teacher={t} />)}
                </>
              )}

              {filtered.length === 0 && (
                <EmptyState
                  icon={GraduationCap}
                  heading={search ? 'No faculty match your search' : 'No faculty logged in yet'}
                  subtext={search ? 'Try a different name or subject' : 'Teachers will appear here once they join'}
                />
              )}
            </>
          }
        />
      )}
    </View>
  );
}

function TeacherCard({ teacher }) {
  const navigation = useNavigation();
  const av = avatarColor(teacher.name);
  const tp = teacher.teacher_profiles;
  const subjects = tp?.subjects || [];
  const facultyType = tp?.faculty_type;

  return (
    <View style={styles.card}>
      <View style={[styles.avatar, { backgroundColor: av.bg }]}>
        <Text style={[styles.avatarText, { color: av.text }]}>{initials(teacher.name)}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{teacher.name}</Text>

        {facultyType && (
          <View style={styles.positionPill}>
            <Text style={styles.positionText}>{facultyType}</Text>
          </View>
        )}

        {teacher.campus && (
          <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Landmark size={12} color={colors.textTertiary} /><Text style={styles.specialisation}>{teacher.campus}</Text></View>
        )}

        {subjects.length > 0 && (
          <View style={styles.subjectsRow}>
            {subjects.map(s => (
              <View key={s} style={styles.subjectPill}>
                <Text style={styles.subjectText}>{s}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.msgBtn}
        onPress={() => navigation.navigate('DM', {
          personKey: `teacher-${teacher.id}`,
          name: teacher.name,
          isTeacher: true,
        })}
        activeOpacity={0.7}
      >
        <MessageCircle size={18} color={colors.textPrimary} />
      </TouchableOpacity>
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
  bannerTitle: { fontSize: 14, ...font.bold, color: colors.textPrimary, marginBottom: 2 },
  bannerSub: { fontSize: 11, color: colors.textSecondary },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    marginBottom: spacing.md,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, padding: 0, outlineWidth: 0 },

  sectionLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold, marginBottom: spacing.sm, marginTop: spacing.xs,
  },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },

  avatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, ...font.bold },

  name: { fontSize: 14, ...font.bold, color: colors.textPrimary, marginBottom: 3 },

  positionPill: {
    alignSelf: 'flex-start', backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4,
  },
  positionText: { fontSize: 10, ...font.bold, color: colors.primary, letterSpacing: 0.4 },
  specialisation: { fontSize: 11, color: colors.textSecondary, marginBottom: 6 },

  subjectsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  subjectPill: {
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  subjectText: { fontSize: 10, color: colors.textTertiary },

  msgBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  msgIcon: { fontSize: 16 },
});
