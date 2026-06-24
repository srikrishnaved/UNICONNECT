import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hubClubs } from '../data';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, font } from '../theme';

export default function EventDetailScreen({ route }) {
  const event = route.params.event;
  const { interestedEventIds, toggleEventInterest, userCreatedClubs } = useApp();

  const allClubs = [...hubClubs, ...(userCreatedClubs || [])];
  const club = allClubs.find(c => String(c.id) === String(event.clubId)) || {
    name: 'Unknown Club',
    emoji: '🏛️',
    color: colors.primary,
    logo_url: null,
  };

  const isInterested = interestedEventIds.has(String(event.id));
  const displayCount = event.interested + (isInterested ? 1 : 0);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Hero */}
        {event.imageUri ? (
          <Image source={{ uri: event.imageUri }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroBanner, { backgroundColor: club.color + '22' }]}>
            {club.logo_url
              ? <Image source={{ uri: club.logo_url }} style={styles.heroLogo} />
              : <Text style={styles.heroEmoji}>{club.emoji}</Text>
            }
          </View>
        )}

        <View style={styles.content}>
          {/* Club tag */}
          <Text style={[styles.clubTag, { color: club.color }]}>{club.name}</Text>

          {/* Title */}
          <Text style={styles.title}>{event.title}</Text>

          {/* Meta */}
          <View style={styles.metaBlock}>
            <Text style={styles.metaLine}>📅 {event.time}</Text>
            {!!event.venue && <Text style={styles.metaLine}>📍 {event.venue}</Text>}
          </View>

          {/* Description */}
          {!!event.desc && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ABOUT THIS EVENT</Text>
              <Text style={styles.desc}>{event.desc}</Text>
            </View>
          )}

          {/* Interested */}
          <View style={styles.interestedRow}>
            <Text style={styles.interestedCount}>👥 {displayCount} interested</Text>
            <TouchableOpacity
              style={[styles.interestedBtn, isInterested && styles.interestedBtnActive]}
              onPress={() => toggleEventInterest(event.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.interestedBtnText, isInterested && styles.interestedBtnTextActive]}>
                {isInterested ? '✓ Interested' : '+ Interested'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  heroImage: { width: '100%', height: 220 },
  heroBanner: {
    height: 180, alignItems: 'center', justifyContent: 'center',
  },
  heroLogo: { width: 80, height: 80, borderRadius: radius.md },
  heroEmoji: { fontSize: 64 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  clubTag: { fontSize: 12, ...font.bold, letterSpacing: 0.6, marginBottom: 6 },
  title: { fontSize: 22, ...font.bold, color: colors.textPrimary, lineHeight: 30, marginBottom: spacing.md },
  metaBlock: { gap: 6, marginBottom: spacing.lg },
  metaLine: { fontSize: 14, color: colors.textSecondary },
  section: { marginBottom: spacing.lg },
  sectionLabel: {
    fontSize: 10, ...font.bold, color: colors.textSecondary,
    letterSpacing: 0.8, marginBottom: spacing.sm,
  },
  desc: { fontSize: 14, color: colors.textPrimary, lineHeight: 22 },
  interestedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  interestedCount: { fontSize: 14, color: colors.textSecondary, ...font.medium },
  interestedBtn: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.full, paddingHorizontal: 18, paddingVertical: 8,
  },
  interestedBtnActive: {
    backgroundColor: colors.primaryLight, borderColor: colors.primary,
  },
  interestedBtnText: { fontSize: 13, color: colors.textSecondary, ...font.semibold },
  interestedBtnTextActive: { color: colors.primary },
});
