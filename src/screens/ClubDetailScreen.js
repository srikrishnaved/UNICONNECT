import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, Image, Platform, ActivityIndicator,
} from 'react-native';
import { hubClubs, teachers } from '../data';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius, font } from '../theme';
import {
  colors as tColors,
  typography,
  spacing as tSpacing,
  radius as tRadius,
  shadows,
  presets,
} from '../theme/tokens';
import { EmptyState } from '../components/EmptyState';
import { Calendar as CalendarIcon, Users, Check, BarChart2, Gift, ShieldCheck, GraduationCap, Megaphone, MapPin, Trash2, Image as ImageIcon, Timer, Camera, Briefcase, MessageCircle, Link, X, UserPlus } from 'lucide-react-native';
import { ClubLucideIcon } from './HubScreen';

// Lazy-load image picker so web bundler never tries to parse native-only APIs
let ImagePicker = null;
if (Platform.OS !== 'web') {
  ImagePicker = require('expo-image-picker');
}

async function pickEventImage(onResult) {
  if (Platform.OS === 'web') {
    // Web: use a hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const path = `events/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error } = await supabase.storage.from('chat-media').upload(path, file, { contentType: file.type, upsert: false });
      if (error) { alert('Upload failed: ' + error.message); return; }
      const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(path);
      onResult(publicUrl);
    };
    input.click();
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to add an event image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!result.canceled) onResult(result.assets[0].uri);
  }
}

const WHEN_OPTIONS = ['today', 'thisWeek', 'upcoming'];
const WHEN_LABELS  = { today: 'Today', thisWeek: 'This Week', upcoming: 'Upcoming' };

const SEED_MEMBERS = [
  { id: 1, name: 'Srikrishna',   wing: 'Lead',         initials: 'SK' },
  { id: 2, name: 'Ananya Iyer',  wing: 'Photo/Video',  initials: 'AI' },
  { id: 3, name: 'Rohan Das',    wing: 'Photo/Video',  initials: 'RD' },
  { id: 4, name: 'Meera Thomas', wing: 'Design',       initials: 'MT' },
  { id: 5, name: 'Karthik R',    wing: 'Design',       initials: 'KR' },
  { id: 6, name: 'Divya Nair',   wing: 'Social Media', initials: 'DN' },
  { id: 7, name: 'Aryan V',      wing: 'Social Media', initials: 'AV' },
];

export default function ClubDetailScreen({ route, navigation }) {
  const rawId = route.params.clubId;
  const isNumericId = /^\d+$/.test(String(rawId));
  const clubId = isNumericId ? Number(rawId) : rawId;
  const {
    events: hubEvents, addEvent, deleteEvent,
    clubAdminRequests, approvedClubAdmins, submitClubAdminRequest, checkClubAdminRequest,
    createNotification, userProfile, isAppAdmin,
    followingClubIds, toggleClubFollow,
    clubMemberships, submitClubJoinRequest, loadClubJoinRequests, resolveClubJoinRequest, checkClubJoinRequest, leaveClub, resignClubAdmin,
    userCreatedClubs,
  } = useApp();

  const club = hubClubs.find(c => c.id === clubId)
    || userCreatedClubs?.find(c => c.id === String(rawId));

  const isEffectiveAdmin = approvedClubAdmins.has(clubId) || approvedClubAdmins.has(String(rawId)) || isAppAdmin;
  const pendingRequest = clubAdminRequests.find(r => r.clubId === clubId);
  const [pendingAdminReq, setPendingAdminReq] = useState(false);
  const isMember = clubMemberships.has(clubId) || clubMemberships.has(String(rawId));
  const canAccessDashboard = isMember || isEffectiveAdmin;

  const following = followingClubIds.has(String(clubId));
  const [interested, setInterested]   = useState(new Set());
  // Team assignments per event: { [eventId]: { members: [], loading: bool, open: bool } }
  const [teamAssignments, setTeamAssignments] = useState({});

  // Admin Access Request
  const [showAdminRequest, setShowAdminRequest] = useState(false);
  const [adminReason, setAdminReason] = useState('');

  // Club join request
  const [showJoinRequest, setShowJoinRequest] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [pendingJoinReq, setPendingJoinReq] = useState(null);
  const [pendingInvite, setPendingInvite] = useState(null);

  // Admin: review join requests
  const [showJoinReview, setShowJoinReview] = useState(false);
  const [joinReviewList, setJoinReviewList] = useState([]);

  // Post Event
  const [showPostEvent, setShowPostEvent] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: '', date: '', time: '', venue: '', when: 'upcoming', desc: '', imageUri: null,
  });
  const [teamsNeeded, setTeamsNeeded] = useState([]);

  // Recruitment
  const [showRecruitment, setShowRecruitment] = useState(false);
  const [recruitForm, setRecruitForm] = useState({
    role: '', requirements: '', applyBy: '', contact: '',
  });

  // Members
  const [showMembers, setShowMembers]   = useState(false);
  const [members, setMembers]           = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [realMemberCount, setRealMemberCount] = useState(null);
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]       = useState(false);

  // Contribution Hours — member request
  const [showHoursRequest, setShowHoursRequest] = useState(false);
  const [hoursForm, setHoursForm] = useState({ reason: '', hours: '' });
  const [hoursSubmitting, setHoursSubmitting] = useState(false);
  const [hoursError, setHoursError] = useState('');
  const [myClubHours, setMyClubHours] = useState(null);
  const [myAdjustments, setMyAdjustments] = useState([]);

  // Social link
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [socialLink, setSocialLink]           = useState(null); // { platform, url }
  const [socialPlatform, setSocialPlatform]   = useState('Instagram');
  const [socialUrl, setSocialUrl]             = useState('');
  const [savingLink, setSavingLink]           = useState(false);

  const SOCIAL_PLATFORMS = [
    { name: 'Instagram', Icon: Camera,        prefix: 'instagram.com/' },
    { name: 'LinkedIn',  Icon: Briefcase,     prefix: 'linkedin.com/company/' },
    { name: 'WhatsApp',  Icon: MessageCircle, prefix: 'chat.whatsapp.com/' },
    { name: 'Other',     Icon: Link,          prefix: '' },
  ];

  useEffect(() => {
    if (club) navigation.setOptions({ title: club.name });
  }, [club]);

  useEffect(() => {
    if (!isEffectiveAdmin) {
      checkClubAdminRequest(clubId).then(r => { if (r) setPendingAdminReq(true); });
    }
  }, [clubId]);

  useEffect(() => {
    if (!isEffectiveAdmin && !isMember && userProfile?.id) {
      checkClubJoinRequest(clubId).then(r => {
        if (r) setPendingJoinReq(r.status);
      });
      supabase.from('club_invites').select('id')
        .eq('invited_user_id', userProfile.id)
        .eq('club_id', clubId)
        .eq('status', 'pending')
        .maybeSingle()
        .then(({ data }) => { if (data) setPendingInvite(data); });
    }
  }, [clubId, userProfile?.id]);

  useEffect(() => {
    supabase
      .from('club_social_links')
      .select('platform, url')
      .eq('club_id', String(rawId))
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSocialLink({ platform: data.platform, url: data.url });
          setSocialPlatform(data.platform);
          setSocialUrl(data.url);
        }
      });
    if (isMember && userProfile?.id) {
      supabase.from('club_member_hours').select('total_hours')
        .eq('user_id', userProfile.id).eq('club_id', String(rawId)).maybeSingle()
        .then(({ data }) => setMyClubHours(Number(data?.total_hours) || 0));

      supabase.from('hour_adjustments').select('id, hours_delta, reason, status, created_at')
        .eq('user_id', userProfile.id).eq('club_id', String(rawId))
        .order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setMyAdjustments(data); });
    }
    // Fetch real member count so the header never shows the stale seed value.
    supabase.from('club_memberships').select('user_id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .then(({ count }) => setRealMemberCount(count ?? 0));
  }, [rawId]);

  if (!club) {
    return <View style={styles.container}><Text style={styles.body}>Club not found</Text></View>;
  }

  const clubEvents     = hubEvents.filter(e => e.clubId === club.id);
  const upcomingForClub = clubEvents.filter(e => e.when !== 'past');

  // ─── Contribution Hours ────────────────────────────────────────────────────

  const handleRequestHours = async () => {
    setHoursError('');
    const hrs = Number(hoursForm.hours);
    if (!hoursForm.reason.trim()) { setHoursError('Describe what you contributed.'); return; }
    if (!hoursForm.hours.trim() || isNaN(hrs) || hrs <= 0) { setHoursError('Enter a valid number of hours (e.g. 3 or 1.5).'); return; }
    setHoursSubmitting(true);
    const { error } = await supabase.from('hour_adjustments').insert({
      user_id: userProfile.id,
      club_id: String(rawId),
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
      .eq('user_id', userProfile.id).eq('club_id', String(rawId))
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setMyAdjustments(data); });
  };

  // ─── Notify club followers ─────────────────────────────────────────────────

  const notifyFollowers = async (title, body) => {
    const { data } = await supabase
      .from('club_following')
      .select('user_id')
      .eq('club_id', club.id);
    if (!data) return;
    const adminId = userProfile?.id;
    for (const row of data) {
      if (row.user_id === adminId) continue;
      createNotification(row.user_id, 'event', title, body);
    }
  };

  // ─── Post Event ────────────────────────────────────────────────────────────

  const handlePostEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.time.trim() || !eventForm.venue.trim()) {
      Alert.alert('Missing info', 'Title, time, and venue are required.');
      return;
    }
    const title = eventForm.title.trim();
    const timeStr = eventForm.date.trim() ? `${eventForm.date.trim()} · ${eventForm.time.trim()}` : eventForm.time.trim();
    const desc = eventForm.desc.trim() || `${club.name} event.`;

    const { data, error } = await supabase.from('hub_events').insert({
      club_id: club.id,
      club_name: club.name,
      title,
      time: timeStr,
      venue: eventForm.venue.trim(),
      when: eventForm.when,
      description: desc,
      is_recruitment: false,
      image_uri: eventForm.imageUri || null,
      posted_by: userProfile?.id || null,
      teams_needed: teamsNeeded,
    }).select().single();

    if (error) {
      Alert.alert('Error', 'Could not post event. Please try again.');
      return;
    }

    addEvent({
      id: data.id,
      clubId: club.id,
      title,
      time: timeStr,
      venue: eventForm.venue.trim(),
      when: eventForm.when,
      interested: 0,
      desc,
      imageUri: eventForm.imageUri,
    });
    // Notify all active students and all teachers
    const eventNotifTitle = `${club.name}: ${title}`;
    const eventNotifBody = `New event at ${eventForm.venue.trim()}${eventForm.date.trim() ? ' · ' + eventForm.date.trim() : ''}`;
    supabase.from('profiles').select('id').eq('status', 'active').eq('role', 'student').then(({ data: activeStudents }) => {
      for (const p of (activeStudents || [])) {
        if (p.id !== userProfile?.id) {
          createNotification(p.id, 'event', eventNotifTitle, eventNotifBody);
        }
      }
    });
    for (const t of teachers) {
      createNotification(`teacher-${t.id}`, 'event', eventNotifTitle, eventNotifBody);
    }
    // Notify members of each selected team
    for (const teamId of teamsNeeded) {
      const { data: teamMembers } = await supabase
        .from('club_memberships').select('user_id').eq('club_id', teamId);
      const teamName = hubClubs.find(t => t.id === teamId)?.name || 'Your team';
      for (const row of (teamMembers || [])) {
        if (row.user_id !== userProfile?.id) {
          createNotification(
            row.user_id, 'event',
            `${teamName} needed for "${title}"`,
            `${club.name} has selected your team for this event · ${timeStr}`,
          );
        }
      }
    }
    setEventForm({ title: '', date: '', time: '', venue: '', when: 'upcoming', desc: '', imageUri: null });
    setTeamsNeeded([]);
    setShowPostEvent(false);
  };

  // ─── Recruitment ───────────────────────────────────────────────────────────
  const handlePostRecruitment = async () => {
    if (!recruitForm.role.trim()) {
      Alert.alert('Missing info', 'Please enter the role/position.');
      return;
    }
    const title = `${club.name} — Recruiting: ${recruitForm.role.trim()}`;
    const timeStr = recruitForm.applyBy.trim() ? `Apply by ${recruitForm.applyBy.trim()}` : 'Open applications';
    const venue = recruitForm.contact.trim() || 'DM on UniConnect';
    const desc = recruitForm.requirements.trim() || `${club.name} is looking for ${recruitForm.role.trim()}. Reach out to apply!`;

    const { data, error } = await supabase.from('hub_events').insert({
      club_id: club.id,
      club_name: club.name,
      title,
      time: timeStr,
      venue,
      when: 'thisWeek',
      description: desc,
      is_recruitment: true,
      posted_by: userProfile?.id || null,
    }).select().single();

    if (error) {
      Alert.alert('Error', 'Could not post recruitment notice. Please try again.');
      return;
    }

    addEvent({ id: data.id, clubId: club.id, title, time: timeStr, venue, when: 'thisWeek', interested: 0, desc, isRecruitment: true });
    // Notify all active students and all teachers
    const recruitNotifTitle = `${club.name} is recruiting!`;
    const recruitNotifBody = `Looking for: ${recruitForm.role.trim()}`;
    supabase.from('profiles').select('id').eq('status', 'active').eq('role', 'student').then(({ data: activeStudents }) => {
      for (const p of (activeStudents || [])) {
        if (p.id !== userProfile?.id) {
          createNotification(p.id, 'event', recruitNotifTitle, recruitNotifBody);
        }
      }
    });
    for (const t of teachers) {
      createNotification(`teacher-${t.id}`, 'event', recruitNotifTitle, recruitNotifBody);
    }
    setRecruitForm({ role: '', requirements: '', applyBy: '', contact: '' });
    setShowRecruitment(false);
    Alert.alert('Posted!', 'Recruitment notice is live in the Hub feed.');
  };

  // ─── Members ───────────────────────────────────────────────────────────────
  const loadRealMembers = async () => {
    setMembersLoading(true);
    const { data: rows } = await supabase
      .from('club_memberships')
      .select('user_id')
      .eq('club_id', clubId);
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
    // Check not already invited
    const { data: existing } = await supabase
      .from('club_invites')
      .select('id')
      .eq('invited_user_id', user.id)
      .eq('club_id', clubId)
      .eq('status', 'pending')
      .maybeSingle();
    if (existing) { alert(`${user.name} already has a pending invite.`); return; }

    const { data: inviteRow, error } = await supabase.from('club_invites').insert({
      club_id: clubId,
      club_name: club.name,
      invited_user_id: user.id,
      invited_by: userProfile?.id,
    }).select().single();
    if (error) { alert('Could not send invite: ' + error.message); return; }

    // Send notification
    createNotification(
      user.id, 'invite',
      `You've been invited to join ${club.name}!`,
      'Open the notification to accept or decline.',
      { invite_id: inviteRow.id, club_id: clubId, club_name: club.name },
    );

    // Send DM
    const dmText = `Hey! 👋 You've been invited to join ${club.emoji} ${club.name}. Open your notifications to accept or decline the invite.`;
    await supabase.from('direct_messages').insert({
      sender_id: userProfile.id,
      conversation_key: `student-${user.id}`,
      text: dmText,
    });

    setSearchResults(prev => prev.filter(p => p.id !== user.id));
    setSearchQuery('');
    alert(`Invite sent to ${user.name}!`);
  };

  const handleRemoveMember = (userId, name) => {
    const doRemove = async () => {
      await supabase.from('club_memberships').delete()
        .eq('user_id', userId).eq('club_id', clubId);
      setMembers(prev => prev.filter(m => m.userId !== userId));
    };
    Alert.alert('Remove Member', `Remove ${name} from ${club.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: doRemove },
    ]);
  };

  const handleAcceptInvite = async () => {
    if (!pendingInvite) return;
    await supabase.from('club_memberships').insert({ user_id: userProfile.id, club_id: clubId, club_name: club.name });
    await supabase.from('club_invites').update({ status: 'accepted' }).eq('id', pendingInvite.id);
    setPendingInvite(null);
    // update local membership state
    if (clubMemberships) clubMemberships.add(clubId);
    alert(`You've joined ${club.name}!`);
  };

  const handleDeclineInvite = async () => {
    if (!pendingInvite) return;
    await supabase.from('club_invites').update({ status: 'declined' }).eq('id', pendingInvite.id);
    setPendingInvite(null);
  };

  const loadTeamAssignments = async (eventId) => {
    setTeamAssignments(prev => ({
      ...prev,
      [eventId]: { ...prev[eventId], loading: true, open: true },
    }));
    const { data: assignRows } = await supabase
      .from('event_member_assignments')
      .select('user_id, team_id, status')
      .eq('event_id', String(eventId));

    const rows = assignRows || [];
    const userIds = [...new Set(rows.map(r => r.user_id))];
    let profileMap = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, name, course, year').in('id', userIds);
      (profiles || []).forEach(p => { profileMap[p.id] = p; });
    }
    setTeamAssignments(prev => ({
      ...prev,
      [eventId]: {
        open: true,
        loading: false,
        members: rows.map(r => ({ ...r, profile: profileMap[r.user_id] })).filter(r => r.profile),
      },
    }));
  };

  const toggleInterested = (id) => {
    setInterested(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Cover */}
        <View style={[styles.cover, { backgroundColor: club.color }]}>
          <View style={styles.coverInner}>
            <View style={[styles.emojiBox, { backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }]}>
              {club.logo_url
                ? <Image source={{ uri: club.logo_url }} style={{ width: 76, height: 76, borderRadius: 20 }} />
                : <ClubLucideIcon emoji={club.emoji} size={48} color="#fff" />
              }
            </View>
            <View style={styles.typeBadgeWrap}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{club.type.toUpperCase()}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Name + meta */}
        <View style={styles.nameBlock}>
          <Text style={styles.name}>{club.name}</Text>
          <Text style={styles.fullName}>{club.fullName}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Users size={13} color={colors.textSecondary} /><Text style={styles.members}>{realMemberCount !== null ? realMemberCount : '…'} members</Text></View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {isEffectiveAdmin && !isAppAdmin ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.leaveBtn]}
              onPress={async () => {
                const ok = Platform.OS === 'web'
                  ? window.confirm(`Resign as admin of ${club.name}? You will lose admin access.`)
                  : await new Promise(resolve =>
                      Alert.alert('Resign Admin', `Resign as admin of ${club.name}? You will lose admin access.`, [
                        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                        { text: 'Resign', style: 'destructive', onPress: () => resolve(true) },
                      ])
                    );
                if (!ok) return;
                try {
                  await resignClubAdmin(clubId);
                  navigation.goBack();
                } catch (err) {
                  Alert.alert('Error', err.message || 'Could not resign. Please try again.');
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.leaveBtnText}>Resign Admin</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.followBtn, following && styles.followBtnActive]}
                onPress={() => toggleClubFollow(clubId)}
                activeOpacity={0.8}
              >
                <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                  {following && <Check size={13} color={colors.success} />}
                  <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                    {following ? 'Following' : '+ Follow'}
                  </Text>
                </View>
              </TouchableOpacity>

              {isMember ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.leaveBtn]}
                  onPress={() => {
                    Alert.alert('Leave Club', `Leave ${club.name}? You will need to re-apply to rejoin.`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Leave', style: 'destructive', onPress: () => leaveClub(clubId) },
                    ]);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.leaveBtnText}>Leave Club</Text>
                </TouchableOpacity>
              ) : pendingJoinReq === 'pending' ? (
                <View style={[styles.actionBtn, styles.pendingBtn]}>
                  <Text style={styles.pendingBtnText}>Pending Approval</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.applyBtn]}
                  onPress={() => setShowJoinRequest(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.applyBtnText}>Request to Join</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Dashboard entry — clubs only, not teams */}
        {canAccessDashboard && club.type !== 'Team' && (
          <View style={{ paddingHorizontal: tSpacing.base, marginTop: tSpacing.md }}>
            <TouchableOpacity
              style={styles.dashboardBtn}
              onPress={() => navigation.navigate('ClubDashboard', { clubId })}
              activeOpacity={0.82}
            >
              <View style={styles.dashboardBtnLeft}>
                <BarChart2 size={18} color={colors.textPrimary} />
              </View>
              <View style={styles.dashboardBtnCenter}>
                <Text style={styles.dashboardBtnText}>Club Dashboard</Text>
                <Text style={styles.dashboardBtnSub}>Events · Members · Notices · Wings</Text>
              </View>
              <Text style={styles.dashboardBtnArrow}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pending invite banner */}
        {pendingInvite && !isMember && (
          <View style={styles.inviteBanner}>
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Gift size={16} color={colors.accent} /><Text style={styles.inviteBannerText}>You've been invited to join {club.name}!</Text></View>
            <View style={styles.inviteBannerBtns}>
              <TouchableOpacity onPress={handleAcceptInvite} style={styles.inviteAcceptBtn} activeOpacity={0.8}>
                <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Check size={13} color="#fff" /><Text style={styles.inviteAcceptBtnText}>Accept</Text></View>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeclineInvite} style={styles.inviteDeclineBtn} activeOpacity={0.8}>
                <Text style={styles.inviteDeclineBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Request Admin Access */}
        {!isEffectiveAdmin && (
          <View style={styles.adminRequestRow}>
            {(pendingRequest || pendingAdminReq) ? (
              <View style={styles.adminRequestPending}>
                <Text style={styles.adminRequestPendingText}>Admin Request Submitted</Text>
                <Text style={styles.adminRequestPendingHint}>Your request is awaiting review</Text>
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

        {/* About */}
        <Section label="ABOUT">
          <Text style={styles.body}>{club.desc}</Text>
          {club.coordinator && (
            <View style={styles.coordinatorRow}>
              <GraduationCap size={18} color={colors.textSecondary} />
              <View>
                <Text style={styles.coordinatorLabel}>FACULTY COORDINATOR</Text>
                <Text style={styles.coordinatorName}>{club.coordinator}</Text>
              </View>
            </View>
          )}
        </Section>

        {/* Social link — visible to everyone if set */}
        {socialLink && (
          <Section label="LINKS">
            <View style={styles.socialLinkRow}>
              {(() => { const plat = SOCIAL_PLATFORMS.find(p => p.name === socialLink.platform); const PlatIcon = plat?.Icon ?? Link; return <PlatIcon size={20} color={colors.textSecondary} />; })()}
              <View style={{ flex: 1 }}>
                <Text style={styles.socialLinkPlatform}>{socialLink.platform}</Text>
                <Text style={styles.socialLinkUrl} numberOfLines={1}>{socialLink.url}</Text>
              </View>
            </View>
          </Section>
        )}


        {/* My Contribution */}
        {isMember && (
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
                <View style={[styles.myHoursProgressFill, { width: `${Math.min(((myClubHours ?? 0) / 30) * 100, 100)}%`, backgroundColor: club.color }]} />
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

        {/* Upcoming events */}
        <Section label={`EVENTS (${upcomingForClub.length})`}>
          {upcomingForClub.length === 0 ? (
            <EmptyState icon={CalendarIcon} heading="No events yet" subtext="Check back soon for upcoming events" />
          ) : (
            upcomingForClub.map(event => (
              <View key={event.id} style={styles.eventCard}>
                <View style={[styles.eventStripe, { backgroundColor: club.color }]} />
                <View style={styles.eventBody}>
                  {event.isRecruitment && (
                    <View style={styles.recruitBadge}>
                      <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Megaphone size={11} color={colors.accent} /><Text style={styles.recruitBadgeText}>RECRUITMENT</Text></View>
                    </View>
                  )}
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <View style={styles.eventMetaRow}>
                    <View style={{flexDirection:'row',alignItems:'center',gap:6}}><CalendarIcon size={12} color={colors.textSecondary} /><Text style={styles.eventMeta}>{event.time}</Text></View>
                    <View style={{flexDirection:'row',alignItems:'center',gap:6}}><MapPin size={12} color={colors.textSecondary} /><Text style={styles.metaLine}>{event.venue}</Text></View>
                  </View>
                  <Text style={styles.eventDesc}>{event.desc}</Text>
                  {/* Team Assignments — shown when event has teams */}
                  {(event.teams_needed?.length > 0) && (() => {
                    const ta = teamAssignments[event.id];
                    return (
                      <View style={styles.teamAssignSection}>
                        <TouchableOpacity
                          style={styles.teamAssignToggle}
                          onPress={() => {
                            if (!ta || !ta.open) {
                              loadTeamAssignments(event.id);
                            } else {
                              setTeamAssignments(prev => ({ ...prev, [event.id]: { ...prev[event.id], open: false } }));
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                            <Users size={12} color={colors.textSecondary} />
                            <Text style={styles.teamAssignToggleText}>
                              Team Assignments ({event.teams_needed.length} team{event.teams_needed.length !== 1 ? 's' : ''})
                            </Text>
                          </View>
                          <Text style={styles.teamAssignChevron}>{ta?.open ? '▲' : '▼'}</Text>
                        </TouchableOpacity>
                        {ta?.open && (
                          ta.loading ? (
                            <ActivityIndicator color={tColors.student.primary} style={{ marginVertical: 8 }} />
                          ) : ta.members.length === 0 ? (
                            <Text style={styles.teamAssignEmpty}>No members assigned yet.</Text>
                          ) : (() => {
                            // Group by team
                            const byTeam = {};
                            ta.members.forEach(m => {
                              const key = m.team_id;
                              if (!byTeam[key]) byTeam[key] = { team: hubClubs.find(c => c.id === key), members: [] };
                              byTeam[key].members.push(m);
                            });
                            return Object.values(byTeam).map(({ team: t, members: mems }) => (
                              <View key={t?.id} style={styles.teamAssignGroup}>
                                <View style={styles.teamAssignGroupHeader}>
                                  <Text style={styles.teamAssignGroupEmoji}>{t?.emoji}</Text>
                                  <Text style={[styles.teamAssignGroupName, { color: t?.color || tColors.student.primary }]}>
                                    {t?.name || 'Team'}
                                  </Text>
                                  <Text style={styles.teamAssignGroupCount}>{mems.length} assigned</Text>
                                </View>
                                {mems.map((m, i) => (
                                  <View key={i} style={styles.teamAssignRow}>
                                    <View style={styles.teamAssignAvatar}>
                                      <Text style={styles.teamAssignAvatarText}>
                                        {m.profile.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                                      </Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                      <Text style={styles.teamAssignName}>{m.profile.name}</Text>
                                      <Text style={styles.teamAssignMeta}>{m.profile.course} · {m.profile.year}</Text>
                                    </View>
                                    <Check size={12} color={colors.success} />
                                  </View>
                                ))}
                              </View>
                            ));
                          })()
                        )}
                      </View>
                    );
                  })()}

                  <View style={styles.eventFooter}>
                    <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                      <Users size={12} color={colors.textSecondary} />
                      <Text style={styles.eventInterested}>{event.interested + (interested.has(event.id) ? 1 : 0)} interested</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {isEffectiveAdmin && (
                        <TouchableOpacity
                          onPress={() => {
                            const doDelete = () => deleteEvent(event.id);
                            Alert.alert('Delete Event', 'Remove this event from the Hub?', [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: doDelete },
                            ]);
                          }}
                          style={styles.deleteEventBtn}
                          activeOpacity={0.7}
                        >
                          <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Trash2 size={14} color={colors.error} /><Text style={styles.deleteEventBtnText}>Delete</Text></View>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => toggleInterested(event.id)}
                        style={[styles.interestBtn, interested.has(event.id) && styles.interestBtnActive]}
                        activeOpacity={0.7}
                      >
                        <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                          {interested.has(event.id) && <Check size={12} color={colors.success} />}
                          <Text style={[styles.interestBtnText, interested.has(event.id) && styles.interestBtnTextActive]}>
                            {interested.has(event.id) ? 'Interested' : '+ Interested'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Post Event Modal ──────────────────────────────────────────── */}
      <Modal visible={showPostEvent} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post Event</Text>
              <TouchableOpacity onPress={() => setShowPostEvent(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>EVENT TITLE *</Text>
            <TextInput
              value={eventForm.title}
              onChangeText={t => setEventForm(f => ({ ...f, title: t }))}
              placeholder="e.g. Wing 1 Recruitment Drive"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>DATE</Text>
                <TextInput
                  value={eventForm.date}
                  onChangeText={t => setEventForm(f => ({ ...f, date: t }))}
                  placeholder="e.g. Thu 12 Jun"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.modalInput}
                />
              </View>
              <View style={{ width: tSpacing.sm }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>TIME *</Text>
                <TextInput
                  value={eventForm.time}
                  onChangeText={t => setEventForm(f => ({ ...f, time: t }))}
                  placeholder="e.g. 2:00 PM"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.modalInput}
                />
              </View>
            </View>

            <Text style={styles.modalLabel}>VENUE *</Text>
            <TextInput
              value={eventForm.venue}
              onChangeText={t => setEventForm(f => ({ ...f, venue: t }))}
              placeholder="e.g. Tech Hub, Yeshwanthpur"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />

            <Text style={styles.modalLabel}>WHEN</Text>
            <View style={styles.whenRow}>
              {WHEN_OPTIONS.map(w => (
                <TouchableOpacity
                  key={w}
                  style={[styles.whenPill, eventForm.when === w && styles.whenPillActive]}
                  onPress={() => setEventForm(f => ({ ...f, when: w }))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.whenPillText, eventForm.when === w && styles.whenPillTextActive]}>
                    {WHEN_LABELS[w]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>DESCRIPTION</Text>
            <TextInput
              value={eventForm.desc}
              onChangeText={t => setEventForm(f => ({ ...f, desc: t }))}
              placeholder="What's this event about?"
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              multiline
            />

            <Text style={styles.modalLabel}>TEAMS NEEDED (optional)</Text>
            <View style={styles.teamPickerGrid}>
              {hubClubs.filter(c => c.type === 'Team').map(t => {
                const selected = teamsNeeded.includes(t.id);
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.teamPickerChip, selected && { backgroundColor: `${t.color}22`, borderColor: t.color }]}
                    onPress={() => setTeamsNeeded(prev =>
                      selected ? prev.filter(id => id !== t.id) : [...prev, t.id]
                    )}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.teamPickerEmoji}>{t.emoji}</Text>
                    <Text style={[styles.teamPickerText, selected && { color: t.color, fontWeight: typography.semibold }]}>{t.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.modalLabel}>IMAGE (optional)</Text>
            <TouchableOpacity
              style={styles.imagePicker}
              onPress={() => pickEventImage(uri => setEventForm(f => ({ ...f, imageUri: uri })))}
              activeOpacity={0.8}
            >
              {eventForm.imageUri ? (
                <>
                  <Image source={{ uri: eventForm.imageUri }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.imageRemove}
                    onPress={() => setEventForm(f => ({ ...f, imageUri: null }))}
                    activeOpacity={0.8}
                  >
                    <X size={16} color={colors.error} />
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.imagePickerEmpty}>
                  <ImageIcon size={24} color={colors.textSecondary} />
                  <Text style={styles.imagePickerText}>Tap to add a photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, (!eventForm.title.trim() || !eventForm.time.trim() || !eventForm.venue.trim()) && { opacity: 0.45 }]}
              onPress={handlePostEvent}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText}>Post Event</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Recruitment Modal ─────────────────────────────────────────── */}
      <Modal visible={showRecruitment} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Open Recruitment</Text>
              <TouchableOpacity onPress={() => setShowRecruitment(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>ROLE / POSITION *</Text>
            <TextInput
              value={recruitForm.role}
              onChangeText={t => setRecruitForm(f => ({ ...f, role: t }))}
              placeholder="e.g. Wing 1 — Photographer"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />

            <Text style={styles.modalLabel}>REQUIREMENTS</Text>
            <TextInput
              value={recruitForm.requirements}
              onChangeText={t => setRecruitForm(f => ({ ...f, requirements: t }))}
              placeholder="What skills or experience are you looking for?"
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              multiline
            />

            <Text style={styles.modalLabel}>APPLY BY</Text>
            <TextInput
              value={recruitForm.applyBy}
              onChangeText={t => setRecruitForm(f => ({ ...f, applyBy: t }))}
              placeholder="e.g. 20 Jun 2026"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />

            <Text style={styles.modalLabel}>CONTACT / HOW TO APPLY</Text>
            <TextInput
              value={recruitForm.contact}
              onChangeText={t => setRecruitForm(f => ({ ...f, contact: t }))}
              placeholder="e.g. DM @techteam or email us"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />

            <TouchableOpacity
              style={[styles.submitBtn, !recruitForm.role.trim() && { opacity: 0.45 }]}
              onPress={handlePostRecruitment}
              disabled={!recruitForm.role.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText}>Post Recruitment Notice</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Admin Access Request Modal ───────────────────────────────── */}
      <Modal visible={showAdminRequest} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Admin Access</Text>
              <TouchableOpacity onPress={() => { setShowAdminRequest(false); setAdminReason(''); }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.adminRequestClubRow}>
              <View style={[styles.adminRequestClubEmoji, { backgroundColor: `${club.color}33` }]}>
                <Text style={{ fontSize: 20 }}>{club.emoji}</Text>
              </View>
              <View>
                <Text style={styles.adminRequestClubName}>{club.name}</Text>
                <Text style={styles.adminRequestClubFull}>{club.fullName}</Text>
              </View>
            </View>

            <Text style={styles.modalLabel}>WHY DO YOU WANT TO BE ADMIN?</Text>
            <TextInput
              value={adminReason}
              onChangeText={setAdminReason}
              placeholder="Describe your experience and what you'd bring to this club..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { height: 120, textAlignVertical: 'top', paddingTop: tSpacing.sm }]}
              multiline
              maxLength={500}
            />
            <Text style={styles.charCount}>{adminReason.length}/500</Text>

            <TouchableOpacity
              style={[styles.submitBtn, !adminReason.trim() && { opacity: 0.45 }]}
              onPress={async () => {
                if (!adminReason.trim()) return;
                try {
                  await submitClubAdminRequest({ clubId: club.id, clubName: club.name, reason: adminReason });
                  setPendingAdminReq(true);
                  setShowAdminRequest(false);
                  setAdminReason('');
                  Alert.alert('Request Sent', 'Your request has been submitted. The app admin will review it shortly.');
                } catch (err) {
                  Alert.alert('Error', err.message || 'Could not send request. Please try again.');
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

      {/* ── Request Contribution Hours Modal ─────────────────────────── */}
      <Modal visible={showHoursRequest} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Hours</Text>
              <TouchableOpacity onPress={() => { setShowHoursRequest(false); setHoursError(''); }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>WHAT DID YOU CONTRIBUTE? *</Text>
            <TextInput
              value={hoursForm.reason}
              onChangeText={t => setHoursForm(f => ({ ...f, reason: t }))}
              placeholder="e.g. Photographed the ACE event on Sat 14 Jun"
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              multiline
            />
            <Text style={styles.modalLabel}>HOURS *</Text>
            <TextInput
              value={hoursForm.hours}
              onChangeText={t => setHoursForm(f => ({ ...f, hours: t }))}
              placeholder="e.g. 3.5"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
              keyboardType="decimal-pad"
            />
            {hoursError ? (
              <Text style={{ color: tColors.error, fontSize: 12, marginTop: 6 }}>{hoursError}</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.submitBtn, hoursSubmitting && { opacity: 0.5 }]}
              onPress={handleRequestHours}
              disabled={hoursSubmitting}
              activeOpacity={0.85}
            >
              {hoursSubmitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Submit Request</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Social Link Modal ────────────────────────────────────────── */}
      <Modal visible={showSocialModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Social Link</Text>
              <TouchableOpacity onPress={() => setShowSocialModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>PLATFORM</Text>
            <View style={styles.platformRow}>
              {SOCIAL_PLATFORMS.map(p => (
                <TouchableOpacity
                  key={p.name}
                  style={[styles.platformPill, socialPlatform === p.name && styles.platformPillActive]}
                  onPress={() => setSocialPlatform(p.name)}
                  activeOpacity={0.7}
                >
                  <p.Icon size={14} color={socialPlatform === p.name ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.platformPillText, socialPlatform === p.name && styles.platformPillTextActive]}>
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>LINK / URL</Text>
            <TextInput
              value={socialUrl}
              onChangeText={setSocialUrl}
              placeholder={
                SOCIAL_PLATFORMS.find(p => p.name === socialPlatform)?.prefix
                  ? `e.g. ${SOCIAL_PLATFORMS.find(p => p.name === socialPlatform).prefix}yourclub`
                  : 'Paste your full link here'
              }
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
              autoCapitalize="none"
              keyboardType="url"
            />

            <TouchableOpacity
              style={[styles.submitBtn, (!socialUrl.trim() || savingLink) && { opacity: 0.45 }]}
              onPress={async () => {
                if (!socialUrl.trim()) return;
                setSavingLink(true);
                const { error } = await supabase.from('club_social_links').upsert({
                  club_id: String(rawId), platform: socialPlatform, url: socialUrl.trim(),
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'club_id' });
                setSavingLink(false);
                if (error) { Alert.alert('Error', 'Could not save link.'); return; }
                setSocialLink({ platform: socialPlatform, url: socialUrl.trim() });
                setShowSocialModal(false);
              }}
              disabled={!socialUrl.trim() || savingLink}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText}>{savingLink ? 'Saving…' : 'Save Link'}</Text>
            </TouchableOpacity>

            {socialLink && (
              <TouchableOpacity
                style={styles.removeLinkBtn}
                onPress={async () => {
                  await supabase.from('club_social_links').delete().eq('club_id', String(rawId));
                  setSocialLink(null);
                  setSocialUrl('');
                  setShowSocialModal(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.removeLinkBtnText}>Remove link</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Join Request Modal ───────────────────────────────────────── */}
      <Modal visible={showJoinRequest} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Verify Membership</Text>
              <TouchableOpacity onPress={() => { setShowJoinRequest(false); setJoinMessage(''); }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.adminRequestClubRow}>
              <View style={[styles.adminRequestClubEmoji, { backgroundColor: `${club.color}33` }]}>
                <Text style={{ fontSize: 20 }}>{club.emoji}</Text>
              </View>
              <View>
                <Text style={styles.adminRequestClubName}>{club.name}</Text>
                <Text style={styles.adminRequestClubFull}>{club.fullName}</Text>
              </View>
            </View>

            <Text style={styles.modalLabel}>ANYTHING TO ADD? (optional)</Text>
            <TextInput
              value={joinMessage}
              onChangeText={setJoinMessage}
              placeholder="e.g. I joined last semester, my role is photographer..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { height: 100, textAlignVertical: 'top', paddingTop: tSpacing.sm }]}
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
                  await submitClubJoinRequest({ clubId: club.id, clubName: club.name, message: joinMessage });
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

      {/* ── Join Review Modal (admin) ─────────────────────────────────── */}
      <Modal visible={showJoinReview} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Join Requests</Text>
              <TouchableOpacity onPress={() => setShowJoinReview(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {joinReviewList.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: tSpacing.lg }}>
                <Text style={{ fontSize: 13, color: tColors.textSecondary }}>No pending requests.</Text>
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
                    {req.message ? (
                      <Text style={styles.joinReqMessage}>"{req.message}"</Text>
                    ) : null}
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

      {/* ── Members Modal ─────────────────────────────────────────────── */}
      <Modal visible={showMembers} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Members ({members.length})</Text>
              <TouchableOpacity onPress={() => { setShowMembers(false); setSearchQuery(''); setSearchResults([]); }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Invite section */}
            <View style={styles.inviteSection}>
              <View style={{flexDirection:'row',alignItems:'center',gap:6}}><UserPlus size={16} color={colors.textPrimary} /><Text style={styles.inviteSectionTitle}>Invite a Member</Text></View>
              <View style={styles.addMemberRow}>
                <TextInput
                  value={searchQuery}
                  onChangeText={handleSearch}
                  placeholder="Type a name to search..."
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
                <EmptyState icon={Users} heading="No members yet" subtext="Be the first to join this club" />
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
  container: { flex: 1, backgroundColor: tColors.bg },
  body: { fontSize: 14, color: tColors.textSecondary, lineHeight: 20 },
  coordinatorRow: { flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm, marginTop: tSpacing.md, backgroundColor: tColors.student.primaryDim, borderWidth: 1, borderColor: tColors.student.primary, borderRadius: tRadius.md, padding: tSpacing.sm },
  coordinatorIcon: { fontSize: 20 },
  coordinatorLabel: { fontSize: 9, fontWeight: typography.bold, color: tColors.student.primary, letterSpacing: 0.6 },
  coordinatorName: { fontSize: 13, fontWeight: typography.semibold, color: tColors.textPrimary, marginTop: 2 },

  cover: { height: 130 },
  coverInner: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  emojiBox: {
    width: 76, height: 76, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 38 },
  typeBadgeWrap: { position: 'absolute', top: 12, right: 12 },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: tRadius.full,
  },
  typeBadgeText: { fontSize: 10, fontWeight: typography.bold, color: '#fff', letterSpacing: 0.8 },

  nameBlock: { alignItems: 'center', paddingHorizontal: tSpacing.base, marginTop: tSpacing.base },
  name: { fontSize: 22, fontWeight: typography.bold, color: tColors.textPrimary },
  fullName: { fontSize: 12, color: tColors.textSecondary, marginTop: 4, textAlign: 'center' },
  members: { fontSize: 12, color: tColors.textTertiary, marginTop: 8 },

  actions: {
    flexDirection: 'row', gap: tSpacing.sm,
    paddingHorizontal: tSpacing.base, marginTop: tSpacing.base,
  },
  actionBtn: { flex: 1, borderRadius: tRadius.md, paddingVertical: 12, alignItems: 'center' },
  followBtn: { backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border },
  followBtnActive: { backgroundColor: tColors.student.primary, borderColor: tColors.student.primary },
  followBtnText: { fontSize: 13, fontWeight: typography.bold, color: tColors.textPrimary },
  followBtnTextActive: { color: tColors.success },
  applyBtn: { backgroundColor: tColors.student.primary },
  applyBtnText: { fontSize: 13, fontWeight: typography.bold, color: '#fff' },
  memberBtn: { backgroundColor: tColors.successDim, borderWidth: 1, borderColor: tColors.success },
  memberBtnText: { fontSize: 13, fontWeight: typography.bold, color: tColors.success },
  pendingBtn: { backgroundColor: tColors.warningDim, borderWidth: 1, borderColor: tColors.warning },
  pendingBtnText: { fontSize: 13, fontWeight: typography.bold, color: tColors.textSecondary },
  leaveBtn: { backgroundColor: tColors.errorDim, borderWidth: 1, borderColor: tColors.error },
  leaveBtnText: { fontSize: 13, fontWeight: typography.bold, color: tColors.error },
  limitBtn: { backgroundColor: tColors.errorDim, borderWidth: 1, borderColor: tColors.error },
  limitBtnText: { fontSize: 12, fontWeight: typography.bold, color: tColors.error },
  manageBtn: { backgroundColor: tColors.student.primary, flex: 1 },
  manageBtnText: { fontSize: 14, fontWeight: typography.bold, color: '#fff' },

  dashboardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.md,
    backgroundColor: tColors.student.primary,
    borderRadius: tRadius.md, paddingVertical: 14, paddingHorizontal: tSpacing.md,
  },
  dashboardBtnLeft: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  dashboardBtnIcon: { fontSize: 20 },
  dashboardBtnCenter: { flex: 1 },
  dashboardBtnText: { fontSize: 15, fontWeight: typography.bold, color: '#fff' },
  dashboardBtnSub: { fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 1 },
  dashboardBtnArrow: { fontSize: 22, color: 'rgba(255,255,255,0.7)' },

  section: { paddingHorizontal: tSpacing.base, marginTop: tSpacing.base },
  sectionLabel: {
    fontSize: typography.lg, color: tColors.textPrimary,
    fontWeight: typography.bold, letterSpacing: 0.8, marginBottom: tSpacing.sm,
  },

  adminActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    backgroundColor: tColors.card,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md, marginBottom: tSpacing.sm,
  },
  adminActionIcon: { fontSize: 22 },
  adminActionTitle: { fontSize: 13, fontWeight: typography.bold, color: tColors.textPrimary },
  adminActionDesc: { fontSize: 11, color: tColors.textSecondary, marginTop: 2 },
  adminActionArrow: { fontSize: 22, color: tColors.textTertiary },

  eventCard: {
    ...shadows.card,
    backgroundColor: tColors.card,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.lg, marginBottom: tSpacing.sm, overflow: 'hidden',
  },
  eventImage: { width: '100%', height: 140 },
  eventStripe: { height: 3 },
  eventBody: { padding: tSpacing.md },
  recruitBadge: {
    alignSelf: 'flex-start',
    backgroundColor: tColors.warningDim,
    borderWidth: 1, borderColor: tColors.warning,
    borderRadius: tRadius.full,
    paddingHorizontal: 8, paddingVertical: 2,
    marginBottom: 6,
  },
  recruitBadgeText: { fontSize: 9, fontWeight: typography.bold, color: tColors.warning, letterSpacing: 0.6 },
  eventTitle: { fontSize: 14, fontWeight: typography.bold, color: tColors.textPrimary, marginBottom: 6 },
  eventMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 6 },
  eventMeta: { fontSize: 11, color: tColors.textSecondary },
  eventDesc: { fontSize: 12, color: tColors.textSecondary, lineHeight: 17, marginBottom: tSpacing.sm },
  eventFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: tSpacing.sm, borderTopWidth: 1, borderTopColor: tColors.border,
  },
  eventInterested: { fontSize: 11, color: tColors.textTertiary },
  deleteEventBtn: {
    backgroundColor: 'transparent', borderWidth: 1, borderColor: tColors.error,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: tRadius.sm,
  },
  deleteEventBtnText: { fontSize: 11, color: tColors.error, fontWeight: typography.semibold },
  interestBtn: {
    backgroundColor: tColors.student.primary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: tRadius.sm,
  },
  interestBtnActive: { backgroundColor: tColors.successDim, borderWidth: 1, borderColor: tColors.success },
  interestBtnText: { fontSize: 11, color: '#fff', fontWeight: typography.semibold },
  interestBtnTextActive: { color: tColors.success },

  emptyBox: {
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.base, alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: tColors.textSecondary },

  // Modal shared
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: tColors.card,
    borderTopLeftRadius: tRadius.lg, borderTopRightRadius: tRadius.lg,
    padding: tSpacing.base, maxHeight: '92%',
    borderWidth: 1, borderColor: tColors.border,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: tSpacing.base,
  },
  modalTitle: { fontSize: 18, fontWeight: typography.bold, color: tColors.textPrimary },
  modalClose: { fontSize: 22, color: tColors.textSecondary, padding: 4 },
  modalLabel: {
    fontSize: 10, color: tColors.textSecondary, letterSpacing: 0.8,
    fontWeight: typography.bold, marginBottom: 6, marginTop: tSpacing.sm,
  },
  modalInput: {
    backgroundColor: tColors.bg, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md, color: tColors.textPrimary, fontSize: 14,
    marginBottom: 0,
  },
  row: { flexDirection: 'row', marginTop: 0 },
  whenRow: { flexDirection: 'row', gap: 8 },
  whenPill: {
    flex: 1, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.full, paddingVertical: 8,
    alignItems: 'center', backgroundColor: tColors.bg,
  },
  whenPillActive: { backgroundColor: tColors.student.primary, borderColor: tColors.student.primary },
  whenPillText: { fontSize: 12, color: tColors.textSecondary, fontWeight: typography.medium },
  whenPillTextActive: { color: '#fff', fontWeight: typography.semibold },

  imagePicker: {
    backgroundColor: tColors.bg, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, overflow: 'hidden', minHeight: 100,
  },
  imagePickerEmpty: { height: 100, alignItems: 'center', justifyContent: 'center', gap: 6 },
  imagePickerIcon: { fontSize: 28 },
  imagePickerText: { fontSize: 13, color: tColors.textTertiary },
  imagePreview: { width: '100%', height: 160 },
  imageRemove: {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  imageRemoveText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  submitBtn: {
    backgroundColor: tColors.student.primary, borderRadius: tRadius.md,
    paddingVertical: 14, marginTop: tSpacing.base, alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: typography.bold },

  adminRequestRow: { paddingHorizontal: tSpacing.base, marginTop: tSpacing.sm },
  adminRequestBtn: {
    borderWidth: 1, borderColor: tColors.warning,
    borderRadius: tRadius.md, paddingVertical: 12,
    alignItems: 'center', backgroundColor: tColors.warningDim,
  },
  adminRequestBtnText: { fontSize: 13, fontWeight: typography.bold, color: tColors.warning },
  adminRequestPending: {
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, paddingVertical: 12,
    alignItems: 'center', backgroundColor: tColors.card,
  },
  adminRequestPendingText: { fontSize: 13, fontWeight: typography.bold, color: tColors.textSecondary },
  adminRequestPendingHint: { fontSize: 11, color: tColors.textTertiary, marginTop: 2 },

  adminRequestClubRow: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    backgroundColor: tColors.bg, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md, marginBottom: tSpacing.md,
  },
  adminRequestClubEmoji: {
    width: 40, height: 40, borderRadius: tRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  adminRequestClubName: { fontSize: 14, fontWeight: typography.bold, color: tColors.textPrimary },
  adminRequestClubFull: { fontSize: 11, color: tColors.textSecondary, marginTop: 1 },
  charCount: { fontSize: 10, color: tColors.textTertiary, textAlign: 'right', marginTop: 4 },

  // Members modal
  addMemberRow: { flexDirection: 'row', gap: tSpacing.sm, alignItems: 'center', marginBottom: tSpacing.sm },
  addMemberBtn: {
    backgroundColor: tColors.student.primary, borderRadius: tRadius.md,
    paddingHorizontal: tSpacing.md, paddingVertical: 13,
  },
  addMemberBtnText: { color: '#fff', fontSize: 13, fontWeight: typography.bold },
  inviteBanner: {
    marginHorizontal: tSpacing.md, marginTop: tSpacing.sm,
    backgroundColor: tColors.student.primaryDim,
    borderWidth: 1, borderColor: tColors.student.primary,
    borderRadius: tRadius.md, padding: tSpacing.md,
  },
  inviteBannerText: { fontSize: 13, fontWeight: typography.semibold, color: tColors.student.primary, marginBottom: tSpacing.sm },
  inviteBannerBtns: { flexDirection: 'row', gap: tSpacing.sm },
  inviteAcceptBtn: {
    flex: 1, backgroundColor: tColors.success, borderRadius: tRadius.md,
    paddingVertical: 9, alignItems: 'center',
  },
  inviteAcceptBtnText: { fontSize: 13, fontWeight: typography.bold, color: '#fff' },
  inviteDeclineBtn: {
    flex: 1, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, paddingVertical: 9, alignItems: 'center',
  },
  inviteDeclineBtnText: { fontSize: 13, fontWeight: typography.bold, color: tColors.textSecondary },
  inviteSection: {
    backgroundColor: tColors.student.primaryDim,
    borderWidth: 1, borderColor: tColors.student.primary,
    borderRadius: tRadius.md, padding: tSpacing.md, marginBottom: tSpacing.md,
  },
  inviteSectionTitle: { fontSize: 13, fontWeight: typography.bold, color: tColors.student.primary, marginBottom: tSpacing.sm },
  searchResultsBox: {
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, marginTop: tSpacing.sm, overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    padding: tSpacing.sm, borderBottomWidth: 1, borderBottomColor: tColors.border,
  },
  inviteBtnText: { fontSize: 12, color: tColors.student.primary, fontWeight: typography.bold },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    paddingVertical: tSpacing.sm,
    borderBottomWidth: 1, borderBottomColor: tColors.border,
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: tColors.cardAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarText: { fontSize: 13, fontWeight: typography.bold, color: '#fff' },
  memberName: { fontSize: 13, fontWeight: typography.semibold, color: tColors.textPrimary },
  memberWing: { fontSize: 11, color: tColors.textTertiary, marginTop: 1 },
  removeBtn: {
    backgroundColor: tColors.errorDim, borderWidth: 1, borderColor: tColors.error,
    borderRadius: tRadius.sm, paddingHorizontal: 10, paddingVertical: 4,
  },
  removeBtnText: { fontSize: 11, color: tColors.error, fontWeight: typography.semibold },
  youBadge: {
    backgroundColor: tColors.student.primaryDim, borderWidth: 1, borderColor: tColors.student.primary,
    borderRadius: tRadius.sm, paddingHorizontal: 10, paddingVertical: 4,
  },
  youBadgeText: { fontSize: 11, color: tColors.student.primary, fontWeight: typography.semibold },

  socialLinkRow: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md,
  },
  socialLinkIcon: { fontSize: 22 },
  socialLinkPlatform: { fontSize: 13, fontWeight: typography.semibold, color: tColors.textPrimary },
  socialLinkUrl: { fontSize: 12, color: tColors.textSecondary, marginTop: 2 },

  platformRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: tSpacing.sm },
  platformPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.full, paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: tColors.bg,
  },
  platformPillActive: { borderColor: tColors.student.primary, backgroundColor: tColors.student.primaryDim },
  platformPillIcon: { fontSize: 14 },
  platformPillText: { fontSize: 12, color: tColors.textSecondary, fontWeight: typography.medium },
  platformPillTextActive: { color: tColors.student.primary, fontWeight: typography.semibold },

  removeLinkBtn: {
    marginTop: tSpacing.sm, alignItems: 'center', paddingVertical: 10,
  },
  removeLinkBtnText: { fontSize: 13, color: tColors.error, fontWeight: typography.semibold },

  teamAssignSection: {
    backgroundColor: tColors.bg, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, marginBottom: tSpacing.sm, overflow: 'hidden',
  },
  teamAssignToggle: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: tSpacing.sm,
  },
  teamAssignToggleText: { fontSize: 11, fontWeight: typography.semibold, color: tColors.student.primary },
  teamAssignChevron: { fontSize: 9, color: tColors.textTertiary },
  teamAssignEmpty: { fontSize: 12, color: tColors.textTertiary, paddingHorizontal: tSpacing.sm, paddingBottom: tSpacing.sm },
  teamAssignRow: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    paddingHorizontal: tSpacing.sm, paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: tColors.border,
  },
  teamAssignAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: tColors.student.primary, alignItems: 'center', justifyContent: 'center',
  },
  teamAssignAvatarText: { fontSize: 10, fontWeight: typography.bold, color: '#fff' },
  teamAssignGroup: { borderTopWidth: 1, borderTopColor: tColors.border },
  teamAssignGroupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: tSpacing.sm, paddingVertical: 6,
    backgroundColor: tColors.bg,
  },
  teamAssignGroupEmoji: { fontSize: 13 },
  teamAssignGroupName: { fontSize: 11, fontWeight: typography.bold, flex: 1 },
  teamAssignGroupCount: { fontSize: 10, color: tColors.textTertiary },
  teamAssignName: { fontSize: 12, fontWeight: typography.semibold, color: tColors.textPrimary },
  teamAssignMeta: { fontSize: 10, color: tColors.textTertiary, marginTop: 1 },
  teamAssignDot: { fontSize: 12, color: tColors.success, fontWeight: typography.bold },

  teamPickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: tSpacing.sm },
  teamPickerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.full, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: tColors.card,
  },
  teamPickerEmoji: { fontSize: 13 },
  teamPickerText: { fontSize: 11, color: tColors.textSecondary, fontWeight: typography.medium },

  joinReqCard: {
    backgroundColor: tColors.bg, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md, marginBottom: tSpacing.sm,
  },
  joinReqHeader: { flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm, marginBottom: tSpacing.sm },
  joinReqAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: tColors.student.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  joinReqAvatarText: { fontSize: 13, fontWeight: typography.bold, color: '#fff' },
  joinReqName: { fontSize: 13, fontWeight: typography.semibold, color: tColors.textPrimary },
  joinReqMeta: { fontSize: 11, color: tColors.textTertiary, marginTop: 1 },
  joinReqMessage: {
    fontSize: 12, color: tColors.textSecondary, fontStyle: 'italic',
    marginBottom: tSpacing.sm, lineHeight: 17,
  },
  joinReqActions: { flexDirection: 'row', gap: tSpacing.sm },
  joinReqReject: {
    flex: 1, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.sm, paddingVertical: 8, alignItems: 'center',
  },
  joinReqRejectText: { fontSize: 12, fontWeight: typography.semibold, color: tColors.textSecondary },
  joinReqApprove: {
    flex: 1, backgroundColor: tColors.student.primary,
    borderRadius: tRadius.sm, paddingVertical: 8, alignItems: 'center',
  },
  joinReqApproveText: { fontSize: 12, fontWeight: typography.semibold, color: '#fff' },

  myHoursTrackerBox: {
    backgroundColor: tColors.card,
    borderWidth: 1,
    borderColor: tColors.border,
    borderRadius: tRadius.lg,
    padding: tSpacing.md,
    width: '100%',
  },
  myHoursTrackerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tSpacing.sm,
  },
  myHoursTitle: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    color: tColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  myHoursValue: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: tColors.textPrimary,
    marginTop: 2,
  },
  myHoursProgressSub: {
    fontSize: 10,
    color: tColors.textTertiary,
    marginTop: 2,
  },
  logHoursBtn: {
    backgroundColor: tColors.student.primary,
    borderRadius: tRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  logHoursBtnText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    color: '#fff',
  },
  myHoursProgressTrack: {
    height: 6,
    backgroundColor: tColors.borderSubtle,
    borderRadius: tRadius.full,
    overflow: 'hidden',
    marginBottom: tSpacing.md,
    marginTop: 4,
  },
  myHoursProgressFill: {
    height: '100%',
    borderRadius: tRadius.full,
  },
  historySection: {
    borderTopWidth: 1,
    borderTopColor: tColors.border,
    paddingTop: tSpacing.md,
  },
  historyLabel: {
    fontSize: 9,
    fontWeight: typography.bold,
    color: tColors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: tSpacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tColors.borderSubtle,
  },
  historyReason: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: tColors.textPrimary,
  },
  historyDate: {
    fontSize: 10,
    color: tColors.textTertiary,
    marginTop: 2,
  },
  historyDelta: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  historyStatusBadge: {
    borderWidth: 0.5,
    borderRadius: tRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  historyStatusText: {
    fontSize: 8,
    fontWeight: typography.bold,
  },
});
