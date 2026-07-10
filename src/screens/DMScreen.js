import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { pickAndUploadMedia } from '../lib/uploadMedia';
import MediaMessage from '../components/MediaMessage';
import { colors, spacing, radius, font, avatarColor, initials } from '../theme';
import { EmptyState } from '../components/EmptyState';
import { MessageCircle, Clock, Lock, Paperclip } from 'lucide-react-native';

export default function DMScreen({ route, navigation }) {
  const { personKey, name, isTeacher, recipientId } = route.params;
  const { userProfile, createNotification, isConnected, hasPendingRequest } = useApp();

  const myName  = userProfile?.name || 'You';
  const myAbbr  = userProfile?.name ? initials(userProfile.name) : '?';
  const myAv    = userProfile?.name ? avatarColor(userProfile.name) : { bg: colors.pink, text: '#fff' };
  const theirAv = avatarColor(name);
  const theirAbbr = initials(name);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const scrollRef = useRef();

  useEffect(() => {
    navigation.setOptions({ title: name });
  }, [name]);

  useEffect(() => {
    if (!userProfile?.id) return;

    // theirId: UUID for student recipients, 'teacher-X' for teacher chats
    const theirId = recipientId ?? personKey;

    const buildMsg = (from) => (m) => ({
      from,
      text: m.text,
      media_url: m.media_url || null,
      time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      created_at: m.created_at,
      id: m.id,
    });

    const queries = [
      // My sent messages (old + new format)
      supabase.from('direct_messages').select('*')
        .eq('sender_id', userProfile.id)
        .eq('conversation_key', personKey)
        .order('created_at', { ascending: true }),
      // Their replies via new recipient_id format
      supabase.from('direct_messages').select('*')
        .eq('sender_id', theirId)
        .eq('recipient_id', userProfile.id)
        .order('created_at', { ascending: true }),
    ];

    // For student→student: also load old-format replies (no recipient_id set yet)
    if (recipientId && recipientId !== userProfile.id) {
      queries.push(
        supabase.from('direct_messages').select('*')
          .eq('sender_id', recipientId)
          .eq('conversation_key', `student-${userProfile.id}`)
          .is('recipient_id', null)
          .order('created_at', { ascending: true })
      );
    }

    Promise.all(queries).then((results) => {
      const seen = new Set();
      const all = [];
      results.forEach((r, i) => {
        (r.data || []).forEach(m => {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            const from = m.sender_id === userProfile.id ? 'me' : 'them';
            all.push(buildMsg(from)(m));
          }
        });
      });
      all.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      if (all.length > 0) setMessages(all);
    });

    // Mark their messages to us as read
    if (theirId) {
      supabase.from('direct_messages')
        .update({ read: true })
        .eq('sender_id', theirId)
        .eq('recipient_id', userProfile.id)
        .eq('read', false)
        .then(() => {});
    }

    // Real-time subscription: receive new messages without a page reload
    const channel = supabase
      .channel(`dm-${userProfile.id}-${theirId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `recipient_id=eq.${userProfile.id}`,
        },
        (payload) => {
          const m = payload.new;
          // Only process messages from this specific conversation
          if (m.sender_id !== theirId) return;
          setMessages(prev => {
            if (prev.some(msg => msg.id === m.id)) return prev;
            return [...prev, {
              from: 'them',
              text: m.text,
              media_url: m.media_url || null,
              time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              created_at: m.created_at,
              id: m.id,
            }];
          });
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.id, personKey, recipientId]);

  const send = async (mediaUrl = null) => {
    const text = draft.trim();
    if (!text && !mediaUrl) return;
    if (!userProfile?.id) return;
    const theirId = recipientId ?? personKey;
    setMessages(prev => [...prev, { from: 'me', text, media_url: mediaUrl, time: 'now', created_at: new Date().toISOString(), id: `local-${Date.now()}` }]);
    if (text) setDraft('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    await supabase.from('direct_messages').insert({
      sender_id: userProfile.id,
      conversation_key: personKey,
      recipient_id: theirId,
      text: text || null,
      media_url: mediaUrl || null,
    });
    if (theirId && theirId !== userProfile.id) {
      createNotification(
        theirId, 'dm', `New message from ${userProfile.name}`,
        mediaUrl ? 'Sent a photo' : (text.length > 60 ? text.slice(0, 57) + '…' : text),
        { person_key: `student-${userProfile.id}`, recipient_id: userProfile.id, sender_name: userProfile.name, is_teacher: false }
      );
    }
  };

  const pickMedia = async () => {
    setUploadingMedia(true);
    try {
      const url = await pickAndUploadMedia();
      if (url) await send(url);
    } catch (e) {
      alert('Failed to upload image: ' + (e.message || 'Unknown error'));
    } finally {
      setUploadingMedia(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Recipient header */}
      <View style={styles.recipientBar}>
        <View style={[styles.avatar, { backgroundColor: theirAv.bg }]}>
          <Text style={[styles.avatarText, { color: theirAv.text }]}>{theirAbbr}</Text>
        </View>
        <View>
          <Text style={styles.recipientName}>{name}</Text>
          <Text style={styles.recipientSub}>{isTeacher ? 'Faculty · Yeshwanthpur' : 'Student · ChristConnect'}</Text>
        </View>
      </View>

      {/* Disappearing messages notice */}
      <View style={styles.expiryBanner}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
          <Clock size={13} color={colors.textTertiary} />
          <Text style={styles.expiryText}>Messages & media are wiped every 3 days</Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messagesArea}
        contentContainerStyle={{ paddingVertical: spacing.md }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            heading="No messages yet"
            subtext={
              isTeacher
                ? 'Send a message to reach out to this faculty member.'
                : hasPendingRequest(recipientId)
                  ? 'Connection pending — waiting for acceptance.'
                  : "You're connected — say hi!"
            }
          />
        ) : (
          messages.map((m, i) => {
            const isMe = m.from === 'me';
            return (
              <View key={i} style={[styles.msgRow, isMe && styles.msgRowMe]}>
                {!isMe && (
                  <View style={[styles.msgAvatar, { backgroundColor: theirAv.bg }]}>
                    <Text style={[styles.msgAvatarText, { color: theirAv.text }]}>{theirAbbr}</Text>
                  </View>
                )}
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                  <MediaMessage url={m.media_url} isMe={isMe} />
                  {m.text ? <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{m.text}</Text> : null}
                  <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>{m.time}</Text>
                </View>
                {isMe && (
                  <View style={[styles.msgAvatar, { backgroundColor: myAv.bg }]}>
                    <Text style={[styles.msgAvatarText, { color: myAv.text }]}>{myAbbr}</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Input */}
      {!isTeacher && recipientId && !isConnected(recipientId) ? (
        <View style={styles.lockedBar}>
          <Lock size={16} color={colors.textTertiary} />
          <Text style={styles.lockedText}>Connect with {name.split(' ')[0]} to send messages</Text>
        </View>
      ) : (
        <View style={styles.inputArea}>
          <TouchableOpacity onPress={pickMedia} style={styles.mediaBtn} disabled={uploadingMedia} activeOpacity={0.7}>
            {uploadingMedia
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Paperclip size={20} color={colors.textSecondary} />}
          </TouchableOpacity>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`Message ${name.split(' ')[0]}...`}
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, !draft.trim() && { opacity: 0.4 }]}
            onPress={() => send()}
            disabled={!draft.trim()}
            activeOpacity={0.7}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  recipientBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, ...font.bold },
  recipientName: { fontSize: 15, ...font.bold, color: colors.textPrimary },
  recipientSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },

  messagesArea: { flex: 1, paddingHorizontal: spacing.md },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: spacing.xl },
  emptyAvatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyAvatarText: { fontSize: 24, ...font.bold },
  emptyName: { fontSize: 17, ...font.bold, color: colors.textPrimary, marginBottom: 6 },
  emptyHint: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.sm },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  msgAvatarText: { fontSize: 10, ...font.bold },

  bubble: {
    maxWidth: '72%',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: 18,
  },
  bubbleThem: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: colors.textTertiary, marginTop: 3 },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },

  msgImage: { width: 200, height: 150, borderRadius: 8, marginBottom: 4 },
  mediaBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  expiryBanner: {
    backgroundColor: '#78350f18',
    borderBottomWidth: 1, borderBottomColor: '#92400e30',
    paddingVertical: 6, paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  expiryText: { fontSize: 11, color: '#92400e', ...font.medium },

  lockedBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, paddingBottom: spacing.lg,
    backgroundColor: colors.card,
    borderTopWidth: 1, borderTopColor: colors.border,
    justifyContent: 'center',
  },
  lockedIcon: { fontSize: 16 },
  lockedText: { fontSize: 13, color: colors.textSecondary, ...font.medium },
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    padding: spacing.sm, paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 10, paddingBottom: 10,
    color: colors.textPrimary, fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendIcon: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
