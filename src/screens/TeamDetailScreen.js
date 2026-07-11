import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { hubClubs } from '../data';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius, font } from '../theme';
import { Users, Clock, BarChart2, ShieldCheck, Calendar, MapPin, UserCheck, UserPlus, ClipboardList, X } from 'lucide-react-native';

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

  // Contribution Hours
  const [myClubHours, setMyClubHours] = useState(null);
  const [myAdjustments, setMyAdjustments] = useState([]);
  const [showHoursRequest, setShowHoursRequest] = useState(false);
  const [hoursForm, setHoursForm] = useState({ reason: '', hours: '' });
  const [hoursSubmitting, setHoursSubmitting] = useState(false);
  const [hoursError, setHoursError] = useState('');

  useEffect(() => {
    if (team) navigation.setOptions({ title: team.name });
  }, [team]);

  useEffect(() => {
    if (isMember && userProfile?.id) {
      supabase.from('club_member_hours').select('total_hours')
        .eq('user_id', userProfile.id).eq('club_id', teamId).maybeSingle()
        .then(({ data }) => setMyClubHours(Number(data?.total_hours) || 0));

      supabase.from('hour_adjustments').select('id, hours_delta, reason, status, created_at')
        .eq('user_id', userProfile.id).eq('club_id', teamId)
        .order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setMyAdjustments(data); });
    }
  }, [teamId, isMember, userProfile?.id]);

  const handleRequestHours = async () => {
    setHoursError('');
    const hrs = Number(hoursForm.hours);
    if (!hoursForm.reason.trim()) { setHoursError('Describe what you contributed.'); return; }
    if (!hoursForm.hours.trim() || isNaN(hrs) || hrs <= 0) { setHoursError('Enter a valid number of hours (e.g. 3 or 1.5).'); return; }
    setHoursSubmitting(true);
    const { error } = await supabase.from('hour_adjustments').insert({
      user_id: userProfile.id,
      club_id: teamId,
      hours_delta: hrs,
      reason: hoursForm.reason.trim(),
      source: 'self_requested',
      status: 'pending',
      created_by: userProfile.id,
    });
    setHoursSubmitting(false);
    if (error) { setHoursError('Could not submit: ' + error.message); return; }
    setShowHoursRequest(false);
    setHoursForm({ reason: '', hours: '' });
    Alert.alert('Submitted', 'Your hours request has been sent to the coordinator for review.');

    // Refetch adjustments history
    supabase.from('hour_adjustments').select('id, hours_delta, reason, status, created_at')
      .eq('user_id', userProfile.id).eq('club_id', teamId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setMyAdjustments(data); });
  };

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
          <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Users size={13} color={colors.textSecondary} /><Text style={styles.members}>{team.members} members</Text></View>
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
              <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Clock size={14} color={colors.textSecondary} /><Text style={styles.pendingBtnText}>Request Pending</Text></View>
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
                <BarChart2 size={18} color={colors.textPrimary} />
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
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Clock size={13} color={colors.textSecondary} /><Text style={styles.adminRequestPendingText}>Admin Request Submitted</Text></View>
                <Text style={styles.adminRequestPendingHint}>Awaiting review</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.adminRequestBtn}
                onPress={() => setShowAdminRequest(true)}
                activeOpacity={0.8}
              >
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}><ShieldCheck size={14} color={colors.textSecondary} /><Text style={styles.adminRequestBtnText}>Request Admin Access</Text></View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* My Contribution */}
        {(isMember || isEffectiveAdmin) && (
          <Section label="MY CONTRIBUTION & HOURS TRACKER">
            <View style={styles.myHoursTrackerBox}>
              <View style={styles.myHoursTrackerMain}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.myHoursTitle}>Total Hours Contributed</Text>
                  <Text style={styles.myHoursValue}>{myClubHours ?? 0}h</Text>
                  <Text style={styles.myHoursProgressSub}>Target: 30h</Text>
                </View>
                <TouchableOpacity
                  style={styles.logHoursBtn}
                  onPress={() => { setShowHoursRequest(true); setHoursError(''); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.logHoursBtnText}>+ Log Hours</Text>
                </TouchableOpacity>
              </View>

              {/* Progress Bar */}
              <View style={styles.myHoursProgressTrack}>
                <View style={[styles.myHoursProgressFill, { width: `${Math.min(((myClubHours ?? 0) / 30) * 100, 100)}%`, backgroundColor: team.color }]} />
              </View>

              {/* History list */}
              {myAdjustments.length > 0 && (
                <View style={styles.historySection}>
                  <Text style={styles.historyLabel}>REQUEST HISTORY</Text>
                  {myAdjustments.map(adj => {
                    const isPending = adj.status === 'pending';
                    const isApproved = adj.status === 'approved';
                    const isRejected = adj.status === 'rejected';
                    
                    const statusColor = isApproved 
                      ? colors.green 
                      : isRejected 
                      ? colors.red 
                      : colors.amber;
                    const statusBg = isApproved 
                      ? colors.greenLight 
                      : isRejected 
                      ? colors.redLight 
                      : colors.amberLight;

                    return (
                      <View key={adj.id} style={styles.historyRow}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.historyReason} numberOfLines={1}>{adj.reason || 'Hours Log Request'}</Text>
                          <Text style={styles.historyDate}>{new Date(adj.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text style={[styles.historyDelta, { color: adj.hours_delta >= 0 ? colors.green : colors.red }]}>
                            {adj.hours_delta >= 0 ? '+' : ''}{adj.hours_delta}h
                          </Text>
                          <View style={[styles.historyStatusBadge, { backgroundColor: statusBg, borderColor: statusColor }]}>
                            <Text style={[styles.historyStatusText, { color: statusColor }]}>
                              {adj.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </Section>
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
              <Users size={20} color={colors.textPrimary} />
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
              <ClipboardList size={20} color={colors.textPrimary} />
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
                      <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Calendar size={12} color={colors.textSecondary} /><Text style={styles.metaLine}>{event.time}</Text></View>
                      <View style={{flexDirection:'row',alignItems:'center',gap:6}}><MapPin size={12} color={colors.textSecondary} /><Text style={styles.metaLine}>{event.venue}</Text></View>
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
              <View style={{flexDirection:'row',alignItems:'center',gap:8}}><UserCheck size={18} color={colors.textPrimary} /><Text style={styles.modalTitle}>Join {team.name}</Text></View>
              <TouchableOpacity onPress={() => { setShowJoinRequest(false); setJoinMessage(''); }}>
                <X size={20} color={colors.textSecondary} />
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
              <View style={{flexDirection:'row',alignItems:'center',gap:8}}><ShieldCheck size={16} color={colors.textPrimary} /><Text style={styles.modalTitle}>Request Admin Access</Text></View>
              <TouchableOpacity onPress={() => { setShowAdminRequest(false); setAdminReason(''); }}>
                <X size={20} color={colors.textSecondary} />
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
              <View style={{flexDirection:'row',alignItems:'center',gap:8}}><ClipboardList size={16} color={colors.textPrimary} /><Text style={styles.modalTitle}>Join Requests</Text></View>
              <TouchableOpacity onPress={() => setShowJoinReview(false)}>
                <X size={20} color={colors.textSecondary} />
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
              <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Users size={16} color={colors.textPrimary} /><Text style={styles.modalTitle}>Members ({members.length})</Text></View>
              <TouchableOpacity onPress={() => { setShowMembers(false); setSearchQuery(''); setSearchResults([]); }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inviteSection}>
              <View style={{flexDirection:'row',alignItems:'center',gap:6}}><UserPlus size={16} color={colors.textPrimary} /><Text style={styles.inviteSectionTitle}>Invite a Member</Text></View>
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

      {/* Request Contribution Hours Modal */}
      <Modal visible={showHoursRequest} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { maxHeight: 420 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Hours</Text>
              <TouchableOpacity onPress={() => { setShowHoursRequest(false); setHoursError(''); }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>CONTRIBUTION DESCRIPTION *</Text>
            <TextInput
              value={hoursForm.reason}
              onChangeText={t => setHoursForm(f => ({ ...f, reason: t }))}
              placeholder="e.g. Assisted with event lighting setup"
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              multiline
            />

            <Text style={styles.modalLabel}>HOURS *</Text>
            <TextInput
              value={hoursForm.hours}
              onChangeText={t => setHoursForm(f => ({ ...f, hours: t }))}
              placeholder="e.g. 2.5"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
              keyboardType="decimal-pad"
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 12 }}>
              {['1', '2', '3', '5'].map(val => (
                <TouchableOpacity
                  key={val}
                  onPress={() => {
                    const current = parseFloat(hoursForm.hours) || 0;
                    setHoursForm(f => ({ ...f, hours: String(current + parseFloat(val)) }));
                  }}
                  style={styles.presetBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetBtnText}>+{val} Hour{val !== '1' ? 's' : ''}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {hoursError ? (
              <Text style={{ color: colors.red, fontSize: 12, marginTop: 6, marginBottom: 12 }}>{hoursError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.submitBtn, hoursSubmitting && { opacity: 0.5 }, { marginTop: spacing.sm }]}
              onPress={handleRequestHours}
              disabled={hoursSubmitting}
              activeOpacity={0.8}
            >
              {hoursSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Request</Text>
              )}
            </TouchableOpacity>
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
  leaveBtn: { backgroundColor: colors.redLight, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  leaveBtnText: { fontSize: 13, ...font.bold, color: colors.red },

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

  myHoursTrackerBox: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.sm,
  },
  myHoursTrackerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  myHoursTitle: {
    fontSize: 10,
    ...font.bold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  myHoursValue: {
    fontSize: 22,
    ...font.bold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  myHoursProgressSub: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },
  logHoursBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  logHoursBtnText: {
    fontSize: 12,
    ...font.bold,
    color: '#fff',
  },
  myHoursProgressTrack: {
    height: 6,
    backgroundColor: colors.borderSubtle || 'rgba(0,0,0,0.05)',
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: spacing.md,
    marginTop: 4,
  },
  myHoursProgressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  historySection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  historyLabel: {
    fontSize: 9,
    ...font.bold,
    color: colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle || 'rgba(0,0,0,0.05)',
  },
  historyReason: {
    fontSize: 12,
    ...font.semibold,
    color: colors.textPrimary,
  },
  historyDate: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },
  historyDelta: {
    fontSize: 12,
    ...font.bold,
  },
  historyStatusBadge: {
    borderWidth: 0.5,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  historyStatusText: {
    fontSize: 8,
    ...font.bold,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 8,
    alignItems: 'center',
  },
  presetBtnText: {
    fontSize: 11,
    ...font.bold,
    color: colors.textSecondary,
  },
});
