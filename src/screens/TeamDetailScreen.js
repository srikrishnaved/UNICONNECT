import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { hubClubs } from '../data';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius, font } from '../theme';

export default function TeamDetailScreen({ route, navigation }) {
  const teamId = Number(route.params.clubId);
  const team = hubClubs.find(c => c.id === teamId);

  const {
    clubAdminRequests, approvedClubAdmins, submitClubAdminRequest, checkClubAdminRequest,
    createNotification, userProfile, isAppAdmin,
    clubMemberships, submitClubJoinRequest, loadClubJoinRequests, resolveClubJoinRequest,
    checkClubJoinRequest, leaveClub, resignClubAdmin,
  } = useApp();

  const isEffectiveAdmin = approvedClubAdmins.has(teamId) || approvedClubAdmins.has(String(teamId)) || isAppAdmin;
  const isMember = clubMemberships.has(teamId) || clubMemberships.has(String(teamId));
  const pendingAdminReqFromCtx = clubAdminRequests.find(r => r.clubId === teamId);

  const [pendingAdminReq, setPendingAdminReq] = useState(false);
  const [pendingJoinReq, setPendingJoinReq] = useState(null);

  const [showAdminRequest, setShowAdminRequest] = useState(false);
  const [adminReason, setAdminReason] = useState('');

  const [showJoinRequest, setShowJoinRequest] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const [showJoinReview, setShowJoinReview] = useState(false);
  const [joinReviewList, setJoinReviewList] = useState([]);

  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  useEffect(() => {
    if (team) navigation.setOptions({ title: team.name });
  }, [team]);

  useEffect(() => {
    if (!isEffectiveAdmin) {
      checkClubAdminRequest(teamId).then(r => { if (r) setPendingAdminReq(true); });
    }
  }, [teamId]);

  useEffect(() => {
    if (!isEffectiveAdmin && !isMember && userProfile?.id) {
      checkClubJoinRequest(teamId).then(r => {
        if (r) setPendingJoinReq(r.status);
      });
    }
  }, [teamId, userProfile?.id]);

  useEffect(() => {
    supabase
      .from('hub_events')
      .select('id, title, time, venue, when, club_name, club_id')
      .contains('teams_needed', [teamId])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setAssignments(data || []);
        setAssignmentsLoading(false);
      });
  }, [teamId]);

  const loadRealMembers = async () => {
    setMembersLoading(true);
    const { data: rows } = await supabase
      .from('club_memberships')
      .select('user_id')
      .eq('club_id', teamId);
    if (rows?.length) {
      const ids = rows.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, course, year')
        .in('id', ids);
      setMembers((profiles || []).map(p => ({
        userId: p.id,
        name: p.name,
        course: p.course,
        year: p.year,
        initials: p.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(),
      })));
    } else {
      setMembers([]);
    }
    setMembersLoading(false);
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, name, course, year')
      .ilike('name', `%${query.trim()}%`)
      .limit(8);
    const memberIds = new Set(members.map(m => m.userId));
    setSearchResults((data || []).filter(p => !memberIds.has(p.id)));
    setSearching(false);
  };

  const handleInvite = async (user) => {
    const { data: existing } = await supabase
      .from('club_invites')
      .select('id')
      .eq('invited_user_id', user.id)
      .eq('club_id', teamId)
      .eq('status', 'pending')
      .maybeSingle();
    if (existing) { alert(`${user.name} already has a pending invite.`); return; }

    const { data: inviteRow, error } = await supabase.from('club_invites').insert({
      club_id: teamId,
      club_name: team.name,
      invited_user_id: user.id,
      invited_by: userProfile?.id,
    }).select().single();
    if (error) { alert('Could not send invite: ' + error.message); return; }

    createNotification(
      user.id, 'invite',
      `You've been invited to join ${team.name}!`,
      'Open your notifications to accept or decline.',
      { invite_id: inviteRow.id, club_id: teamId, club_name: team.name },
    );
    setSearchResults(prev => prev.filter(p => p.id !== user.id));
    setSearchQuery('');
    alert(`Invite sent to ${user.name}!`);
  };

  const handleRemoveMember = (userId, name) => {
    const doRemove = async () => {
      await supabase.from('club_memberships').delete()
        .eq('user_id', userId).eq('club_id', teamId);
      setMembers(prev => prev.filter(m => m.userId !== userId));
    };
    Alert.alert('Remove Member', `Remove ${name} from ${team.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: doRemove },
    ]);
  };

  if (!team) {
    return <View style={styles.container}><Text style={styles.body}>Team not found.</Text></View>;
  }

  const clubForAssignment = (clubId) => hubClubs.find(c => c.id === clubId);

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Cover */}
        <View style={[styles.cover, { backgroundColor: team.color }]}>
          <View style={styles.coverInner}>
            <View style={[styles.emojiBox, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.emoji}>{team.emoji}</Text>
            </View>
            <View style={styles.typeBadgeWrap}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>TEAM</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Name + meta */}
        <View style={styles.nameBlock}>
          <Text style={styles.name}>{team.name}</Text>
          <Text style={styles.fullName}>{team.fullName}</Text>
          <Text style={styles.members}>👥 {team.members} members</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {isEffectiveAdmin ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.leaveBtn]}
              onPress={() => {
                Alert.alert('Resign Admin', `Resign as admin of ${team.name}? You will lose admin access.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Resign', style: 'destructive', onPress: () => resignClubAdmin(teamId) },
                ]);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.leaveBtnText}>Resign Admin</Text>
            </TouchableOpacity>
          ) : isMember ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.leaveBtn]}
              onPress={() => {
                Alert.alert('Leave Team', `Leave ${team.name}? You will need to re-apply to rejoin.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Leave', style: 'destructive', onPress: () => leaveClub(teamId) },
                ]);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.leaveBtnText}>Leave Team</Text>
            </TouchableOpacity>
          ) : pendingJoinReq === 'pending' ? (
            <View style={[styles.actionBtn, styles.pendingBtn]}>
              <Text style={styles.pendingBtnText}>⏳ Request Pending</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.applyBtn]}
              onPress={() => setShowJoinRequest(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.applyBtnText}>Join Team</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Team Dashboard */}
        {(isMember || isEffectiveAdmin) && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <TouchableOpacity
              style={styles.dashboardBtn}
              onPress={() => navigation.navigate('TeamDashboard', { clubId: teamId })}
              activeOpacity={0.82}
            >
              <View style={styles.dashboardBtnLeft}>
                <Text style={styles.dashboardBtnIcon}>📊</Text>
              </View>
              <View style={styles.dashboardBtnCenter}>
                <Text style={styles.dashboardBtnText}>Team Dashboard</Text>
                <Text style={styles.dashboardBtnSub}>Event Assignments · Members</Text>
              </View>
              <Text style={styles.dashboardBtnArrow}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Admin Request */}
        {!isEffectiveAdmin && (
          <View style={styles.adminRequestRow}>
            {(pendingAdminReqFromCtx || pendingAdminReq) ? (
              <View style={styles.adminRequestPending}>
                <Text style={styles.adminRequestPendingText}>⏳ Admin Request Submitted</Text>
                <Text style={styles.adminRequestPendingHint}>Awaiting review</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.adminRequestBtn}
                onPress={() => setShowAdminRequest(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.adminRequestBtnText}>🛡️ Request Admin Access</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* About */}
        <Section label="ABOUT">
          <Text style={styles.body}>{team.desc}</Text>
        </Section>

        {/* Admin actions */}
        {isEffectiveAdmin && (
          <Section label="ADMIN ACTIONS">
            <TouchableOpacity
              style={styles.adminActionBtn}
              activeOpacity={0.85}
              onPress={() => { setShowMembers(true); loadRealMembers(); }}
            >
              <Text style={styles.adminActionIcon}>👥</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminActionTitle}>Manage members</Text>
                <Text style={styles.adminActionDesc}>View, invite, or remove team members</Text>
              </View>
              <Text style={styles.adminActionArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.adminActionBtn}
              activeOpacity={0.85}
              onPress={async () => {
                const reqs = await loadClubJoinRequests(teamId);
                setJoinReviewList(reqs);
                setShowJoinReview(true);
              }}
            >
              <Text style={styles.adminActionIcon}>📋</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminActionTitle}>Review join requests</Text>
                <Text style={styles.adminActionDesc}>Approve or reject applications</Text>
              </View>
              <Text style={styles.adminActionArrow}>›</Text>
            </TouchableOpacity>
          </Section>
        )}

        {/* Event Assignments */}
        <Section label={`EVENT ASSIGNMENTS (${assignments.length})`}>
          {assignmentsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
          ) : assignments.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No event assignments yet.</Text>
              <Text style={styles.emptySubText}>When a club selects your team for an event, it will appear here.</Text>
            </View>
          ) : (
            assignments.map(event => {
              const club = clubForAssignment(event.club_id);
              return (
                <View key={event.id} style={styles.assignmentCard}>
                  <View style={[styles.assignmentStripe, { backgroundColor: club?.color || colors.primary }]} />
                  <View style={styles.assignmentBody}>
                    <View style={styles.assignmentClubRow}>
                      {club && (
                        <Text style={[styles.assignmentClubName, { color: club.color }]}>
                          {club.emoji} {club.name}
                        </Text>
                      )}
                      <View style={[styles.whenBadge, event.when === 'today' && styles.whenBadgeToday]}>
                        <Text style={styles.whenBadgeText}>
                          {event.when === 'today' ? 'TODAY' : event.when === 'thisWeek' ? 'THIS WEEK' : 'UPCOMING'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.assignmentTitle}>{event.title}</Text>
                    <View style={styles.assignmentMetaRow}>
                      <Text style={styles.assignmentMeta}>📅 {event.time}</Text>
                      <Text style={styles.assignmentMeta}>📍 {event.venue}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Join Request Modal */}
      <Modal visible={showJoinRequest} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🙋 Join {team.name}</Text>
              <TouchableOpacity onPress={() => { setShowJoinRequest(false); setJoinMessage(''); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.teamRow}>
              <View style={[styles.teamEmoji, { backgroundColor: `${team.color}33` }]}>
                <Text style={{ fontSize: 20 }}>{team.emoji}</Text>
              </View>
              <View>
                <Text style={styles.teamRowName}>{team.name}</Text>
                <Text style={styles.teamRowFull}>{team.fullName}</Text>
              </View>
            </View>

            <Text style={styles.modalLabel}>WHY DO YOU WANT TO JOIN? (optional)</Text>
            <TextInput
              value={joinMessage}
              onChangeText={setJoinMessage}
              placeholder="Tell the team lead why you'd like to join..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { height: 100, textAlignVertical: 'top', paddingTop: spacing.sm }]}
              multiline
              maxLength={300}
            />
            <Text style={styles.charCount}>{joinMessage.length}/300</Text>

            <TouchableOpacity
              style={[styles.submitBtn, joinLoading && { opacity: 0.6 }]}
              disabled={joinLoading}
              onPress={async () => {
                setJoinLoading(true);
                try {
                  await submitClubJoinRequest({ clubId: teamId, clubName: team.name, message: joinMessage });
                  setPendingJoinReq('pending');
                  setShowJoinRequest(false);
                  setJoinMessage('');
                } catch (err) {
                  alert('Error: ' + (err.message || 'Could not send request. Try again.'));
                } finally {
                  setJoinLoading(false);
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText}>Send Request</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Admin Request Modal */}
      <Modal visible={showAdminRequest} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🛡️ Request Admin Access</Text>
              <TouchableOpacity onPress={() => { setShowAdminRequest(false); setAdminReason(''); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.teamRow}>
              <View style={[styles.teamEmoji, { backgroundColor: `${team.color}33` }]}>
                <Text style={{ fontSize: 20 }}>{team.emoji}</Text>
              </View>
              <View>
                <Text style={styles.teamRowName}>{team.name}</Text>
                <Text style={styles.teamRowFull}>{team.fullName}</Text>
              </View>
            </View>

            <Text style={styles.modalLabel}>WHY DO YOU WANT TO BE ADMIN?</Text>
            <TextInput
              value={adminReason}
              onChangeText={setAdminReason}
              placeholder="Describe your role and experience in this team..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { height: 120, textAlignVertical: 'top', paddingTop: spacing.sm }]}
              multiline
              maxLength={500}
            />
            <Text style={styles.charCount}>{adminReason.length}/500</Text>

            <TouchableOpacity
              style={[styles.submitBtn, !adminReason.trim() && { opacity: 0.45 }]}
              onPress={async () => {
                if (!adminReason.trim()) return;
                try {
                  await submitClubAdminRequest({ clubId: teamId, clubName: team.name, reason: adminReason });
                  setPendingAdminReq(true);
                  setShowAdminRequest(false);
                  setAdminReason('');
                  Alert.alert('Request Sent', 'Your request has been submitted for review.');
                } catch (err) {
                  Alert.alert('Error', err.message || 'Could not send request.');
                }
              }}
              disabled={!adminReason.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText}>Submit Request</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Join Review Modal */}
      <Modal visible={showJoinReview} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📋 Join Requests</Text>
              <TouchableOpacity onPress={() => setShowJoinReview(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {joinReviewList.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>No pending requests.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {joinReviewList.map(req => (
                  <View key={req.id} style={styles.joinReqCard}>
                    <View style={styles.joinReqHeader}>
                      <View style={styles.joinReqAvatar}>
                        <Text style={styles.joinReqAvatarText}>
                          {req.student_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.joinReqName}>{req.student_name}</Text>
                        <Text style={styles.joinReqMeta}>{req.course} · {req.year}</Text>
                      </View>
                    </View>
                    {req.message ? <Text style={styles.joinReqMessage}>"{req.message}"</Text> : null}
                    <View style={styles.joinReqActions}>
                      <TouchableOpacity
                        style={styles.joinReqReject}
                        activeOpacity={0.8}
                        onPress={async () => {
                          await resolveClubJoinRequest(req.id, 'reject', { userId: req.user_id, clubId: req.club_id, clubName: req.club_name });
                          setJoinReviewList(prev => prev.filter(r => r.id !== req.id));
                        }}
                      >
                        <Text style={styles.joinReqRejectText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.joinReqApprove}
                        activeOpacity={0.8}
                        onPress={async () => {
                          await resolveClubJoinRequest(req.id, 'approve', { userId: req.user_id, clubId: req.club_id, clubName: req.club_name });
                          setJoinReviewList(prev => prev.filter(r => r.id !== req.id));
                        }}
                      >
                        <Text style={styles.joinReqApproveText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Members Modal */}
      <Modal visible={showMembers} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>👥 Members ({members.length})</Text>
              <TouchableOpacity onPress={() => { setShowMembers(false); setSearchQuery(''); setSearchResults([]); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inviteSection}>
              <Text style={styles.inviteSectionTitle}>➕ Invite a Member</Text>
              <View style={styles.addMemberRow}>
                <TextInput
                  value={searchQuery}
                  onChangeText={handleSearch}
                  placeholder="Search by name..."
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                  autoCapitalize="words"
                />
                {searching && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
              </View>
              {searchQuery.length > 0 && searchResults.length === 0 && !searching && (
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>No users found.</Text>
              )}
              {searchResults.length > 0 && (
                <View style={styles.searchResultsBox}>
                  {searchResults.map(u => (
                    <TouchableOpacity key={u.id} style={styles.searchResultRow} onPress={() => handleInvite(u)} activeOpacity={0.8}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>{u.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{u.name}</Text>
                        <Text style={styles.memberWing}>{u.course} · {u.year}</Text>
                      </View>
                      <Text style={styles.inviteBtnText}>+ Add</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <Text style={[styles.modalLabel, { marginTop: spacing.sm }]}>CURRENT MEMBERS</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {membersLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
              ) : members.length === 0 ? (
                <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg }}>No members yet.</Text>
              ) : (
                members.map(m => (
                  <View key={m.userId} style={styles.memberRow}>
                    <View style={[styles.memberAvatar, m.userId === userProfile?.id && { backgroundColor: colors.primary }]}>
                      <Text style={styles.memberAvatarText}>{m.initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{m.name}</Text>
                      <Text style={styles.memberWing}>{m.course} · {m.year}</Text>
                    </View>
                    {m.userId === userProfile?.id ? (
                      <View style={styles.youBadge}><Text style={styles.youBadgeText}>YOU</Text></View>
                    ) : (
                      <TouchableOpacity onPress={() => handleRemoveMember(m.userId, m.name)} style={styles.removeBtn} activeOpacity={0.7}>
                        <Text style={styles.removeBtnText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Section({ label, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

  cover: { height: 130 },
  coverInner: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  emojiBox: { width: 76, height: 76, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 38 },
  typeBadgeWrap: { position: 'absolute', top: 12, right: 12 },
  typeBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  typeBadgeText: { fontSize: 10, ...font.bold, color: '#fff', letterSpacing: 0.8 },

  nameBlock: { alignItems: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  name: { fontSize: 22, ...font.bold, color: colors.textPrimary },
  fullName: { fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  members: { fontSize: 12, color: colors.textTertiary, marginTop: 8 },

  actions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  actionBtn: { flex: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  applyBtn: { backgroundColor: colors.primary },
  applyBtnText: { fontSize: 13, ...font.bold, color: '#fff' },
  pendingBtn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  pendingBtnText: { fontSize: 13, ...font.bold, color: colors.textSecondary },
  leaveBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  leaveBtnText: { fontSize: 13, ...font.bold, color: '#DC2626' },

  dashboardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 14, paddingHorizontal: spacing.md,
  },
  dashboardBtnLeft: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  dashboardBtnIcon: { fontSize: 20 },
  dashboardBtnCenter: { flex: 1 },
  dashboardBtnText: { fontSize: 15, ...font.bold, color: '#fff' },
  dashboardBtnSub: { fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 1 },
  dashboardBtnArrow: { fontSize: 22, color: 'rgba(255,255,255,0.7)' },

  adminRequestRow: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  adminRequestBtn: {
    borderWidth: 1, borderColor: colors.amber, borderRadius: radius.md,
    paddingVertical: 12, alignItems: 'center', backgroundColor: colors.amberLight,
  },
  adminRequestBtnText: { fontSize: 13, ...font.bold, color: colors.amber },
  adminRequestPending: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: 12, alignItems: 'center', backgroundColor: colors.card,
  },
  adminRequestPendingText: { fontSize: 13, ...font.bold, color: colors.textSecondary },
  adminRequestPendingHint: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },

  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionLabel: { fontSize: 11, color: colors.textSecondary, ...font.bold, letterSpacing: 0.8, marginBottom: spacing.sm },

  adminActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  adminActionIcon: { fontSize: 22 },
  adminActionTitle: { fontSize: 13, ...font.bold, color: colors.textPrimary },
  adminActionDesc: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  adminActionArrow: { fontSize: 22, color: colors.textTertiary },

  assignmentCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, marginBottom: spacing.sm, overflow: 'hidden',
  },
  assignmentStripe: { height: 3 },
  assignmentBody: { padding: spacing.md },
  assignmentClubRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  assignmentClubName: { fontSize: 10, ...font.bold, letterSpacing: 0.6 },
  whenBadge: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  whenBadgeToday: { backgroundColor: colors.greenLight, borderColor: colors.greenBorder },
  whenBadgeText: { fontSize: 9, ...font.bold, color: colors.textSecondary, letterSpacing: 0.4 },
  assignmentTitle: { fontSize: 14, ...font.bold, color: colors.textPrimary, marginBottom: 6 },
  assignmentMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  assignmentMeta: { fontSize: 11, color: colors.textSecondary },

  emptyBox: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.textSecondary, ...font.semibold },
  emptySubText: { fontSize: 11, color: colors.textTertiary, marginTop: 4, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '92%', borderWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: 18, ...font.bold, color: colors.textPrimary },
  modalClose: { fontSize: 22, color: colors.textSecondary, padding: 4 },
  modalLabel: { fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold, marginBottom: 6, marginTop: spacing.sm },
  modalInput: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, fontSize: 14 },

  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  teamEmoji: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  teamRowName: { fontSize: 14, ...font.bold, color: colors.textPrimary },
  teamRowFull: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  charCount: { fontSize: 10, color: colors.textTertiary, textAlign: 'right', marginTop: 4 },

  submitBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, marginTop: spacing.lg, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, ...font.bold },

  addMemberRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.sm },
  inviteSection: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  inviteSectionTitle: { fontSize: 13, ...font.bold, color: colors.primary, marginBottom: spacing.sm },
  searchResultsBox: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginTop: spacing.sm, overflow: 'hidden' },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  inviteBtnText: { fontSize: 12, color: colors.primary, ...font.bold },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardElevated, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 13, ...font.bold, color: '#fff' },
  memberName: { fontSize: 13, ...font.semibold, color: colors.textPrimary },
  memberWing: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  removeBtn: { backgroundColor: colors.redLight, borderWidth: 1, borderColor: colors.red, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  removeBtnText: { fontSize: 11, color: colors.red, ...font.semibold },
  youBadge: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  youBadgeText: { fontSize: 11, color: colors.primary, ...font.semibold },

  joinReqCard: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  joinReqHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  joinReqAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  joinReqAvatarText: { fontSize: 13, ...font.bold, color: '#fff' },
  joinReqName: { fontSize: 13, ...font.semibold, color: colors.textPrimary },
  joinReqMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  joinReqMessage: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginBottom: spacing.sm, lineHeight: 17 },
  joinReqActions: { flexDirection: 'row', gap: spacing.sm },
  joinReqReject: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 8, alignItems: 'center' },
  joinReqRejectText: { fontSize: 12, ...font.semibold, color: colors.textSecondary },
  joinReqApprove: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 8, alignItems: 'center' },
  joinReqApproveText: { fontSize: 12, ...font.semibold, color: '#fff' },
});
