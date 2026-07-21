import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import {
  colors as tColors,
  typography,
  spacing as tSpacing,
  radius as tRadius,
  shadows,
} from '../theme/tokens';
import { ExternalLink, Tag, BookOpen, Clock } from 'lucide-react-native';

// 1st/2nd year → prefer Beginner; 3rd year → prefer Intermediate
const PREFERRED_LEVEL = {
  '1st Year': 'Beginner',
  '2nd Year': 'Beginner',
  '3rd Year': 'Intermediate',
};

const LEVEL_STYLE = {
  Beginner:     { bg: 'rgba(16,185,129,0.1)',  text: '#10B981', border: 'rgba(16,185,129,0.3)' },
  Intermediate: { bg: 'rgba(245,158,11,0.1)',  text: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
  Advanced:     { bg: 'rgba(239,68,68,0.1)',   text: '#EF4444', border: 'rgba(239,68,68,0.3)' },
};

const CATEGORY_COLOR = {
  Finance:       '#C9622E',
  Tech:          '#0EA5E9',
  Business:      '#8B5CF6',
  Communication: '#F59E0B',
};

// interests = userProfile.interests, e.g. ['Finance', 'Technology']
// These match course categories directly, so give a +1 boost
function scoreFor(course, tagSet, year, interests) {
  const overlap       = (course.skill_tags || []).filter(t => tagSet.has(t)).length;
  const levelBoost    = PREFERRED_LEVEL[year] === course.level ? 0.5 : 0;
  const interestBoost = (interests || []).includes(course.category) ? 1 : 0;
  return overlap + levelBoost + interestBoost;
}

export default function CourseRecommendationsScreen() {
  const navigation        = useNavigation();
  const { userProfile }   = useApp();
  const [courses, setCourses]       = useState([]);
  const [tags, setTags]             = useState([]);
  const [usingFallback, setFallback] = useState(false);
  const [loading, setLoading]       = useState(true);

  // Reload every time the screen comes into focus so saved-tag changes reflect immediately
  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    setLoading(true);
    const [coursesRes, tagsRes, dtmRes] = await Promise.all([
      supabase.from('courses').select('*'),
      supabase
        .from('student_interest_tags')
        .select('tag')
        .eq('student_id', userProfile.id),
      supabase
        .from('degree_tag_mapping')
        .select('suggested_tags')
        .eq('university_id', userProfile.university_id)
        .eq('class_name', userProfile.class)
        .maybeSingle(),
    ]);

    const saved = (tagsRes.data || []).map(r => r.tag);

    if (saved.length > 0) {
      setTags(saved);
      setFallback(false);
    } else {
      // No saved tags — auto-use degree suggestions so results appear immediately
      const degreeTags = dtmRes.data?.suggested_tags || [];
      setTags(degreeTags);
      setFallback(true);
    }

    setCourses(coursesRes.data || []);
    setLoading(false);
  }

  const interests = userProfile?.interests || [];

  const ranked = useMemo(() => {
    if (!tags.length && !interests.length) return [];
    const tagSet = new Set(tags);
    return courses
      .map(c => ({ ...c, _score: scoreFor(c, tagSet, userProfile.year, interests) }))
      .filter(c => c._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 15);
  }, [courses, tags, interests, userProfile.year]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tColors.student.primary} />
      </View>
    );
  }


  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Recommended Courses</Text>
          <Text style={styles.headerSub}>
            {usingFallback
              ? `Based on your ${userProfile.class || 'degree'} profile`
              : `Matched to your ${tags.length} saved tag${tags.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.editTagsBtn}
          onPress={() => navigation.navigate('CourseTags')}
          activeOpacity={0.8}
        >
          <Text style={styles.editTagsBtnText}>Edit Tags</Text>
        </TouchableOpacity>
      </View>

      {ranked.length === 0 ? (
        <View style={styles.noMatchBox}>
          <BookOpen size={28} color={tColors.textTertiary} />
          <Text style={styles.noMatchTitle}>No matches found</Text>
          <Text style={styles.noMatchSub}>
            Customise your learning tags to see tailored course picks.
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { marginTop: tSpacing.md }]}
            onPress={() => navigation.navigate('CourseTags')}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyBtnText}>Edit Tags</Text>
          </TouchableOpacity>
        </View>
      ) : (
        ranked.map(course => {
          const levelStyle = LEVEL_STYLE[course.level] || LEVEL_STYLE.Beginner;
          const catColor   = CATEGORY_COLOR[course.category] || tColors.student.primary;
          const matchedTagSet = new Set(tags);

          return (
            <View key={course.id} style={styles.card}>
              {/* Left accent strip */}
              <View style={[styles.strip, { backgroundColor: catColor }]} />

              <View style={styles.cardBody}>
                {/* Badges */}
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: `${catColor}18`, borderColor: `${catColor}44` }]}>
                    <Text style={[styles.badgeText, { color: catColor }]}>{course.category}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: levelStyle.bg, borderColor: levelStyle.border }]}>
                    <Text style={[styles.badgeText, { color: levelStyle.text }]}>{course.level}</Text>
                  </View>
                  {!!course.estimated_hours && (
                    <View style={[styles.badge, { backgroundColor: tColors.card, borderColor: tColors.border }]}>
                      <Clock size={9} color={tColors.textTertiary} />
                      <Text style={[styles.badgeText, { color: tColors.textTertiary }]}>
                        {course.estimated_hours}h
                      </Text>
                    </View>
                  )}
                  {course.is_free && (
                    <View style={[styles.badge, { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' }]}>
                      <Text style={[styles.badgeText, { color: '#10B981' }]}>Free audit</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.cardTitle} numberOfLines={2}>{course.title}</Text>

                {!!course.description && (
                  <Text style={styles.cardDesc} numberOfLines={2}>{course.description}</Text>
                )}

                {/* Matched tags */}
                <View style={styles.tagsRow}>
                  {(course.skill_tags || []).slice(0, 5).map(tag => {
                    const matched = matchedTagSet.has(tag);
                    return (
                      <View key={tag} style={[styles.tagChip, matched && styles.tagChipMatch]}>
                        <Text style={[styles.tagChipText, matched && styles.tagChipTextMatch]}>
                          {tag}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.viewBtn, { backgroundColor: catColor }]}
                  onPress={() => Linking.openURL(course.coursera_url)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.viewBtnText}>View on Coursera</Text>
                  <ExternalLink size={13} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tColors.bg },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 12,
  },
  scroll: { padding: tSpacing.md, paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: tSpacing.base,
  },
  headerLeft:    { flex: 1 },
  headerTitle:   { fontSize: 18, fontWeight: typography.bold, color: tColors.textPrimary, marginBottom: 2 },
  headerSub:     { fontSize: 12, color: tColors.textSecondary },
  editTagsBtn: {
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, paddingHorizontal: 12, paddingVertical: 7,
  },
  editTagsBtnText: { fontSize: 12, color: tColors.textPrimary, fontWeight: typography.semibold },

  emptyIcon: {
    width: 64, height: 64, borderRadius: tRadius.lg,
    backgroundColor: tColors.student.primaryDim,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: typography.bold, color: tColors.textPrimary, textAlign: 'center' },
  emptySub: {
    fontSize: 13, color: tColors.textSecondary, textAlign: 'center',
    lineHeight: 19, maxWidth: 280,
  },
  emptyBtn: {
    backgroundColor: tColors.student.primary,
    borderRadius: tRadius.md, paddingVertical: 12, paddingHorizontal: 28,
    marginTop: tSpacing.sm,
  },
  emptyBtnText: { fontSize: 14, color: '#fff', fontWeight: typography.bold },

  noMatchBox: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  noMatchTitle: { fontSize: 15, fontWeight: typography.bold, color: tColors.textPrimary },
  noMatchSub:   { fontSize: 13, color: tColors.textTertiary, textAlign: 'center' },

  card: {
    flexDirection: 'row',
    backgroundColor: tColors.card,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.lg,
    marginBottom: tSpacing.sm,
    overflow: 'hidden',
    ...shadows.card,
  },
  strip:    { width: 4 },
  cardBody: { flex: 1, padding: tSpacing.md, gap: 8 },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderWidth: 1, borderRadius: tRadius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeText: { fontSize: 10, fontWeight: typography.bold },

  cardTitle: { fontSize: 14, fontWeight: typography.bold, color: tColors.textPrimary, lineHeight: 19 },
  cardDesc:  { fontSize: 12, color: tColors.textSecondary, lineHeight: 17 },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tagChip: {
    borderWidth: 1, borderColor: tColors.border, borderRadius: tRadius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: tColors.bg,
  },
  tagChipMatch:     { backgroundColor: tColors.student.primaryDim, borderColor: tColors.student.primary },
  tagChipText:      { fontSize: 10, color: tColors.textSecondary },
  tagChipTextMatch: { color: tColors.student.primary, fontWeight: typography.semibold },

  viewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: tRadius.md, paddingVertical: 10, marginTop: 4,
  },
  viewBtnText: { fontSize: 13, color: '#fff', fontWeight: typography.bold },
});
