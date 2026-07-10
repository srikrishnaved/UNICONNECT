import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '../theme';
import {
  colors as tColors,
  typography,
  spacing as tSpacing,
  radius as tRadius,
  shadows,
  presets,
} from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { hubClubs, teachers } from '../data';
import { EmptyState } from '../components/EmptyState';
import { Bell, MessageCircle, Calendar, GraduationCap, Users, Gift, Target, X, Check } from 'lucide-react-native';

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsPanel({ visible, onClose, onOpenDM }) {
  const { userProfile, setUnreadCount, clubMemberships, setClubMemberships, acceptConnectionRequest, declineConnectionRequest, createNotification } = useApp();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(null); // invite_id being resolved

  const isHOD = userProfile?.name?.toLowerCase().includes('hridhya');

  useEffect(() => {
    if (!visible || !userProfile?.id) return;
    setLoading(true);
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userProfile.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setNotifs(data || []);
        setLoading(false);
      });
  }, [visible, userProfile?.id]);

  const markAllRead = async () => {
    if (!userProfile?.id) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userProfile.id)
      .eq('read', false);
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const markRead = async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const clearAll = async () => {
    if (!userProfile?.id) return;
    await supabase.from('notifications').delete().eq('user_id', userProfile.id);
    setNotifs([]);
    setUnreadCount(0);
  };

  const clearOne = async (id, wasUnread) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifs(prev => prev.filter(n => n.id !== id));
    if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const unread = notifs.filter(n => !n.read).length;

  const NotifIcon = ({ type, size = 20 }) => {
    if (type === 'dm') return <MessageCircle size={size} color={tColors.textSecondary} />;
    if (type === 'event') return <Calendar size={size} color={tColors.textSecondary} />;
    if (type === 'mentor') return <GraduationCap size={size} color={tColors.textSecondary} />;
    if (type === 'connection') return <Users size={size} color={tColors.textSecondary} />;
    if (type === 'invite') return <Gift size={size} color={tColors.textSecondary} />;
    if (type === 'assignment') return <Target size={size} color={tColors.textSecondary} />;
    return <Bell size={size} color={tColors.textSecondary} />;
  };


  const handleInviteAction = async (notif, action) => {
    const { invite_id, club_id, club_name } = notif.meta || {};
    if (!invite_id) return;
    setResolving(invite_id);
    if (action === 'accept') {
      await supabase.from('club_memberships').insert({
        user_id: userProfile.id,
        club_id,
        club_name,
      });
      if (setClubMemberships) {
        setClubMemberships(prev => new Set([...prev, club_id]));
      }
    }
    await supabase.from('club_invites').update({ status: action === 'accept' ? 'accepted' : 'declined' }).eq('id', invite_id);
    await supabase.from('notifications').update({ read: true, meta: null, body: action === 'accept' ? '✓ You joined the club!' : '✗ Invite declined.' }).eq('id', notif.id);
    setNotifs(prev => prev.map(n => n.id === notif.id
      ? { ...n, read: true, body: action === 'accept' ? '✓ You joined the club!' : '✗ Invite declined.', meta: null }
      : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
    setResolving(null);
  };

  const handleConnectionAction = async (notif, action) => {
    const { request_id, from_user_id } = notif.meta || {};
    if (!request_id) return;
    setResolving(request_id);
    if (action === 'accept') {
      await acceptConnectionRequest(request_id, from_user_id);
    } else {
      await declineConnectionRequest(request_id, from_user_id);
    }
    const resultBody = action === 'accept' ? '✓ You are now connected!' : '✗ Request declined.';
    await supabase.from('notifications').update({ read: true, meta: null, body: resultBody }).eq('id', notif.id);
    setNotifs(prev => prev.map(n =>
      n.id === notif.id ? { ...n, read: true, body: resultBody, meta: null } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
    setResolving(null);
  };

  const handleApprovalAction = async (notif, action) => {
    const { slot_id, class_name, day, period_name, course_name, faculty_name, submitted_by } = notif.meta || {};
    if (!slot_id) return;
    setResolving(slot_id);
    try {
      if (action === 'approve') {
        await supabase.from('timetable_slots')
          .update({ approval_status: 'approved' })
          .eq('id', slot_id);

        // Broadcast to all active students
        const msg = `${class_name} timetable change approved — ${day} ${period_name}: ${course_name || 'Class'} assigned to ${faculty_name || 'TBD'}`;
        const { data: profiles } = await supabase.from('profiles').select('id').eq('status', 'active');
        for (const p of (profiles || [])) {
          if (p.id !== userProfile?.id) {
            createNotification(p.id, 'info', 'Timetable Approved', msg);
          }
        }

        const resultBody = `✓ Approved — ${day} ${period_name} for ${class_name}`;
        await supabase.from('notifications').update({ read: true, meta: null, body: resultBody }).eq('id', notif.id);
        setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read: true, body: resultBody, meta: null } : n));

      } else {
        await supabase.from('timetable_slots')
          .update({ approval_status: 'rejected' })
          .eq('id', slot_id);

        // Notify the team member who submitted
        if (submitted_by) {
          await createNotification(
            submitted_by,
            'info',
            'Timetable Change Rejected',
            `Your timetable change for ${class_name} ${day} ${period_name} was rejected by Dr. Hridhya.`
          );
        }

        const resultBody = `✗ Rejected — ${day} ${period_name} for ${class_name}`;
        await supabase.from('notifications').update({ read: true, meta: null, body: resultBody }).eq('id', notif.id);
        setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read: true, body: resultBody, meta: null } : n));
      }
      setUnreadCount(prev => Math.max(0, prev - 1));
    } finally {
      setResolving(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <SafeAreaView style={styles.panel}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unread > 0 && <Text style={styles.headerSub}>{unread} unread</Text>}
            </View>
            <View style={styles.headerActions}>
              {unread > 0 && (
                <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn} activeOpacity={0.7}>
                  <Text style={styles.markAllText}>Mark all read</Text>
                </TouchableOpacity>
              )}
              {notifs.length > 0 && (
                <TouchableOpacity onPress={clearAll} style={styles.clearAllBtn} activeOpacity={0.7}>
                  <Text style={styles.clearAllText}>Clear all</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <X size={20} color={tColors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
          ) : notifs.length === 0 ? (
            <EmptyState icon={Bell} heading="All caught up" subtext="You have no new notifications" />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {notifs.map(n => {
                const isInvite = n.type === 'invite' && n.meta?.invite_id;
                const isConnectionRequest = n.type === 'connection' && n.meta?.request_id;
                const isApprovalRequest = isHOD && n.meta?.approve_action === true && n.meta?.slot_id;
                const isDM = n.type === 'dm' && !!onOpenDM;
                const handleTap = () => {
                  if (!isDM) return;
                  markRead(n.id);
                  if (n.meta?.person_key) {
                    onOpenDM({
                      personKey: n.meta.person_key,
                      name: n.meta.sender_name || n.title.replace('New message from ', ''),
                      isTeacher: !!n.meta.is_teacher,
                      recipientId: n.meta.is_teacher ? undefined : n.meta.recipient_id,
                    });
                  } else {
                    // Legacy notifications without meta — infer from title
                    const senderName = n.title.replace('New message from ', '').trim();
                    const teacher = teachers.find(
                      t => t.name.toLowerCase() === senderName.toLowerCase()
                    );
                    if (teacher) {
                      onOpenDM({ personKey: `teacher-${teacher.id}`, name: teacher.name, isTeacher: true });
                    } else {
                      onOpenDM({ personKey: senderName, name: senderName, isTeacher: false });
                    }
                  }
                };
                return (
                  <TouchableOpacity
                    key={n.id}
                    style={[styles.item, !n.read && styles.itemUnread, isDM && styles.itemTappable]}
                    onPress={handleTap}
                    activeOpacity={isDM ? 0.7 : 1}
                    disabled={!isDM}
                  >
                    <View style={[styles.iconBox, !n.read && styles.iconBoxUnread]}>
                      <NotifIcon type={n.type} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemTitle, !n.read && styles.itemTitleUnread]} numberOfLines={2}>
                        {n.title}
                      </Text>
                      {n.body ? <Text style={styles.itemSub}>{n.body}</Text> : null}
                      {isInvite && (
                        <View style={styles.inviteActions}>
                          <TouchableOpacity
                            style={styles.acceptBtn}
                            onPress={() => handleInviteAction(n, 'accept')}
                            disabled={resolving === n.meta.invite_id}
                            activeOpacity={0.8}
                          >
                            {resolving === n.meta.invite_id
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Check size={13} color={tColors.success} /><Text style={styles.acceptBtnText}>Accept</Text></View>
                            }
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.declineBtn}
                            onPress={() => handleInviteAction(n, 'decline')}
                            disabled={resolving === n.meta.invite_id}
                            activeOpacity={0.8}
                          >
                            <View style={{flexDirection:'row',alignItems:'center',gap:4}}><X size={13} color={tColors.error} /><Text style={styles.declineBtnText}>Decline</Text></View>
                          </TouchableOpacity>
                        </View>
                      )}
                      {isConnectionRequest && (
                        <View style={styles.inviteActions}>
                          <TouchableOpacity
                            style={styles.acceptBtn}
                            onPress={() => handleConnectionAction(n, 'accept')}
                            disabled={resolving === n.meta.request_id}
                            activeOpacity={0.8}
                          >
                            {resolving === n.meta.request_id
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Check size={13} color={tColors.success} /><Text style={styles.acceptBtnText}>Accept</Text></View>
                            }
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.declineBtn}
                            onPress={() => handleConnectionAction(n, 'decline')}
                            disabled={resolving === n.meta.request_id}
                            activeOpacity={0.8}
                          >
                            <View style={{flexDirection:'row',alignItems:'center',gap:4}}><X size={13} color={tColors.error} /><Text style={styles.declineBtnText}>Decline</Text></View>
                          </TouchableOpacity>
                        </View>
                      )}
                      {isApprovalRequest && (
                        <View style={styles.hodActions}>
                          <TouchableOpacity
                            style={styles.approveBtn}
                            onPress={() => handleApprovalAction(n, 'approve')}
                            disabled={!!resolving}
                            activeOpacity={0.8}
                          >
                            {resolving === n.meta.slot_id
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Check size={13} color={tColors.success} /><Text style={styles.approveBtnText}>Approve</Text></View>
                            }
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.rejectBtn}
                            onPress={() => handleApprovalAction(n, 'reject')}
                            disabled={!!resolving}
                            activeOpacity={0.8}
                          >
                            <View style={{flexDirection:'row',alignItems:'center',gap:4}}><X size={13} color={tColors.error} /><Text style={styles.rejectBtnText}>Reject</Text></View>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    <View style={styles.rightCol}>
                      <Text style={styles.time}>{timeAgo(n.created_at)}</Text>
                      {!n.read && <View style={styles.dot} />}
                      <TouchableOpacity
                        onPress={() => clearOne(n.id, !n.read)}
                        activeOpacity={0.7}
                        style={styles.clearOneBtn}
                      >
                        <X size={16} color={tColors.textTertiary} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: {
    backgroundColor: tColors.bg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: tColors.border,
    maxHeight: '85%',
    ...shadows.strong,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: tSpacing.base, paddingTop: tSpacing.base, paddingBottom: tSpacing.md,
    borderBottomWidth: 1, borderBottomColor: tColors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: typography.bold, color: tColors.textPrimary },
  headerSub: { fontSize: 12, color: tColors.student.primary, fontWeight: typography.semibold, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm },
  markAllBtn: {
    paddingHorizontal: tSpacing.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.sm,
  },
  markAllText: { fontSize: 11, color: tColors.textSecondary, fontWeight: typography.medium },
  clearAllBtn: {
    paddingHorizontal: tSpacing.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: tColors.errorDim,
    borderRadius: tRadius.sm,
  },
  clearAllText: { fontSize: 11, color: tColors.error, fontWeight: typography.medium },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: tColors.card,
    borderWidth: 1, borderColor: tColors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: 14, color: tColors.textSecondary, fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { fontSize: 15, fontWeight: typography.bold, color: tColors.textPrimary, marginBottom: 4 },
  emptySub: { fontSize: 13, color: tColors.textSecondary },

  item: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.md,
    paddingHorizontal: tSpacing.base, paddingVertical: tSpacing.md,
    borderBottomWidth: 1, borderBottomColor: tColors.border,
  },
  itemUnread: { backgroundColor: tColors.student.primaryDim, borderLeftWidth: 3, borderLeftColor: tColors.student.primary },
  itemTappable: { cursor: 'pointer' },
  iconBox: {
    width: 44, height: 44, borderRadius: tRadius.md,
    backgroundColor: tColors.card,
    borderWidth: 1, borderColor: tColors.border,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  iconBoxUnread: { borderColor: tColors.student.primary },
  iconText: { fontSize: 20 },
  itemTitle: { fontSize: 13, color: tColors.textSecondary, lineHeight: 18 },
  itemTitleUnread: { color: tColors.textPrimary, fontWeight: typography.semibold },
  itemSub: { fontSize: 11, color: tColors.textTertiary, marginTop: 2 },
  rightCol: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  time: { fontSize: 10, color: tColors.textTertiary },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tColors.student.primary },
  clearOneBtn: { marginTop: 2, padding: 2 },
  clearOneText: { fontSize: 11, color: tColors.textTertiary },
  inviteActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  acceptBtn: {
    backgroundColor: tColors.success, borderRadius: tRadius.sm,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  acceptBtnText: { fontSize: 12, fontWeight: typography.bold, color: '#fff' },
  declineBtn: {
    borderWidth: 1, borderColor: tColors.border, borderRadius: tRadius.sm,
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: tColors.cardAlt,
  },
  declineBtnText: { fontSize: 12, fontWeight: typography.bold, color: tColors.textSecondary },
  hodActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  approveBtn: {
    backgroundColor: tColors.faculty.primary, borderRadius: tRadius.sm,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  approveBtnText: { fontSize: 12, fontWeight: typography.bold, color: '#fff' },
  rejectBtn: {
    borderWidth: 1, borderColor: tColors.error, borderRadius: tRadius.sm,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  rejectBtnText: { fontSize: 12, fontWeight: typography.bold, color: tColors.error },
});
