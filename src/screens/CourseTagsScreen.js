import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import {
  colors as tColors,
  typography,
  spacing as tSpacing,
  radius as tRadius,
  shadows,
} from '../theme/tokens';
import { Search, X, Check, Sparkles } from 'lucide-react-native';

export default function CourseTagsScreen({ navigation }) {
  const { userProfile } = useApp();

  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [suggestedTags, setSuggested] = useState([]);
  const [allTags, setAllTags]         = useState([]);
  const [selected, setSelected]       = useState(new Set());
  const [search, setSearch]           = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);

    const [dtmRes, coursesRes, existingRes] = await Promise.all([
      supabase
        .from('degree_tag_mapping')
        .select('suggested_tags')
        .eq('university_id', userProfile.university_id)
        .eq('class_name', userProfile.class)
        .maybeSingle(),
      supabase.from('courses').select('skill_tags'),
      supabase
        .from('student_interest_tags')
        .select('tag')
        .eq('student_id', userProfile.id),
    ]);

    const suggested   = dtmRes.data?.suggested_tags || [];
    const tagSet      = new Set();
    (coursesRes.data || []).forEach(c => c.skill_tags?.forEach(t => tagSet.add(t)));
    const existingTags = (existingRes.data || []).map(r => r.tag);

    setSuggested(suggested);
    setAllTags([...tagSet].sort());
    setSelected(new Set(existingTags.length > 0 ? existingTags : suggested));
    setLoading(false);
  }

  function toggle(tag) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await supabase
        .from('student_interest_tags')
        .delete()
        .eq('student_id', userProfile.id);

      const rows = [...selected].map(tag => ({
        student_id: userProfile.id,
        tag,
        source: suggestedTags.includes(tag) ? 'auto' : 'manual',
      }));

      if (rows.length > 0) {
        await supabase.from('student_interest_tags').insert(rows);
      }

      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const browseTags = useMemo(() => {
    const q = search.toLowerCase();
    return allTags.filter(t => !suggestedTags.includes(t) && (!q || t.includes(q)));
  }, [allTags, suggestedTags, search]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tColors.student.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Sparkles size={22} color={tColors.student.primary} />
          </View>
          <Text style={styles.heroTitle}>Your Learning Tags</Text>
          <Text style={styles.heroSub}>
            Tags tell us what subjects to match courses to. We've pre-selected ones
            relevant to {userProfile.class || 'your degree'}.
          </Text>
        </View>

        {/* Suggested for your class */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            SUGGESTED FOR {(userProfile.class || 'YOUR DEGREE').toUpperCase()}
          </Text>
          <View style={styles.chipsWrap}>
            {suggestedTags.map(tag => {
              const on = selected.has(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => toggle(tag)}
                  activeOpacity={0.75}
                >
                  {on && <Check size={11} color={tColors.student.primary} />}
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
            {suggestedTags.length === 0 && (
              <Text style={styles.emptyHint}>
                No suggestions for your class yet — browse below.
              </Text>
            )}
          </View>
        </View>

        {/* Browse all tags */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ADD MORE</Text>
          <View style={styles.searchRow}>
            <Search size={14} color={tColors.textTertiary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search topics…"
              placeholderTextColor={tColors.textTertiary}
              style={styles.searchInput}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={14} color={tColors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.chipsWrap}>
            {browseTags.map(tag => {
              const on = selected.has(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => toggle(tag)}
                  activeOpacity={0.75}
                >
                  {on && <Check size={11} color={tColors.student.primary} />}
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

      </ScrollView>

      {/* Footer — normal flex child, not absolute */}
      <View style={styles.footer}>
        <Text style={styles.footerCount}>
          {selected.size} tag{selected.size !== 1 ? 's' : ''} selected
        </Text>
        <TouchableOpacity
          style={[styles.saveBtn, (saving || selected.size === 0) && styles.saveBtnDisabled]}
          onPress={save}
          disabled={saving || selected.size === 0}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveBtnText}>Save Tags</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: tColors.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scroll:     { padding: tSpacing.base, paddingBottom: tSpacing.lg },

  hero: { alignItems: 'center', paddingVertical: tSpacing.xl, gap: tSpacing.sm },
  heroIcon: {
    width: 48, height: 48, borderRadius: tRadius.lg,
    backgroundColor: tColors.student.primaryDim,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: tSpacing.xs,
  },
  heroTitle: { fontSize: 18, fontWeight: typography.bold, color: tColors.textPrimary, textAlign: 'center' },
  heroSub: {
    fontSize: 13, color: tColors.textSecondary, textAlign: 'center',
    lineHeight: 19, maxWidth: 320,
  },

  section:      { marginBottom: tSpacing.lg },
  sectionLabel: {
    fontSize: 10, color: tColors.textSecondary, letterSpacing: 0.8,
    fontWeight: typography.bold, marginBottom: tSpacing.sm,
  },
  emptyHint: { fontSize: 13, color: tColors.textTertiary, fontStyle: 'italic' },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: tColors.card,
  },
  chipOn: {
    backgroundColor: tColors.student.primaryDim,
    borderColor: tColors.student.primary,
  },
  chipText:   { fontSize: 12, color: tColors.textSecondary, fontWeight: typography.semibold },
  chipTextOn: { color: tColors.student.primary },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, paddingHorizontal: tSpacing.md, paddingVertical: tSpacing.sm,
    marginBottom: tSpacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: tColors.textPrimary },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: tColors.card, borderTopWidth: 1, borderTopColor: tColors.border,
    paddingHorizontal: tSpacing.base, paddingTop: tSpacing.md, paddingBottom: tSpacing.xl,
  },
  footerCount: { fontSize: 13, color: tColors.textSecondary, fontWeight: typography.semibold },
  saveBtn: {
    backgroundColor: tColors.student.primary,
    borderRadius: tRadius.md, paddingVertical: 12, paddingHorizontal: 28,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontSize: 14, color: '#fff', fontWeight: typography.bold },
});
