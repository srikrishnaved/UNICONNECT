import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, font, spacing } from '../theme';

export function EmptyState({ icon: Icon, heading, subtext }) {
  return (
    <View style={styles.container}>
      <Icon size={48} color={colors.textTertiary} strokeWidth={1.5} />
      <Text style={styles.heading}>{heading}</Text>
      {!!subtext && <Text style={styles.subtext}>{subtext}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.xl,
  },
  heading: {
    fontSize: 15,
    ...font.semibold,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 19,
  },
});
