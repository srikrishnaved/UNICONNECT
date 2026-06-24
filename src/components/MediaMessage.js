import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { isImageUrl, getFileIcon, getFileName } from '../lib/uploadMedia';
import { colors, spacing, radius, font } from '../theme';

export default function MediaMessage({ url, isMe }) {
  if (!url) return null;

  if (isImageUrl(url)) {
    return (
      <TouchableOpacity onPress={() => Linking.openURL(url)} activeOpacity={0.85}>
        <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
      </TouchableOpacity>
    );
  }

  const icon = getFileIcon(url);
  const name = getFileName(url);

  return (
    <TouchableOpacity
      style={[styles.fileCard, isMe && styles.fileCardMe]}
      onPress={() => Linking.openURL(url)}
      activeOpacity={0.8}
    >
      <Text style={styles.fileIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.fileName, isMe && styles.fileNameMe]} numberOfLines={2}>{name}</Text>
        <Text style={[styles.fileOpen, isMe && styles.fileOpenMe]}>Tap to open</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  image: {
    width: 200, height: 150, borderRadius: radius.md, marginBottom: 4,
  },
  fileCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: 4,
    minWidth: 160, maxWidth: 220,
  },
  fileCardMe: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  fileIcon: { fontSize: 26, flexShrink: 0 },
  fileName: { fontSize: 12, ...font.semibold, color: colors.textPrimary, lineHeight: 16 },
  fileNameMe: { color: '#fff' },
  fileOpen: { fontSize: 10, color: colors.primary, marginTop: 2 },
  fileOpenMe: { color: 'rgba(255,255,255,0.7)' },
});
