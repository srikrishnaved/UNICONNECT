import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Modal, ActivityIndicator } from 'react-native';
import { pickAndUploadMedia } from '../lib/uploadMedia';
import MediaMessage from '../components/MediaMessage';
import { colors, spacing, radius, font, avatarColor, initials, courseColor } from '../theme';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { hubClubs, teachers } from '../data';
// Flip to true after creating the group_teacher_requests table in Supabase
const GROUP_TEACHER_TABLE_EXISTS = false;

export default function GroupDetailScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { userProfile, studentGroups, teacherGroups, createNotification } = useApp();

  const isClubGroup = String(groupId).startsWith('club_');
  const clubId = isClubGroup ? parseInt(String(groupId).replace('club_', ''), 10) : null;
  const clubData = isClubGroup ? hubClubs.find(c => c.id === clubId) : null;

  const group = isClubGroup
    ? (clubData ? {
        id: groupId,
        name: clubData.name,
        emoji: clubData.emoji,
        course: 'Club',
        members: clubData.members,
        active: true,
        desc: clubData.desc,
        recentMessages: [],
      } : null)
    : [...studentGroups, ...teacherGroups].find(g => g.id === groupId);

  const myName = userProfile?.name || 'You';
  const myAbbr = userProfile?.name ? initials(userProfile.name) : '?';
  const myAv = userProfile?.name ? avatarColor(userProfile.name) : { bg: colors.pink, text: '#fff' };
  const [messages, setMessages] = useState(group?.recentMessages || []);
  const [draft, setDraft] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const scrollRef = useRef();
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showInviteTeacher, setShowInviteTeacher] = useState(false);
  const [sendingTeacher, setSendingTeacher] = useState(null);
  const [sentTeacherIds, setSentTeacherIds] = useState(new Set());

  const loadMembers = async () => {
    setLoadingMembers(true);
    if (isClubGroup) {
      const { data: rows } = await supabase
        .from('club_memberships')
        .select('user_id')
        .eq('club_id', clubId);
      if (rows && rows.length > 0) {
        const ids = rows.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, course, year')
          .in('id', ids);
        setMembers(profiles || []);
      } else {
        setMembers([]);
      }
    } else {
      const { data: rows } = await supabase
        .from('group_memberships')
        .select('user_id')
        .eq('group_id', String(groupId));
      if (rows && rows.length > 0) {
        const ids = rows.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, course, year')
          .in('id', ids);
        setMembers(profiles || []);
      } else {
        setMembers([]);
      }
    }
    setLoadingMembers(false);
  };

  useEffect(() => {
    if (group) navigation.setOptions({ title: group.name });
  }, [group]);

  useEffect(() => {
    if (isClubGroup || !groupId || !GROUP_TEACHER_TABLE_EXISTS) return;
    supabase
      .from('group_teacher_requests')
      .select('teacher_id')
      .eq('group_id', String(groupId))
      .then(({ data }) => {
        if (data) setSentTeacherIds(new Set(data.map(r => r.teacher_id)));
      })
      .catch(() => {});
  }, [groupId]);

  const handleInviteTeacher = async (teacher) => {
    if (!userProfile?.id || !GROUP_TEACHER_TABLE_EXISTS) return;
    setSendingTeacher(teacher.id);
    let error;
    try {
      ({ error } = await supabase.from('group_teacher_requests').insert({
        group_id: String(groupId),
        group_name: group.name,
        group_emoji: group.emoji,
        requested_by: userProfile.id,
        requester_name: userProfile.name || 'A student',
        teacher_id: teacher.id,
        status: 'pending',
      }));
    } catch (_) {}
    if (!error) {
      setSentTeacherIds(prev => new Set([...prev, teacher.id]));
      createNotification(
        `teacher-${teacher.id}`,
        'group_invite',
        `Group invite: ${group.name}`,
        `${userProfile.name || 'A student'} invited you to join their study group`,
        { group_id: String(groupId), group_name: group.name },
      );
    }
    setSendingTeacher(null);
  };

  useEffect(() => {
    supabase
      .from('group_messages')
      .select('*')
      .eq('group_id', String(groupId))
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setMessages(data.map(m => ({
            user: m.sender_name,
            text: m.text,
            media_url: m.media_url || null,
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          })));
        }
      });
  }, [groupId]);

  if (!group) {
    return <View style={styles.container}><Text style={styles.bodyText}>Group not found</Text></View>;
  }

  const cc = isClubGroup
    ? { bg: colors.primaryLight, text: colors.primary }
    : courseColor(group.course);

  const sendMessage = async (mediaUrl = null) => {
    const text = draft.trim();
    if (!text && !mediaUrl) return;
    setMessages(prev => [...prev, { user: myName, text, media_url: mediaUrl, time: 'now' }]);
    if (text) setDraft('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    if (userProfile?.id) {
      await supabase.from('group_messages').insert({
        group_id: String(groupId),
        user_id: userProfile.id,
        sender_name: myName,
        text: text || null,
        media_url: mediaUrl || null,
      });
    }
  };

  const pickMedia = async () => {
    setUploadingMedia(true);
    try {
      const url = await pickAndUploadMedia();
      if (url) await sendMessage(url);
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
      {/* Group banner */}
      <View style={[styles.banner, { backgroundColor: cc.bg }]}>
        <View style={[styles.emojiBox, { backgroundColor: colors.bg }]}>
          <Text style={styles.emoji}>{group.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerName}>{group.name}</Text>
          <Text style={styles.bannerMeta}>
            👥 {group.members} members · {group.active ? '🟢 Active now' : '⚪ Quiet'}
          </Text>
          <View style={styles.groupActions}>
            <TouchableOpacity
              style={styles.membersBtn}
              onPress={() => { setShowMembers(true); loadMembers(); }}
              activeOpacity={0.75}
            >
              <Text style={styles.membersBtnText}>View Members</Text>
            </TouchableOpacity>
            {!isClubGroup && !group.createdByTeacher && (
              <TouchableOpacity
                style={styles.inviteTeacherBtn}
                onPress={() => setShowInviteTeacher(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.inviteTeacherBtnText}>👩‍🏫 Invite Teacher</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Description */}
      <View style={styles.descBox}>
        <Text style={styles.descText}>{group.desc}</Text>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messagesArea}
        contentContainerStyle={{ paddingVertical: spacing.md }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <View style={styles.welcomeRow}>
          <Text style={styles.welcomeText}>
            # Welcome to {group.name}
          </Text>
        </View>

        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Be the first to start the conversation!</Text>
          </View>
        ) : (
          messages.map((m, i) => {
            const isMe = m.user === myName;
            const av = isMe ? myAv : avatarColor(m.user);
            return (
              <View key={i} style={styles.messageRow}>
                <View style={[styles.msgAvatar, { backgroundColor: av.bg }]}>
                  <Text style={[styles.msgAvatarText, { color: av.text }]}>
                    {isMe ? myAbbr : initials(m.user)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.msgHeader}>
                    <Text style={[styles.msgUser, isMe && { color: myAv.bg }]}>
                      {m.user}
                    </Text>
                    <Text style={styles.msgTime}>{m.time}</Text>
                  </View>
                  <MediaMessage url={m.media_url} isMe={isMe} />
                  {m.text ? <Text style={styles.msgText}>{m.text}</Text> : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputArea}>
        <TouchableOpacity onPress={pickMedia} style={styles.mediaBtn} disabled={uploadingMedia} activeOpacity={0.7}>
          {uploadingMedia
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Text style={{ fontSize: 20 }}>📎</Text>}
        </TouchableOpacity>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={`Message ${group.name}...`}
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          onSubmitEditing={() => sendMessage()}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, !draft.trim() && { opacity: 0.5 }]}
          onPress={() => sendMessage()}
          activeOpacity={0.7}
          disabled={!draft.trim()}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
      {/* Invite Teacher modal */}
      <Modal visible={showInviteTeacher} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowInviteTeacher(false)} activeOpacity={1} />
          <View style={styles.membersModal}>
            <View style={styles.membersModalHeader}>
              <Text style={styles.membersModalTitle}>👩‍🏫 Invite a Teacher</Text>
              <TouchableOpacity onPress={() => setShowInviteTeacher(false)}>
                <Text style={styles.membersModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              {teachers.map(t => {
                const sent = sentTeacherIds.has(t.id);
                const isSending = sendingTeacher === t.id;
                return (
                  <View key={t.id} style={styles.memberRow}>
                    <View style={[styles.memberAvatar, { backgroundColor: colors.amberLight }]}>
                      <Text style={{ fontSize: 13, ...font.bold, color: colors.amber }}>{t.initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{t.name}</Text>
                      <Text style={styles.memberSub}>{t.position}</Text>
                    </View>
                    {sent ? (
                      <View style={styles.sentBadge}>
                        <Text style={styles.sentBadgeText}>✓ Sent</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.inviteBtn, isSending && { opacity: 0.5 }]}
                        onPress={() => handleInviteTeacher(t)}
                        disabled={!!sendingTeacher}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.inviteBtnText}>{isSending ? '…' : 'Invite'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Members modal */}
      <Modal visible={showMembers} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowMembers(false)} activeOpacity={1} />
          <View style={styles.membersModal}>
            <View style={styles.membersModalHeader}>
              <Text style={styles.membersModalTitle}>👥 Members</Text>
              <TouchableOpacity onPress={() => setShowMembers(false)}>
                <Text style={styles.membersModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {loadingMembers ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 32 }} />
            ) : members.length === 0 ? (
              <View style={styles.membersEmpty}>
                <Text style={styles.membersEmptyText}>No members have joined yet.</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                {members.map(m => {
                  const av = avatarColor(m.name);
                  return (
                    <View key={m.id} style={styles.memberRow}>
                      <View style={[styles.memberAvatar, { backgroundColor: av.bg }]}>
                        <Text style={[styles.memberAvatarText, { color: av.text }]}>{initials(m.name)}</Text>
                      </View>
                      <View>
                        <Text style={styles.memberName}>{m.name}</Text>
                        <Text style={styles.memberSub}>{m.course} · {m.year}</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  bodyText: { color: colors.textPrimary, padding: spacing.lg },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg,
  },
  emojiBox: {
    width: 56, height: 56, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 28 },
  bannerName: { fontSize: 17, ...font.bold, color: colors.textPrimary, marginBottom: 4 },
  bannerMeta: { fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  groupActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  membersBtn: {
    borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  membersBtnText: { fontSize: 11, color: colors.primary, ...font.semibold },
  studyBtn: {
    borderWidth: 1, borderColor: colors.green,
    borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: colors.greenLight,
  },
  studyBtnText: { fontSize: 11, color: colors.green, ...font.semibold },
  inviteTeacherBtn: {
    borderWidth: 1, borderColor: colors.amber,
    borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: colors.amberLight,
  },
  inviteTeacherBtnText: { fontSize: 11, color: colors.amber, ...font.semibold },
  sentBadge: {
    backgroundColor: colors.greenLight, borderWidth: 1, borderColor: colors.greenBorder,
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  sentBadgeText: { fontSize: 11, color: colors.green, ...font.semibold },
  inviteBtn: {
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  inviteBtnText: { fontSize: 12, color: '#fff', ...font.bold },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  membersModal: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: colors.border,
    maxHeight: '70%',
  },
  membersModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  membersModalTitle: { fontSize: 16, ...font.bold, color: colors.textPrimary },
  membersModalClose: { fontSize: 18, color: colors.textSecondary, padding: 4 },
  membersEmpty: { padding: spacing.xl, alignItems: 'center' },
  membersEmptyText: { fontSize: 13, color: colors.textSecondary },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarText: { fontSize: 13, ...font.bold },
  memberName: { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  memberSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },

  descBox: {
    backgroundColor: colors.card,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
    padding: spacing.md,
  },
  descText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

  messagesArea: { flex: 1, paddingHorizontal: spacing.md },

  welcomeRow: { alignItems: 'center', marginBottom: spacing.md },
  welcomeText: { fontSize: 11, color: colors.textTertiary, ...font.medium },

  messageRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  msgAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  msgAvatarText: { fontSize: 12, ...font.bold },
  msgHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2 },
  msgUser: { fontSize: 13, ...font.bold, color: colors.textPrimary },
  msgTime: { fontSize: 10, color: colors.textTertiary },
  msgText: { fontSize: 14, color: colors.textPrimary, lineHeight: 19 },
  msgImage: { width: 200, height: 150, borderRadius: 8, marginBottom: 4, marginTop: 2 },
  mediaBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 15, color: colors.textPrimary, ...font.semibold, marginBottom: 4 },
  emptySubtext: { fontSize: 12, color: colors.textSecondary },

  inputArea: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    color: colors.textPrimary, fontSize: 14,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 20, ...font.bold },
});