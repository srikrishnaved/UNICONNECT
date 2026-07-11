import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, Alert, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hubClubs, teachers } from '../data';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius, font, avatarColor, initials } from '../theme';
import { colors as tColors, typography, spacing as tSpacing, radius as tRadius, shadows, presets } from '../theme/tokens';
import { createCompensatoryRequest } from '../lib/compensatoryUtils';
import DocumentationScreen from './DocumentationScreen';
import { X, Camera, Briefcase, MessageCircle, Link, RefreshCw, Image as ImageIcon, ClipboardList, Zap, Calendar, Megaphone, Users, FileText, Trash2, Layers, LayoutTemplate, Pencil, Check, MapPin, Phone, Lock, Compass, CalendarDays, Landmark, GraduationCap, BookOpen } from 'lucide-react-native';

let ImagePicker = null;
if (Platform.OS !== 'web') {
  ImagePicker = require('expo-image-picker');
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function SectionHeader({ label, action }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {action}
    </View>
  );
}

function EmptyState({ text }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function parseTimeMins(t) {
  if (!t) return 0;
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
}

// Parse a free-text event time ("2:00 PM", "14:00", "9 AM") to minutes since midnight.
// Returns null if unparseable.
function parseEventTime(t) {
  if (!t) return null;
  const s = t.trim();
  const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2] || '0', 10);
    if (ampm[3].toLowerCase() === 'pm' && h !== 12) h += 12;
    if (ampm[3].toLowerCase() === 'am' && h === 12) h = 0;
    return h * 60 + m;
  }
  const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) return parseInt(h24[1], 10) * 60 + parseInt(h24[2], 10);
  return null;
}

// Extract a timetable day abbreviation from a free-text date string
// ("Thu 12 Jun" → "THU", "Friday" → "FRI", "2026-06-20" → "SAT", etc.)
function parseFreeTextDay(dateStr) {
  if (!dateStr) return null;
  const s = dateStr.trim();
  // ISO date → use getWeekdayAbbr
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return getWeekdayAbbr(s);
  const l = s.toLowerCase();
  if (/\bmon/.test(l)) return 'MON';
  if (/\btue/.test(l)) return 'TUE';
  if (/\bwed/.test(l)) return 'WED';
  if (/\bthu/.test(l)) return 'THU';
  if (/\bfri/.test(l)) return 'FRI';
  if (/\bsat/.test(l)) return 'SAT';
  return null;
}

// Returns timetable_slots rows (with period times attached) that overlap with the
// given free-text time on the given free-text date. Empty array = no conflict or
// time couldn't be parsed.
async function checkEventTimetableConflicts(dateStr, timeStr) {
  const eventMins = parseEventTime(timeStr);
  if (eventMins === null) return [];

  const dayAbbr = parseFreeTextDay(dateStr); // null → check all days

  const { data: periodsData } = await supabase.from('timetable_periods').select('name, start_time, end_time');
  if (!periodsData?.length) return [];

  const overlapping = periodsData.filter(p => {
    const ps = parseTimeMins(p.start_time);
    const pe = parseTimeMins(p.end_time);
    return eventMins >= ps && eventMins < pe;
  });
  if (!overlapping.length) return [];

  let query = supabase
    .from('timetable_slots')
    .select('class_name, day, period_name, faculty_name')
    .in('period_name', overlapping.map(p => p.name));
  if (dayAbbr) query = query.eq('day', dayAbbr);

  const { data: conflictSlots } = await query;
  if (!conflictSlots?.length) return [];

  return conflictSlots.map(s => {
    const period = overlapping.find(p => p.name === s.period_name);
    return { ...s, start_time: period?.start_time || '', end_time: period?.end_time || '' };
  });
}

function getWeekdayAbbr(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
}

function eventStatusLabel(status) {
  switch (status) {
    case 'pending_faculty_coordinator': return 'Awaiting Faculty Coordinator';
    case 'pending_saps': return 'Awaiting SAPS';
    case 'pending_hod': return 'Awaiting HOD';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    default: return status || 'Unknown';
  }
}

// Works as both a Stack.Screen (route.params) and a Modal component (direct props)
export default function ClubDashboardScreen({
  route, navigation,
  clubId: propClubId,
  isCoordinatorProp = false,
  onClose,
}) {
  const rawId = propClubId ?? route?.params?.clubId;
  const isNumericId = /^\d+$/.test(String(rawId));
  const clubId = isNumericId ? Number(rawId) : rawId;

  const {
    userProfile, teacherProfile,
    approvedClubAdmins, clubMemberships,
    isAppAdmin, isSapsCore, events: hubEvents, deleteEvent, addEvent,
    loadClubJoinRequests, resolveClubJoinRequest, deleteClub,
    userCreatedClubs, createNotification, adminTestTeacher,
  } = useApp();

  const club = hubClubs.find(c => c.id === clubId)
    || userCreatedClubs?.find(c => c.id === String(rawId));

  const isCoordinator = isCoordinatorProp
    || !!(adminTestTeacher?.coordinatorClubIds?.includes(clubId))
    || !!(isNumericId && teacherProfile?.coordinatorClubIds?.includes(clubId));
  const isAdmin = approvedClubAdmins.has(clubId) || approvedClubAdmins.has(String(rawId))
    || (isAppAdmin && !adminTestTeacher) || isSapsCore
    || !!(adminTestTeacher?.position?.includes('SAPS'));
  const canWrite = isCoordinator || isAdmin;
  const effectiveName = adminTestTeacher?.name || teacherProfile?.name || userProfile?.name;
  const myName = isCoordinator ? (adminTestTeacher?.name || teacherProfile?.name) : userProfile?.name;

  const roleLabel = isCoordinator ? 'Coordinator' : isAdmin ? 'Admin' : 'Member';
  const roleBg = isCoordinator
    ? colors.amberLight : isAdmin
    ? colors.primaryLight : colors.greenLight;
  const roleColor = isCoordinator ? colors.amber : isAdmin ? colors.primary : colors.green;

  const [members, setMembers] = useState([]);
  const [wings, setWings] = useState([]);
  const [notices, setNotices] = useState([]);
  const [resourcePersons, setResourcePersons] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal visibility
  const [showAddNotice, setShowAddNotice] = useState(false);
  const [showAddWing, setShowAddWing] = useState(false);
  const [showAddRP, setShowAddRP] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [selectedWing, setSelectedWing] = useState(null);
  const [showWingPrompt, setShowWingPrompt] = useState(false);
  const [savingWing, setSavingWing] = useState(false);

  // Event tracker
  const [trackingEvent, setTrackingEvent] = useState(null);
  const [trackerSteps, setTrackerSteps] = useState([]);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [undoStep, setUndoStep] = useState(null);
  const [editingMember, setEditingMember] = useState(null);

  // ── Club event requests ────────────────────────────────────────────────────
  const [clubEventList, setClubEventList] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({ name: '', description: '', date: '', startTime: '', endTime: '' });
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [eventError, setEventError] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const _today = new Date();
  const [calYear, setCalYear] = useState(_today.getFullYear());
  const [calMonth, setCalMonth] = useState(_today.getMonth());

  // Forms
  const [noticeForm, setNoticeForm] = useState({ title: '', body: '' });
  const [wingForm, setWingForm] = useState({ wing_name: '', responsibilities: '' });
  const [rpForm, setRpForm] = useState({ name: '', designation: '', contact: '', event_name: '' });
  const [roleInput, setRoleInput] = useState('');
  const [customRoleMode, setCustomRoleMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Contribution Hours ────────────────────────────────────────────────────
  const [memberHours, setMemberHours] = useState({});
  const [pendingHourReqs, setPendingHourReqs] = useState([]);
  const [pendingHourProfiles, setPendingHourProfiles] = useState({});
  const [hoursLoading, setHoursLoading] = useState(false);
  const [resolvingHourReq, setResolvingHourReq] = useState(null);
  const [showSetHoursModal, setShowSetHoursModal] = useState(false);
  const [setHoursTarget, setSetHoursTarget] = useState(null);
  const [setHoursInput, setSetHoursInput] = useState('');
  const [setHoursSaving, setSetHoursSaving] = useState(false);
  const [hoursMode, setHoursMode] = useState('set'); // 'set' or 'adjust'

  // Logo upload
  const [logoUrl, setLogoUrl] = useState(club?.logo_url || null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState('');

  // Admin Actions
  const [showPostHubEvent, setShowPostHubEvent] = useState(false);
  const [hubEventForm, setHubEventForm] = useState({ title: '', date: '', time: '', venue: '', when: 'upcoming', desc: '' });
  const [hubTeamsNeeded, setHubTeamsNeeded] = useState([]);
  const [showRecruitment, setShowRecruitment] = useState(false);
  const [recruitForm, setRecruitForm] = useState({ role: '', requirements: '', applyBy: '', contact: '' });
  const [showJoinReview, setShowJoinReview] = useState(false);
  const [joinReviewList, setJoinReviewList] = useState([]);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [docsNFAPrefill, setDocsNFAPrefill] = useState(null);
  const [socialLink, setSocialLink] = useState(null);
  const [socialPlatform, setSocialPlatform] = useState('Instagram');
  const [socialUrl, setSocialUrl] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  const WHEN_OPTIONS = ['today', 'thisWeek', 'upcoming'];
  const WHEN_LABELS  = { today: 'Today', thisWeek: 'This Week', upcoming: 'Upcoming' };
  const SOCIAL_PLATFORMS = [
    { name: 'Instagram', Icon: Camera,        prefix: 'instagram.com/' },
    { name: 'LinkedIn',  Icon: Briefcase,     prefix: 'linkedin.com/company/' },
    { name: 'WhatsApp',  Icon: MessageCircle, prefix: 'chat.whatsapp.com/' },
    { name: 'Other',     Icon: Link,          prefix: '' },
  ];

  const pickAndUploadLogo = async () => {
    setLogoError('');
    const MAX_BYTES = 2 * 1024 * 1024;
    const doUpload = async (blob, contentType) => {
      if (blob.size > MAX_BYTES) {
        setLogoError('Image must be under 2MB');
        return;
      }
      setUploadingLogo(true);
      const path = `${String(rawId)}`;
      const { error: upErr } = await supabase.storage
        .from('club-logos')
        .upload(path, blob, { contentType, upsert: true });
      if (upErr) { setLogoError('Upload failed: ' + upErr.message); setUploadingLogo(false); return; }
      const { data: { publicUrl } } = supabase.storage.from('club-logos').getPublicUrl(path);
      await supabase.from('user_clubs').update({ logo_url: publicUrl }).eq('id', String(rawId));
      setLogoUrl(publicUrl);
      setUploadingLogo(false);
    };

    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > MAX_BYTES) { setLogoError('Image must be under 2MB'); return; }
        await doUpload(file, file.type);
      };
      input.click();
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to upload a club logo.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (result.canceled) return;
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      await doUpload(blob, asset.mimeType || 'image/jpeg');
    }
  };

  const clubEvents = (hubEvents || []).filter(e => String(e.clubId) === String(clubId));

  useEffect(() => {
    if (!clubId) return;
    loadAll();
    loadHours();
  }, [clubId]);

  // Intercept back navigation — close any open modal first instead of leaving the screen.
  useEffect(() => {
    if (!navigation) return;
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      const anyOpen = showAddNotice || showAddWing || showAddRP || showAllMembers ||
        !!selectedWing || showWingPrompt || showEventModal || showPostHubEvent ||
        showCalendar || !!editingMember || !!trackingEvent ||
        showSetHoursModal || showDocsModal || showSocialModal;
      if (!anyOpen) return;
      e.preventDefault();
      setShowAddNotice(false);
      setShowAddWing(false);
      setShowAddRP(false);
      setShowAllMembers(false);
      setSelectedWing(null);
      setShowWingPrompt(false);
      setShowEventModal(false);
      setShowPostHubEvent(false);
      setShowCalendar(false);
      setEditingMember(null);
      if (trackingEvent) { setTrackingEvent(null); setUndoStep(null); }
      setShowSetHoursModal(false);
      setShowDocsModal(false);
      setShowSocialModal(false);
    });
    return unsubscribe;
  }, [navigation, showAddNotice, showAddWing, showAddRP, showAllMembers, selectedWing,
      showWingPrompt, showEventModal, showPostHubEvent, showCalendar, editingMember,
      trackingEvent, showSetHoursModal, showDocsModal, showSocialModal]);

  const handlePostHubEvent = async () => {
    const { title, date, time, venue, when, desc } = hubEventForm;
    if (!title.trim() || !time.trim() || !venue.trim()) {
      Alert.alert('Missing info', 'Please fill in title, time, and venue.');
      return;
    }

    const doInsert = async () => {
      const { data, error } = await supabase.from('hub_events').insert({
        club_id: String(rawId), club_name: club.name,
        title: title.trim(), time: time.trim(), venue: venue.trim(),
        when, description: desc.trim() || null,
        posted_by: userProfile?.id || null,
        teams_needed: hubTeamsNeeded,
      }).select().single();
      if (error) { Alert.alert('Error', 'Could not post event. Please try again.'); return; }
      addEvent({ id: data.id, clubId, title: title.trim(), time: time.trim(), venue: venue.trim(), when, interested: 0, desc: desc.trim() });
      const notifTitle = `${club.name}: ${title.trim()}`;
      const notifBody = `New event at ${venue.trim()}${date.trim() ? ' · ' + date.trim() : ''}`;
      supabase.from('profiles').select('id').eq('status', 'active').eq('role', 'student').then(({ data: ps }) => {
        (ps || []).forEach(p => { if (p.id !== userProfile?.id) createNotification(p.id, 'event', notifTitle, notifBody); });
      });
      teachers.forEach(t => createNotification(`teacher-${t.id}`, 'event', notifTitle, notifBody));
      for (const teamId of hubTeamsNeeded) {
        const { data: teamMembers } = await supabase.from('club_memberships').select('user_id').eq('club_id', teamId);
        const teamName = hubClubs.find(t => t.id === teamId)?.name || 'Your team';
        for (const row of (teamMembers || [])) {
          if (row.user_id !== userProfile?.id) {
            createNotification(row.user_id, 'event', `${teamName} needed for "${title.trim()}"`, `${club.name} has selected your team · ${time.trim()}`);
          }
        }
      }
      setHubEventForm({ title: '', date: '', time: '', venue: '', when: 'upcoming', desc: '' });
      setHubTeamsNeeded([]);
      setShowPostHubEvent(false);
    };

    const conflicts = await checkEventTimetableConflicts(date.trim(), time.trim());
    if (conflicts.length > 0) {
      const lines = conflicts
        .map(c => `• ${c.class_name} ${c.period_name} (${c.start_time}–${c.end_time})${c.faculty_name ? ` – ${c.faculty_name}` : ''}`)
        .join('\n');
      Alert.alert(
        'Overlaps with Class Time',
        `This event overlaps with:\n${lines}\n\nPosting will not automatically notify affected faculty — consider using Club Event → Timetable Override for official timetable changes.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Post Anyway', onPress: doInsert },
        ],
      );
      return;
    }

    await doInsert();
  };

  const handlePostRecruitment = async () => {
    if (!recruitForm.role.trim()) { Alert.alert('Missing info', 'Please enter the role/position.'); return; }
    const title = `${club.name} — Recruiting: ${recruitForm.role.trim()}`;
    const timeStr = recruitForm.applyBy.trim() ? `Apply by ${recruitForm.applyBy.trim()}` : 'Open applications';
    const venue = recruitForm.contact.trim() || 'DM on UniConnect';
    const desc = recruitForm.requirements.trim() || `${club.name} is looking for ${recruitForm.role.trim()}. Reach out to apply!`;
    const { data, error } = await supabase.from('hub_events').insert({
      club_id: String(rawId), club_name: club.name, title,
      time: timeStr, venue, when: 'thisWeek', description: desc,
      is_recruitment: true, posted_by: userProfile?.id || null,
    }).select().single();
    if (error) { Alert.alert('Error', 'Could not post recruitment notice.'); return; }
    addEvent({ id: data.id, clubId, title, time: timeStr, venue, when: 'thisWeek', interested: 0, desc, isRecruitment: true });
    const rTitle = `${club.name} is recruiting!`;
    const rBody = `Looking for: ${recruitForm.role.trim()}`;
    supabase.from('profiles').select('id').eq('status', 'active').eq('role', 'student').then(({ data: ps }) => {
      (ps || []).forEach(p => { if (p.id !== userProfile?.id) createNotification(p.id, 'event', rTitle, rBody); });
    });
    teachers.forEach(t => createNotification(`teacher-${t.id}`, 'event', rTitle, rBody));
    setRecruitForm({ role: '', requirements: '', applyBy: '', contact: '' });
    setShowRecruitment(false);
    Alert.alert('Posted!', 'Recruitment notice is live in the Hub feed.');
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const cid = clubId;
      const [membershipsRes, wingsRes, noticesRes, rpRes, eventsRes, socialRes] = await Promise.all([
        supabase.from('club_memberships').select('user_id, role, wing').eq('club_id', cid),
        supabase.from('club_wings').select('*').eq('club_id', cid).order('sort_order'),
        supabase.from('club_notices').select('*').eq('club_id', cid).order('created_at', { ascending: false }).limit(20),
        supabase.from('club_resource_persons').select('*').eq('club_id', cid).order('created_at', { ascending: false }),
        supabase.from('club_events').select('id, event_name, event_date, start_time, end_time, status, creator_role, created_at').eq('club_id', String(cid)).order('created_at', { ascending: false }).limit(30),
        supabase.from('club_social_links').select('platform, url').eq('club_id', String(cid)).maybeSingle(),
      ]);
      if (socialRes.data) {
        setSocialLink({ platform: socialRes.data.platform, url: socialRes.data.url });
        setSocialPlatform(socialRes.data.platform);
        setSocialUrl(socialRes.data.url);
      }

      if (wingsRes.error) console.error('wings fetch error:', wingsRes.error);
      if (membershipsRes.error) console.error('memberships fetch error:', membershipsRes.error);

      if (membershipsRes.data?.length) {
        const roleMap = {};
        const wingMap = {};
        membershipsRes.data.forEach(r => {
          roleMap[r.user_id] = r.role || null;
          wingMap[r.user_id] = r.wing || null;
        });
        const ids = membershipsRes.data.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles').select('id, name, course, year').in('id', ids);
        setMembers((profiles || []).map(p => ({
          userId: p.id,
          name: p.name,
          course: p.course,
          year: p.year,
          role: roleMap[p.id] || null,
          wing: wingMap[p.id] || null,
          abbr: (p.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(),
          av: avatarColor(p.name),
        })));
      } else {
        setMembers([]);
      }

      const fetchedWings = wingsRes.data || [];
      setWings(fetchedWings);
      setNotices(noticesRes.data || []);
      setResourcePersons(rpRes.data || []);
      setClubEventList(eventsRes.data || []);

      // Auto-show wing picker for members who haven't chosen a wing yet
      if (fetchedWings.length > 0 && userProfile && !isCoordinatorProp) {
        const myRow = membershipsRes.data?.find(r => r.user_id === userProfile.id);
        if (myRow && !myRow.wing) setShowWingPrompt(true);
      }
    } catch (e) {
      console.error('loadAll error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Contribution Hours ────────────────────────────────────────────────────
  const loadHours = async () => {
    if (!canWrite) return;
    setHoursLoading(true);
    const cid = String(clubId);
    const [hoursRes, reqsRes] = await Promise.all([
      supabase.from('club_member_hours').select('user_id, total_hours').eq('club_id', cid),
      supabase.from('hour_adjustments').select('*').eq('club_id', cid).eq('status', 'pending').order('created_at', { ascending: false }),
    ]);
    const hoursMap = {};
    (hoursRes.data || []).forEach(r => { hoursMap[r.user_id] = Number(r.total_hours) || 0; });
    setMemberHours(hoursMap);
    const reqs = reqsRes.data || [];
    setPendingHourReqs(reqs);
    const reqIds = [...new Set(reqs.map(r => r.user_id))];
    if (reqIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, name').in('id', reqIds);
      const profMap = {};
      (profs || []).forEach(p => { profMap[p.id] = p.name; });
      setPendingHourProfiles(profMap);
    }
    setHoursLoading(false);
  };

  const handleApproveHours = async (req) => {
    setResolvingHourReq(req.id);
    const cid = String(clubId);
    const { data: existing } = await supabase.from('club_member_hours')
      .select('total_hours').eq('user_id', req.user_id).eq('club_id', cid).maybeSingle();
    const current = Number(existing?.total_hours) || 0;
    const newTotal = current + Number(req.hours_delta);
    const [updateRes, upsertRes] = await Promise.all([
      supabase.from('hour_adjustments').update({ status: 'approved' }).eq('id', req.id),
      supabase.from('club_member_hours').upsert(
        { user_id: req.user_id, club_id: cid, total_hours: newTotal, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,club_id' }
      ),
    ]);
    if (!updateRes.error && !upsertRes.error) {
      setPendingHourReqs(prev => prev.filter(r => r.id !== req.id));
      setMemberHours(prev => ({ ...prev, [req.user_id]: newTotal }));
      createNotification(req.user_id, 'info', 'Hours Approved',
        `Your request for ${req.hours_delta}h has been approved.`);
    } else {
      Alert.alert('Error', updateRes.error?.message || upsertRes.error?.message || 'Could not approve request.');
    }
    setResolvingHourReq(null);
  };

  const handleRejectHours = async (req) => {
    setResolvingHourReq(req.id);
    const { error } = await supabase.from('hour_adjustments').update({ status: 'rejected' }).eq('id', req.id);
    if (!error) {
      setPendingHourReqs(prev => prev.filter(r => r.id !== req.id));
      createNotification(req.user_id, 'info', 'Hours Not Approved',
        `Your request for ${req.hours_delta}h was not approved this time.`);
    } else {
      Alert.alert('Error', error.message || 'Could not reject request.');
    }
    setResolvingHourReq(null);
  };

  const handleSetHours = async () => {
    if (!setHoursTarget || !setHoursInput.trim()) return;
    const inputVal = Number(setHoursInput);
    if (isNaN(inputVal)) { Alert.alert('Invalid', 'Please enter a valid number.'); return; }
    
    const currentHours = memberHours[setHoursTarget.userId] || 0;
    let newTotal = currentHours;
    let delta = 0;

    if (hoursMode === 'adjust') {
      delta = inputVal;
      newTotal = currentHours + delta;
    } else {
      newTotal = inputVal;
      delta = newTotal - currentHours;
    }

    if (newTotal < 0) {
      Alert.alert('Invalid', 'Total hours cannot be negative.');
      return;
    }

    setSetHoursSaving(true);
    const cid = String(clubId);
    const actorId = userProfile?.id || null;
    const actorRole = isCoordinator ? 'coordinator' : 'admin';
    const reasonText = hoursMode === 'adjust'
      ? `Manual adjustment (${delta > 0 ? '+' : ''}${delta}h) set by ${actorRole}`
      : `Manual baseline set by ${actorRole}`;

    const [adjRes, upsertRes] = await Promise.all([
      supabase.from('hour_adjustments').insert({
        user_id: setHoursTarget.userId, club_id: cid,
        hours_delta: delta, reason: reasonText,
        source: 'manual_baseline', status: 'approved', created_by: actorId,
      }),
      supabase.from('club_member_hours').upsert(
        { user_id: setHoursTarget.userId, club_id: cid, total_hours: newTotal, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,club_id' }
      ),
    ]);

    if (!adjRes.error && !upsertRes.error) {
      setMemberHours(prev => ({ ...prev, [setHoursTarget.userId]: newTotal }));
      setShowSetHoursModal(false);
      setSetHoursTarget(null);
      setSetHoursInput('');
      setHoursMode('set');
      createNotification(
        setHoursTarget.userId, 'info', 'Hours Updated',
        `Your hours have been manually updated to ${newTotal}h by a club ${actorRole}.`
      );
    } else {
      Alert.alert('Error', adjRes.error?.message || upsertRes.error?.message || 'Could not update hours.');
    }
    setSetHoursSaving(false);
  };

  // ── Notices ────────────────────────────────────────────────────────────────
  const postNotice = async () => {
    if (!noticeForm.title.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('club_notices').insert({
      club_id: clubId,
      title: noticeForm.title.trim(),
      body: noticeForm.body.trim() || null,
      posted_by_name: myName,
    }).select().single();
    setSaving(false);
    if (!error && data) {
      const capturedTitle = noticeForm.title.trim();
      setNotices(prev => [data, ...prev]);
      setNoticeForm({ title: '', body: '' });
      setShowAddNotice(false);
      // Notify all club followers
      const clubDisplayName = club?.name || 'Club';
      supabase.from('club_following').select('user_id').eq('club_id', clubId).then(({ data: followers }) => {
        const posterId = userProfile?.id || teacherProfile?.id;
        for (const row of (followers || [])) {
          if (row.user_id !== posterId) {
            createNotification(row.user_id, 'info', `${clubDisplayName}: New Notice`, capturedTitle);
          }
        }
      });
    }
  };

  const deleteNotice = (id) => {
    const doDelete = async () => {
      await supabase.from('club_notices').delete().eq('id', id);
      setNotices(prev => prev.filter(n => n.id !== id));
    };
    Alert.alert('Delete Notice', 'Remove this notice?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  // ── Wings ──────────────────────────────────────────────────────────────────
  const addWing = async () => {
    if (!wingForm.wing_name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('club_wings').insert({
      club_id: clubId,
      wing_name: wingForm.wing_name.trim(),
      responsibilities: wingForm.responsibilities.trim() || null,
      sort_order: wings.length,
    }).select().single();
    setSaving(false);
    if (error) {
      console.error('addWing error:', JSON.stringify(error));
      Alert.alert('Error', error.message || 'Could not save wing.');
      return;
    }
    if (data) {
      setWings(prev => [...prev, data]);
      setWingForm({ wing_name: '', responsibilities: '' });
      setShowAddWing(false);
    }
  };

  const deleteWing = (id) => {
    const doDelete = async () => {
      await supabase.from('club_wings').delete().eq('id', id);
      setWings(prev => prev.filter(w => w.id !== id));
    };
    Alert.alert('Delete Wing', 'Remove this wing?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  // ── Resource Persons ───────────────────────────────────────────────────────
  const addRP = async () => {
    if (!rpForm.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('club_resource_persons').insert({
      club_id: clubId,
      name: rpForm.name.trim(),
      designation: rpForm.designation.trim() || null,
      contact: rpForm.contact.trim() || null,
      event_name: rpForm.event_name.trim() || null,
    }).select().single();
    setSaving(false);
    if (!error && data) {
      setResourcePersons(prev => [data, ...prev]);
      setRpForm({ name: '', designation: '', contact: '', event_name: '' });
      setShowAddRP(false);
    }
  };

  const deleteRP = (id) => {
    const doDelete = async () => {
      await supabase.from('club_resource_persons').delete().eq('id', id);
      setResourcePersons(prev => prev.filter(r => r.id !== id));
    };
    Alert.alert('Delete Contact', 'Remove this resource person?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  const deleteClubEvent = (ev) => {
    const doDelete = async () => {
      await supabase.from('club_events').delete().eq('id', ev.id);
      setClubEventList(prev => prev.filter(e => e.id !== ev.id));
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete event "${ev.event_name}"?`)) doDelete();
    } else {
      Alert.alert('Delete Event', `Delete "${ev.event_name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // ── Club Events ───────────────────────────────────────────────────────────
  const effectiveIsHOD = adminTestTeacher
    ? (adminTestTeacher.name?.includes('Hridhya') || !!adminTestTeacher.isHOD)
    : teacherProfile?.isHOD === true;
  const effectiveSapsCore = adminTestTeacher
    ? !!adminTestTeacher.position?.includes('SAPS')
    : isSapsCore;
  const eventCreatorRole = effectiveIsHOD ? 'hod'
    : effectiveSapsCore ? 'saps_coordinator'
    : isCoordinator ? 'faculty_coordinator'
    : 'club_admin';

  const handleCreateEvent = async () => {
    const { name, description, date, startTime, endTime } = eventForm;
    if (!name.trim() || !date || !startTime || !endTime) {
      setEventError('Name, date, start time, and end time are required.');
      return;
    }
    const dayAbbr = getWeekdayAbbr(date);
    if (!dayAbbr || dayAbbr === 'SUN') {
      setEventError('Please pick a weekday (Mon–Sat).');
      return;
    }
    if (parseTimeMins(startTime) >= parseTimeMins(endTime)) {
      setEventError('End time must be after start time.');
      return;
    }
    setEventSubmitting(true);
    setEventError('');
    try {
      // Compute affected timetable slots
      const startMins = parseTimeMins(startTime);
      const endMins = parseTimeMins(endTime);
      const { data: periodsData } = await supabase.from('timetable_periods').select('*');
      const matchingPeriods = (periodsData || []).filter(p => {
        const ps = parseTimeMins(p.start_time);
        return ps >= startMins && ps < endMins;
      });
      let affected = [];
      if (matchingPeriods.length > 0) {
        const { data: slotsData } = await supabase.from('timetable_slots')
          .select('class_name, day, period_name, course_name')
          .eq('day', dayAbbr)
          .in('period_name', matchingPeriods.map(p => p.name));
        affected = (slotsData || []).map(s => ({
          class_name: s.class_name, day: s.day,
          period_name: s.period_name, course_name: s.course_name || null,
        }));
      }

      const initialStatus = eventCreatorRole === 'hod' ? 'approved'
        : eventCreatorRole === 'saps_coordinator' ? 'pending_hod'
        : eventCreatorRole === 'faculty_coordinator' ? 'pending_saps'
        : 'pending_faculty_coordinator';

      const creatorId = userProfile?.id || null;
      const clubIdStr = String(rawId); // rawId preserves the original string (UUID or numeric)
      const payload = {
        club_id: clubIdStr,
        created_by: creatorId,
        creator_role: eventCreatorRole,
        event_name: name.trim(),
        description: description.trim() || null,
        event_date: date,
        start_time: startTime,
        end_time: endTime,
        status: initialStatus,
        affected_slots: affected,
      };
      console.log('[handleCreateEvent] insert payload:', JSON.stringify(payload));
      console.log('[handleCreateEvent] club_id:', clubIdStr, typeof clubIdStr, '| created_by:', creatorId, typeof creatorId);
      const { data: evData, error } = await supabase.from('club_events').insert(payload).select().single();
      if (error) { console.error('[handleCreateEvent] insert error:', JSON.stringify(error)); throw error; }
      // Notify appropriate next approver (without affected_slots for club_admin)
      if (eventCreatorRole === 'club_admin') {
        const coordName = (hubClubs.find(c => c.id === clubId))?.coordinator;
        if (coordName) {
          const lastName = coordName.split(' ').slice(-1)[0];
          const { data: cp } = await supabase.from('profiles').select('id').ilike('name', `%${lastName}%`).maybeSingle();
          if (cp?.id) await createNotification(cp.id, 'info', 'Club Event Approval Needed',
            `${myName} from ${club?.name || 'a club'} submitted "${name.trim()}" on ${date} for your review.`);
        }
      } else if (eventCreatorRole === 'faculty_coordinator') {
        const { data: cp } = await supabase.from('profiles').select('id').ilike('name', '%Monika%').maybeSingle();
        if (cp?.id) await createNotification(cp.id, 'info', 'Club Event Approval Needed',
          `${myName} forwarded "${name.trim()}" (${date}) to SAPS for review.`);
      } else if (eventCreatorRole === 'saps_coordinator') {
        const { data: cp } = await supabase.from('profiles').select('id').ilike('name', '%Hridhya%').maybeSingle();
        if (cp?.id) await createNotification(cp.id, 'info', 'Club Event Approval Needed',
          `SAPS submitted "${name.trim()}" (${date}) for your final approval.`);
      } else if (eventCreatorRole === 'hod' && affected.length > 0) {
        // Apply immediately
        for (const slotRef of affected) {
          const { data: slot } = await supabase.from('timetable_slots')
            .select('id, course_name, faculty_name').eq('class_name', slotRef.class_name)
            .eq('day', slotRef.day).eq('period_name', slotRef.period_name).maybeSingle();
          if (slot?.id) {
            await supabase.from('timetable_slots').update({
              course_name: name.trim(), faculty_name: null,
              overridden_by_event: { original_course_name: slot.course_name, original_faculty_name: slot.faculty_name, event_id: evData.id, event_name: name.trim() },
              updated_at: new Date().toISOString(),
            }).eq('id', slot.id);
            const { data: cdLogRow } = await supabase.from('timetable_change_log').insert({
              changed_by: typeof creatorId === 'string' ? creatorId : null,
              class_name: slotRef.class_name, day: slotRef.day, period_name: slotRef.period_name,
              old_faculty: slot.faculty_name, new_faculty: null,
              reason: `Club Event Override: ${name.trim()}`, change_type: 'event_override',
            }).select('id').single();
            if (slot.faculty_name) {
              createCompensatoryRequest(supabase, {
                changeLogId: cdLogRow?.id || null,
                teacherName: slot.faculty_name,
                className: slotRef.class_name,
                day: slotRef.day,
                periodName: slotRef.period_name,
              }).catch(e => console.warn('[CompReq] club event override error:', e.message));
            }
          }
        }
      }

      setClubEventList(prev => [evData, ...prev]);
      setShowEventModal(false);
      setEventForm({ name: '', description: '', date: '', startTime: '', endTime: '' });
    } catch (e) {
      setEventError(e.message || 'Could not submit event request.');
    } finally {
      setEventSubmitting(false);
    }
  };

  // ── Member Roles ───────────────────────────────────────────────────────────
  const ROLE_OPTIONS = [
    'President', 'Vice President', 'Secretary', 'Joint Secretary', 'Treasurer',
    'BOD — Marketing', 'BOD — Operations', 'BOD — Events', 'BOD — Finance',
    'BOD — PR & Outreach', 'BOD — Design', 'Wing Lead', 'Core Member', 'Volunteer',
  ];

  const openRoleEdit = (member) => {
    const existing = member.role || '';
    setRoleInput(existing);
    setCustomRoleMode(existing !== '' && !ROLE_OPTIONS.includes(existing));
    setEditingMember(member);
  };

  const saveRole = async () => {
    if (!editingMember) return;
    setSaving(true);
    const { error } = await supabase.from('club_memberships')
      .update({ role: roleInput.trim() || null })
      .eq('user_id', editingMember.userId)
      .eq('club_id', clubId);
    if (error) { console.error('saveRole error:', error); setSaving(false); return; }
    setMembers(prev => prev.map(m =>
      m.userId === editingMember.userId ? { ...m, role: roleInput.trim() || null } : m
    ));
    setSaving(false);
    setEditingMember(null);
  };

  const saveMyWing = async (wingName) => {
    if (!userProfile?.id) return;
    setSavingWing(true);
    const newWing = wingName === myCurrentWing ? null : wingName;
    const { error } = await supabase.from('club_memberships')
      .upsert(
        { user_id: userProfile.id, club_id: clubId, club_name: club?.name, wing: newWing },
        { onConflict: 'user_id,club_id' }
      );
    if (error) { console.error('saveMyWing error:', error); setSavingWing(false); return; }
    setShowWingPrompt(false);
    setMembers(prev => {
      const exists = prev.some(m => m.userId === userProfile.id);
      if (exists) return prev.map(m => m.userId === userProfile.id ? { ...m, wing: newWing } : m);
      return [...prev, {
        userId: userProfile.id,
        name: userProfile.name,
        course: userProfile.course,
        year: userProfile.year,
        role: null,
        wing: newWing,
        abbr: (userProfile.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(),
        av: avatarColor(userProfile.name),
      }];
    });
    setSavingWing(false);
  };

  const myCurrentWing = members.find(m => m.userId === userProfile?.id)?.wing || null;

  // ── Event Tracker ──────────────────────────────────────────────────────────
  const DEFAULT_TRACKER_STEPS = [
    'Conceptualise the Event',
    'Sign the NFA (Note for Approval)',
    'Book the Venue',
    'Assign Team Roles & Responsibilities',
    'Conduct Promotions',
    'Finalise the Team',
    'Conduct the Event',
    'Collect Feedback',
    'Submit Documentation Report',
    'Submit Photos & Videos (Drive Link)',
  ];

  const openTracker = async (event) => {
    setTrackingEvent(event);
    setTrackerLoading(true);
    setUndoStep(null);
    const { data } = await supabase
      .from('event_tracker_steps')
      .select('*')
      .eq('event_id', String(event.id))
      .order('sort_order');
    if (data && data.length > 0) {
      setTrackerSteps(data);
    } else {
      const rows = DEFAULT_TRACKER_STEPS.map((label, i) => ({
        event_id: String(event.id),
        club_id: clubId,
        label,
        done: false,
        sort_order: i,
      }));
      const { data: created } = await supabase.from('event_tracker_steps').insert(rows).select();
      setTrackerSteps(created || rows);
    }
    setTrackerLoading(false);
  };

  const confirmAndToggleStep = (step, index) => {
    if (step.done) {
      const hasCascade = index < trackerSteps.length - 1 && trackerSteps.slice(index + 1).some(s => s.done);
      const msg = hasCascade
        ? `Unmark "${step.label}"? This will also unmark all later completed steps.`
        : `Unmark "${step.label}" as complete?`;
      if (Platform.OS === 'web') {
        if (window.confirm(msg)) toggleStep(step, index);
      } else {
        Alert.alert('Unmark Step', msg, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unmark', style: 'destructive', onPress: () => toggleStep(step, index) },
        ]);
      }
    } else {
      const msg = `Mark "${step.label}" as complete?`;
      if (Platform.OS === 'web') {
        if (window.confirm(msg)) toggleStep(step, index);
      } else {
        Alert.alert('Mark Complete', msg, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Mark Complete', onPress: () => toggleStep(step, index) },
        ]);
      }
    }
  };

  const toggleStep = async (step, index) => {
    const firstUncompleted = trackerSteps.findIndex(s => !s.done);
    if (!step.done && index !== firstUncompleted) return; // enforce sequential
    const newDone = !step.done;
    // Unchecking cascades — all steps from this index onwards become undone
    const updated = trackerSteps.map((s, i) => {
      if (!newDone && i >= index) return { ...s, done: false };
      if (s.id === step.id) return { ...s, done: true };
      return s;
    });
    setTrackerSteps(updated);
    if (!newDone) {
      const ids = updated.slice(index).map(s => s.id);
      await supabase.from('event_tracker_steps').update({ done: false }).in('id', ids);
    } else {
      await supabase.from('event_tracker_steps').update({ done: true }).eq('id', step.id);
    }
  };

  const deleteTrackerStep = (step) => {
    setTrackerSteps(prev => prev.filter(s => s.id !== step.id));
    if (undoStep?.timer) clearTimeout(undoStep.timer);
    const timer = setTimeout(async () => {
      const { error } = await supabase.from('event_tracker_steps').delete().eq('id', step.id);
      if (error) {
        setTrackerSteps(prev => [...prev, step].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
        Alert.alert('Error', 'Could not delete step. Please run the event tracker SQL fix in Supabase.');
      }
      setUndoStep(null);
    }, 3500);
    setUndoStep({ step, timer });
  };

  const undoDeleteStep = () => {
    if (!undoStep) return;
    clearTimeout(undoStep.timer);
    setTrackerSteps(prev =>
      [...prev, undoStep.step].sort((a, b) => a.sort_order - b.sort_order)
    );
    setUndoStep(null);
  };

  if (!club) {
    return <View style={styles.container}><Text style={{ color: colors.textSecondary }}>Club not found</Text></View>;
  }

  const handleDeleteClub = () => {
    const name = club.name;
    const doDelete = async () => {
      const ok = await deleteClub(rawId);
      if (ok) handleBack();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${name}"? This cannot be undone.`)) doDelete();
    } else {
      Alert.alert(
        `Delete ${name}?`,
        'This will permanently remove the club and all its data. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ],
      );
    }
  };

  const handleBack = () => {
    if (onClose) onClose();
    else if (navigation) navigation.goBack();
  };

  const previewMembers = members.slice(0, 5);

  const content = (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: onClose ? 60 : 80 }}>

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: club.color }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          {onClose ? <X size={18} color={colors.textSecondary} /> : <Text style={styles.backIcon}>‹</Text>}
        </TouchableOpacity>
        <View style={styles.headerContent}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.headerLogo} />
          ) : (
            <Text style={styles.headerEmoji}>{club.emoji}</Text>
          )}
          <Text style={styles.headerName}>{club.name}</Text>
          <Text style={styles.headerFull}>{club.fullName}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleBg, borderColor: roleColor }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel.toUpperCase()}</Text>
          </View>
          {canWrite && !isNumericId && (
            <TouchableOpacity
              style={styles.uploadLogoBtn}
              onPress={pickAndUploadLogo}
              disabled={uploadingLogo}
              activeOpacity={0.8}
            >
              {uploadingLogo
                ? <ActivityIndicator size="small" color="rgba(255,255,255,0.9)" />
                : <View style={{flexDirection:'row',alignItems:'center',gap:6}}>{logoUrl ? <RefreshCw size={13} color="rgba(255,255,255,0.9)" /> : <ImageIcon size={13} color="rgba(255,255,255,0.9)" />}<Text style={styles.uploadLogoBtnText}>{logoUrl ? 'Change Logo' : 'Upload Logo'}</Text></View>
              }
            </TouchableOpacity>
          )}
          {!!logoError && <Text style={styles.logoErrorText}>{logoError}</Text>}
        </View>
      </View>

      {/* ── Quick Stats ── */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{loading ? '—' : members.length}</Text>
          <Text style={styles.statLabel}>Members</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statVal}>{clubEvents.length}</Text>
          <Text style={styles.statLabel}>Events</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statVal}>{wings.length}</Text>
          <Text style={styles.statLabel}>Wings</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statVal}>{notices.length}</Text>
          <Text style={styles.statLabel}>Notices</Text>
        </View>
      </View>

      {/* ── Team: Event Assignments shortcut ── */}
      {club.type === 'Team' && navigation && (
        <TouchableOpacity
          style={[styles.teamDashBanner, { borderColor: club.color }]}
          onPress={() => navigation.navigate('TeamDashboard', { clubId: rawId })}
          activeOpacity={0.82}
        >
          <View style={[styles.teamDashBannerIcon, { backgroundColor: club.color + '22' }]}>
            <ClipboardList size={22} color={club.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.teamDashBannerTitle, { color: club.color }]}>Event Assignments</Text>
            <Text style={styles.teamDashBannerSub}>View &amp; assign members to club events</Text>
          </View>
          <Text style={[styles.teamDashBannerArrow, { color: club.color }]}>›</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* ── Admin Actions ── */}
          {canWrite && (
            <View style={styles.section}>
              <SectionHeader label="ADMIN ACTIONS" />
              {club.type !== 'Team' && (
                <TouchableOpacity style={styles.adminActionBtn} onPress={() => setShowPostHubEvent(true)} activeOpacity={0.85}>
                  <Calendar size={18} color={colors.textSecondary} style={styles.adminActionIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adminActionTitle}>Post a new event</Text>
                    <Text style={styles.adminActionDesc}>Add to the Hub events feed</Text>
                  </View>
                  <Text style={styles.adminActionArrow}>›</Text>
                </TouchableOpacity>
              )}
              {club.type !== 'Team' && (
                <TouchableOpacity style={styles.adminActionBtn} onPress={() => setShowRecruitment(true)} activeOpacity={0.85}>
                  <Megaphone size={18} color={colors.textSecondary} style={styles.adminActionIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adminActionTitle}>Open recruitment</Text>
                    <Text style={styles.adminActionDesc}>Find new members</Text>
                  </View>
                  <Text style={styles.adminActionArrow}>›</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.adminActionBtn} onPress={() => setShowAllMembers(true)} activeOpacity={0.85}>
                <Users size={18} color={colors.textSecondary} style={styles.adminActionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminActionTitle}>Manage members</Text>
                  <Text style={styles.adminActionDesc}>{members.length} members · view & manage</Text>
                </View>
                <Text style={styles.adminActionArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adminActionBtn}
                activeOpacity={0.85}
                onPress={async () => {
                  const reqs = await loadClubJoinRequests(clubId);
                  setJoinReviewList(reqs);
                  setShowJoinReview(true);
                }}
              >
                <ClipboardList size={18} color={colors.textSecondary} style={styles.adminActionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminActionTitle}>Review join requests</Text>
                  <Text style={styles.adminActionDesc}>Approve or reject member applications</Text>
                </View>
                <Text style={styles.adminActionArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adminActionBtn}
                activeOpacity={0.85}
                onPress={() => {
                  setSocialPlatform(socialLink?.platform || 'Instagram');
                  setSocialUrl(socialLink?.url || '');
                  setShowSocialModal(true);
                }}
              >
                <Link size={18} color={colors.textSecondary} style={styles.adminActionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminActionTitle}>Update social link</Text>
                  <Text style={styles.adminActionDesc}>
                    {socialLink ? `${socialLink.platform} · ${socialLink.url}` : 'No link set yet'}
                  </Text>
                </View>
                <Text style={styles.adminActionArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminActionBtn} onPress={() => setShowDocsModal(true)} activeOpacity={0.85}>
                <FileText size={18} color={colors.textSecondary} style={styles.adminActionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminActionTitle}>Documents</Text>
                  <Text style={styles.adminActionDesc}>Submit NFAs &amp; Activity Reports</Text>
                </View>
                <Text style={styles.adminActionArrow}>›</Text>
              </TouchableOpacity>
              {(isCoordinator || (isAppAdmin && !adminTestTeacher)) && (
                <TouchableOpacity style={styles.deleteClubBtn} onPress={handleDeleteClub} activeOpacity={0.85}>
                  <Trash2 size={18} color={colors.textSecondary} style={styles.adminActionIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deleteClubTitle}>Delete club</Text>
                    <Text style={styles.adminActionDesc}>Permanently remove this club</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── My Wing (member self-assignment) — shown at top so members see it first ── */}
          {wings.length > 0 && !!userProfile && !teacherProfile && (
            <View style={styles.section}>
              <SectionHeader label="MY WING" />
              <Text style={styles.wingPickerHint}>Select the wing you belong to:</Text>
              {wings.map(w => {
                const selected = myCurrentWing === w.wing_name;
                return (
                  <TouchableOpacity
                    key={w.id}
                    style={[styles.wingPickerOption, selected && styles.wingPickerOptionSelected]}
                    onPress={() => saveMyWing(w.wing_name)}
                    disabled={savingWing}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.wingDot, { backgroundColor: club.color }]} />
                    <Text style={[styles.wingPickerText, selected && styles.wingPickerTextSelected]}>{w.wing_name}</Text>
                    {selected && <Check size={16} color={club.color} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Upcoming Events ── */}
          <View style={styles.section}>
            <SectionHeader label={`UPCOMING EVENTS (${clubEvents.length})`} />
            {clubEvents.length === 0 ? (
              <EmptyState text="No upcoming events." />
            ) : (
              clubEvents.map(e => (
                <View key={e.id} style={styles.eventCard}>
                  <View style={[styles.eventStripe, { backgroundColor: club.color }]} />
                  <View style={styles.eventBody}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventTitle}>{e.title}</Text>
                        <View style={{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8,marginTop:2}}>
                          <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Calendar size={12} color={colors.textSecondary} /><Text style={styles.eventMeta}>{e.time}</Text></View>
                          <View style={{flexDirection:'row',alignItems:'center',gap:4}}><MapPin size={12} color={colors.textSecondary} /><Text style={styles.eventMeta}>{e.venue}</Text></View>
                        </View>
                      </View>
                      {canWrite && (
                        <TouchableOpacity
                          onPress={() => {
                            if (Platform.OS === 'web') {
                              if (window.confirm(`Delete "${e.title}"?`)) deleteEvent(e.id);
                            } else {
                              Alert.alert('Delete Event', `Remove "${e.title}" from the Hub?`, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => deleteEvent(e.id) },
                              ]);
                            }
                          }}
                          style={styles.deleteIcon}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                      )}
                    </View>
                    {e.desc ? <Text style={styles.eventDesc} numberOfLines={2}>{e.desc}</Text> : null}
                    {canWrite && (
                      <View style={styles.eventCardActions}>
                        <TouchableOpacity style={styles.trackerBtn} onPress={() => openTracker(e)} activeOpacity={0.8}>
                          <View style={{flexDirection:'row',alignItems:'center',gap:5}}><ClipboardList size={13} color={colors.textSecondary} /><Text style={styles.trackerBtnText}>Track Progress</Text></View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.nfaBtn}
                          activeOpacity={0.8}
                          onPress={() => {
                            setDocsNFAPrefill({
                              title_of_session: e.title || '',
                              event_date: e.event_date || '',
                              event_time: e.time || '',
                              venue: e.venue || '',
                              club_name: club.name,
                              organised_by: club.name,
                              club_id: club.id,
                              linked_event_id: String(e.id),
                            });
                            setShowDocsModal(true);
                          }}
                        >
                          <View style={{flexDirection:'row',alignItems:'center',gap:5}}><FileText size={13} color={colors.textSecondary} /><Text style={styles.nfaBtnText}>Create NFA</Text></View>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* ── Team Members ── */}
          <View style={styles.section}>
            <SectionHeader
              label={`TEAM MEMBERS (${members.length})`}
              action={members.length > 6 ? (
                <TouchableOpacity onPress={() => setShowAllMembers(true)} activeOpacity={0.7}>
                  <Text style={styles.seeAll}>See all</Text>
                </TouchableOpacity>
              ) : null}
            />
            {members.length === 0 ? (
              <EmptyState text="No members linked yet." />
            ) : (
              <View style={styles.memberList}>
                {members.slice(0, 6).map(m => (
                  <View key={m.userId} style={styles.memberListRow}>
                    <View style={[styles.memberAvatar, { backgroundColor: m.av.bg }]}>
                      <Text style={[styles.memberAbbr, { color: m.av.text }]}>{m.abbr}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberRowName}>{m.name}</Text>
                      {m.role ? (
                        <Text style={styles.memberRoleText}>{m.role}</Text>
                      ) : (
                        <Text style={styles.memberNoRole}>{m.course} · {m.year}</Text>
                      )}
                    </View>
                    {canWrite && (
                      <TouchableOpacity
                        style={styles.editRoleBtn}
                        onPress={() => openRoleEdit(m)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.editRoleBtnText}>{m.role ? 'Edit role' : '+ Role'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {members.length > 6 && (
                  <TouchableOpacity onPress={() => setShowAllMembers(true)} activeOpacity={0.7} style={styles.showMoreBtn}>
                    <Text style={styles.showMoreText}>Show {members.length - 6} more members</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* ── Wings & Responsibilities ── */}
          <View style={styles.section}>
            <SectionHeader
              label="WINGS & RESPONSIBILITIES"
              action={canWrite ? (
                <TouchableOpacity onPress={() => setShowAddWing(true)} activeOpacity={0.7} style={styles.addBtn}>
                  <Text style={styles.addBtnText}>+ Add Wing</Text>
                </TouchableOpacity>
              ) : null}
            />
            {wings.length === 0 ? (
              <EmptyState text={canWrite ? 'No wings defined yet. Add one above.' : 'No wings defined yet.'} />
            ) : (
              wings.map(w => {
                const wingMemberCount = members.filter(m => m.wing === w.wing_name).length;
                return (
                  <TouchableOpacity key={w.id} style={styles.wingCard} onPress={() => setSelectedWing(w)} activeOpacity={0.8}>
                    <View style={styles.wingCardHeader}>
                      <View style={[styles.wingDot, { backgroundColor: club.color }]} />
                      <Text style={styles.wingName}>{w.wing_name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.wingMemberBadge, { backgroundColor: club.color + '22' }]}>
                          <Text style={[styles.wingMemberBadgeText, { color: club.color }]}>
                            {wingMemberCount} member{wingMemberCount !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        {canWrite && (
                          <TouchableOpacity onPress={() => deleteWing(w.id)} activeOpacity={0.7} style={styles.deleteIcon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <X size={14} color={colors.textSecondary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    {w.responsibilities ? (
                      <Text style={styles.wingResp}>{w.responsibilities}</Text>
                    ) : null}
                    <Text style={styles.wingTapHint}>Tap to see members →</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* ── Timetable Event Requests ── */}
          {(canWrite) && (
            <View style={styles.section}>
              <SectionHeader
                label={`EVENT REQUESTS (${clubEventList.length})`}
                action={
                  <TouchableOpacity onPress={() => { setShowEventModal(true); setEventError(''); }} activeOpacity={0.7} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>+ Request</Text>
                  </TouchableOpacity>
                }
              />
              {clubEventList.length === 0 ? (
                <EmptyState text="No event requests yet. Tap '+ Request' to submit one." />
              ) : (
                clubEventList.map(ev => {
                  const statusColor = ev.status === 'approved' ? colors.green
                    : ev.status === 'rejected' ? colors.red
                    : colors.amber;
                  return (
                    <View key={ev.id} style={styles.eventReqCard}>
                      <View style={styles.eventReqCardTop}>
                        <Text style={styles.eventReqName} numberOfLines={1}>{ev.event_name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[styles.eventReqStatusPill, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
                            <Text style={[styles.eventReqStatusText, { color: statusColor }]}>{eventStatusLabel(ev.status)}</Text>
                          </View>
                          {canWrite && (
                            <TouchableOpacity onPress={() => deleteClubEvent(ev)} activeOpacity={0.7}>
                              <Trash2 size={15} color={colors.textSecondary} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      <Text style={styles.eventReqMeta}>
                        {ev.event_date}  ·  {ev.start_time}–{ev.end_time}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ── Contribution Hours (coordinator only) ── */}
          {canWrite && (
            <View style={styles.section}>
              <SectionHeader
                label="MEMBER HOURS"
                action={hoursLoading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <TouchableOpacity onPress={loadHours} activeOpacity={0.7} style={styles.addBtn}>
                      <Text style={styles.addBtnText}>↻ Refresh</Text>
                    </TouchableOpacity>
                }
              />

              {/* Pending requests */}
              {pendingHourReqs.length > 0 && (
                <>
                  <Text style={styles.hoursSubLabel}>PENDING REQUESTS</Text>
                  {pendingHourReqs.map(req => (
                    <View key={req.id} style={styles.hourReqCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberRowName}>{pendingHourProfiles[req.user_id] || 'Unknown member'}</Text>
                        <Text style={styles.memberRowMeta}>{req.reason}</Text>
                        <Text style={[styles.memberRowMeta, { color: colors.primary }]}>+{req.hours_delta}h requested</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={[styles.hourReqBtn, { backgroundColor: colors.red + '22', borderColor: colors.red }]}
                          onPress={() => handleRejectHours(req)}
                          disabled={resolvingHourReq === req.id}
                          activeOpacity={0.7}
                        >
                          {resolvingHourReq === req.id
                            ? <ActivityIndicator size="small" color={colors.red} />
                            : <Text style={[styles.hourReqBtnText, { color: colors.red }]}>Reject</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.hourReqBtn, { backgroundColor: colors.green + '22', borderColor: colors.green }]}
                          onPress={() => handleApproveHours(req)}
                          disabled={resolvingHourReq === req.id}
                          activeOpacity={0.7}
                        >
                          {resolvingHourReq === req.id
                            ? <ActivityIndicator size="small" color={colors.green} />
                            : <Text style={[styles.hourReqBtnText, { color: colors.green }]}>Approve</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* Leaderboard sorted by hours ascending (lowest = needs improvement) */}
              <Text style={styles.hoursSubLabel}>LEADERBOARD · least hours first</Text>
              {members.length === 0
                ? <Text style={styles.memberRowMeta}>No members yet.</Text>
                : [...members]
                    .sort((a, b) => (memberHours[a.userId] || 0) - (memberHours[b.userId] || 0))
                    .map((m, idx) => {
                      const hrs = memberHours[m.userId] || 0;
                      return (
                        <View key={m.userId} style={styles.hourLeaderRow}>
                          <Text style={styles.hourLeaderRank}>#{idx + 1}</Text>
                          <View style={[styles.memberAvatar, { backgroundColor: m.av.bg }]}>
                            <Text style={[styles.memberAbbr, { color: m.av.text }]}>{m.abbr}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.memberRowName}>{m.name}</Text>
                            {m.role ? <Text style={styles.memberRoleText}>{m.role}</Text> : null}
                          </View>
                          <Text style={[styles.hourAmount, hrs === 0 && { color: colors.red }]}>{hrs}h</Text>
                          <TouchableOpacity
                            style={styles.setHoursBtn}
                            onPress={() => {
                              setSetHoursTarget({ userId: m.userId, name: m.name, currentHours: hrs });
                              setSetHoursInput(String(hrs));
                              setShowSetHoursModal(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.setHoursBtnText}>Set</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })
              }
            </View>
          )}

          {/* ── Notices Board ── */}
          <View style={styles.section}>
            <SectionHeader
              label="NOTICES BOARD"
              action={canWrite ? (
                <TouchableOpacity onPress={() => setShowAddNotice(true)} activeOpacity={0.7} style={styles.addBtn}>
                  <Text style={styles.addBtnText}>+ Post</Text>
                </TouchableOpacity>
              ) : null}
            />
            {notices.length === 0 ? (
              <EmptyState text={canWrite ? 'No notices yet. Post one above.' : 'No notices yet.'} />
            ) : (
              notices.map(n => (
                <View key={n.id} style={styles.noticeCard}>
                  <View style={styles.noticeCardTop}>
                    <Text style={styles.noticeTitle}>{n.title}</Text>
                    {canWrite && (
                      <TouchableOpacity onPress={() => deleteNotice(n.id)} activeOpacity={0.7} style={styles.deleteIcon}>
                        <X size={14} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                  {n.body ? <Text style={styles.noticeBody}>{n.body}</Text> : null}
                  <Text style={styles.noticeMeta}>
                    {n.posted_by_name ? `${n.posted_by_name} · ` : ''}{timeAgo(n.created_at)}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* ── Resource Persons ── */}
          <View style={styles.section}>
            <SectionHeader
              label="RESOURCE PERSONS"
              action={canWrite ? (
                <TouchableOpacity onPress={() => setShowAddRP(true)} activeOpacity={0.7} style={styles.addBtn}>
                  <Text style={styles.addBtnText}>+ Add</Text>
                </TouchableOpacity>
              ) : null}
            />
            {resourcePersons.length === 0 ? (
              <EmptyState text={canWrite ? 'No contacts yet. Add one above.' : 'No contacts yet.'} />
            ) : (
              resourcePersons.map(r => (
                <View key={r.id} style={styles.rpCard}>
                  <View style={[styles.rpAvatar, { backgroundColor: club.color + '33' }]}>
                    <Text style={[styles.rpAvatarText, { color: club.color }]}>
                      {(r.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rpName}>{r.name}</Text>
                    {r.designation ? <Text style={styles.rpMeta}>{r.designation}</Text> : null}
                    {r.event_name ? <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Calendar size={11} color={colors.textSecondary} /><Text style={styles.rpEvent}>{r.event_name}</Text></View> : null}
                    {r.contact ? <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Phone size={11} color={colors.textSecondary} /><Text style={styles.rpContact}>{r.contact}</Text></View> : null}
                  </View>
                  {canWrite && (
                    <TouchableOpacity onPress={() => deleteRP(r.id)} activeOpacity={0.7} style={styles.deleteIcon}>
                      <X size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );

  const BOTTOM_TABS = [
    { key: 'Discover', Icon: Compass,       label: 'Discover' },
    { key: 'Planner',  Icon: CalendarDays,  label: 'Planner'  },
    { key: 'Hub',      Icon: Landmark,      label: 'Hub'      },
    { key: 'Groups',   Icon: Users,         label: 'Groups'   },
    { key: 'Mentors',  Icon: GraduationCap, label: 'Mentors'  },
    { key: 'Teachers', Icon: BookOpen,      label: 'Teachers' },
  ];

  const bottomNav = !onClose ? (
    <View style={styles.bottomNavBar}>
      {BOTTOM_TABS.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={styles.bottomNavItem}
          onPress={() => navigation.navigate('Main', { screen: tab.key })}
          activeOpacity={0.7}
        >
          <tab.Icon size={20} color={colors.textTertiary} />
          <Text style={styles.bottomNavLabel}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  ) : null;

  return (
    <>
      {onClose ? (
        <SafeAreaView style={styles.container}>{content}</SafeAreaView>
      ) : (
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <View style={{ flex: 1 }}>{content}</View>
          {bottomNav}
        </SafeAreaView>
      )}

      {/* ── All Members Modal ── */}
      <Modal visible={showAllMembers} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All Members ({members.length})</Text>
              <TouchableOpacity onPress={() => setShowAllMembers(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {members.map(m => (
                <View key={m.userId} style={styles.memberRow}>
                  <View style={[styles.memberAvatar, { backgroundColor: m.av.bg }]}>
                    <Text style={[styles.memberAbbr, { color: m.av.text }]}>{m.abbr}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberRowName}>{m.name}</Text>
                    {m.role
                      ? <Text style={styles.memberRoleText}>{m.role}</Text>
                      : <Text style={styles.memberRowMeta}>{m.course} · {m.year}</Text>
                    }
                  </View>
                  {canWrite && (
                    <TouchableOpacity
                      style={styles.editRoleBtn}
                      onPress={() => { setShowAllMembers(false); openRoleEdit(m); }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.editRoleBtnText}>{m.role ? 'Edit' : '+ Role'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Set Hours Modal ── */}
      <Modal visible={showSetHoursModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { maxHeight: 400 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Alter Hours</Text>
              <TouchableOpacity onPress={() => { setShowSetHoursModal(false); setSetHoursTarget(null); setHoursMode('set'); }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.memberRowName}>{setHoursTarget?.name}</Text>
            <Text style={[styles.memberRowMeta, { marginBottom: spacing.sm }]}>
              Current total: {setHoursTarget?.currentHours ?? 0}h
            </Text>

            {/* Mode selection tabs */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: hoursMode === 'set' ? colors.primary : colors.border,
                  backgroundColor: hoursMode === 'set' ? colors.primaryLight : colors.bg,
                }}
                onPress={() => { setHoursMode('set'); setSetHoursInput(''); }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 11, color: hoursMode === 'set' ? colors.primary : colors.textSecondary, ...font.bold }}>
                  Set Total
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: hoursMode === 'adjust' ? colors.primary : colors.border,
                  backgroundColor: hoursMode === 'adjust' ? colors.primaryLight : colors.bg,
                }}
                onPress={() => { setHoursMode('adjust'); setSetHoursInput(''); }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 11, color: hoursMode === 'adjust' ? colors.primary : colors.textSecondary, ...font.bold }}>
                  Adjust (+/-)
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>
              {hoursMode === 'set' ? 'NEW TOTAL HOURS' : 'ADJUST BY HOURS (e.g. +3.5 or -2)'}
            </Text>
            <TextInput
              value={setHoursInput}
              onChangeText={setSetHoursInput}
              placeholder={hoursMode === 'set' ? "e.g. 12.5" : "e.g. +5 or -2.5"}
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
              keyboardType="numbers-and-punctuation"
            />
            <TouchableOpacity
              style={[styles.submitBtn, setHoursSaving && { opacity: 0.5 }, { marginTop: spacing.sm }]}
              onPress={handleSetHours}
              disabled={setHoursSaving}
              activeOpacity={0.85}
            >
              {setHoursSaving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Post Notice Modal ── */}
      <Modal visible={showAddNotice} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post Notice</Text>
              <TouchableOpacity onPress={() => { setShowAddNotice(false); setNoticeForm({ title: '', body: '' }); }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>TITLE *</Text>
            <TextInput
              value={noticeForm.title}
              onChangeText={t => setNoticeForm(f => ({ ...f, title: t }))}
              placeholder="e.g. Dry run tomorrow at 9am"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />
            <Text style={styles.modalLabel}>DETAILS (optional)</Text>
            <TextInput
              value={noticeForm.body}
              onChangeText={t => setNoticeForm(f => ({ ...f, body: t }))}
              placeholder="Additional details..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { height: 90, textAlignVertical: 'top' }]}
              multiline
            />
            <TouchableOpacity
              style={[styles.submitBtn, (!noticeForm.title.trim() || saving) && { opacity: 0.45 }]}
              onPress={postNotice}
              disabled={!noticeForm.title.trim() || saving}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Post Notice</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Add Wing Modal ── */}
      <Modal visible={showAddWing} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Wing</Text>
              <TouchableOpacity onPress={() => { setShowAddWing(false); setWingForm({ wing_name: '', responsibilities: '' }); }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>WING NAME *</Text>
            <TextInput
              value={wingForm.wing_name}
              onChangeText={t => setWingForm(f => ({ ...f, wing_name: t }))}
              placeholder="e.g. Marketing Wing"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />
            <Text style={styles.modalLabel}>RESPONSIBILITIES</Text>
            <TextInput
              value={wingForm.responsibilities}
              onChangeText={t => setWingForm(f => ({ ...f, responsibilities: t }))}
              placeholder="Describe this wing's duties, authority, and what they are responsible for..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { height: 110, textAlignVertical: 'top' }]}
              multiline
            />
            <TouchableOpacity
              style={[styles.submitBtn, (!wingForm.wing_name.trim() || saving) && { opacity: 0.45 }]}
              onPress={addWing}
              disabled={!wingForm.wing_name.trim() || saving}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Add Wing</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Edit Member Role Modal ── */}
      <Modal visible={!!editingMember} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: 8 }]}>
            <View style={styles.modalHeader}>
              <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Pencil size={15} color={colors.textSecondary} /><Text style={styles.modalTitle}>Set Role</Text></View>
              <TouchableOpacity onPress={() => setEditingMember(null)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {editingMember && (
              <View style={styles.memberRow}>
                <View style={[styles.memberAvatar, { backgroundColor: editingMember.av.bg }]}>
                  <Text style={[styles.memberAbbr, { color: editingMember.av.text }]}>{editingMember.abbr}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberRowName}>{editingMember.name}</Text>
                  <Text style={styles.memberRowMeta}>{editingMember.course} · {editingMember.year}</Text>
                </View>
              </View>
            )}
            <Text style={styles.modalLabel}>SELECT ROLE</Text>
            {/* Role options list */}
            {!customRoleMode && (
              <ScrollView style={styles.roleList} showsVerticalScrollIndicator={false}>
                {ROLE_OPTIONS.map(opt => {
                  const selected = roleInput === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.roleOption, selected && styles.roleOptionSelected]}
                      onPress={() => setRoleInput(opt)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.roleOptionText, selected && styles.roleOptionTextSelected]}>
                        {opt}
                      </Text>
                      {selected && <Check size={14} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.roleOption}
                  onPress={() => { setCustomRoleMode(true); setRoleInput(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.roleOptionText, { color: colors.primary }]}>+ Custom role…</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
            {customRoleMode && (
              <View>
                <TouchableOpacity onPress={() => { setCustomRoleMode(false); setRoleInput(''); }} style={{ marginBottom: spacing.sm }}>
                  <Text style={{ color: colors.primary, fontSize: 13 }}>← Back to list</Text>
                </TouchableOpacity>
                <TextInput
                  value={roleInput}
                  onChangeText={setRoleInput}
                  placeholder="Type a custom role..."
                  placeholderTextColor={colors.textTertiary}
                  style={styles.modalInput}
                  autoFocus
                />
              </View>
            )}
            <TouchableOpacity
              style={[styles.submitBtn, { marginTop: spacing.md }, (!roleInput.trim() || saving) && { opacity: 0.5 }]}
              onPress={saveRole}
              disabled={!roleInput.trim() || saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Save Role</Text>
              }
            </TouchableOpacity>
            {editingMember?.role && (
              <TouchableOpacity
                style={[styles.clearRoleBtn, { marginBottom: spacing.md }]}
                onPress={async () => {
                  setRoleInput('');
                  setSaving(true);
                  await supabase.from('club_memberships')
                    .update({ role: null })
                    .eq('user_id', editingMember.userId)
                    .eq('club_id', clubId);
                  setMembers(prev => prev.map(m =>
                    m.userId === editingMember.userId ? { ...m, role: null } : m
                  ));
                  setSaving(false);
                  setEditingMember(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.clearRoleBtnText}>Clear role</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Add Resource Person Modal ── */}
      <Modal visible={showAddRP} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Resource Person</Text>
              <TouchableOpacity onPress={() => { setShowAddRP(false); setRpForm({ name: '', designation: '', contact: '', event_name: '' }); }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>NAME *</Text>
            <TextInput
              value={rpForm.name}
              onChangeText={t => setRpForm(f => ({ ...f, name: t }))}
              placeholder="e.g. Dr. Anand Krishnan"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />
            <Text style={styles.modalLabel}>DESIGNATION / ORGANISATION</Text>
            <TextInput
              value={rpForm.designation}
              onChangeText={t => setRpForm(f => ({ ...f, designation: t }))}
              placeholder="e.g. CFO at Infosys"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />
            <Text style={styles.modalLabel}>CONTACT</Text>
            <TextInput
              value={rpForm.contact}
              onChangeText={t => setRpForm(f => ({ ...f, contact: t }))}
              placeholder="Phone or email"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.modalLabel}>EVENT / SESSION</Text>
            <TextInput
              value={rpForm.event_name}
              onChangeText={t => setRpForm(f => ({ ...f, event_name: t }))}
              placeholder="e.g. Stock Market Simulation 2026"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />
            <TouchableOpacity
              style={[styles.submitBtn, (!rpForm.name.trim() || saving) && { opacity: 0.45 }]}
              onPress={addRP}
              disabled={!rpForm.name.trim() || saving}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Contact</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Create Event Request Modal ── */}
      <Modal visible={showEventModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Event</Text>
              <TouchableOpacity onPress={() => { setShowEventModal(false); setEventForm({ name: '', description: '', date: '', startTime: '', endTime: '' }); setEventError(''); }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>EVENT NAME *</Text>
            <TextInput
              value={eventForm.name}
              onChangeText={t => setEventForm(f => ({ ...f, name: t }))}
              placeholder="e.g. Annual Finance Summit"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />
            <Text style={styles.modalLabel}>DESCRIPTION (optional)</Text>
            <TextInput
              value={eventForm.description}
              onChangeText={t => setEventForm(f => ({ ...f, description: t }))}
              placeholder="Brief description of the event..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              multiline
            />
            <Text style={styles.modalLabel}>DATE *</Text>
            <TouchableOpacity
              style={[styles.modalInput, styles.datePickerBtn]}
              onPress={() => {
                if (eventForm.date) {
                  const [y, m, d] = eventForm.date.split('-').map(Number);
                  setCalYear(y); setCalMonth(m - 1);
                } else {
                  const now = new Date();
                  setCalYear(now.getFullYear()); setCalMonth(now.getMonth());
                }
                setShowCalendar(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={eventForm.date ? styles.datePickerValue : styles.datePickerPlaceholder}>
                {eventForm.date
                  ? (() => { const [y,m,d] = eventForm.date.split('-'); return `${d}/${m}/${y}`; })()
                  : 'Select date'}
              </Text>
              <Calendar size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>START TIME * (HH:MM)</Text>
                <TextInput
                  value={eventForm.startTime}
                  onChangeText={t => setEventForm(f => ({ ...f, startTime: t }))}
                  placeholder="e.g. 10:00"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.modalInput}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>END TIME * (HH:MM)</Text>
                <TextInput
                  value={eventForm.endTime}
                  onChangeText={t => setEventForm(f => ({ ...f, endTime: t }))}
                  placeholder="e.g. 13:00"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.modalInput}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
            </View>
            {eventError ? <Text style={{ color: colors.red, fontSize: 12, marginTop: 6 }}>{eventError}</Text> : null}
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 8, lineHeight: 16 }}>
              Affected timetable slots are computed automatically. The timetable team will review before approval.
            </Text>
            <TouchableOpacity
              style={[styles.submitBtn, eventSubmitting && { opacity: 0.5 }]}
              onPress={handleCreateEvent}
              disabled={eventSubmitting}
              activeOpacity={0.85}
            >
              {eventSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Request</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Date Picker Calendar ── */}
      {(() => {
        const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const firstDay = new Date(calYear, calMonth, 1).getDay();
        const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
        while (cells.length % 7 !== 0) cells.push(null);
        const rows = [];
        for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
        const todayY = new Date().getFullYear(), todayM = new Date().getMonth(), todayD = new Date().getDate();
        const selParts = eventForm.date ? eventForm.date.split('-').map(Number) : null;
        const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
        const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };
        const selectDay = (day) => {
          const mm = String(calMonth + 1).padStart(2, '0');
          const dd = String(day).padStart(2, '0');
          setEventForm(f => ({ ...f, date: `${calYear}-${mm}-${dd}` }));
          setShowCalendar(false);
        };
        return (
          <Modal visible={showCalendar} animationType="fade" transparent>
            <View style={styles.calOverlay}>
              <View style={styles.calCard}>
                <View style={styles.calHeader}>
                  <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}>
                    <Text style={styles.calNavBtnText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.calMonthLabel}>{CAL_MONTHS[calMonth]} {calYear}</Text>
                  <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
                    <Text style={styles.calNavBtnText}>›</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.calWeekRow}>
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                    <Text key={d} style={styles.calDayLabel}>{d}</Text>
                  ))}
                </View>
                {rows.map((row, ri) => (
                  <View key={ri} style={styles.calWeekRow}>
                    {row.map((day, di) => {
                      const isSel = selParts && selParts[0] === calYear && selParts[1] - 1 === calMonth && selParts[2] === day;
                      const isTodayCell = calYear === todayY && calMonth === todayM && day === todayD;
                      return (
                        <TouchableOpacity
                          key={di}
                          style={[styles.calDayCell, isSel && styles.calDaySel]}
                          onPress={() => day && selectDay(day)}
                          disabled={!day}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.calDayText,
                            isSel && styles.calDaySelText,
                            isTodayCell && !isSel && styles.calDayTodayText,
                            !day && { opacity: 0 },
                          ]}>
                            {day ?? ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
                <TouchableOpacity onPress={() => setShowCalendar(false)} style={{ marginTop: 14, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        );
      })()}

      {/* ── Event Tracker Modal ── */}
      <Modal visible={!!trackingEvent} animationType="slide" transparent>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
          {trackingEvent && (() => {
            const done = trackerSteps.filter(s => s.done).length;
            const total = trackerSteps.length;
            const pct = total > 0 ? done / total : 0;
            return (
              <>
                {/* Header */}
                <View style={[styles.trackerHeader, { backgroundColor: club.color }]}>
                  <TouchableOpacity onPress={() => { setTrackingEvent(null); setUndoStep(null); }} style={styles.backBtn} activeOpacity={0.7}>
                    <X size={18} color="rgba(255,255,255,0.9)" />
                  </TouchableOpacity>
                  <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
                    <Text style={styles.trackerHeaderTitle} numberOfLines={1}>{trackingEvent.title}</Text>
                    <Text style={styles.trackerHeaderSub}>{club.name} · Event Tracker</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.trackerProgressBox}>
                  <View style={styles.trackerProgressRow}>
                    <Text style={styles.trackerProgressLabel}>
                      {done} of {total} steps completed
                    </Text>
                    <Text style={[styles.trackerProgressPct, { color: pct === 1 ? colors.green : colors.primary }]}>
                      {Math.round(pct * 100)}%
                    </Text>
                  </View>
                  <View style={styles.trackerProgressTrack}>
                    <View style={[styles.trackerProgressFill, { width: `${pct * 100}%`, backgroundColor: pct === 1 ? colors.green : club.color }]} />
                  </View>
                  {pct === 1 && (
                    <Text style={{ color: colors.green, fontSize: 12, ...font.semibold, marginTop: 4 }}>
                      🎉 All steps complete!
                    </Text>
                  )}
                </View>

                {trackerLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
                ) : (
                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}>
                    {trackerSteps.map((step, index) => {
                      const isCompleted = step.done;
                      const isActive = !step.done && (index === 0 || trackerSteps[index - 1]?.done);
                      const isLocked = !step.done && !isActive;
                      return (
                        <View key={step.id} style={styles.stepRow}>
                          {/* Connector line */}
                          {index < trackerSteps.length - 1 && (
                            <View style={[styles.stepConnector, { backgroundColor: isCompleted ? club.color : colors.border }]} />
                          )}
                          {/* Checkbox */}
                          <TouchableOpacity
                            style={[styles.stepCheck, isCompleted && { backgroundColor: club.color, borderColor: club.color }, isActive && { borderColor: club.color }, isLocked && styles.stepCheckLocked]}
                            onPress={() => confirmAndToggleStep(step, index)}
                            disabled={isLocked}
                            activeOpacity={0.7}
                          >
                            {isCompleted && <Check size={14} color="#fff" />}
                            {isLocked && <Lock size={13} color={colors.textTertiary} />}
                          </TouchableOpacity>
                          {/* Label */}
                          <View style={{ flex: 1, paddingLeft: spacing.md }}>
                            <Text style={[styles.stepLabel, isCompleted && styles.stepLabelDone, isLocked && styles.stepLabelLocked]}>
                              {step.label}
                            </Text>
                            {isActive && !isCompleted && (
                              <Text style={[styles.stepActivePill, { color: club.color }]}>← Current step</Text>
                            )}
                          </View>
                          {/* Delete */}
                          <TouchableOpacity style={styles.stepDelete} onPress={() => deleteTrackerStep(step)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Trash2 size={16} color={colors.textTertiary} />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}

                {/* Undo toast */}
                {undoStep && (
                  <View style={styles.undoToast}>
                    <Text style={styles.undoToastText}>Step removed</Text>
                    <TouchableOpacity onPress={undoDeleteStep} activeOpacity={0.7}>
                      <Text style={styles.undoToastBtn}>UNDO</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            );
          })()}
        </SafeAreaView>
      </Modal>

      {/* ── Wing Prompt Modal (auto-shown for new members) ── */}
      <Modal visible={showWingPrompt} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={[styles.header, { backgroundColor: club?.color, borderRadius: radius.md, marginBottom: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.lg }]}>
              <Text style={{ fontSize: 32, textAlign: 'center' }}>{club?.emoji}</Text>
              <Text style={[styles.headerName, { marginTop: 4 }]}>{club?.name}</Text>
            </View>
            <Text style={[styles.modalTitle, { marginBottom: 4 }]}>Choose Your Wing</Text>
            <Text style={[styles.wingPickerHint, { marginBottom: spacing.md }]}>
              Select the wing you'll be part of in this club.
            </Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {wings.map(w => (
                <TouchableOpacity
                  key={w.id}
                  style={styles.wingPickerOption}
                  onPress={() => saveMyWing(w.wing_name)}
                  disabled={savingWing}
                  activeOpacity={0.75}
                >
                  <View style={[styles.wingDot, { backgroundColor: club?.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wingPickerText}>{w.wing_name}</Text>
                    {w.responsibilities ? (
                      <Text style={styles.wingPickerSub}>{w.responsibilities}</Text>
                    ) : null}
                  </View>
                  {savingWing && <ActivityIndicator size="small" color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowWingPrompt(false)} style={{ alignItems: 'center', marginTop: spacing.md, paddingVertical: 8 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Wing Members Modal ── */}
      <Modal visible={!!selectedWing} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedWing?.wing_name}</Text>
                {selectedWing?.responsibilities ? (
                  <Text style={[styles.wingResp, { marginTop: 2 }]}>{selectedWing.responsibilities}</Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => setSelectedWing(null)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {selectedWing && (() => {
              const wingMembers = members.filter(m => m.wing === selectedWing.wing_name);
              return wingMembers.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center', gap: 8 }}>
                  <Users size={28} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No members in this wing yet.</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
                  {wingMembers.map(m => (
                    <View key={m.userId} style={styles.memberRow}>
                      <View style={[styles.memberAvatar, { backgroundColor: m.av.bg }]}>
                        <Text style={[styles.memberAbbr, { color: m.av.text }]}>{m.abbr}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberRowName}>{m.name}</Text>
                        <Text style={styles.memberRowMeta}>{m.course} · {m.year}</Text>
                        {m.role ? <Text style={[styles.memberRowMeta, { color: colors.primary }]}>{m.role}</Text> : null}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ── Post Hub Event Modal ── */}
      <Modal visible={showPostHubEvent} animationType="slide" transparent onRequestClose={() => setShowPostHubEvent(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post Event</Text>
              <TouchableOpacity onPress={() => setShowPostHubEvent(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>EVENT TITLE *</Text>
            <TextInput value={hubEventForm.title} onChangeText={t => setHubEventForm(f => ({ ...f, title: t }))} placeholder="e.g. Annual Quiz Night" placeholderTextColor={colors.textTertiary} style={styles.modalInput} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>DATE</Text>
                <TextInput value={hubEventForm.date} onChangeText={t => setHubEventForm(f => ({ ...f, date: t }))} placeholder="e.g. Thu 12 Jun" placeholderTextColor={colors.textTertiary} style={styles.modalInput} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>TIME *</Text>
                <TextInput value={hubEventForm.time} onChangeText={t => setHubEventForm(f => ({ ...f, time: t }))} placeholder="e.g. 2:00 PM" placeholderTextColor={colors.textTertiary} style={styles.modalInput} />
              </View>
            </View>
            <Text style={styles.modalLabel}>VENUE *</Text>
            <TextInput value={hubEventForm.venue} onChangeText={t => setHubEventForm(f => ({ ...f, venue: t }))} placeholder="e.g. Tech Hub, Yeshwanthpur" placeholderTextColor={colors.textTertiary} style={styles.modalInput} />
            <Text style={styles.modalLabel}>WHEN</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.sm }}>
              {WHEN_OPTIONS.map(w => (
                <TouchableOpacity key={w} onPress={() => setHubEventForm(f => ({ ...f, when: w }))} activeOpacity={0.7}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md, borderWidth: 1,
                    borderColor: hubEventForm.when === w ? colors.primary : colors.border,
                    backgroundColor: hubEventForm.when === w ? colors.primaryLight : colors.bg }}>
                  <Text style={{ fontSize: 12, color: hubEventForm.when === w ? colors.primary : colors.textSecondary, ...font.semibold }}>{WHEN_LABELS[w]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modalLabel}>DESCRIPTION</Text>
            <TextInput value={hubEventForm.desc} onChangeText={t => setHubEventForm(f => ({ ...f, desc: t }))} placeholder="What's this event about?" placeholderTextColor={colors.textTertiary} style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]} multiline />
            <Text style={styles.modalLabel}>TEAMS NEEDED (optional)</Text>
            <View style={styles.teamPickerGrid}>
              {hubClubs.filter(c => c.type === 'Team').map(t => {
                const selected = hubTeamsNeeded.includes(t.id);
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.teamPickerChip, selected && { backgroundColor: `${t.color}22`, borderColor: t.color }]}
                    onPress={() => setHubTeamsNeeded(prev => selected ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.teamPickerEmoji}>{t.emoji}</Text>
                    <Text style={[styles.teamPickerText, selected && { color: t.color, ...font.semibold }]}>{t.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={[styles.submitBtn, (!hubEventForm.title.trim() || !hubEventForm.time.trim() || !hubEventForm.venue.trim()) && { opacity: 0.45 }]} onPress={handlePostHubEvent} activeOpacity={0.85}>
              <Text style={styles.submitBtnText}>Post Event</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Recruitment Modal ── */}
      <Modal visible={showRecruitment} animationType="slide" transparent onRequestClose={() => setShowRecruitment(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Open Recruitment</Text>
              <TouchableOpacity onPress={() => setShowRecruitment(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>ROLE / POSITION *</Text>
            <TextInput value={recruitForm.role} onChangeText={t => setRecruitForm(f => ({ ...f, role: t }))} placeholder="e.g. Wing 1 — Photographer" placeholderTextColor={colors.textTertiary} style={styles.modalInput} />
            <Text style={styles.modalLabel}>REQUIREMENTS</Text>
            <TextInput value={recruitForm.requirements} onChangeText={t => setRecruitForm(f => ({ ...f, requirements: t }))} placeholder="Skills or experience needed?" placeholderTextColor={colors.textTertiary} style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]} multiline />
            <Text style={styles.modalLabel}>APPLY BY</Text>
            <TextInput value={recruitForm.applyBy} onChangeText={t => setRecruitForm(f => ({ ...f, applyBy: t }))} placeholder="e.g. 20 Jun 2026" placeholderTextColor={colors.textTertiary} style={styles.modalInput} />
            <Text style={styles.modalLabel}>CONTACT / HOW TO APPLY</Text>
            <TextInput value={recruitForm.contact} onChangeText={t => setRecruitForm(f => ({ ...f, contact: t }))} placeholder="e.g. DM @club or email us" placeholderTextColor={colors.textTertiary} style={styles.modalInput} />
            <TouchableOpacity style={[styles.submitBtn, !recruitForm.role.trim() && { opacity: 0.45 }]} onPress={handlePostRecruitment} disabled={!recruitForm.role.trim()} activeOpacity={0.85}>
              <Text style={styles.submitBtnText}>Post Recruitment Notice</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Join Requests Review Modal ── */}
      <Modal visible={showJoinReview} animationType="slide" transparent onRequestClose={() => setShowJoinReview(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={{flexDirection:'row',alignItems:'center',gap:6}}><ClipboardList size={15} color={colors.textSecondary} /><Text style={styles.modalTitle}>Join Requests</Text></View>
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
                        <Text style={styles.joinReqAvatarText}>{req.student_name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.joinReqName}>{req.student_name}</Text>
                        <Text style={styles.joinReqMeta}>{req.course} · {req.year}</Text>
                      </View>
                    </View>
                    {req.message ? <Text style={styles.joinReqMessage}>"{req.message}"</Text> : null}
                    <View style={styles.joinReqActions}>
                      <TouchableOpacity style={styles.joinReqReject} activeOpacity={0.8}
                        onPress={async () => {
                          await resolveClubJoinRequest(req.id, 'reject', { userId: req.user_id, clubId: req.club_id, clubName: req.club_name });
                          setJoinReviewList(prev => prev.filter(r => r.id !== req.id));
                        }}>
                        <Text style={styles.joinReqRejectText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.joinReqApprove} activeOpacity={0.8}
                        onPress={async () => {
                          await resolveClubJoinRequest(req.id, 'approve', { userId: req.user_id, clubId: req.club_id, clubName: req.club_name });
                          setJoinReviewList(prev => prev.filter(r => r.id !== req.id));
                        }}>
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

      {/* ── Social Link Modal ── */}
      {/* ── Docs Modal ── */}
      <Modal visible={showDocsModal} animationType="slide" transparent={false} onRequestClose={() => setShowDocsModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}><FileText size={16} color={colors.textPrimary} /><Text style={{ fontSize: 16, ...font.bold, color: colors.textPrimary }}>Documents</Text></View>
            <TouchableOpacity onPress={() => setShowDocsModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <DocumentationScreen
            effectiveProfile={{
              name: effectiveName,
              coordinatorClubIds: adminTestTeacher?.coordinatorClubIds
                || teacherProfile?.coordinatorClubIds
                || [],
            }}
            effectiveSapsCore={
              isSapsCore
              || !!(adminTestTeacher?.position?.includes('SAPS'))
              || !!(teacherProfile?.position?.includes('SAPS'))
            }
            userProfile={userProfile}
            createNotification={createNotification}
            nfaPrefill={docsNFAPrefill}
            onPrefillConsumed={() => setDocsNFAPrefill(null)}
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={showSocialModal} animationType="slide" transparent onRequestClose={() => setShowSocialModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Social Link</Text>
              <TouchableOpacity onPress={() => setShowSocialModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>PLATFORM</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm }}>
              {SOCIAL_PLATFORMS.map(p => (
                <TouchableOpacity key={p.name} onPress={() => setSocialPlatform(p.name)} activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8,
                    borderRadius: radius.full, borderWidth: 1,
                    borderColor: socialPlatform === p.name ? colors.primary : colors.border,
                    backgroundColor: socialPlatform === p.name ? colors.primaryLight : colors.card }}>
                  <p.Icon size={14} color={socialPlatform === p.name ? colors.primary : colors.textSecondary} />
                  <Text style={{ fontSize: 12, color: socialPlatform === p.name ? colors.primary : colors.textSecondary, ...font.semibold }}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modalLabel}>LINK / URL</Text>
            <TextInput value={socialUrl} onChangeText={setSocialUrl}
              placeholder={SOCIAL_PLATFORMS.find(p => p.name === socialPlatform)?.prefix ? `e.g. ${SOCIAL_PLATFORMS.find(p => p.name === socialPlatform).prefix}yourclub` : 'Paste your full link here'}
              placeholderTextColor={colors.textTertiary} style={styles.modalInput} autoCapitalize="none" keyboardType="url" />
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
                style={{ marginTop: spacing.sm, alignItems: 'center', paddingVertical: 10 }}
                onPress={async () => {
                  await supabase.from('club_social_links').delete().eq('club_id', String(rawId));
                  setSocialLink(null); setSocialUrl(''); setShowSocialModal(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, color: colors.red, ...font.semibold }}>Remove link</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tColors.bg },
  bottomNavBar: {
    flexDirection: 'row',
    backgroundColor: tColors.card,
    borderTopWidth: 1, borderTopColor: tColors.border,
    height: 64, paddingBottom: tSpacing.sm, paddingTop: 6,
  },
  bottomNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  bottomNavIcon: { fontSize: typography.lg },
  bottomNavLabel: { fontSize: 9, color: tColors.textTertiary, fontWeight: typography.medium },
  scroll: { flex: 1 },

  header: {
    paddingTop: 48, paddingBottom: 28, alignItems: 'center', position: 'relative',
  },
  backBtn: {
    position: 'absolute', top: 14, left: 14,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { color: tColors.textPrimary, fontSize: 22, fontWeight: typography.bold, marginTop: -2 },
  headerContent: { alignItems: 'center', gap: tSpacing.xs },
  headerEmoji: { fontSize: 44 },
  headerName: { fontSize: typography.xl, fontWeight: typography.bold, color: tColors.textPrimary, marginTop: 6 },
  headerFull: { fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center', paddingHorizontal: tSpacing.xl },
  roleBadge: {
    marginTop: 10, borderWidth: 1, borderRadius: tRadius.full,
    paddingHorizontal: 14, paddingVertical: tSpacing.xs,
  },
  roleText: { fontSize: typography.xs, fontWeight: typography.bold, letterSpacing: 0.8 },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: tColors.card,
    borderBottomWidth: 1, borderBottomColor: tColors.border,
    paddingVertical: tSpacing.md,
  },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: typography.bold, color: tColors.textPrimary },
  statLabel: { fontSize: 10, color: tColors.textTertiary, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: tColors.border },

  section: { paddingHorizontal: tSpacing.lg, marginTop: tSpacing.lg },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: tSpacing.sm,
  },
  sectionLabel: { fontSize: typography.xs, fontWeight: typography.bold, color: tColors.textSecondary, letterSpacing: 0.8 },
  addBtn: {
    backgroundColor: tColors.student.primaryDim, borderWidth: 1, borderColor: tColors.student.primary,
    borderRadius: tRadius.full, paddingHorizontal: 10, paddingVertical: tSpacing.xs,
  },
  addBtnText: { fontSize: typography.xs, color: tColors.student.primary, fontWeight: typography.semibold },
  seeAll: { fontSize: 12, color: tColors.student.primary, fontWeight: typography.semibold },

  emptyBox: {
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md, alignItems: 'center',
  },
  emptyText: { fontSize: 12, color: tColors.textTertiary },

  // Events
  eventCard: {
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, marginBottom: tSpacing.sm, overflow: 'hidden',
    flexDirection: 'row',
  },
  eventStripe: { width: 3 },
  eventBody: { flex: 1, padding: tSpacing.md },
  eventTitle: { fontSize: typography.sm, fontWeight: typography.bold, color: tColors.textPrimary, marginBottom: 4 },
  eventMeta: { fontSize: typography.xs, color: tColors.textSecondary, marginBottom: 4 },
  eventDesc: { fontSize: typography.xs, color: tColors.textTertiary, lineHeight: 16 },

  // Members
  memberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tSpacing.sm },
  memberChip: {
    alignItems: 'center', width: 62,
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.sm, gap: 3,
  },
  memberAvatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  memberAbbr: { fontSize: 12, fontWeight: typography.bold },
  memberName: { fontSize: 10, fontWeight: typography.semibold, color: tColors.textPrimary, textAlign: 'center' },
  memberMeta: { fontSize: 9, color: tColors.textTertiary, textAlign: 'center' },
  memberMoreChip: {
    width: 62, height: 62 + tSpacing.sm * 2 + 10 + 9 + 3,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md,
  },
  memberMoreText: { fontSize: typography.sm, fontWeight: typography.bold, color: tColors.student.primary },

  // Wings
  wingCard: {
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md, marginBottom: tSpacing.sm,
  },
  wingCardHeader: { flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm, marginBottom: 4 },
  wingDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  wingName: { fontSize: typography.sm, fontWeight: typography.bold, color: tColors.textPrimary, flex: 1 },
  wingResp: { fontSize: 12, color: tColors.textSecondary, lineHeight: 18, marginTop: 4 },
  wingMemberBadge: { borderRadius: 20, paddingHorizontal: tSpacing.sm, paddingVertical: 2 },
  wingMemberBadgeText: { fontSize: typography.xs, fontWeight: typography.semibold },
  wingTapHint: { fontSize: typography.xs, color: tColors.textTertiary, marginTop: 6 },
  wingPickerHint: { fontSize: 12, color: tColors.textSecondary, marginBottom: tSpacing.sm },
  wingPickerOption: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.sm, padding: tSpacing.md, marginBottom: tSpacing.sm,
  },
  wingPickerOptionSelected: { borderColor: tColors.student.primary, backgroundColor: tColors.student.primaryDim },
  wingPickerText: { fontSize: 14, color: tColors.textPrimary, fontWeight: typography.medium },
  wingPickerTextSelected: { color: tColors.student.primary, fontWeight: typography.bold },
  wingPickerSub: { fontSize: typography.xs, color: tColors.textSecondary, marginTop: 2 },

  // Event card action buttons row
  eventCardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: tSpacing.sm, marginTop: tSpacing.sm },
  trackerBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.sm, paddingVertical: 5, paddingHorizontal: 10,
  },
  trackerBtnText: { fontSize: 12, color: tColors.textSecondary, fontWeight: typography.medium },
  nfaBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: tColors.student.primary,
    borderRadius: tRadius.sm, paddingVertical: 5, paddingHorizontal: 10,
  },
  nfaBtnText: { fontSize: 12, color: tColors.student.primary, fontWeight: typography.medium },

  // Tracker modal
  trackerHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 48, paddingBottom: tSpacing.base, paddingHorizontal: tSpacing.md,
  },
  trackerHeaderTitle: { fontSize: 16, fontWeight: typography.bold, color: tColors.textPrimary },
  trackerHeaderSub: { fontSize: typography.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  trackerProgressBox: {
    padding: tSpacing.lg,
    borderBottomWidth: 1, borderBottomColor: tColors.border,
    backgroundColor: tColors.card,
  },
  trackerProgressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: tSpacing.sm },
  trackerProgressLabel: { fontSize: typography.sm, color: tColors.textSecondary, fontWeight: typography.medium },
  trackerProgressPct: { fontSize: typography.sm, fontWeight: typography.bold },
  trackerProgressTrack: {
    height: 6, backgroundColor: tColors.border, borderRadius: 3, overflow: 'hidden',
  },
  trackerProgressFill: { height: 6, borderRadius: 3 },

  // Steps
  stepRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: tSpacing.lg, position: 'relative',
  },
  stepConnector: {
    position: 'absolute', left: 15, top: 32,
    width: 2, height: tSpacing.lg + 8,
    zIndex: 0,
  },
  stepCheck: {
    width: 32, height: 32, borderRadius: tRadius.lg,
    borderWidth: 2, borderColor: tColors.border,
    backgroundColor: tColors.bg,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1, flexShrink: 0,
  },
  stepCheckLocked: { backgroundColor: tColors.card, borderColor: tColors.border },
  stepCheckTick: { color: tColors.textPrimary, fontSize: 14, fontWeight: typography.bold },
  stepLockIcon: { fontSize: 10 },
  stepLabel: { fontSize: 14, color: tColors.textPrimary, fontWeight: typography.medium, lineHeight: 20, paddingTop: 6 },
  stepLabelDone: { textDecorationLine: 'line-through', color: tColors.textTertiary },
  stepLabelLocked: { color: tColors.textTertiary },
  stepActivePill: { fontSize: typography.xs, fontWeight: typography.semibold, marginTop: 2 },
  stepDelete: { paddingTop: 6, paddingLeft: tSpacing.sm },
  stepDeleteIcon: { fontSize: 14 },

  // Undo toast
  undoToast: {
    position: 'absolute', bottom: tSpacing.xl, left: tSpacing.lg, right: tSpacing.lg,
    backgroundColor: tColors.textPrimary, borderRadius: tRadius.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: tSpacing.md, paddingHorizontal: tSpacing.lg,
  },
  undoToastText: { color: tColors.bg, fontSize: typography.sm, fontWeight: typography.medium },
  undoToastBtn: { color: tColors.student.primary, fontSize: typography.sm, fontWeight: typography.bold },

  // Notices
  noticeCard: {
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md, marginBottom: tSpacing.sm,
  },
  noticeCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: tSpacing.sm },
  noticeTitle: { flex: 1, fontSize: typography.sm, fontWeight: typography.semibold, color: tColors.textPrimary },
  noticeBody: { fontSize: 12, color: tColors.textSecondary, lineHeight: 18, marginTop: 4 },
  noticeMeta: { fontSize: 10, color: tColors.textTertiary, marginTop: tSpacing.xs },

  // Resource persons
  rpCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: tSpacing.md,
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md, marginBottom: tSpacing.sm,
  },
  rpAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  rpAvatarText: { fontSize: 14, fontWeight: typography.bold },
  rpName: { fontSize: typography.sm, fontWeight: typography.bold, color: tColors.textPrimary },
  rpMeta: { fontSize: typography.xs, color: tColors.textSecondary, marginTop: 2 },
  rpEvent: { fontSize: typography.xs, color: tColors.student.primary, marginTop: 3 },
  rpContact: { fontSize: typography.xs, color: tColors.textSecondary, marginTop: 2 },

  deleteIcon: { padding: tSpacing.xs, flexShrink: 0 },
  deleteIconText: { fontSize: 12, color: tColors.textTertiary },

  // Members list
  memberList: {
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, overflow: 'hidden',
  },
  memberListRow: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    paddingHorizontal: tSpacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: tColors.border,
  },
  memberRoleText: { fontSize: typography.xs, color: tColors.student.primary, fontWeight: typography.semibold, marginTop: 1 },
  memberNoRole: { fontSize: typography.xs, color: tColors.textTertiary, marginTop: 1 },
  editRoleBtn: {
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.full, paddingHorizontal: 10, paddingVertical: tSpacing.xs,
  },
  editRoleBtnText: { fontSize: typography.xs, color: tColors.textSecondary, fontWeight: typography.semibold },
  showMoreBtn: { paddingVertical: tSpacing.md, alignItems: 'center' },
  showMoreText: { fontSize: 12, color: tColors.student.primary, fontWeight: typography.semibold },
  clearRoleBtn: { alignItems: 'center', paddingVertical: 10, marginTop: tSpacing.xs },
  clearRoleBtnText: { fontSize: typography.sm, color: tColors.error },
  roleList: { maxHeight: 260, marginBottom: tSpacing.xs },
  roleOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: tSpacing.md, paddingHorizontal: tSpacing.sm,
    borderRadius: tRadius.sm, marginBottom: 2,
  },
  roleOptionSelected: {
    backgroundColor: tColors.student.primaryDim,
    borderWidth: 1, borderColor: tColors.student.primary,
  },
  roleOptionText: { flex: 1, fontSize: 14, color: tColors.textPrimary, fontWeight: typography.medium },
  roleOptionTextSelected: { color: tColors.student.primary, fontWeight: typography.bold },
  roleOptionCheck: { fontSize: 14, color: tColors.student.primary, fontWeight: typography.bold },

  // Members modal
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    paddingVertical: tSpacing.sm, borderBottomWidth: 1, borderBottomColor: tColors.border,
    marginBottom: tSpacing.sm,
  },
  memberRowName: { fontSize: typography.sm, fontWeight: typography.semibold, color: tColors.textPrimary },
  memberRowMeta: { fontSize: typography.xs, color: tColors.textTertiary, marginTop: 1 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: tColors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: tSpacing.lg, maxHeight: '90%',
    borderWidth: 1, borderColor: tColors.border,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: tSpacing.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: typography.bold, color: tColors.textPrimary },
  modalClose: { fontSize: 22, color: tColors.textSecondary, padding: tSpacing.xs },
  modalLabel: {
    fontSize: 10, fontWeight: typography.bold, color: tColors.textSecondary,
    letterSpacing: 0.8, marginBottom: 6, marginTop: tSpacing.sm,
  },
  modalInput: {
    backgroundColor: tColors.bg, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md,
    color: tColors.textPrimary, fontSize: 14,
  },
  submitBtn: {
    backgroundColor: tColors.student.primary, borderRadius: tRadius.md,
    paddingVertical: 14, marginTop: tSpacing.lg, alignItems: 'center',
  },
  submitBtnText: { color: tColors.textPrimary, fontSize: typography.base, fontWeight: typography.bold },

  // Date picker field
  datePickerBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  datePickerValue: { color: tColors.textPrimary, fontSize: 14 },
  datePickerPlaceholder: { color: tColors.textTertiary, fontSize: 14 },
  datePickerIcon: { fontSize: 16 },

  // Calendar modal
  calOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center', padding: tSpacing.lg,
  },
  calCard: {
    backgroundColor: tColors.card, borderRadius: tRadius.lg,
    padding: tSpacing.lg, width: '100%', maxWidth: 340,
    borderWidth: 1, borderColor: tColors.border,
  },
  calHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: tSpacing.md,
  },
  calMonthLabel: { fontSize: 16, fontWeight: typography.bold, color: tColors.textPrimary },
  calNavBtn: { padding: 6 },
  calNavBtnText: { fontSize: 22, color: tColors.student.primary, lineHeight: 24 },
  calWeekRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: tSpacing.xs },
  calDayLabel: { width: 36, textAlign: 'center', fontSize: typography.xs, fontWeight: typography.bold, color: tColors.textSecondary },
  calDayCell: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  calDayText: { fontSize: 14, color: tColors.textPrimary },
  calDaySel: { backgroundColor: tColors.student.primary },
  calDaySelText: { color: tColors.textPrimary, fontWeight: typography.bold },
  calDayTodayText: { color: tColors.student.primary, fontWeight: typography.bold },

  // Event request cards
  eventReqCard: {
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md, marginBottom: tSpacing.sm,
  },
  eventReqCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: tSpacing.sm, marginBottom: 4 },
  eventReqName: { flex: 1, fontSize: typography.sm, fontWeight: typography.semibold, color: tColors.textPrimary },
  eventReqStatusPill: {
    borderRadius: tRadius.full, borderWidth: 1,
    paddingHorizontal: tSpacing.sm, paddingVertical: 2, flexShrink: 0,
  },
  eventReqStatusText: { fontSize: 9, fontWeight: typography.bold, letterSpacing: 0.4 },
  eventReqMeta: { fontSize: typography.xs, color: tColors.textTertiary },

  teamDashBanner: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    marginHorizontal: tSpacing.md, marginTop: tSpacing.md,
    backgroundColor: tColors.card, borderWidth: 1.5,
    borderRadius: tRadius.lg, padding: tSpacing.md,
  },
  teamDashBannerIcon: {
    width: 44, height: 44, borderRadius: tRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  teamDashBannerTitle: { fontSize: 14, fontWeight: typography.bold },
  teamDashBannerSub: { fontSize: typography.xs, color: tColors.textSecondary, marginTop: 2 },
  teamDashBannerArrow: { fontSize: 26, fontWeight: typography.bold },

  headerLogo: { width: 72, height: 72, borderRadius: tRadius.lg, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  uploadLogoBtn: {
    marginTop: 10, paddingHorizontal: 14, paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: tRadius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  uploadLogoBtnText: { fontSize: 12, color: tColors.textPrimary, fontWeight: typography.semibold },
  logoErrorText: { fontSize: typography.xs, color: '#FFD0D0', marginTop: 4 },

  // Contribution Hours
  hoursSubLabel: {
    fontSize: 9, fontWeight: typography.bold, color: tColors.textTertiary,
    letterSpacing: 0.8, marginTop: tSpacing.md, marginBottom: 6,
  },
  hourReqCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md, marginBottom: tSpacing.sm,
  },
  hourReqBtn: {
    borderRadius: tRadius.sm, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center',
  },
  hourReqBtnText: { fontSize: 12, fontWeight: typography.bold },
  hourLeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    paddingVertical: tSpacing.sm,
    borderBottomWidth: 1, borderBottomColor: tColors.border,
  },
  hourLeaderRank: { fontSize: typography.xs, fontWeight: typography.bold, color: tColors.textTertiary, width: 22 },
  hourAmount: { fontSize: 14, fontWeight: typography.bold, color: tColors.textPrimary, minWidth: 36, textAlign: 'right' },
  setHoursBtn: {
    backgroundColor: tColors.student.primaryDim, borderRadius: tRadius.sm,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: tColors.student.primary,
  },
  setHoursBtnText: { fontSize: typography.xs, fontWeight: typography.bold, color: tColors.student.primary },

  // Admin Actions
  adminActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md, marginBottom: tSpacing.sm,
  },
  adminActionIcon: { fontSize: typography.lg, width: 28, textAlign: 'center' },
  adminActionTitle: { fontSize: typography.sm, fontWeight: typography.semibold, color: tColors.textPrimary },
  adminActionDesc: { fontSize: typography.xs, color: tColors.textSecondary, marginTop: 1 },
  adminActionArrow: { fontSize: typography.lg, color: tColors.textTertiary },
  deleteClubBtn: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    backgroundColor: tColors.errorDim, borderWidth: 1, borderColor: tColors.error,
    borderRadius: tRadius.md, padding: tSpacing.md, marginBottom: tSpacing.sm,
  },
  deleteClubTitle: { fontSize: typography.sm, fontWeight: typography.semibold, color: tColors.error },

  // Join Request Review
  joinReqCard: {
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md, marginBottom: tSpacing.sm,
  },
  joinReqHeader: { flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm, marginBottom: tSpacing.sm },
  joinReqAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: tColors.student.primaryDim, alignItems: 'center', justifyContent: 'center',
  },
  joinReqAvatarText: { fontSize: 12, fontWeight: typography.bold, color: tColors.student.primary },
  joinReqName: { fontSize: typography.sm, fontWeight: typography.semibold, color: tColors.textPrimary },
  joinReqMeta: { fontSize: typography.xs, color: tColors.textSecondary },
  joinReqMessage: { fontSize: 12, color: tColors.textTertiary, fontStyle: 'italic', marginBottom: tSpacing.sm },
  joinReqActions: { flexDirection: 'row', gap: tSpacing.sm },
  joinReqReject: {
    flex: 1, alignItems: 'center', paddingVertical: tSpacing.sm,
    borderRadius: tRadius.md, borderWidth: 1, borderColor: tColors.border,
    backgroundColor: tColors.bg,
  },
  joinReqRejectText: { fontSize: 12, fontWeight: typography.semibold, color: tColors.textSecondary },
  joinReqApprove: {
    flex: 1, alignItems: 'center', paddingVertical: tSpacing.sm,
    borderRadius: tRadius.md, backgroundColor: tColors.student.primary,
  },
  joinReqApproveText: { fontSize: 12, fontWeight: typography.semibold, color: tColors.textPrimary },

  // Team picker
  teamPickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tSpacing.sm, marginBottom: tSpacing.sm },
  teamPickerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.full, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: tColors.card,
  },
  teamPickerEmoji: { fontSize: typography.sm },
  teamPickerText: { fontSize: typography.xs, color: tColors.textSecondary, fontWeight: typography.medium },
});
