import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { pickAndUploadMedia } from '../lib/uploadMedia';
import MediaMessage from '../components/MediaMessage';
import { students, myProfile, mentorAssignments, hubClubs } from '../data';
import ClubDashboardScreen from './ClubDashboardScreen';
import TimetablePlannerScreen from './TimetablePlannerScreen';
import DocumentationScreen from './DocumentationScreen';
import { colors, spacing, radius, font, avatarColor, THEMES, activeThemeKey, setTheme } from '../theme';
import { supabase } from '../lib/supabase';
import { metaFromClass, ALL_CLASSES } from '../lib/subjectUtils';
import { createCompensatoryRequest } from '../lib/compensatoryUtils';

const ALL_COURSES = ['1BcomIAF', '3BcomIAF', '5BcomIAF', '1BcomIBA', '3BcomIBA', '1BcomF&A', '3BcomF&A(A)', '3BcomF&A(B)', '5BcomF&A(A)', '5BcomF&A(B)', '7BcomF&A'];
// Classes that have HED reserved at TUE P2 (5th-year classes have real subjects there).
const HED_CLASSES = new Set([
  '1BcomIBA', '1BcomF&A', '1BcomIAF',
  '3BcomIBA', '3BcomF&A(A)', '3BcomF&A(B)', '3BcomIAF',
]);
// Flip to true after creating the group_teacher_requests table in Supabase
const GROUP_TEACHER_TABLE_EXISTS = false;
const EMOJI_OPTIONS = ['📚', '⚡', '🧠', '💡', '🎯', '📊', '💼', '🔬', '💻', '📝', '🌏', '🎓'];
const REQUIRED_VISITS = 5;

export default function TeacherDashboardScreen({ onSignOut, onClose }) {
  const { teacherProfile, setTeacherProfile, teacherGroups, addTeacherGroup, submitFacultyClubRequest, createNotification, deleteClub, isAppAdmin, userProfile, isSapsCore, adminTestTeacher } = useApp();

  const TIMETABLE_TEAM_NAMES = ['Shruthi', 'Bhoomika', 'Thirupat'];
  const isStudentTimetableTeam = !isAppAdmin && !teacherProfile && userProfile &&
    (userProfile.name?.toLowerCase().includes('hridhya') ||
     TIMETABLE_TEAM_NAMES.some(n => userProfile.name?.toLowerCase().includes(n.toLowerCase())));

  // Superadmin acting as highest-authority teacher (or testing as a specific faculty)
  const effectiveProfile = adminTestTeacher
    ? {
        ...adminTestTeacher,
        isHOD: adminTestTeacher.name?.includes('Hridhya') || !!adminTestTeacher.isHOD,
      }
    : (isAppAdmin && !teacherProfile)
      ? {
          id: userProfile?.id || 'admin',
          name: userProfile?.name || 'Super Admin',
          specialisation: 'Owner',
          isHOD: true,
          hodLabel: 'Founder',
          isSupabaseTeacher: true,
          coordinatorClubIds: [],
        }
      : teacherProfile
        ? { ...teacherProfile, isHOD: teacherProfile.name?.includes('Hridhya') || !!teacherProfile.isHOD }
        : isStudentTimetableTeam
          ? {
              id: userProfile.id,
              name: userProfile.name,
              specialisation: 'Timetable Team',
              isHOD: userProfile.name?.toLowerCase().includes('hridhya'),
              isSupabaseTeacher: true,
              coordinatorClubIds: [],
            }
          : teacherProfile;
  // Teachers log in via PIN (no Supabase session), so isSapsCore is always false for them.
  // Check teacherProfile.position directly as the real-teacher fallback.
  const effectiveSapsCore = adminTestTeacher
    ? !!adminTestTeacher.position?.includes('SAPS')
    : !!(teacherProfile?.position?.includes('SAPS') || isSapsCore);

  if (!effectiveProfile) return null;

  const av = avatarColor(effectiveProfile.name);

  const assignment = mentorAssignments.find(a => a.teacherId === effectiveProfile.id);
  const menteeIds = assignment?.studentIds ?? [];
  const mentees = menteeIds.map(id =>
    id === 0 ? { ...myProfile, id: 0 } : students.find(s => s.id === id)
  ).filter(Boolean);

  const myGroups = teacherGroups.filter(g => g.teacherId === effectiveProfile.id);

  // ── Visit counts ─────────────────────────────────────────────────────────────
  const [visitCounts, setVisitCounts] = useState({});
  const [loggingVisit, setLoggingVisit] = useState(null);

  useEffect(() => { loadVisitCounts(); }, [effectiveProfile.id]);

  const loadVisitCounts = async () => {
    const { data } = await supabase
      .from('mentor_visits')
      .select('student_id')
      .eq('teacher_id', String(effectiveProfile.id));
    if (!data) return;
    const counts = {};
    data.forEach(r => {
      const sid = r.student_id;
      counts[sid] = (counts[sid] || 0) + 1;
    });
    setVisitCounts(counts);
  };

  // ── Log Visit modal ───────────────────────────────────────────────────────────
  const [logVisitModal, setLogVisitModal] = useState(null); // mentee object
  const [logVisitNote, setLogVisitNote] = useState('');

  const openLogVisit = (mentee) => { setLogVisitModal(mentee); setLogVisitNote(''); };

  const handleLogVisit = async (studentId, note = '') => {
    setLoggingVisit(studentId);
    await supabase.from('mentor_visits').insert({
      teacher_id: String(effectiveProfile.id),
      student_id: String(studentId),
      note: note.trim() || null,
    });
    setVisitCounts(prev => ({ ...prev, [String(studentId)]: (prev[String(studentId)] || 0) + 1 }));
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(studentId))) {
      createNotification(String(studentId), 'info', 'Mentor Visit Logged', `${effectiveProfile.name} has logged a mentor visit for you.`);
    }
    setLoggingVisit(null);
    if (logVisitModal) {
      setMenteeVisits(prev => [{ created_at: new Date().toISOString(), note: note.trim() || null }, ...prev]);
      setLogVisitModal(null);
      setLogVisitNote('');
    }
  };

  // ── Announcements ─────────────────────────────────────────────────────────────
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [newAnnounce, setNewAnnounce] = useState({ title: '', body: '' });
  const [announceLoading, setAnnounceLoading] = useState(false);
  const [announceError, setAnnounceError] = useState('');

  useEffect(() => { loadAnnouncements(); }, [effectiveProfile.id]);

  const loadAnnouncements = async () => {
    const { data } = await supabase
      .from('teacher_announcements')
      .select('*')
      .eq('teacher_id', String(effectiveProfile.id))
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setAnnouncements(data);
  };

  const postAnnouncement = async () => {
    if (!newAnnounce.title.trim()) { setAnnounceError('Please enter a title.'); return; }
    setAnnounceLoading(true);
    setAnnounceError('');
    const { data, error } = await supabase.from('teacher_announcements').insert({
      teacher_id: String(effectiveProfile.id),
      teacher_name: effectiveProfile.name,
      title: newAnnounce.title.trim(),
      body: newAnnounce.body.trim() || null,
    }).select().single();
    if (error) { setAnnounceError('Failed to post: ' + error.message); setAnnounceLoading(false); return; }
    setAnnouncements(prev => [data, ...prev]);
    setNewAnnounce({ title: '', body: '' });
    setShowAnnounceModal(false);
    setAnnounceLoading(false);
  };

  // ── Student profile modal ─────────────────────────────────────────────────────
  const [selectedMentee, setSelectedMentee] = useState(null);
  const [menteeVisits, setMenteeVisits] = useState([]);

  // Academic progress (inline in profile modal)
  const [editingProgress, setEditingProgress] = useState(false);
  const [progressCgpa, setProgressCgpa] = useState('');
  const [progressAttendance, setProgressAttendance] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [progressSaving, setProgressSaving] = useState(false);

  // Schedule next session (inline in profile modal)
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleNote, setScheduleNote] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const getMenteeRecord = (mentee) => addedMentees.find(m =>
    (m.user_id && m.user_id === String(mentee?.id)) ||
    m.student_name?.toLowerCase() === mentee?.name?.toLowerCase()
  );

  const openMenteeProfile = async (mentee) => {
    setSelectedMentee(mentee);
    setEditingProgress(false);
    setEditingSchedule(false);
    const { data } = await supabase
      .from('mentor_visits')
      .select('created_at, note')
      .eq('teacher_id', String(effectiveProfile.id))
      .eq('student_id', String(mentee.id))
      .order('created_at', { ascending: false });
    setMenteeVisits(data || []);
    const rec = getMenteeRecord(mentee);
    setProgressCgpa(rec?.cgpa != null ? String(rec.cgpa) : '');
    setProgressAttendance(rec?.attendance_pct != null ? String(rec.attendance_pct) : '');
    setProgressNote(rec?.progress_note || '');
    setScheduleDate(rec?.next_session_date || '');
    setScheduleNote(rec?.next_session_note || '');
  };

  const upsertMenteeRecord = async (mentee, patch) => {
    const rec = getMenteeRecord(mentee);
    if (rec) {
      await supabase.from('teacher_mentees').update(patch).eq('id', rec.id);
      setAddedMentees(prev => prev.map(m => m.id === rec.id ? { ...m, ...patch } : m));
    } else {
      const { data } = await supabase.from('teacher_mentees').insert({
        teacher_id: String(effectiveProfile.id),
        student_name: mentee.name,
        course: mentee.course || null,
        year: mentee.year || null,
        user_id: mentee.isReal ? mentee.id : null,
        ...patch,
      }).select().single();
      if (data) setAddedMentees(prev => [...prev, data]);
    }
  };

  const handleSaveProgress = async () => {
    if (!selectedMentee) return;
    setProgressSaving(true);
    await upsertMenteeRecord(selectedMentee, {
      cgpa: progressCgpa ? parseFloat(progressCgpa) : null,
      attendance_pct: progressAttendance ? parseInt(progressAttendance) : null,
      progress_note: progressNote.trim() || null,
      progress_updated_at: new Date().toISOString(),
    });
    setProgressSaving(false);
    setEditingProgress(false);
  };

  const handleScheduleSession = async () => {
    if (!selectedMentee || !scheduleDate.trim()) return;
    setScheduleSaving(true);
    const patch = {
      next_session_date: scheduleDate.trim(),
      next_session_note: scheduleNote.trim() || null,
    };
    await upsertMenteeRecord(selectedMentee, patch);
    const uuid = selectedMentee.isReal ? String(selectedMentee.id) : null;
    if (uuid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
      createNotification(uuid, 'info', 'Mentor Session Scheduled',
        `${effectiveProfile.name} has scheduled a mentor session for ${scheduleDate.trim()}${scheduleNote.trim() ? ' — ' + scheduleNote.trim() : ''}`);
    }
    setScheduleSaving(false);
    setEditingSchedule(false);
  };

  // ── All students ──────────────────────────────────────────────────────────────
  const mockStudents = [{ ...myProfile, id: 0 }, ...students];
  const [realProfiles, setRealProfiles] = useState([]); // from Supabase
  const [profileUUIDMap, setProfileUUIDMap] = useState({}); // name key → uuid
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    // Load all signed-up profiles to build UUID map and real student list
    supabase.from('profiles').select('id, name, course, year, campus').then(({ data }) => {
      if (!data) return;
      setRealProfiles(data);
      const map = {};
      data.forEach(p => {
        map[p.name.toLowerCase().trim()] = p.id;
        // Also index by first name for partial matches
        const first = p.name.split(' ')[0].toLowerCase().trim();
        if (!map[first]) map[first] = p.id;
      });
      setProfileUUIDMap(map);
    });
  }, []);

  // Merge: show real profiles at top, then mock students not already covered
  const allStudents = (() => {
    const realNames = new Set(realProfiles.map(p => p.name.toLowerCase().trim()));
    const mockOnly = mockStudents.filter(s => !realNames.has(s.name.toLowerCase().trim()));
    return [
      ...realProfiles.map(p => ({ ...p, isReal: true })),
      ...mockOnly.map(s => ({ ...s, isReal: false })),
    ];
  })();

  const filteredStudents = studentSearch.trim()
    ? allStudents.filter(s => {
        const q = studentSearch.toLowerCase();
        return s.name.toLowerCase().includes(q) || (s.course || '').toLowerCase().includes(q) || (s.year || '').toLowerCase().includes(q);
      })
    : allStudents;

  const getUUID = (student) => {
    if (student.isReal) return student.id;
    const byFull = profileUUIDMap[student.name.toLowerCase().trim()];
    if (byFull) return byFull;
    const first = student.name.split(' ')[0].toLowerCase().trim();
    return profileUUIDMap[first] ?? null;
  };

  // ── Notifications ─────────────────────────────────────────────────────────────
  const teacherId = `teacher-${effectiveProfile.id}`;
  const [showTeacherNotifs, setShowTeacherNotifs] = useState(false);
  const [teacherNotifs, setTeacherNotifs] = useState([]);
  const [teacherNotifsUnread, setTeacherNotifsUnread] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const timeAgoT = (ts) => {
    const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const loadTeacherNotifs = async () => {
    setLoadingNotifs(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', teacherId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      setTeacherNotifs(data);
      setTeacherNotifsUnread(data.filter(n => !n.read).length);
    }
    setLoadingNotifs(false);
  };

  useEffect(() => { loadTeacherNotifs(); }, [effectiveProfile.id]);

  // ── Group Invites ─────────────────────────────────────────────────────────────
  const [groupInvites, setGroupInvites] = useState([]);
  const [groupInvitesLoading, setGroupInvitesLoading] = useState(true);

  useEffect(() => {
    if (GROUP_TEACHER_TABLE_EXISTS) loadGroupInvites();
    else setGroupInvitesLoading(false);
  }, [effectiveProfile.id]);

  const loadGroupInvites = async () => {
    try {
      const { data } = await supabase
        .from('group_teacher_requests')
        .select('*')
        .eq('teacher_id', effectiveProfile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setGroupInvites(data || []);
    } catch (_) {}
    setGroupInvitesLoading(false);
  };

  const respondToGroupInvite = async (req, accept) => {
    try {
      await supabase
        .from('group_teacher_requests')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('id', req.id);
    } catch (_) {}
    if (accept) {
      await supabase.from('group_memberships').upsert(
        { group_id: req.group_id, user_id: `teacher-${effectiveProfile.id}` },
        { onConflict: 'group_id,user_id' },
      );
    }
    createNotification(
      req.requested_by,
      'group_invite',
      accept ? `${effectiveProfile.name} joined ${req.group_name}!` : `${effectiveProfile.name} declined your invite`,
      accept
        ? `Your teacher has accepted your invite to "${req.group_name}"`
        : `Your invite to "${req.group_name}" was declined`,
      { group_id: req.group_id },
    );
    setGroupInvites(prev => prev.filter(r => r.id !== req.id));
  };

  const markTeacherNotifRead = async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setTeacherNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setTeacherNotifsUnread(prev => Math.max(0, prev - 1));
  };

  const markAllTeacherNotifsRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', teacherId).eq('read', false);
    setTeacherNotifs(prev => prev.map(n => ({ ...n, read: true })));
    setTeacherNotifsUnread(0);
  };

  const handleTeacherNotifTap = (notif) => {
    if (notif.type !== 'dm') return;
    markTeacherNotifRead(notif.id);
    setShowTeacherNotifs(false);
    const studentUUID = notif.meta?.recipient_id;
    if (studentUUID) {
      const student = realProfiles.find(p => p.id === studentUUID);
      if (student) { openChat({ ...student, isReal: true }); return; }
    }
    const senderName = notif.meta?.sender_name || (notif.title || '').replace('New message from ', '');
    if (senderName) {
      const student = allStudents.find(s => s.name.toLowerCase() === senderName.toLowerCase());
      if (student) openChat(student);
    }
  };

  // ── Chat modal ────────────────────────────────────────────────────────────────
  const [chatMentee, setChatMentee] = useState(null);
  const [chatStudentUUID, setChatStudentUUID] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [uploadingChatMedia, setUploadingChatMedia] = useState(false);
  const chatScrollRef = useRef(null);

  const openChat = async (mentee) => {
    setChatMentee(mentee);
    setChatStudentUUID(null);
    setChatMessages([]);
    setChatLoading(true);

    // Resolve UUID: use pre-loaded map (handles name mismatches)
    const sUUID = getUUID(mentee);
    setChatStudentUUID(sUUID);

    if (sUUID) {
      const [{ data: studentMsgs }, { data: teacherMsgs }] = await Promise.all([
        // Student's messages sent to this teacher
        supabase.from('direct_messages').select('*')
          .eq('sender_id', sUUID)
          .eq('conversation_key', teacherId)
          .order('created_at', { ascending: true }),
        // Teacher's replies to this student
        supabase.from('direct_messages').select('*')
          .eq('sender_id', teacherId)
          .eq('recipient_id', sUUID)
          .order('created_at', { ascending: true }),
      ]);

      const all = [
        ...(studentMsgs || []).map(m => ({ ...m, fromTeacher: false })),
        ...(teacherMsgs || []).map(m => ({ ...m, fromTeacher: true })),
      ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setChatMessages(all);

      // Mark student's messages to teacher as read
      const unreadIds = (studentMsgs || []).filter(m => !m.read).map(m => m.id);
      if (unreadIds.length > 0) {
        supabase.from('direct_messages').update({ read: true }).in('id', unreadIds).then(() => {
          setTeacherUnread(prev => Math.max(0, prev - unreadIds.length));
        });
      }
    }

    setChatLoading(false);
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: false }), 100);
  };

  const sendChatMessage = async (mediaUrl = null) => {
    const text = chatText.trim();
    if (!text && !mediaUrl) return;
    if (!chatMentee || !chatStudentUUID) return;
    const newMsg = {
      id: `local-${Date.now()}`,
      sender_id: teacherId,
      recipient_id: chatStudentUUID,
      text,
      media_url: mediaUrl || null,
      created_at: new Date().toISOString(),
      fromTeacher: true,
    };
    setChatMessages(prev => [...prev, newMsg]);
    if (text) setChatText('');
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 80);
    await supabase.from('direct_messages').insert({
      sender_id: teacherId,
      recipient_id: chatStudentUUID,
      conversation_key: `student-${chatStudentUUID}`,
      text: text || null,
      media_url: mediaUrl || null,
    });
    await supabase.from('notifications').insert({
      user_id: chatStudentUUID,
      type: 'dm',
      title: `New message from ${effectiveProfile.name}`,
      body: mediaUrl ? '📷 Sent a photo' : (text.length > 60 ? text.slice(0, 57) + '…' : text),
      read: false,
      meta: { person_key: teacherId, sender_name: effectiveProfile.name, is_teacher: true },
    });
  };

  const pickTeacherChatMedia = async () => {
    setUploadingChatMedia(true);
    try {
      const url = await pickAndUploadMedia();
      if (url) await sendChatMessage(url);
    } catch (e) {
      alert('Failed to upload image: ' + (e.message || 'Unknown error'));
    } finally {
      setUploadingChatMedia(false);
    }
  };

  // ── Club Administration ───────────────────────────────────────────────────────
  const canApproveClubs = isAppAdmin || effectiveProfile.id === 1 || effectiveProfile.id === 6;
  const [allUserClubs, setAllUserClubs] = useState([]);
  useEffect(() => {
    if (!canApproveClubs) return;
    supabase.from('user_clubs').select('*').order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setAllUserClubs(data.map(c => ({ ...c, fullName: c.full_name || c.name })));
      });
  }, [canApproveClubs]);

  const coordinatedClubs = canApproveClubs
    ? [...hubClubs, ...allUserClubs]
    : (effectiveProfile.coordinatorClubIds || [])
        .map(id => hubClubs.find(c => c.id === id))
        .filter(Boolean);

  const [joinRequests, setJoinRequests] = useState({}); // clubId → requests[]
  const [clubMemberCounts, setClubMemberCounts] = useState({}); // clubId → count
  const [resolvingReq, setResolvingReq] = useState(null);
  const [expandedClub, setExpandedClub] = useState(null);
  const [dashboardClubId, setDashboardClubId] = useState(null);
  const [showTimetablePlanner, setShowTimetablePlanner] = useState(false);

  // ── Club Creation Requests (dept coordinator id=1, SAPS id=6) ─────────────────
  const [clubCreationReqs, setClubCreationReqs] = useState([]);
  const [resolvingClubReq, setResolvingClubReq] = useState(null);
  const { resolveClubCreationRequest } = useApp();

  useEffect(() => {
    if (!canApproveClubs) return;
    supabase.from('club_creation_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setClubCreationReqs(data); });
  }, [canApproveClubs]);

  const handleResolveClubReq = async (req, action) => {
    setResolvingClubReq(req.id);
    try {
      await resolveClubCreationRequest(req, action);
      setClubCreationReqs(prev => prev.filter(r => r.id !== req.id));
    } catch (e) {
      alert('Error: ' + (e.message || 'Could not process request.'));
    } finally {
      setResolvingClubReq(null);
    }
  };

  // ── My Classes Today ─────────────────────────────────────────────────────────
  const todayDay = useMemo(() => {
    const d = new Date().getDay();
    return [null, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d];
  }, []);

  const [todayClasses, setTodayClasses] = useState([]);
  const [todayClassesLoading, setTodayClassesLoading] = useState(true);
  const [scheduleDay, setScheduleDay] = useState(todayDay || 'MON');
  const [scheduleSlots, setScheduleSlots] = useState([]);
  const [scheduleSlotsLoading, setScheduleSlotsLoading] = useState(false);
  const [allPeriodMap, setAllPeriodMap] = useState({});

  // Schedule Absence state
  const [showScheduleAbsence, setShowScheduleAbsence] = useState(false);
  const [absenceDate, setAbsenceDate] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');
  const [absenceSubmitting, setAbsenceSubmitting] = useState(false);

  // Sub request state
  const [subReqSlot, setSubReqSlot] = useState(null);
  const [subReqReason, setSubReqReason] = useState('');
  const [subReqPrefSub, setSubReqPrefSub] = useState('');
  const [subReqSubmitting, setSubReqSubmitting] = useState(false);

  // Rename display name state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renameSubmitting, setRenameSubmitting] = useState(false);

  const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const DAY_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  useEffect(() => {
    if (!todayDay || !effectiveProfile?.name) { setTodayClassesLoading(false); return; }
    const name = effectiveProfile.name;
    (async () => {
      setTodayClassesLoading(true);
      const [slotsRes, periodsRes] = await Promise.all([
        supabase.from('timetable_slots').select('*').eq('day', todayDay).ilike('faculty_name', `%${name}%`),
        supabase.from('timetable_periods').select('*').order('sort_order'),
      ]);
      const periodMap = Object.fromEntries((periodsRes.data || []).map(p => [p.name, p]));
      setAllPeriodMap(periodMap);
      const slots = (slotsRes.data || []).map(s => ({ ...s, periodInfo: periodMap[s.period_name] || null }));
      slots.sort((a, b) => (a.periodInfo?.sort_order ?? 99) - (b.periodInfo?.sort_order ?? 99));
      setTodayClasses(slots);
      setTodayClassesLoading(false);
    })();
  }, [effectiveProfile?.name, todayDay]);

  // Load slots for selected schedule day
  useEffect(() => {
    if (!scheduleDay || !effectiveProfile?.name) return;
    const name = effectiveProfile.name;
    (async () => {
      setScheduleSlotsLoading(true);
      const { data } = await supabase
        .from('timetable_slots').select('*')
        .eq('day', scheduleDay).ilike('faculty_name', `%${name}%`);
      const mapped = (data || []).map(s => ({ ...s, periodInfo: allPeriodMap[s.period_name] || null }));
      mapped.sort((a, b) => (a.periodInfo?.sort_order ?? 99) - (b.periodInfo?.sort_order ?? 99));
      setScheduleSlots(mapped);
      setScheduleSlotsLoading(false);
    })();
  }, [scheduleDay, effectiveProfile?.name, allPeriodMap]);

  const handleScheduleAbsence = async () => {
    if (!absenceDate.trim()) { Alert.alert('Date required', 'Please enter the date.'); return; }
    const parsed = new Date(absenceDate.trim());
    if (isNaN(parsed.getTime())) { Alert.alert('Invalid date', 'Please enter a valid date (YYYY-MM-DD).'); return; }
    const dayName = DAY_OF_WEEK[parsed.getDay()];
    if (dayName === 'SUN') { Alert.alert('Sunday', 'No classes on Sunday.'); return; }
    setAbsenceSubmitting(true);
    try {
      const name = effectiveProfile.name;
      const { data: daySlots } = await supabase
        .from('timetable_slots').select('*')
        .eq('day', dayName).ilike('faculty_name', `%${name}%`);
      if (!daySlots?.length) {
        Alert.alert('No classes', `You have no classes on ${dayName}.`);
        setAbsenceSubmitting(false);
        return;
      }
      const teacherId = teacherProfile?.id || userProfile?.id;
      const now = new Date().toISOString();
      const dateStr = parsed.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
      await Promise.all(daySlots.map(slot =>
        supabase.from('timetable_slots').update({
          course_name: 'Class Cancelled',
          faculty_name: null,
          updated_at: now,
        }).eq('id', slot.id)
      ));
      await supabase.from('timetable_change_log').insert(daySlots.map(slot => ({
        changed_by: teacherId != null ? String(teacherId) : null,
        class_name: slot.class_name,
        day: slot.day,
        period_name: slot.period_name,
        old_faculty: slot.faculty_name || null,
        new_faculty: null,
        reason: absenceReason.trim() || 'Class cancelled — teacher absent',
        change_type: 'cancel',
      })));
      const classNames = [...new Set(daySlots.map(s => s.class_name))];
      for (const cls of classNames) {
        const clsSlots = daySlots.filter(s => s.class_name === cls);
        const { data: students } = await supabase.from('profiles').select('id').eq('class_name', cls);
        const periods = clsSlots.map(s => s.period_name).join(', ');
        for (const st of (students || [])) {
          createNotification(st.id, 'info',
            `Class Cancelled — ${cls}`,
            `${name}'s ${periods} ${clsSlots.length !== 1 ? 'classes are' : 'class is'} cancelled on ${dateStr}.`,
          );
        }
      }
      setShowScheduleAbsence(false);
      setAbsenceDate('');
      setAbsenceReason('');
      Alert.alert('Classes Cancelled', `${daySlots.length} class${daySlots.length !== 1 ? 'es' : ''} cancelled on ${dateStr}. Students have been notified.`);
    } catch {
      Alert.alert('Error', 'Could not cancel. Please try again.');
    } finally {
      setAbsenceSubmitting(false);
    }
  };

  // ── Sub request ───────────────────────────────────────────────────────────────
  const handleSubReqSubmit = async () => {
    if (!subReqReason.trim()) {
      Alert.alert('Reason Required', 'Please enter a reason for your substitute request.');
      return;
    }
    if (!subReqSlot) return;
    setSubReqSubmitting(true);
    try {
      const name = effectiveProfile?.name;
      const teacherId = teacherProfile?.id || userProfile?.id;
      await supabase.from('substitute_requests').insert({
        slot_id: subReqSlot.id || null,
        class_name: subReqSlot.class_name || null,
        day: subReqSlot.day || null,
        period_name: subReqSlot.period_name || null,
        requesting_teacher_id: teacherId != null ? String(teacherId) : null,
        requesting_teacher_name: name,
        reason: subReqReason.trim(),
        preferred_substitute: subReqPrefSub.trim() || null,
        status: 'pending',
      });
      const { data: teamProfiles } = await supabase.from('profiles').select('id, name')
        .or(['Shruti', 'Bhoomika', 'Tirupathi', 'Hridhya'].map(n => `name.ilike.%${n}%`).join(','));
      const slotDesc = `${subReqSlot.course_name || 'a class'} (${subReqSlot.day} ${subReqSlot.period_name})`;
      const msg = `${name} has requested a substitute for ${slotDesc}. Reason: ${subReqReason.trim()}${subReqPrefSub.trim() ? `. Preferred: ${subReqPrefSub.trim()}` : ''}.`;
      (teamProfiles || []).forEach(p =>
        createNotification('teacher-' + p.id, 'info', 'Substitute Request', msg)
      );
      setSubReqSlot(null);
      setSubReqReason('');
      setSubReqPrefSub('');
      Alert.alert('Request Sent', 'Your substitute request has been sent to the timetable team.');
    } catch {
      Alert.alert('Error', 'Could not submit request. Please try again.');
    } finally {
      setSubReqSubmitting(false);
    }
  };

  // ── Rename display name ───────────────────────────────────────────────────────
  const handleSaveName = async () => {
    const trimmed = renameInput.trim();
    if (!trimmed || !effectiveProfile?.id) return;
    setRenameSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: trimmed })
        .eq('id', effectiveProfile.id);
      if (error) throw error;
      setTeacherProfile(prev => prev ? { ...prev, display_name: trimmed } : prev);
      setShowRenameModal(false);
    } catch {
      Alert.alert('Error', 'Could not save name. Please try again.');
    } finally {
      setRenameSubmitting(false);
    }
  };

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('mentoring');

  // ── Tasks (Planner tab) ───────────────────────────────────────────────────────
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', deadline: '', duration_hours: '' });
  const [taskFormError, setTaskFormError] = useState('');
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);

  useEffect(() => { loadTasks(); }, [effectiveProfile.id]);

  const loadTasks = async () => {
    setTasksLoading(true);
    const teacherIdVal = String(effectiveProfile.id);
    console.log('[loadTasks] querying teacher_tasks where teacher_id =', teacherIdVal, '(type: text)');
    const { data, error } = await supabase
      .from('teacher_tasks')
      .select('*')
      .eq('teacher_id', teacherIdVal)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[loadTasks] error:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint);
    } else {
      console.log('[loadTasks] returned', data?.length ?? 0, 'rows');
      if (data) setTasks(data);
    }
    setTasksLoading(false);
  };

  const handleAddTask = async () => {
    if (!taskForm.title.trim()) { setTaskFormError('Please enter a title.'); return; }
    setTaskSubmitting(true);
    setTaskFormError('');
    const hrs = taskForm.duration_hours.trim() ? parseFloat(taskForm.duration_hours) : null;
    try {
      const { data, error } = await supabase.from('teacher_tasks').insert({
        teacher_id: String(effectiveProfile.id),
        title: taskForm.title.trim(),
        deadline: taskForm.deadline.trim() || null,
        duration_hours: Number.isFinite(hrs) ? hrs : null,
        status: 'pending',
      }).select().single();
      if (error) { setTaskFormError('Failed to save: ' + error.message); setTaskSubmitting(false); return; }
      setTasks(prev => [data, ...prev]);
      setTaskForm({ title: '', deadline: '', duration_hours: '' });
      setShowTaskModal(false);
    } catch (_) {}
    setTaskSubmitting(false);
  };

  const updateTaskStatus = async (task, newStatus) => {
    setUpdatingTaskId(task.id);
    try {
      await supabase.from('teacher_tasks').update({ status: newStatus }).eq('id', task.id);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    } catch (_) {}
    setUpdatingTaskId(null);
  };

  const deleteTask = async (id) => {
    setDeletingTaskId(id);
    try {
      await supabase.from('teacher_tasks').delete().eq('id', id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (_) {}
    setDeletingTaskId(null);
  };

  // ── Dynamic mentees (added by teacher via Supabase) ───────────────────────────
  const [addedMentees, setAddedMentees] = useState([]);
  const [showAddMentee, setShowAddMentee] = useState(false);
  const [addingMenteeId, setAddingMenteeId] = useState(null);
  const [removingMenteeId, setRemovingMenteeId] = useState(null);
  const [menteeAddSearch, setMenteeAddSearch] = useState('');

  useEffect(() => { loadAddedMentees(); }, [effectiveProfile.id]);

  const loadAddedMentees = async () => {
    const { data } = await supabase
      .from('teacher_mentees')
      .select('*')
      .eq('teacher_id', String(effectiveProfile.id));
    if (data) setAddedMentees(data);
  };

  const handleAddMentee = async (student) => {
    const sid = student.isReal ? student.id : student.name;
    if (addingMenteeId === sid) return;
    setAddingMenteeId(sid);
    const { data, error } = await supabase.from('teacher_mentees').insert({
      teacher_id: String(effectiveProfile.id),
      student_name: student.name,
      course: student.course || null,
      year: student.year || null,
      user_id: student.isReal ? student.id : null,
    }).select().single();
    if (!error && data) setAddedMentees(prev => [...prev, data]);
    setAddingMenteeId(null);
  };

  const handleRemoveMentee = async (record) => {
    setRemovingMenteeId(record.id);
    await supabase.from('teacher_mentees').delete().eq('id', record.id);
    setAddedMentees(prev => prev.filter(m => m.id !== record.id));
    setRemovingMenteeId(null);
  };

  // Merged mentee list: static + dynamic (no duplicates)
  const staticMenteeNames = new Set(mentees.map(s => s.name.toLowerCase()));
  const dynamicMentees = addedMentees
    .filter(m => !staticMenteeNames.has(m.student_name.toLowerCase()))
    .map(m => {
      const found = allStudents.find(s =>
        (m.user_id && s.id === m.user_id) ||
        s.name.toLowerCase() === m.student_name.toLowerCase()
      );
      const extra = { _menteeRecordId: m.id, isDynamic: true, next_session_date: m.next_session_date || null };
      return found
        ? { ...found, ...extra }
        : { id: m.id, name: m.student_name, course: m.course, year: m.year, ...extra };
    });
  const allMentees = [...mentees, ...dynamicMentees];

  // IDs/names already in mentor group (for "Add Mentee" modal check)
  const menteeSet = new Set([
    ...menteeIds.map(String),
    ...addedMentees.map(m => m.student_name.toLowerCase()),
  ]);
  const isAlreadyMentee = (student) =>
    menteeIds.includes(student.id) ||
    addedMentees.some(m =>
      (m.user_id && m.user_id === student.id) ||
      m.student_name.toLowerCase() === student.name.toLowerCase()
    );

  const menteeAddFiltered = menteeAddSearch.trim()
    ? allStudents.filter(s => s.name.toLowerCase().includes(menteeAddSearch.toLowerCase()) ||
        (s.course || '').toLowerCase().includes(menteeAddSearch.toLowerCase()))
    : allStudents;

  const loadClubData = async (clubId) => {
    const [{ data: reqs }, { count }] = await Promise.all([
      supabase.from('club_join_requests').select('*').eq('club_id', clubId).eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('club_memberships').select('id', { count: 'exact', head: true }).eq('club_id', clubId),
    ]);
    setJoinRequests(prev => ({ ...prev, [clubId]: reqs || [] }));
    setClubMemberCounts(prev => ({ ...prev, [clubId]: count || 0 }));
  };

  const resolveRequest = async (req, action) => {
    setResolvingReq(req.id);
    if (action === 'approve') {
      await supabase.from('club_memberships').insert({ user_id: req.user_id, club_id: req.club_id, club_name: req.club_name });
      setClubMemberCounts(prev => ({ ...prev, [req.club_id]: (prev[req.club_id] || 0) + 1 }));
    }
    await supabase.from('club_join_requests').update({ status: action === 'approve' ? 'approved' : 'rejected' }).eq('id', req.id);
    setJoinRequests(prev => ({ ...prev, [req.club_id]: (prev[req.club_id] || []).filter(r => r.id !== req.id) }));
    setResolvingReq(null);
  };

  const toggleClub = (clubId) => {
    if (expandedClub === clubId) { setExpandedClub(null); return; }
    setExpandedClub(clubId);
    loadClubData(clubId);
  };

  // ── Study group create ────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', desc: '', emoji: '📚', visibleTo: [...ALL_COURSES] });

  const toggleCourse = (course) => {
    setNewGroup(prev => {
      const next = prev.visibleTo.includes(course)
        ? prev.visibleTo.filter(c => c !== course)
        : [...prev.visibleTo, course];
      return { ...prev, visibleTo: next.length === 0 ? [course] : next };
    });
  };

  const handleCreate = () => {
    if (!newGroup.name.trim()) { alert('Please enter a group name.'); return; }
    addTeacherGroup({
      id: Date.now(),
      name: newGroup.name.trim(),
      desc: newGroup.desc.trim() || `A study group for ${newGroup.name.trim()}.`,
      emoji: newGroup.emoji,
      visibleTo: newGroup.visibleTo,
      course: newGroup.visibleTo.length === 3 ? 'All' : newGroup.visibleTo[0],
      members: menteeIds.length + 1,
      active: true,
      recentMessages: [],
      createdByTeacher: true,
      teacherName: effectiveProfile.name,
      teacherId: effectiveProfile.id,
    });
    setNewGroup({ name: '', desc: '', emoji: '📚', visibleTo: [...ALL_COURSES] });
    setShowCreate(false);
  };

  // ── Subject requests ─────────────────────────────────────────────────────────
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectClass, setSubjectClass] = useState(null);
  const [subjectError, setSubjectError] = useState('');
  const [subjectSubmitting, setSubjectSubmitting] = useState(false);
  const [subjectRequests, setSubjectRequests] = useState([]);
  const [resolvingSubject, setResolvingSubject] = useState(null);

  // ── Event approvals ────────────────────────────────────────────────────────────
  const [pendingEventApprovals, setPendingEventApprovals] = useState([]);
  const [resolvingEvent, setResolvingEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventEditForm, setEventEditForm] = useState({ event_name: '', description: '', start_time: '', end_time: '' });
  const [eventEditSaving, setEventEditSaving] = useState(false);

  const isEventApprover = isAppAdmin
    || effectiveProfile.isHOD === true
    || !!effectiveSapsCore
    || (effectiveProfile.coordinatorClubIds || []).length > 0;

  useEffect(() => {
    if (!isEventApprover) return;
    loadEventApprovals();
  }, [isEventApprover]);

  const loadEventApprovals = async () => {
    let query = supabase.from('club_events').select('*');
    if (isAppAdmin && !adminTestTeacher) {
      query = query.in('status', ['pending_faculty_coordinator', 'pending_saps', 'pending_hod']);
    } else if (effectiveProfile.isHOD === true) {
      query = query.eq('status', 'pending_hod');
    } else if (effectiveSapsCore) {
      query = query.eq('status', 'pending_saps');
    } else {
      const myClubIds = (effectiveProfile.coordinatorClubIds || []).map(String);
      if (!myClubIds.length) return;
      query = query.eq('status', 'pending_faculty_coordinator').in('club_id', myClubIds);
    }
    const { data } = await query.order('created_at', { ascending: false });
    setPendingEventApprovals(data || []);
  };

  const applyEventOverride = async (ev) => {
    const editorId = typeof (userProfile?.id) === 'string' ? userProfile.id : null;
    console.log('[applyEventOverride] (1) affected_slots:', JSON.stringify(ev.affected_slots));
    let hedSkipped = false;
    for (const slotRef of (ev.affected_slots || [])) {
      if (slotRef.day === 'TUE' && slotRef.period_name === 'P2' && HED_CLASSES.has(slotRef.class_name)) {
        hedSkipped = true;
        continue;
      }
      const { data: slot } = await supabase.from('timetable_slots')
        .select('id, course_name, faculty_name').eq('class_name', slotRef.class_name)
        .eq('day', slotRef.day).eq('period_name', slotRef.period_name).maybeSingle();
      if (slot?.id) {
        // overridden_by_event is not a column in timetable_slots — omit it to avoid 400.
        // The change_log row below captures the original values for audit/restore.
        const patchPayload = {
          course_name: ev.event_name,
          faculty_name: null,
          updated_at: new Date().toISOString(),
        };
        console.log('[applyEventOverride] (2) updating slot id:', slot.id,
          '| match:', slotRef.class_name, slotRef.day, slotRef.period_name,
          '| payload:', JSON.stringify(patchPayload));
        const { data: patchData, error: patchErr } = await supabase
          .from('timetable_slots').update(patchPayload).eq('id', slot.id).select();
        console.log('[applyEventOverride] (2) response — data:', JSON.stringify(patchData),
          '| error:', patchErr ? JSON.stringify(patchErr) : null);
        const { data: evLogRow } = await supabase.from('timetable_change_log').insert({
          changed_by: editorId,
          class_name: slotRef.class_name, day: slotRef.day, period_name: slotRef.period_name,
          old_faculty: slot.faculty_name, new_faculty: null,
          reason: `Club Event Override: ${ev.event_name}`, change_type: 'event_override',
        }).select('id').single();
        if (slot.faculty_name) {
          createCompensatoryRequest(supabase, {
            changeLogId: evLogRow?.id || null,
            teacherName: slot.faculty_name,
            className: slotRef.class_name,
            day: slotRef.day,
            periodName: slotRef.period_name,
          }).catch(e => console.warn('[CompReq] event override error:', e.message));
        }
      } else {
        console.warn('[applyEventOverride] no timetable_slots row found for',
          slotRef.class_name, slotRef.day, slotRef.period_name);
      }
    }
    if (hedSkipped) {
      Alert.alert('Partial Override', 'TUE P2 is reserved for HED and was not overridden.');
    }
    const firstSlot = (ev.affected_slots || [])[0];
    if (firstSlot) {
      const { data: check } = await supabase.from('timetable_slots')
        .select('course_name, faculty_name')
        .eq('class_name', firstSlot.class_name)
        .eq('day', firstSlot.day)
        .eq('period_name', firstSlot.period_name)
        .maybeSingle();
      console.log('[applyEventOverride] (3) re-fetch confirm —',
        firstSlot.class_name, firstSlot.day, firstSlot.period_name,
        '| course_name:', check?.course_name, '| faculty_name:', check?.faculty_name);
    }
    // Insert into hub_events so the approved event appears on the student Hub.
    const dateStr = ev.event_date || '';
    const [yyyy, mm, dd] = dateStr.split('-');
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const displayDate = (yyyy && mm && dd)
      ? `${parseInt(dd, 10)} ${monthNames[parseInt(mm, 10) - 1]}`
      : dateStr;
    const hubTime = ev.start_time ? `${displayDate} · ${ev.start_time}` : displayDate;
    const { data: hubRow, error: hubErr } = await supabase.from('hub_events').insert({
      club_id: String(ev.club_id),
      title: ev.event_name,
      description: ev.description || null,
      time: hubTime,
      venue: null,
      when: 'upcoming',
      interested: 0,
      is_recruitment: false,
    }).select().single();
    console.log('[applyEventOverride] hub_events insert — data:', JSON.stringify(hubRow),
      '| error:', hubErr ? JSON.stringify(hubErr) : null);
    if (ev.created_by) {
      await createNotification(ev.created_by, 'info', 'Event Approved',
        `Your event "${ev.event_name}" on ${ev.event_date} has been approved and applied to the timetable.`);
    }
  };

  const handleApproveEvent = async (ev) => {
    setResolvingEvent(ev.id);
    try {
      let nextStatus;
      if (ev.status === 'pending_hod') {
        nextStatus = 'approved';
      } else if (ev.status === 'pending_saps') {
        nextStatus = 'pending_hod';
      } else {
        nextStatus = 'pending_saps';
      }
      console.log('[handleApproveEvent] (1) id:', ev.id, '| status BEFORE:', ev.status);
      console.log('[handleApproveEvent] (2) setting status TO:', nextStatus);
      const { data: updateData, error: updateErr } = await supabase
        .from('club_events')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', ev.id)
        .select();
      console.log('[handleApproveEvent] (3) update response — data:', JSON.stringify(updateData), '| error:', updateErr ? JSON.stringify(updateErr) : null);
      if (updateErr) throw updateErr;
      const { data: refetch } = await supabase.from('club_events').select('id, status').eq('id', ev.id).single();
      console.log('[handleApproveEvent] (4) re-fetched status:', refetch?.status, '| id:', refetch?.id);

      if (nextStatus === 'approved') {
        await applyEventOverride(ev);
      } else if (nextStatus === 'pending_saps') {
        const slotsDesc = (ev.affected_slots || []).map(s => `${s.class_name} ${s.period_name}${s.course_name ? ` (${s.course_name})` : ''}`).join(', ');
        // Seed teachers (PIN login) have no profiles row — cp will be null; skip notification silently.
        const { data: cp } = await supabase.from('profiles').select('id').ilike('name', '%Monika%').maybeSingle();
        if (cp?.id) await createNotification(cp.id, 'info', 'Event Approval Needed',
          `Faculty coordinator approved "${ev.event_name}" (${ev.event_date}). Affected: ${slotsDesc || 'none'}. Please review.`);
      } else if (nextStatus === 'pending_hod') {
        const slotsDesc = (ev.affected_slots || []).map(s => `${s.class_name} ${s.period_name}${s.course_name ? ` (${s.course_name})` : ''}`).join(', ');
        // Same — Hridhya is a seed teacher with no profiles row.
        const { data: cp } = await supabase.from('profiles').select('id').ilike('name', '%Hridhya%').maybeSingle();
        if (cp?.id) await createNotification(cp.id, 'info', 'Event Approval Needed',
          `SAPS approved "${ev.event_name}" (${ev.event_date}). Affected: ${slotsDesc || 'none'}. Awaiting your final approval.`);
      }
      setPendingEventApprovals(prev => prev.filter(e => e.id !== ev.id));
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not approve event.');
    } finally {
      setResolvingEvent(null);
    }
  };

  const handleRejectEvent = async (ev) => {
    setResolvingEvent(ev.id);
    try {
      await supabase.from('club_events').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', ev.id);
      if (ev.created_by) {
        await createNotification(ev.created_by, 'info', 'Event Request Not Approved',
          `Your event "${ev.event_name}" on ${ev.event_date} was not approved.`);
      }
      setPendingEventApprovals(prev => prev.filter(e => e.id !== ev.id));
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not reject event.');
    } finally {
      setResolvingEvent(null);
    }
  };

  const handleEditEventSave = async () => {
    if (!editingEvent || !eventEditForm.event_name.trim()) return;
    setEventEditSaving(true);
    try {
      await supabase.from('club_events').update({
        event_name: eventEditForm.event_name.trim(),
        description: eventEditForm.description.trim() || null,
        start_time: eventEditForm.start_time || editingEvent.start_time,
        end_time: eventEditForm.end_time || editingEvent.end_time,
        updated_at: new Date().toISOString(),
      }).eq('id', editingEvent.id);
      setPendingEventApprovals(prev => prev.map(e => e.id === editingEvent.id
        ? { ...e, event_name: eventEditForm.event_name.trim(), description: eventEditForm.description.trim() || null, start_time: eventEditForm.start_time || e.start_time, end_time: eventEditForm.end_time || e.end_time }
        : e));
      setEditingEvent(null);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not save edits.');
    } finally {
      setEventEditSaving(false);
    }
  };

  useEffect(() => {
    if (isAppAdmin || effectiveProfile.id === 1) loadSubjectRequests();
  }, []);

  const loadSubjectRequests = async () => {
    const { data } = await supabase.from('subject_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    setSubjectRequests(data || []);
  };

  const handleSubjectRequest = async () => {
    if (!subjectName.trim() || !subjectCode.trim() || !subjectClass) {
      setSubjectError('All three fields are required.');
      return;
    }
    setSubjectSubmitting(true);
    setSubjectError('');
    try {
      const meta = metaFromClass(subjectClass);
      await supabase.from('subject_requests').insert({
        subject_name: subjectName.trim(),
        subject_code: subjectCode.trim(),
        class: subjectClass,
        programme: meta.programme,
        semester: meta.semester,
        requested_by: effectiveProfile.isSupabaseTeacher ? effectiveProfile.id : null,
        requester_name: effectiveProfile.name,
        status: 'pending',
      });
      setShowSubjectModal(false);
      setSubjectName('');
      setSubjectCode('');
      setSubjectClass(null);
      // Notify super admins + Department Coordinator
      const subjectNotifTitle = 'New Subject Request';
      const subjectNotifBody = `${effectiveProfile.name} requested to add "${subjectName.trim()}" (${subjectCode.trim()}).`;
      supabase.from('profiles').select('id').eq('is_super_admin', true).then(({ data: admins }) => {
        for (const admin of (admins || [])) {
          createNotification(admin.id, 'info', subjectNotifTitle, subjectNotifBody);
        }
      });
      createNotification('teacher-1', 'info', subjectNotifTitle, subjectNotifBody);
    } catch (e) {
      setSubjectError(e.message || 'Could not submit request.');
    } finally {
      setSubjectSubmitting(false);
    }
  };

  const resolveSubjectRequest = async (req, action) => {
    setResolvingSubject(req.id);
    try {
      if (action === 'approved') {
        const meta = metaFromClass(req.class);
        await supabase.from('subjects').insert({
          name: req.subject_name,
          code: req.subject_code,
          class: req.class,
          programme: meta.programme,
          semester: meta.semester,
          status: 'active',
          created_by: null,
        });
        if (req.requested_by) {
          await supabase.from('notifications').insert({
            user_id: req.requested_by, type: 'info',
            title: 'Subject Request Approved',
            body: `"${req.subject_name}" (${req.subject_code}) has been approved and added to the subjects list.`,
            read: false,
          });
        }
      } else {
        if (req.requested_by) {
          await supabase.from('notifications').insert({
            user_id: req.requested_by, type: 'info',
            title: 'Subject Request Rejected',
            body: `Your request for "${req.subject_name}" was not approved.`,
            read: false,
          });
        }
      }
      await supabase.from('subject_requests').update({ status: action === 'approved' ? 'approved' : 'rejected' }).eq('id', req.id);
      setSubjectRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (e) {
      window.alert('Error: ' + (e.message || 'Could not process request.'));
    } finally {
      setResolvingSubject(null);
    }
  };

  // ── My Subjects ──────────────────────────────────────────────────────────────
  const [mySubjects, setMySubjects] = useState([]);
  const [mySubjectsLoading, setMySubjectsLoading] = useState(false);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [allActiveSubjects, setAllActiveSubjects] = useState([]);
  const [addingSubjectId, setAddingSubjectId] = useState(null);
  const [removingSubjectId, setRemovingSubjectId] = useState(null);

  useEffect(() => {
    if (effectiveProfile.isSupabaseTeacher) loadMySubjects();
  }, [effectiveProfile.id]);

  const loadMySubjects = async () => {
    setMySubjectsLoading(true);
    try {
      const { data: tsRows } = await supabase
        .from('teacher_subjects')
        .select('id, subject_id')
        .eq('teacher_id', effectiveProfile.id);

      if (tsRows && tsRows.length > 0) {
        const ids = tsRows.map(r => r.subject_id);
        const { data: subjectsData } = await supabase
          .from('subjects')
          .select('id, name, code, class')
          .in('id', ids);
        setMySubjects(
          (tsRows).map(ts => ({
            _recordId: ts.id,
            ...((subjectsData || []).find(s => s.id === ts.subject_id) || { id: ts.subject_id }),
          }))
        );
      } else {
        setMySubjects([]);
      }
    } catch (_) {
      setMySubjects([]);
    }
    setMySubjectsLoading(false);
  };

  const openAddSubjectModal = async () => {
    const { data } = await supabase
      .from('subjects')
      .select('id, name, code, class')
      .eq('status', 'active')
      .order('name', { ascending: true });
    setAllActiveSubjects(data || []);
    setShowAddSubjectModal(true);
  };

  const handleAddSubject = async (subject) => {
    if (addingSubjectId === subject.id) return;
    setAddingSubjectId(subject.id);
    try {
      const { data, error } = await supabase
        .from('teacher_subjects')
        .insert({ teacher_id: effectiveProfile.id, subject_id: subject.id })
        .select('id')
        .single();
      if (!error && data) {
        setMySubjects(prev => [...prev, { _recordId: data.id, ...subject }]);
      }
    } catch (_) {}
    setAddingSubjectId(null);
  };

  const handleRemoveSubject = async (record) => {
    setRemovingSubjectId(record._recordId);
    try {
      await supabase.from('teacher_subjects').delete().eq('id', record._recordId);
      setMySubjects(prev => prev.filter(s => s._recordId !== record._recordId));
    } catch (_) {}
    setRemovingSubjectId(null);
  };

  // ── Faculty coordinator ────────────────────────────────────────────────────────
  const [myRequests, setMyRequests] = useState([]);
  const [showClubRequest, setShowClubRequest] = useState(false);
  const [selectedClub, setSelectedClub] = useState(null);
  const [clubReason, setClubReason] = useState('');
  const [clubRequestError, setClubRequestError] = useState('');
  const [clubRequestLoading, setClubRequestLoading] = useState(false);

  useEffect(() => {
    supabase
      .from('faculty_club_requests')
      .select('*')
      .eq('teacher_id', String(effectiveProfile.id))
      .order('created_at', { ascending: false })
      .then(({ data }) => setMyRequests(data || []));
  }, [effectiveProfile.id]);

  const handleClubRequest = async () => {
    if (!selectedClub) { setClubRequestError('Please select a club.'); return; }
    if (!clubReason.trim()) { setClubRequestError('Please provide a reason.'); return; }
    const alreadyPending = myRequests.find(
      r => r.club_id === String(selectedClub.id) && r.status === 'pending'
    );
    if (alreadyPending) { setClubRequestError('You already have a pending request for this club.'); return; }
    setClubRequestLoading(true);
    setClubRequestError('');
    try {
      await submitFacultyClubRequest({
        teacherId: effectiveProfile.id,
        teacherName: effectiveProfile.name,
        clubId: selectedClub.id,
        clubName: selectedClub.fullName,
        reason: clubReason.trim(),
      });
      const { data } = await supabase
        .from('faculty_club_requests')
        .select('*')
        .eq('teacher_id', String(effectiveProfile.id))
        .order('created_at', { ascending: false });
      setMyRequests(data || []);
      setShowClubRequest(false);
      setSelectedClub(null);
      setClubReason('');
    } catch (e) {
      setClubRequestError(e.message || 'Failed to submit request.');
    } finally {
      setClubRequestLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkIcon}>✦</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.teacherName} numberOfLines={1}>{effectiveProfile.display_name || effectiveProfile.name}</Text>
              {effectiveProfile.isSupabaseTeacher && (
                <TouchableOpacity
                  onPress={() => { setRenameInput(effectiveProfile.display_name || effectiveProfile.name || ''); setShowRenameModal(true); }}
                  activeOpacity={0.7}
                  style={{ marginLeft: 6, padding: 2 }}
                >
                  <Text style={{ fontSize: 13, color: colors.textTertiary }}>✏️</Text>
                </TouchableOpacity>
              )}
              {effectiveProfile.isHOD === true && (
                <View style={styles.hodBadge}><Text style={styles.hodBadgeText}>{effectiveProfile.hodLabel || 'HOD'}</Text></View>
              )}
            </View>
            <Text style={styles.teacherSpec} numberOfLines={1}>{effectiveProfile.specialisation}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TouchableOpacity onPress={() => { setShowTeacherNotifs(true); loadTeacherNotifs(); }} activeOpacity={0.7}>
            <View>
              <Text style={{ fontSize: 20 }}>🔔</Text>
              {teacherNotifsUnread > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{teacherNotifsUnread > 9 ? '9+' : teacherNotifsUnread}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          {onClose ? (
            <TouchableOpacity style={styles.signOutBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.signOutText}>← Back</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut} activeOpacity={0.8}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Tab Bar ─────────────────────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        {[
          { key: 'mentoring', label: '🎓 Mentoring' },
          { key: 'clubs',     label: '🏛️ Clubs' },
          { key: 'timetable', label: '📅 Timetable' },
          { key: 'planner',   label: '📋 Planner' },
          { key: 'docs',      label: '📄 Docs' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Timetable tab — takes full remaining height ─────────────────────── */}
      {activeTab === 'timetable' ? (
        <TimetablePlannerScreen embedded />
      ) : activeTab === 'docs' ? (
        <DocumentationScreen
          effectiveProfile={effectiveProfile}
          effectiveSapsCore={effectiveSapsCore}
          userProfile={userProfile}
          createNotification={createNotification}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* ══ MY SCHEDULE ═════════════════════════════════════════════════════ */}
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={styles.sectionLabel}>🗓️ MY SCHEDULE</Text>
              <TouchableOpacity
                onPress={() => setShowScheduleAbsence(true)}
                activeOpacity={0.8}
                style={{ backgroundColor: colors.red + '18', borderWidth: 1, borderColor: colors.red, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
              >
                <Text style={{ fontSize: 12, color: colors.red, fontWeight: '600' }}>+ Cancel Classes</Text>
              </TouchableOpacity>
            </View>

            {/* Day picker */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {DAY_LABELS.map(d => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setScheduleDay(d)}
                    activeOpacity={0.7}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                      backgroundColor: scheduleDay === d ? colors.primary : colors.card,
                      borderWidth: 1, borderColor: scheduleDay === d ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: scheduleDay === d ? '#fff' : colors.textSecondary }}>
                      {d}{d === todayDay ? ' ·' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Slots for selected day */}
            {scheduleSlotsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
            ) : scheduleSlots.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={styles.emptyText}>No classes on {scheduleDay}</Text>
              </View>
            ) : (
              scheduleSlots.map((slot, idx) => (
                <View key={`${slot.class_name}-${slot.period_name}-${idx}`} style={styles.todayClassCard}>
                  <View style={styles.todayClassPeriodBadge}>
                    <Text style={styles.todayClassPeriodText}>{slot.period_name}</Text>
                    {slot.periodInfo?.start_time ? (
                      <Text style={styles.todayClassTime}>{slot.periodInfo.start_time}</Text>
                    ) : null}
                  </View>
                  <View style={styles.todayClassBody}>
                    <Text style={styles.todayClassName}>{slot.class_name}</Text>
                    {slot.course_name ? (
                      <Text style={styles.todayClassSubject} numberOfLines={1}>{slot.course_name}</Text>
                    ) : null}
                  </View>
                  {scheduleDay === todayDay && (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green, alignSelf: 'center', marginRight: 6 }} />
                  )}
                  <TouchableOpacity
                    style={{ backgroundColor: colors.primary + '18', borderWidth: 1, borderColor: colors.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}
                    onPress={() => { setSubReqSlot(slot); setSubReqReason(''); setSubReqPrefSub(''); }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>Request Sub</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* ══ MENTORING TAB ═══════════════════════════════════════════════════ */}
          {activeTab === 'mentoring' && (
            <>
              {/* Group Invites */}
              {(groupInvitesLoading || groupInvites.length > 0) && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>📬 GROUP INVITES ({groupInvites.length})</Text>
                  {groupInvitesLoading ? (
                    <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
                  ) : (
                    groupInvites.map(req => (
                      <View key={req.id} style={styles.groupInviteCard}>
                        <Text style={styles.groupInviteEmoji}>{req.group_emoji || '📚'}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.groupInviteName}>{req.group_name}</Text>
                          <Text style={styles.groupInviteMeta}>Requested by {req.requester_name}</Text>
                        </View>
                        <View style={styles.groupInviteActions}>
                          <TouchableOpacity
                            style={styles.groupInviteDeclineBtn}
                            onPress={() => respondToGroupInvite(req, false)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.groupInviteDeclineText}>Decline</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.groupInviteAcceptBtn}
                            onPress={() => respondToGroupInvite(req, true)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.groupInviteAcceptText}>Accept</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* Mentor Group */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>
                    🎓 MY MENTOR GROUP{assignment ? ` · ${assignment.course} Group ${assignment.group}` : ''}
                    {allMentees.length > 0 ? ` (${allMentees.length})` : ''}
                  </Text>
                  <TouchableOpacity
                    style={styles.createBtn}
                    onPress={() => { setShowAddMentee(true); setMenteeAddSearch(''); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.createBtnText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
                {allMentees.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyIcon}>👥</Text>
                    <Text style={styles.emptyText}>No mentees yet</Text>
                    <Text style={styles.emptyHint}>Tap "+ Add" to build your mentor group</Text>
                    <TouchableOpacity
                      style={[styles.createBtn, { marginTop: 12, alignSelf: 'center' }]}
                      onPress={() => { setShowAddMentee(true); setMenteeAddSearch(''); }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.createBtnText}>+ Add your first mentee</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  allMentees.map(s => (
                    <MenteeCard
                      key={s._menteeRecordId ?? s.id}
                      student={s}
                      visitCount={visitCounts[String(s.id)] ?? 0}
                      loggingVisit={loggingVisit === s.id}
                      onLogVisit={() => openLogVisit(s)}
                      onViewProfile={() => openMenteeProfile(s)}
                      onOpenChat={() => openChat(s)}
                      isDynamic={!!s.isDynamic}
                      removing={removingMenteeId === s._menteeRecordId}
                      onRemove={s.isDynamic ? () => handleRemoveMentee({ id: s._menteeRecordId }) : null}
                      nextSession={getMenteeRecord(s)?.next_session_date}
                    />
                  ))
                )}
              </View>

              {/* All Students */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>👥 ALL STUDENTS ({allStudents.length}{realProfiles.length > 0 ? ` · ${realProfiles.length} signed up` : ''})</Text>
                <View style={styles.searchBar}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    value={studentSearch}
                    onChangeText={setStudentSearch}
                    placeholder="Search by name, course or year…"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.searchInput}
                  />
                  {studentSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setStudentSearch('')} activeOpacity={0.7}>
                      <Text style={{ fontSize: 14, color: colors.textTertiary, paddingHorizontal: 4 }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {filteredStudents.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyIcon}>🔍</Text>
                    <Text style={styles.emptyText}>No students match your search</Text>
                  </View>
                ) : (
                  filteredStudents.map((s, i) => {
                    const isMentee = isAlreadyMentee(s);
                    return (
                      <StudentRow
                        key={s.id ?? s.name + i}
                        student={s}
                        isMentee={isMentee}
                        isReal={!!s.isReal}
                        onViewProfile={() => openMenteeProfile(s)}
                        onOpenChat={() => openChat(s)}
                      />
                    );
                  })
                )}
              </View>

              {/* Announcements */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>📢 ANNOUNCEMENTS ({announcements.length})</Text>
                  <TouchableOpacity
                    style={styles.createBtn}
                    onPress={() => { setShowAnnounceModal(true); setAnnounceError(''); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.createBtnText}>+ Post</Text>
                  </TouchableOpacity>
                </View>
                {announcements.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyIcon}>📢</Text>
                    <Text style={styles.emptyText}>No announcements yet</Text>
                    <Text style={styles.emptyHint}>Post an update for your mentor group</Text>
                  </View>
                ) : (
                  announcements.map(a => <AnnouncementCard key={a.id} item={a} />)
                )}
              </View>
            </>
          )}

          {/* ══ CLUBS TAB ═══════════════════════════════════════════════════════ */}
          {activeTab === 'clubs' && (
            <>
              {/* ── Event Approvals ── */}
              {isEventApprover && (
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionLabel}>📅 EVENT APPROVALS ({pendingEventApprovals.length})</Text>
                    <TouchableOpacity style={styles.createBtn} onPress={loadEventApprovals} activeOpacity={0.8}>
                      <Text style={styles.createBtnText}>↺ Refresh</Text>
                    </TouchableOpacity>
                  </View>
                  {pendingEventApprovals.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyIcon}>🎉</Text>
                      <Text style={styles.emptyText}>No pending event approvals</Text>
                    </View>
                  ) : pendingEventApprovals.map(ev => (
                    <View key={ev.id} style={styles.eventApprovalCard}>
                      <View style={styles.eventApprovalTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.eventApprovalName}>{ev.event_name}</Text>
                          <Text style={styles.eventApprovalMeta}>
                            {ev.event_date}  ·  {ev.start_time}–{ev.end_time}  ·  Club {ev.club_id}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.eventEditBtn}
                          onPress={() => { setEditingEvent(ev); setEventEditForm({ event_name: ev.event_name, description: ev.description || '', start_time: ev.start_time, end_time: ev.end_time }); }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.eventEditBtnText}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                      {ev.description ? <Text style={styles.eventApprovalDesc}>{ev.description}</Text> : null}
                      {(ev.affected_slots || []).length > 0 && (
                        <View style={styles.affectedSlotsBox}>
                          <Text style={styles.affectedSlotsLabel}>AFFECTED SLOTS</Text>
                          {(ev.affected_slots || []).map((s, i) => (
                            <Text key={i} style={styles.affectedSlotRow}>
                              · {s.class_name} — {s.day} {s.period_name}{s.course_name ? `: ${s.course_name}` : ''}
                            </Text>
                          ))}
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                        <TouchableOpacity
                          style={[styles.createBtn, { flex: 1, alignItems: 'center', borderColor: colors.red, borderWidth: 1, backgroundColor: 'transparent' }, resolvingEvent === ev.id && { opacity: 0.5 }]}
                          onPress={() => handleRejectEvent(ev)}
                          disabled={resolvingEvent === ev.id}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.createBtnText, { color: colors.red }]}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.createBtn, { flex: 1, alignItems: 'center', backgroundColor: colors.green, borderColor: colors.green }, resolvingEvent === ev.id && { opacity: 0.5 }]}
                          onPress={() => handleApproveEvent(ev)}
                          disabled={resolvingEvent === ev.id}
                          activeOpacity={0.8}
                        >
                          {resolvingEvent === ev.id
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={[styles.createBtnText, { color: '#fff' }]}>
                                {ev.status === 'pending_hod' ? 'Approve & Apply' : ev.status === 'pending_saps' ? 'Forward to HOD' : 'Approve & Forward to SAPS'}
                              </Text>
                          }
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* ── Event Edit Modal ── */}
              <Modal visible={!!editingEvent} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                  <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>✏️ Edit Event</Text>
                      <TouchableOpacity onPress={() => setEditingEvent(null)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
                    </View>
                    <Text style={styles.fieldLabel}>EVENT NAME</Text>
                    <TextInput
                      value={eventEditForm.event_name}
                      onChangeText={t => setEventEditForm(f => ({ ...f, event_name: t }))}
                      style={styles.textInput}
                      placeholderTextColor={colors.textTertiary}
                    />
                    <Text style={styles.fieldLabel}>DESCRIPTION</Text>
                    <TextInput
                      value={eventEditForm.description}
                      onChangeText={t => setEventEditForm(f => ({ ...f, description: t }))}
                      style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                      multiline
                      placeholderTextColor={colors.textTertiary}
                    />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>START TIME</Text>
                        <TextInput
                          value={eventEditForm.start_time}
                          onChangeText={t => setEventEditForm(f => ({ ...f, start_time: t }))}
                          style={styles.textInput}
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric" maxLength={5}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>END TIME</Text>
                        <TextInput
                          value={eventEditForm.end_time}
                          onChangeText={t => setEventEditForm(f => ({ ...f, end_time: t }))}
                          style={styles.textInput}
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric" maxLength={5}
                        />
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.submitBtn, eventEditSaving && { opacity: 0.6 }]}
                      onPress={handleEditEventSave}
                      disabled={eventEditSaving}
                      activeOpacity={0.85}
                    >
                      {eventEditSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Changes</Text>}
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </Modal>

              {/* My Subjects — only shown for Supabase-authenticated teachers */}
              {effectiveProfile.isSupabaseTeacher && (
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionLabel}>📖 MY SUBJECTS ({mySubjects.length})</Text>
                    <TouchableOpacity
                      style={styles.createBtn}
                      onPress={openAddSubjectModal}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.createBtnText}>+ Add Subject</Text>
                    </TouchableOpacity>
                  </View>
                  {mySubjectsLoading ? (
                    <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
                  ) : mySubjects.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyIcon}>📖</Text>
                      <Text style={styles.emptyText}>No subjects added yet</Text>
                      <Text style={styles.emptyHint}>Tap "+ Add Subject" to select the subjects you teach</Text>
                    </View>
                  ) : (
                    mySubjects.map(subject => (
                      <View key={subject._recordId} style={styles.mySubjectCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.mySubjectName} numberOfLines={1}>{subject.name}</Text>
                          <Text style={styles.mySubjectMeta}>
                            {subject.code}{subject.class ? ` · ${subject.class}` : ''}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.subjectRemoveBtn, removingSubjectId === subject._recordId && { opacity: 0.5 }]}
                          onPress={() => handleRemoveSubject(subject)}
                          disabled={removingSubjectId === subject._recordId}
                          activeOpacity={0.7}
                        >
                          {removingSubjectId === subject._recordId
                            ? <ActivityIndicator size="small" color={colors.red} />
                            : <Text style={styles.subjectRemoveText}>✕</Text>}
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* Study Groups */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>📚 STUDY GROUPS ({myGroups.length})</Text>
                  <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)} activeOpacity={0.8}>
                    <Text style={styles.createBtnText}>+ Create</Text>
                  </TouchableOpacity>
                </View>
                {myGroups.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyIcon}>📚</Text>
                    <Text style={styles.emptyText}>No groups created yet</Text>
                    <Text style={styles.emptyHint}>Create a group and choose which classes can see it</Text>
                  </View>
                ) : (
                  myGroups.map(g => <TeacherGroupCard key={g.id} group={g} />)
                )}
              </View>

              {/* Club Admin */}
              {coordinatedClubs.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>🏛️ CLUB & TEAM ADMIN ({coordinatedClubs.length})</Text>
                  {coordinatedClubs.map(club => {
                    const isExpanded = expandedClub === club.id;
                    const requests = joinRequests[club.id] || [];
                    const memberCount = clubMemberCounts[club.id];
                    return (
                      <View key={club.id} style={styles.clubAdminCard}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            style={[styles.clubDashBtn, { flex: 1 }]}
                            onPress={() => setDashboardClubId(club.id)}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.clubDashBtnIcon}>📊</Text>
                            <Text style={styles.clubDashBtnText}>Open Dashboard</Text>
                            <Text style={styles.clubDashBtnArrow}>›</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ padding: 10, backgroundColor: '#fee2e2', borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => Alert.alert(
                              'Delete Club',
                              `Remove "${club.fullName || club.name}" from the Hub? This cannot be undone.`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => deleteClub(club.id) },
                              ]
                            )}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 18 }}>🗑</Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.clubAdminHeader} onPress={() => toggleClub(club.id)} activeOpacity={0.8}>
                          <View style={[styles.clubAdminEmoji, { backgroundColor: club.color + '22' }]}>
                            <Text style={{ fontSize: 20 }}>{club.emoji}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.clubAdminName}>{club.fullName}</Text>
                            <Text style={styles.clubAdminMeta}>
                              {memberCount !== undefined ? `${memberCount} members` : club.type}
                              {requests.length > 0 ? ` · ${requests.length} pending` : ''}
                            </Text>
                          </View>
                          {requests.length > 0 && (
                            <View style={styles.reqBadge}><Text style={styles.reqBadgeText}>{requests.length}</Text></View>
                          )}
                          <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</Text>
                        </TouchableOpacity>
                        {isExpanded && (
                          <View style={styles.clubAdminBody}>
                            {requests.length === 0 ? (
                              <Text style={styles.clubAdminEmpty}>No pending join requests</Text>
                            ) : (
                              requests.map(req => (
                                <View key={req.id} style={styles.reqRow}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.reqName}>{req.student_name}</Text>
                                    <Text style={styles.reqSub}>{req.course} · {req.year}</Text>
                                    {req.message ? <Text style={styles.reqMsg}>"{req.message}"</Text> : null}
                                  </View>
                                  <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity
                                      style={styles.reqApprove}
                                      onPress={() => resolveRequest(req, 'approve')}
                                      disabled={resolvingReq === req.id}
                                      activeOpacity={0.8}
                                    >
                                      {resolvingReq === req.id
                                        ? <ActivityIndicator size="small" color="#fff" />
                                        : <Text style={styles.reqApproveText}>✓</Text>}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={styles.reqReject}
                                      onPress={() => resolveRequest(req, 'reject')}
                                      disabled={resolvingReq === req.id}
                                      activeOpacity={0.8}
                                    >
                                      <Text style={styles.reqRejectText}>✕</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              ))
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Club Creation Requests — visible to dept coordinator (id 1) & SAPS (id 6) */}
              {canApproveClubs && (
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionLabel}>🏛️ CLUB CREATION REQUESTS ({clubCreationReqs.length})</Text>
                    <TouchableOpacity
                      style={styles.createBtn}
                      onPress={() => supabase.from('club_creation_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }).then(({ data }) => { if (data) setClubCreationReqs(data); })}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.createBtnText}>↻ Refresh</Text>
                    </TouchableOpacity>
                  </View>
                  {clubCreationReqs.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyIcon}>🏛️</Text>
                      <Text style={styles.emptyText}>No pending club requests</Text>
                    </View>
                  ) : clubCreationReqs.map(req => (
                    <View key={req.id} style={styles.clubAdminCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <View style={[styles.clubAdminEmoji, { backgroundColor: (req.color || '#6366F1') + '22' }]}>
                          <Text style={{ fontSize: 20 }}>{req.emoji || '🏛️'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.clubAdminName}>{req.name}</Text>
                          <Text style={styles.clubAdminSub}>{req.type} · Requested by {req.creator_name}</Text>
                        </View>
                      </View>
                      {req.description ? <Text style={[styles.requestReason, { marginBottom: 8 }]}>"{req.description}"</Text> : null}
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={[styles.resolveBtn, styles.resolveBtnApprove]}
                          onPress={() => handleResolveClubReq(req, 'approved')}
                          disabled={resolvingClubReq === req.id}
                          activeOpacity={0.7}
                        >
                          {resolvingClubReq === req.id
                            ? <ActivityIndicator size="small" color="#0F0F1A" />
                            : <Text style={styles.resolveBtnApproveText}>✓ Approve</Text>
                          }
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.resolveBtn, styles.resolveBtnReject]}
                          onPress={() => handleResolveClubReq(req, 'rejected')}
                          disabled={resolvingClubReq === req.id}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.resolveBtnRejectText}>✕ Reject</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Faculty Coordinator */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>🏛️ CLUB COORDINATOR ACCESS</Text>
                  <TouchableOpacity
                    style={styles.createBtn}
                    onPress={() => { setShowClubRequest(true); setClubRequestError(''); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.createBtnText}>+ Request</Text>
                  </TouchableOpacity>
                </View>
                {myRequests.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyIcon}>🏛️</Text>
                    <Text style={styles.emptyText}>No coordinator requests yet</Text>
                    <Text style={styles.emptyHint}>Request admin access for a club or team you coordinate</Text>
                  </View>
                ) : (
                  myRequests.map(r => (
                    <View key={r.id} style={styles.requestCard}>
                      <View style={styles.requestCardTop}>
                        <Text style={styles.requestClubName} numberOfLines={1}>{r.club_name}</Text>
                        <View style={[styles.statusPill, r.status === 'approved' && styles.statusApproved, r.status === 'rejected' && styles.statusRejected]}>
                          <Text style={[styles.statusText, r.status === 'approved' && styles.statusTextApproved, r.status === 'rejected' && styles.statusTextRejected]}>
                            {r.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.requestReason} numberOfLines={2}>"{r.reason}"</Text>
                    </View>
                  ))
                )}
              </View>

              {/* ── Request New Subject ──────────────────────────────────── */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>📖 SUBJECTS</Text>
                  <TouchableOpacity
                    style={styles.createBtn}
                    onPress={() => { setShowSubjectModal(true); setSubjectError(''); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.createBtnText}>+ Request</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>📖</Text>
                  <Text style={styles.emptyText}>Request a new subject</Text>
                  <Text style={styles.emptyHint}>Submit subject details for coordinator approval</Text>
                </View>
              </View>

              {/* ── Coordinator: Subject Requests ──────────────────────── */}
              {(isAppAdmin || effectiveProfile.id === 1) && (
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionLabel}>📋 SUBJECT REQUESTS ({subjectRequests.length})</Text>
                    <TouchableOpacity style={styles.createBtn} onPress={loadSubjectRequests} activeOpacity={0.8}>
                      <Text style={styles.createBtnText}>↺ Refresh</Text>
                    </TouchableOpacity>
                  </View>
                  {subjectRequests.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyIcon}>🎉</Text>
                      <Text style={styles.emptyText}>No pending subject requests</Text>
                    </View>
                  ) : subjectRequests.map(req => (
                    <View key={req.id} style={styles.requestCard}>
                      <View style={styles.requestCardTop}>
                        <Text style={styles.requestClubName} numberOfLines={1}>{req.subject_name}</Text>
                        <View style={[styles.statusPill]}>
                          <Text style={styles.statusText}>{req.subject_code}</Text>
                        </View>
                      </View>
                      <Text style={styles.requestReason}>{req.class} · Sem {req.semester} · by {req.requester_name}</Text>
                      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                        <TouchableOpacity
                          style={[styles.createBtn, { flex: 1, alignItems: 'center', borderColor: colors.red, borderWidth: 1, backgroundColor: 'transparent' }, resolvingSubject === req.id && { opacity: 0.5 }]}
                          onPress={() => resolveSubjectRequest(req, 'rejected')}
                          disabled={resolvingSubject === req.id}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.createBtnText, { color: colors.red }]}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.createBtn, { flex: 1, alignItems: 'center', backgroundColor: colors.green, borderColor: colors.green }, resolvingSubject === req.id && { opacity: 0.5 }]}
                          onPress={() => resolveSubjectRequest(req, 'approved')}
                          disabled={resolvingSubject === req.id}
                          activeOpacity={0.8}
                        >
                          {resolvingSubject === req.id
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={[styles.createBtnText, { color: '#fff' }]}>Approve</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* ══ PLANNER TAB ═══════════════════════════════════════════════════ */}
          {activeTab === 'planner' && (
            <>
              {/* Tasks */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>📋 MY TASKS ({tasks.length})</Text>
                  <TouchableOpacity
                    style={styles.createBtn}
                    onPress={() => { setShowTaskModal(true); setTaskFormError(''); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.createBtnText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
                {tasksLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
                ) : tasks.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyIcon}>📋</Text>
                    <Text style={styles.emptyText}>No tasks yet</Text>
                    <Text style={styles.emptyHint}>Tap "+ Add" to create your first task</Text>
                  </View>
                ) : (
                  ['pending', 'in_progress', 'done'].map(status => {
                    const group = tasks.filter(t => t.status === status);
                    if (group.length === 0) return null;
                    const groupLabel = status === 'pending' ? '⏳ PENDING' : status === 'in_progress' ? '🔄 IN PROGRESS' : '✅ DONE';
                    return (
                      <View key={status}>
                        <Text style={styles.taskGroupLabel}>{groupLabel} ({group.length})</Text>
                        {group.map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            updating={updatingTaskId === task.id}
                            deleting={deletingTaskId === task.id}
                            onUpdateStatus={updateTaskStatus}
                            onDelete={() => deleteTask(task.id)}
                          />
                        ))}
                      </View>
                    );
                  })
                )}
              </View>

              {/* Free Period Suggestions */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>💡 YOUR FREE TIME</Text>
                <FreePeriodSuggestions tasks={tasks} />
              </View>

              {/* Appearance */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>🎨 APPEARANCE</Text>
                <Text style={[styles.sectionHint, { marginBottom: spacing.md }]}>
                  Choose a theme — applies across the whole app and is saved in your browser.
                </Text>
                <View style={styles.themeGrid}>
                  {THEMES.map(t => {
                    const active = activeThemeKey === t.key;
                    return (
                      <TouchableOpacity
                        key={t.key}
                        style={[styles.themeCard, active && styles.themeCardActive, !t.ready && styles.themeCardDimmed]}
                        onPress={() => t.ready && !active && setTheme(t.key)}
                        activeOpacity={t.ready && !active ? 0.75 : 1}
                      >
                        <View style={styles.swatchRow}>
                          {t.swatch.map((c, i) => (
                            <View key={i} style={[styles.swatchDot, { backgroundColor: c }]} />
                          ))}
                        </View>
                        <Text style={[styles.themeLabel, active && styles.themeLabelActive]}>{t.label}</Text>
                        <Text style={styles.themeDesc}>{active ? '✓ Active' : t.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          )}

        </ScrollView>
      )}

      {/* ── Announcement Modal ─────────────────────────────────────────────────── */}
      <Modal visible={showAnnounceModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📢 Post Announcement</Text>
              <TouchableOpacity onPress={() => setShowAnnounceModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>TITLE</Text>
            <TextInput
              value={newAnnounce.title}
              onChangeText={t => { setNewAnnounce(p => ({ ...p, title: t })); setAnnounceError(''); }}
              placeholder="e.g. Exam schedule reminder"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />
            <Text style={styles.modalLabel}>MESSAGE (OPTIONAL)</Text>
            <TextInput
              value={newAnnounce.body}
              onChangeText={t => setNewAnnounce(p => ({ ...p, body: t }))}
              placeholder="Add details for your mentor group…"
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { height: 90, textAlignVertical: 'top', paddingTop: spacing.sm }]}
              multiline
            />
            {announceError ? <Text style={styles.requestError}>{announceError}</Text> : null}
            <TouchableOpacity
              style={[styles.modalSubmit, (announceLoading || !newAnnounce.title.trim()) && { opacity: 0.45 }]}
              onPress={postAnnouncement}
              disabled={announceLoading || !newAnnounce.title.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.modalSubmitText}>{announceLoading ? 'Posting…' : 'Post Announcement'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Student Profile Modal ──────────────────────────────────────────────── */}
      <Modal visible={!!selectedMentee} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }}>
            {selectedMentee && (() => {
              const pav = avatarColor(selectedMentee.name);
              const count = visitCounts[String(selectedMentee.id)] ?? 0;
              return (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>👤 Student Profile</Text>
                    <TouchableOpacity onPress={() => setSelectedMentee(null)}>
                      <Text style={styles.modalClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.profileHeader}>
                    <View style={[styles.profileAvatar, { backgroundColor: pav.bg }]}>
                      <Text style={[styles.profileAvatarText, { color: pav.text }]}>
                        {selectedMentee.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.profileName}>{selectedMentee.name}</Text>
                      <Text style={styles.profileSub}>{selectedMentee.course} · {selectedMentee.year}</Text>
                      <Text style={styles.profileSub}>{selectedMentee.campus} Campus</Text>
                    </View>
                  </View>
                  {selectedMentee.interest && (
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>INTEREST</Text>
                      <Text style={styles.profileValue}>{selectedMentee.interest}</Text>
                    </View>
                  )}
                  <View style={styles.profileRow}>
                    <Text style={styles.profileLabel}>MENTOR VISITS THIS SEMESTER</Text>
                    <View style={styles.visitsProgressRow}>
                      <View style={[styles.progressTrack, { flex: 1 }]}>
                        <View style={[
                          styles.progressFill,
                          { width: `${Math.min(count / REQUIRED_VISITS, 1) * 100}%` },
                          count >= REQUIRED_VISITS && styles.progressFillDone,
                        ]} />
                      </View>
                      <Text style={[styles.visitsLabel, count >= REQUIRED_VISITS && styles.visitsLabelDone]}>
                        {count}/{REQUIRED_VISITS}{count >= REQUIRED_VISITS ? ' ✓' : ''}
                      </Text>
                    </View>
                  </View>
                  {/* Academic Progress */}
                  <View style={styles.profileRow}>
                    <View style={styles.profileRowHeader}>
                      <Text style={styles.profileLabel}>ACADEMIC PROGRESS</Text>
                      <TouchableOpacity onPress={() => setEditingProgress(v => !v)} activeOpacity={0.7}>
                        <Text style={styles.profileEditLink}>{editingProgress ? 'Cancel' : 'Edit'}</Text>
                      </TouchableOpacity>
                    </View>
                    {editingProgress ? (
                      <View style={styles.progressEditBox}>
                        <View style={styles.progressEditRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.progressEditLabel}>CGPA</Text>
                            <TextInput
                              value={progressCgpa}
                              onChangeText={setProgressCgpa}
                              placeholder="e.g. 8.5"
                              placeholderTextColor={colors.textTertiary}
                              keyboardType="decimal-pad"
                              style={styles.progressEditInput}
                            />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.progressEditLabel}>ATTENDANCE %</Text>
                            <TextInput
                              value={progressAttendance}
                              onChangeText={setProgressAttendance}
                              placeholder="e.g. 85"
                              placeholderTextColor={colors.textTertiary}
                              keyboardType="number-pad"
                              style={styles.progressEditInput}
                            />
                          </View>
                        </View>
                        <Text style={styles.progressEditLabel}>NOTES</Text>
                        <TextInput
                          value={progressNote}
                          onChangeText={setProgressNote}
                          placeholder="Academic observations, strengths, areas to improve…"
                          placeholderTextColor={colors.textTertiary}
                          style={[styles.progressEditInput, { minHeight: 70, textAlignVertical: 'top' }]}
                          multiline
                        />
                        <TouchableOpacity
                          style={[styles.profileVisitBtn, { marginTop: 8 }, progressSaving && { opacity: 0.5 }]}
                          onPress={handleSaveProgress}
                          disabled={progressSaving}
                          activeOpacity={0.8}
                        >
                          {progressSaving
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={styles.profileVisitBtnText}>Save Progress</Text>}
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View>
                        {(progressCgpa || progressAttendance) ? (
                          <View style={styles.progressDisplayRow}>
                            {progressCgpa ? <Text style={styles.progressStat}>CGPA <Text style={styles.progressStatVal}>{progressCgpa}</Text></Text> : null}
                            {progressAttendance ? <Text style={styles.progressStat}>Attendance <Text style={styles.progressStatVal}>{progressAttendance}%</Text></Text> : null}
                          </View>
                        ) : null}
                        {progressNote ? <Text style={styles.progressNoteText}>{progressNote}</Text> : null}
                        {!progressCgpa && !progressAttendance && !progressNote && (
                          <Text style={styles.visitHistoryNote}>No data recorded yet — tap Edit to add</Text>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Next Session */}
                  <View style={styles.profileRow}>
                    <View style={styles.profileRowHeader}>
                      <Text style={styles.profileLabel}>NEXT SESSION</Text>
                      <TouchableOpacity onPress={() => setEditingSchedule(v => !v)} activeOpacity={0.7}>
                        <Text style={styles.profileEditLink}>{editingSchedule ? 'Cancel' : scheduleDate ? 'Reschedule' : 'Schedule'}</Text>
                      </TouchableOpacity>
                    </View>
                    {editingSchedule ? (
                      <View style={styles.progressEditBox}>
                        <Text style={styles.progressEditLabel}>DATE</Text>
                        <TextInput
                          value={scheduleDate}
                          onChangeText={setScheduleDate}
                          placeholder="e.g. Mon 23 Jun 2026"
                          placeholderTextColor={colors.textTertiary}
                          style={styles.progressEditInput}
                        />
                        <Text style={styles.progressEditLabel}>AGENDA (optional)</Text>
                        <TextInput
                          value={scheduleNote}
                          onChangeText={setScheduleNote}
                          placeholder="Topics to cover…"
                          placeholderTextColor={colors.textTertiary}
                          style={[styles.progressEditInput, { minHeight: 50, textAlignVertical: 'top' }]}
                          multiline
                        />
                        <TouchableOpacity
                          style={[styles.profileVisitBtn, { marginTop: 8 }, (!scheduleDate.trim() || scheduleSaving) && { opacity: 0.5 }]}
                          onPress={handleScheduleSession}
                          disabled={!scheduleDate.trim() || scheduleSaving}
                          activeOpacity={0.8}
                        >
                          {scheduleSaving
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={styles.profileVisitBtnText}>Save & Notify Student</Text>}
                        </TouchableOpacity>
                      </View>
                    ) : scheduleDate ? (
                      <View>
                        <Text style={styles.scheduleDate}>{scheduleDate}</Text>
                        {scheduleNote ? <Text style={styles.visitHistoryNote}>{scheduleNote}</Text> : null}
                      </View>
                    ) : (
                      <Text style={styles.visitHistoryNote}>No session scheduled — tap Schedule to set one</Text>
                    )}
                  </View>

                  {/* Visit History */}
                  <View style={styles.profileRow}>
                    <Text style={styles.profileLabel}>VISIT HISTORY ({menteeVisits.length})</Text>
                    {menteeVisits.length === 0 ? (
                      <Text style={styles.visitHistoryNote}>No visits logged yet</Text>
                    ) : (
                      menteeVisits.map((v, i) => (
                        <View key={i} style={styles.visitHistoryItem}>
                          <Text style={styles.visitHistoryDate}>
                            {new Date(v.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                          {v.note ? <Text style={styles.visitHistoryNote}>{v.note}</Text> : null}
                        </View>
                      ))
                    )}
                  </View>

                  <View style={styles.profileActions}>
                    <TouchableOpacity
                      style={styles.profileDmBtn}
                      onPress={() => { setSelectedMentee(null); openChat(selectedMentee); }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.profileDmBtnText}>💬 Open Chat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.profileVisitBtn}
                      onPress={() => { setSelectedMentee(null); openLogVisit(selectedMentee); }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.profileVisitBtnText}>✓ Log Visit</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Log Visit Modal ────────────────────────────────────────────────────── */}
      <Modal visible={!!logVisitModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { maxHeight: '60%' }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Log Mentor Visit</Text>
                  {logVisitModal && <Text style={styles.modalSubtitle}>{logVisitModal.name}</Text>}
                </View>
                <TouchableOpacity onPress={() => setLogVisitModal(null)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalLabel}>WHAT WAS DISCUSSED? (optional)</Text>
              <TextInput
                value={logVisitNote}
                onChangeText={setLogVisitNote}
                placeholder="Key topics, action items, next steps…"
                placeholderTextColor={colors.textTertiary}
                style={[styles.modalInput, { minHeight: 90, textAlignVertical: 'top' }]}
                multiline
                autoFocus
              />
              <TouchableOpacity
                style={[styles.profileVisitBtn, { marginTop: 16 }, loggingVisit && { opacity: 0.5 }]}
                onPress={() => logVisitModal && handleLogVisit(logVisitModal.id, logVisitNote)}
                disabled={!!loggingVisit}
                activeOpacity={0.8}
              >
                {loggingVisit
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.profileVisitBtnText}>✓ Log Visit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Chat Modal ─────────────────────────────────────────────────────────── */}
      <Modal visible={!!chatMentee} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.chatOverlay}>
            <SafeAreaView style={styles.chatPanel}>
              <View style={styles.chatHeader}>
                {chatMentee && (() => {
                  const cav = avatarColor(chatMentee.name);
                  return (
                    <View style={styles.chatHeaderLeft}>
                      <View style={[styles.chatAvatar, { backgroundColor: cav.bg }]}>
                        <Text style={[styles.chatAvatarText, { color: cav.text }]}>
                          {chatMentee.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.chatHeaderName}>{chatMentee.name}</Text>
                        <Text style={styles.chatHeaderSub}>{chatMentee.course}</Text>
                      </View>
                    </View>
                  );
                })()}
                <TouchableOpacity onPress={() => { setChatMentee(null); setChatMessages([]); }} style={{ padding: 4 }}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              {chatLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
              ) : (
                <ScrollView
                  ref={chatScrollRef}
                  style={styles.chatBody}
                  contentContainerStyle={{ padding: spacing.md, paddingBottom: 20 }}
                  showsVerticalScrollIndicator={false}
                >
                  {chatMessages.length === 0 && (
                    <View style={styles.chatEmpty}>
                      <Text style={styles.chatEmptyText}>No messages yet. Say hello!</Text>
                    </View>
                  )}
                  {chatMessages.map((msg, i) => {
                    const isMe = !!msg.fromTeacher;
                    return (
                      <View key={msg.id ?? i} style={[styles.bubble, isMe ? styles.bubbleOut : styles.bubbleIn]}>
                        {!isMe && chatMentee && <Text style={styles.bubbleSender}>{chatMentee.name}</Text>}
                        <MediaMessage url={msg.media_url} isMe={isMe} />
                        {msg.text ? <Text style={[styles.bubbleText, isMe && styles.bubbleTextOut]}>{msg.text}</Text> : null}
                        <Text style={[styles.bubbleTime, isMe && { color: 'rgba(255,255,255,0.6)' }]}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
              {!chatLoading && !chatStudentUUID ? (
                <View style={styles.chatNoAccount}>
                  <Text style={styles.chatNoAccountText}>
                    This student hasn't created a ChristConnect account yet. They'll appear here once they sign up.
                  </Text>
                </View>
              ) : (
                <View style={styles.chatInputRow}>
                  <TouchableOpacity onPress={pickTeacherChatMedia} style={styles.chatMediaBtn} disabled={uploadingChatMedia} activeOpacity={0.7}>
                    {uploadingChatMedia
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Text style={{ fontSize: 18 }}>📎</Text>}
                  </TouchableOpacity>
                  <TextInput
                    value={chatText}
                    onChangeText={setChatText}
                    placeholder="Type a message…"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.chatInput}
                    onSubmitEditing={() => sendChatMessage()}
                    returnKeyType="send"
                  />
                  <TouchableOpacity
                    style={[styles.chatSendBtn, !chatText.trim() && { opacity: 0.4 }]}
                    onPress={() => sendChatMessage()}
                    disabled={!chatText.trim()}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.chatSendIcon}>➤</Text>
                  </TouchableOpacity>
                </View>
              )}
            </SafeAreaView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Club Coordinator Request Modal ──────────────────────────────────────── */}
      <Modal visible={showClubRequest} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🏛️ Request Coordinator Access</Text>
              <TouchableOpacity onPress={() => setShowClubRequest(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>SELECT CLUB / TEAM</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }} contentContainerStyle={{ gap: 8 }}>
              {hubClubs.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.clubChip, selectedClub?.id === c.id && styles.clubChipActive]}
                  onPress={() => { setSelectedClub(c); setClubRequestError(''); }}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
                  <Text style={[styles.clubChipText, selectedClub?.id === c.id && styles.clubChipTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.modalLabel}>REASON FOR REQUEST</Text>
            <TextInput
              value={clubReason}
              onChangeText={t => { setClubReason(t); setClubRequestError(''); }}
              placeholder="Explain your role and how you'll coordinate this club…"
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { height: 90, textAlignVertical: 'top', paddingTop: spacing.sm }]}
              multiline
            />
            {clubRequestError ? <Text style={styles.requestError}>{clubRequestError}</Text> : null}
            <TouchableOpacity
              style={[styles.modalSubmit, (clubRequestLoading || !selectedClub || !clubReason.trim()) && { opacity: 0.45 }]}
              onPress={handleClubRequest}
              disabled={clubRequestLoading || !selectedClub || !clubReason.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.modalSubmitText}>{clubRequestLoading ? 'Submitting…' : 'Submit Request'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Teacher Notifications Modal ─────────────────────────────────────────── */}
      <Modal visible={showTeacherNotifs} animationType="slide" transparent>
        <View style={styles.notifOverlay}>
          <TouchableOpacity style={styles.notifBackdrop} onPress={() => setShowTeacherNotifs(false)} activeOpacity={1} />
          <SafeAreaView style={styles.notifPanel}>
            <View style={styles.notifHeader}>
              <View>
                <Text style={styles.notifHeaderTitle}>Notifications</Text>
                {teacherNotifsUnread > 0 && <Text style={styles.notifHeaderSub}>{teacherNotifsUnread} unread</Text>}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {teacherNotifsUnread > 0 && (
                  <TouchableOpacity onPress={markAllTeacherNotifsRead} style={styles.markAllBtn} activeOpacity={0.7}>
                    <Text style={styles.markAllText}>Mark all read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowTeacherNotifs(false)} style={styles.notifCloseBtn} activeOpacity={0.7}>
                  <Text style={styles.notifCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
            {loadingNotifs ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
            ) : teacherNotifs.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <Text style={{ fontSize: 36, marginBottom: 10 }}>🔔</Text>
                <Text style={{ fontSize: 15, ...font.bold, color: colors.textPrimary, marginBottom: 4 }}>All caught up</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>No notifications yet.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {teacherNotifs.map(n => {
                  const isDM = n.type === 'dm';
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[styles.notifItem, !n.read && styles.notifItemUnread]}
                      onPress={() => handleTeacherNotifTap(n)}
                      activeOpacity={isDM ? 0.7 : 1}
                      disabled={!isDM}
                    >
                      <View style={[styles.notifIcon, !n.read && styles.notifIconUnread]}>
                        <Text style={{ fontSize: 20 }}>{isDM ? '💬' : '🔔'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.notifTitle, !n.read && styles.notifTitleUnread]} numberOfLines={2}>{n.title}</Text>
                        {n.body ? <Text style={styles.notifBody}>{n.body}</Text> : null}
                        {isDM && <Text style={styles.notifTapHint}>Tap to open chat →</Text>}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <Text style={styles.notifTime}>{timeAgoT(n.created_at)}</Text>
                        {!n.read && <View style={styles.notifDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Create Group Modal ──────────────────────────────────────────────────── */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📚 Create Study Group</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>GROUP NAME</Text>
            <TextInput
              value={newGroup.name}
              onChangeText={t => setNewGroup(p => ({ ...p, name: t }))}
              placeholder="e.g. BCom IAF — AA Revision"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />
            <Text style={styles.modalLabel}>EMOJI</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiOption, newGroup.emoji === e && styles.emojiOptionActive]}
                  onPress={() => setNewGroup(p => ({ ...p, emoji: e }))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emojiOptionText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modalLabel}>DESCRIPTION</Text>
            <TextInput
              value={newGroup.desc}
              onChangeText={t => setNewGroup(p => ({ ...p, desc: t }))}
              placeholder="What will this group focus on?"
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { height: 72, textAlignVertical: 'top', paddingTop: spacing.sm }]}
              multiline
            />
            <Text style={styles.modalLabel}>VISIBLE TO</Text>
            <Text style={styles.modalHint}>Select which student classes can see this group</Text>
            <View style={styles.courseCheckRow}>
              {ALL_COURSES.map(c => {
                const selected = newGroup.visibleTo.includes(c);
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.courseCheck, selected && styles.courseCheckActive]}
                    onPress={() => toggleCourse(c)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                      {selected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.courseCheckText, selected && styles.courseCheckTextActive]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.modalSubmit, !newGroup.name.trim() && { opacity: 0.45 }]}
              onPress={handleCreate}
              disabled={!newGroup.name.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.modalSubmitText}>Create Group</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Club Dashboard Modal ──────────────────────────────────────── */}
      <Modal
        visible={!!dashboardClubId}
        animationType="slide"
        onRequestClose={() => setDashboardClubId(null)}
      >
        {dashboardClubId && (
          <ClubDashboardScreen
            clubId={dashboardClubId}
            isCoordinatorProp={true}
            onClose={() => setDashboardClubId(null)}
          />
        )}
      </Modal>

      {/* ── Add Mentee Modal ───────────────────────────────────────────────── */}
      <Modal visible={showAddMentee} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: 0 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>👥 Add Mentee</Text>
              <TouchableOpacity onPress={() => setShowAddMentee(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.searchBar, { marginBottom: spacing.sm }]}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                value={menteeAddSearch}
                onChangeText={setMenteeAddSearch}
                placeholder="Search students…"
                placeholderTextColor={colors.textTertiary}
                style={styles.searchInput}
                autoFocus
              />
              {menteeAddSearch.length > 0 && (
                <TouchableOpacity onPress={() => setMenteeAddSearch('')} activeOpacity={0.7}>
                  <Text style={{ fontSize: 14, color: colors.textTertiary, paddingHorizontal: 4 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
              {menteeAddFiltered.length === 0 ? (
                <View style={[styles.emptyCard, { marginTop: spacing.md }]}>
                  <Text style={styles.emptyText}>No students found</Text>
                </View>
              ) : (
                menteeAddFiltered.map((s, i) => {
                  const already = isAlreadyMentee(s);
                  const isLoading = addingMenteeId === (s.isReal ? s.id : s.name);
                  return (
                    <View key={s.id ?? s.name + i} style={styles.addMenteeRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.addMenteeName}>{s.name}</Text>
                          {s.isReal && <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>● ACTIVE</Text></View>}
                        </View>
                        <Text style={styles.addMenteeSub}>{s.course}{s.year ? ` · ${s.year}` : ''}</Text>
                      </View>
                      {already ? (
                        <View style={styles.addMenteeAdded}>
                          <Text style={styles.addMenteeAddedText}>✓ In group</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.addMenteeBtn, isLoading && { opacity: 0.5 }]}
                          onPress={() => handleAddMentee(s)}
                          disabled={isLoading}
                          activeOpacity={0.8}
                        >
                          {isLoading
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={styles.addMenteeBtnText}>+ Add</Text>}
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Timetable Planner Modal ─────────────────────────────────────── */}
      <Modal
        visible={showTimetablePlanner}
        animationType="slide"
        onRequestClose={() => setShowTimetablePlanner(false)}
      >
        <TimetablePlannerScreen onClose={() => setShowTimetablePlanner(false)} />
      </Modal>

      {/* ── Add Task Modal ──────────────────────────────────────────────────── */}
      <Modal visible={showTaskModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📋 Add Task</Text>
              <TouchableOpacity onPress={() => setShowTaskModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>TITLE *</Text>
            <TextInput
              value={taskForm.title}
              onChangeText={t => { setTaskForm(p => ({ ...p, title: t })); setTaskFormError(''); }}
              placeholder="What do you need to do?"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />
            <Text style={styles.modalLabel}>DEADLINE (OPTIONAL)</Text>
            <TextInput
              value={taskForm.deadline}
              onChangeText={t => setTaskForm(p => ({ ...p, deadline: t }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />
            <Text style={styles.modalLabel}>DURATION IN HOURS (OPTIONAL)</Text>
            <TextInput
              value={taskForm.duration_hours}
              onChangeText={t => setTaskForm(p => ({ ...p, duration_hours: t }))}
              placeholder="e.g. 1.5"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
              keyboardType="numeric"
            />
            {taskFormError ? <Text style={styles.requestError}>{taskFormError}</Text> : null}
            <TouchableOpacity
              style={[styles.modalSubmit, (taskSubmitting || !taskForm.title.trim()) && { opacity: 0.45 }]}
              onPress={handleAddTask}
              disabled={taskSubmitting || !taskForm.title.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.modalSubmitText}>{taskSubmitting ? 'Saving…' : 'Add Task'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Add Subject Modal ─────────────────────────────────────────────── */}
      <Modal visible={showAddSubjectModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: 0 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📖 Add Subject</Text>
              <TouchableOpacity onPress={() => setShowAddSubjectModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalLabel, { marginTop: 0 }]}>
              Tap a subject to add it to your teaching list.
            </Text>
            <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
              {(() => {
                const addedIds = new Set(mySubjects.map(s => s.id));
                const unadded = allActiveSubjects.filter(s => !addedIds.has(s.id));
                if (allActiveSubjects.length === 0) {
                  return (
                    <View style={[styles.emptyCard, { marginTop: spacing.sm }]}>
                      <Text style={styles.emptyText}>No subjects available</Text>
                    </View>
                  );
                }
                if (unadded.length === 0) {
                  return (
                    <View style={[styles.emptyCard, { marginTop: spacing.sm }]}>
                      <Text style={styles.emptyText}>All subjects already added</Text>
                    </View>
                  );
                }
                return unadded.map(subject => {
                  const isAdding = addingSubjectId === subject.id;
                  return (
                    <TouchableOpacity
                      key={subject.id}
                      style={[styles.addSubjectRow, isAdding && { opacity: 0.6 }]}
                      onPress={() => handleAddSubject(subject)}
                      disabled={isAdding}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.addSubjectName}>{subject.name}</Text>
                        <Text style={styles.addSubjectMeta}>
                          {subject.code}{subject.class ? ` · ${subject.class}` : ''}
                        </Text>
                      </View>
                      {isAdding
                        ? <ActivityIndicator size="small" color={colors.primary} />
                        : <Text style={styles.addSubjectPlus}>+</Text>}
                    </TouchableOpacity>
                  );
                });
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Subject Request Modal ─────────────────────────────────────────── */}
      <Modal visible={showSubjectModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowSubjectModal(false)} activeOpacity={1} />
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>📖 Request New Subject</Text>
                <TouchableOpacity onPress={() => setShowSubjectModal(false)} activeOpacity={0.7}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldLabel}>SUBJECT NAME *</Text>
                <TextInput
                  value={subjectName}
                  onChangeText={t => { setSubjectName(t); setSubjectError(''); }}
                  placeholder="e.g. Financial Accounting"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.textInput}
                  maxLength={100}
                />

                <Text style={styles.fieldLabel}>SUBJECT CODE *</Text>
                <TextInput
                  value={subjectCode}
                  onChangeText={t => { setSubjectCode(t); setSubjectError(''); }}
                  placeholder="e.g. BIAF101-1"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.textInput}
                  autoCapitalize="characters"
                  maxLength={20}
                />

                <Text style={styles.fieldLabel}>CLASS *</Text>
                <View style={{ gap: 6, marginBottom: spacing.md }}>
                  {ALL_CLASSES.map(cls => {
                    const active = subjectClass === cls;
                    return (
                      <TouchableOpacity
                        key={cls}
                        style={[styles.classOption, active && styles.classOptionActive]}
                        onPress={() => { setSubjectClass(cls); setSubjectError(''); }}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.classOptionText, active && styles.classOptionTextActive]}>{cls}</Text>
                        {active && <Text style={{ color: colors.primary, fontSize: 14 }}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {subjectError ? <Text style={styles.errorText}>{subjectError}</Text> : null}

                <TouchableOpacity
                  style={[styles.submitBtn, (subjectSubmitting) && { opacity: 0.6 }]}
                  onPress={handleSubjectRequest}
                  disabled={subjectSubmitting}
                  activeOpacity={0.85}
                >
                  {subjectSubmitting
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.submitBtnText}>Submit Request</Text>
                  }
                </TouchableOpacity>
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Sub Request Modal ──────────────────────────────────────────────── */}
      <Modal visible={!!subReqSlot} animationType="slide" transparent onRequestClose={() => setSubReqSlot(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { maxHeight: '65%' }]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Request Substitute</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                    {subReqSlot?.course_name || 'Class'} · {subReqSlot?.class_name} · {subReqSlot?.day} {subReqSlot?.period_name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSubReqSlot(null)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>REASON *</Text>
              <TextInput
                value={subReqReason}
                onChangeText={setSubReqReason}
                placeholder="e.g. Medical appointment, personal emergency…"
                placeholderTextColor={colors.textTertiary}
                style={styles.modalInput}
                multiline
              />

              <Text style={styles.modalLabel}>PREFERRED SUBSTITUTE (optional)</Text>
              <TextInput
                value={subReqPrefSub}
                onChangeText={setSubReqPrefSub}
                placeholder="e.g. Dr. Smith"
                placeholderTextColor={colors.textTertiary}
                style={[styles.modalInput, { marginBottom: 20 }]}
              />

              <TouchableOpacity
                style={[styles.submitBtn, subReqSubmitting && { opacity: 0.6 }]}
                onPress={handleSubReqSubmit}
                disabled={subReqSubmitting}
                activeOpacity={0.8}
              >
                {subReqSubmitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.submitBtnText}>Send Request</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Schedule Absence Modal ──────────────────────────────────────────── */}
      <Modal visible={showScheduleAbsence} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { maxHeight: '60%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Cancel Classes</Text>
                <TouchableOpacity onPress={() => { setShowScheduleAbsence(false); setAbsenceDate(''); setAbsenceReason(''); }}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>DATE *</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={absenceDate}
                  onChange={e => setAbsenceDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  style={{
                    fontSize: 14, padding: '8px 10px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8, backgroundColor: colors.bg,
                    color: colors.textPrimary, width: '100%',
                    marginBottom: 14, fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              ) : (
                <TextInput
                  value={absenceDate}
                  onChangeText={setAbsenceDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.modalInput}
                />
              )}

              <Text style={styles.modalLabel}>REASON</Text>
              <TextInput
                value={absenceReason}
                onChangeText={setAbsenceReason}
                placeholder="e.g. Medical appointment, Conference…"
                placeholderTextColor={colors.textTertiary}
                style={[styles.modalInput, { marginBottom: 20 }]}
              />

              <TouchableOpacity
                style={[styles.submitBtn, absenceSubmitting && { opacity: 0.6 }]}
                onPress={handleScheduleAbsence}
                disabled={absenceSubmitting}
                activeOpacity={0.8}
              >
                {absenceSubmitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.submitBtnText}>Confirm Cancellation</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Rename Display Name Modal ── */}
      <Modal visible={showRenameModal} transparent animationType="fade" onRequestClose={() => setShowRenameModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Display Name</Text>
              <TouchableOpacity onPress={() => setShowRenameModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalLabel, { marginBottom: 4 }]}>
              This changes how your name appears in the app. Your timetable slot matching is unaffected.
            </Text>
            <Text style={[styles.modalLabel, { marginTop: 12 }]}>DISPLAY NAME</Text>
            <TextInput
              value={renameInput}
              onChangeText={setRenameInput}
              placeholder="Your name as shown in the app"
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { marginBottom: 20 }]}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.submitBtn, (renameSubmitting || !renameInput.trim()) && { opacity: 0.5 }]}
              onPress={handleSaveName}
              disabled={renameSubmitting || !renameInput.trim()}
              activeOpacity={0.8}
            >
              {renameSubmitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.submitBtnText}>Save Name</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MenteeCard({ student, visitCount, loggingVisit, onLogVisit, onViewProfile, onOpenChat, isDynamic, removing, onRemove, nextSession }) {
  const av = avatarColor(student.name);
  const progress = Math.min(visitCount / REQUIRED_VISITS, 1);
  const done = visitCount >= REQUIRED_VISITS;

  return (
    <TouchableOpacity style={styles.menteeCard} onPress={onViewProfile} activeOpacity={0.85}>
      <View style={[styles.menteeAvatar, { backgroundColor: av.bg }]}>
        <Text style={[styles.menteeAvatarText, { color: av.text }]}>
          {student.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.menteeTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
            <Text style={styles.menteeName} numberOfLines={1}>{student.name}</Text>
            {isDynamic && (
              <View style={styles.addedBadge}><Text style={styles.addedBadgeText}>ADDED</Text></View>
            )}
          </View>
          <Text style={[styles.visitsLabel, done && styles.visitsLabelDone]}>
            {visitCount}/{REQUIRED_VISITS}{done ? ' ✓' : ''}
          </Text>
        </View>
        <Text style={styles.menteeSub}>{student.course}{student.year ? ` · ${student.year}` : ''}</Text>
        {nextSession ? (
          <Text style={styles.menteeNextSession}>Next: {nextSession}</Text>
        ) : null}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }, done && styles.progressFillDone]} />
        </View>
      </View>
      <View style={styles.menteeActions}>
        <TouchableOpacity style={styles.menteeActionBtn} onPress={(e) => { e.stopPropagation?.(); onOpenChat(); }} activeOpacity={0.7}>
          <Text style={styles.menteeActionIcon}>💬</Text>
        </TouchableOpacity>
        {isDynamic && onRemove ? (
          <TouchableOpacity
            style={[styles.menteeActionBtn, styles.menteeRemoveBtn, removing && { opacity: 0.5 }]}
            onPress={(e) => { e.stopPropagation?.(); onRemove(); }}
            disabled={removing}
            activeOpacity={0.7}
          >
            {removing
              ? <ActivityIndicator size="small" color={colors.red} />
              : <Text style={styles.menteeRemoveText}>✕</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.menteeActionBtn, styles.menteeLogBtn, done && styles.menteeLogBtnDone]}
            onPress={(e) => { e.stopPropagation?.(); onLogVisit(); }}
            disabled={loggingVisit}
            activeOpacity={0.7}
          >
            {loggingVisit
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={styles.menteeLogText}>+1</Text>}
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function StudentRow({ student, isMentee, isReal, onViewProfile, onOpenChat }) {
  const av = avatarColor(student.name);
  return (
    <TouchableOpacity style={[styles.studentRow, isReal && styles.studentRowReal]} onPress={onViewProfile} activeOpacity={0.85}>
      <View style={[styles.studentAvatar, { backgroundColor: av.bg }]}>
        <Text style={[styles.studentAvatarText, { color: av.text }]}>
          {student.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={styles.studentName} numberOfLines={1}>{student.name}</Text>
          {isReal && <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>● ACTIVE</Text></View>}
          {isMentee && <View style={styles.menteeBadge}><Text style={styles.menteeBadgeText}>MENTEE</Text></View>}
        </View>
        <Text style={styles.studentSub}>{student.course}{student.year ? ` · ${student.year}` : ''}</Text>
      </View>
      <TouchableOpacity
        style={styles.studentChatBtn}
        onPress={(e) => { e.stopPropagation?.(); onOpenChat(); }}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 16 }}>💬</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function AnnouncementCard({ item }) {
  return (
    <View style={styles.announceCard}>
      <View style={styles.announceTop}>
        <Text style={styles.announceTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.announceTime}>
          {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </Text>
      </View>
      {item.body ? <Text style={styles.announceBody} numberOfLines={3}>{item.body}</Text> : null}
    </View>
  );
}

function TeacherGroupCard({ group }) {
  return (
    <View style={styles.groupCard}>
      <View style={styles.groupCardLeft}>
        <View style={styles.groupEmoji}><Text style={{ fontSize: 22 }}>{group.emoji}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
          <Text style={styles.groupDesc} numberOfLines={1}>{group.desc}</Text>
          <View style={styles.visibleToRow}>
            {group.visibleTo.map(c => (
              <View key={c} style={styles.visiblePill}>
                <Text style={styles.visiblePillText}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.groupMeta}>
        {group.active && <View style={styles.activeDot} />}
        <Text style={styles.groupMembers}>👥 {group.members}</Text>
      </View>
    </View>
  );
}

// ── Planner sub-components ───────────────────────────────────────────────────

const MOCK_FREE_PERIODS = [
  { label: '10 AM', hour: 10 },
  { label: '2 PM',  hour: 14 },
];

function TaskCard({ task, updating, deleting, onUpdateStatus, onDelete }) {
  const isDone = task.status === 'done';
  const isInProgress = task.status === 'in_progress';
  return (
    <View style={styles.taskCard}>
      <View style={styles.taskCardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]}>{task.title}</Text>
          <View style={styles.taskMeta}>
            {task.deadline ? (
              <Text style={styles.taskMetaText}>
                📅 {new Date(task.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            ) : null}
            {task.duration_hours ? <Text style={styles.taskMetaText}>⏱ {task.duration_hours}h</Text> : null}
          </View>
        </View>
        <TouchableOpacity
          style={[styles.taskDeleteBtn, deleting && { opacity: 0.4 }]}
          onPress={onDelete}
          disabled={deleting}
          activeOpacity={0.7}
        >
          {deleting
            ? <ActivityIndicator size="small" color={colors.textTertiary} />
            : <Text style={styles.taskDeleteText}>✕</Text>}
        </TouchableOpacity>
      </View>
      {!isDone && (
        <View style={styles.taskActions}>
          {!isInProgress && (
            <TouchableOpacity
              style={[styles.taskActionBtn, styles.taskActionProgress, updating && { opacity: 0.5 }]}
              onPress={() => onUpdateStatus(task, 'in_progress')}
              disabled={updating}
              activeOpacity={0.8}
            >
              {updating
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={styles.taskActionProgressText}>→ In Progress</Text>}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.taskActionBtn, styles.taskActionDone, updating && { opacity: 0.5 }]}
            onPress={() => onUpdateStatus(task, 'done')}
            disabled={updating}
            activeOpacity={0.8}
          >
            {updating
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.taskActionDoneText}>✓ Done</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function FreePeriodSuggestions({ tasks }) {
  const today = new Date();
  const dow = today.getDay(); // 0 = Sun, 6 = Sat
  const isWeekend = dow === 0 || dow === 6;
  const pending = tasks.filter(t => t.status === 'pending');

  if (isWeekend) {
    return (
      <View style={styles.suggestionCard}>
        <Text style={styles.suggestionEmoji}>🌅</Text>
        <Text style={styles.suggestionTitle}>It's the weekend!</Text>
        <Text style={styles.suggestionBody}>Enjoy your break. Your tasks will be here on Monday.</Text>
      </View>
    );
  }

  if (pending.length === 0) {
    return (
      <View style={styles.suggestionCard}>
        <Text style={styles.suggestionEmoji}>🎉</Text>
        <Text style={styles.suggestionTitle}>All caught up!</Text>
        <Text style={styles.suggestionBody}>No pending tasks. Enjoy your free periods today.</Text>
      </View>
    );
  }

  const sorted = [...pending].sort((a, b) => {
    if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  const top = sorted[0];
  const dueText = top.deadline
    ? ` — due ${new Date(top.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    : '';

  return (
    <>
      {MOCK_FREE_PERIODS.map(p => (
        <View key={p.label} style={styles.suggestionCard}>
          <View style={styles.suggestionRow}>
            <Text style={styles.suggestionEmoji}>🕐</Text>
            <Text style={styles.suggestionPeriod}>Free period at {p.label} today</Text>
          </View>
          <Text style={styles.suggestionBody}>
            Consider working on{' '}
            <Text style={styles.suggestionTask}>{top.title}</Text>
            {dueText}
            {top.duration_hours ? ` · ${top.duration_hours}h` : ''}
          </Text>
        </View>
      ))}
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: 40 },

  tabBar: {
    flexDirection: 'row', backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm, paddingTop: spacing.xs,
  },
  tabBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 11,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: colors.primary },
  tabBtnText: { fontSize: 12, ...font.semibold, color: colors.textTertiary },
  tabBtnTextActive: { color: colors.primary },

  addedBadge: {
    backgroundColor: colors.greenLight, borderRadius: radius.full,
    paddingHorizontal: 5, paddingVertical: 1,
    borderWidth: 1, borderColor: colors.greenBorder,
  },
  addedBadgeText: { fontSize: 7, ...font.bold, color: colors.green, letterSpacing: 0.5 },
  menteeRemoveBtn: { borderColor: colors.red },
  menteeRemoveText: { fontSize: 13, ...font.bold, color: colors.red },

  addMenteeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: 2,
  },
  addMenteeName: { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  addMenteeSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  addMenteeBtn: {
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 8, minWidth: 60, alignItems: 'center',
  },
  addMenteeBtnText: { fontSize: 12, ...font.bold, color: '#fff' },
  addMenteeAdded: {
    borderWidth: 1, borderColor: colors.greenBorder, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 8, minWidth: 60, alignItems: 'center',
    backgroundColor: colors.greenLight,
  },
  addMenteeAddedText: { fontSize: 11, ...font.semibold, color: colors.green },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    padding: spacing.md, gap: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, ...font.bold, color: '#fff' },
  logoMark: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logoMarkIcon: { color: '#fff', fontSize: 22, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  teacherName: { fontSize: 15, ...font.bold, color: colors.textPrimary, flexShrink: 1 },
  teacherSpec: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  hodBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1, borderColor: colors.primary },
  hodBadgeText: { fontSize: 9, ...font.bold, color: colors.primary, letterSpacing: 0.6 },
  signOutBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 7 },
  signOutText: { fontSize: 12, color: colors.textSecondary, ...font.medium },
  bellBadge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  bellBadgeText: { fontSize: 9, color: '#fff', fontWeight: '700' },

  notifOverlay: { flex: 1, justifyContent: 'flex-end' },
  notifBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  notifPanel: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.border, maxHeight: '85%' },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  notifHeaderTitle: { fontSize: 18, ...font.bold, color: colors.textPrimary },
  notifHeaderSub: { fontSize: 12, color: colors.primary, ...font.semibold, marginTop: 2 },
  markAllBtn: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm },
  markAllText: { fontSize: 11, color: colors.textSecondary, ...font.medium },
  notifCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  notifCloseText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  notifItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  notifItemUnread: { backgroundColor: colors.primaryLight },
  notifIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifIconUnread: { borderColor: colors.primary },
  notifTitle: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  notifTitleUnread: { color: colors.textPrimary, ...font.semibold },
  notifBody: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  notifTapHint: { fontSize: 10, color: colors.primary, marginTop: 4, ...font.medium },
  notifTime: { fontSize: 10, color: colors.textTertiary },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },

  section: { marginBottom: spacing.lg },
  sectionLabel: { fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold, marginBottom: spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  createBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
  createBtnText: { color: '#fff', fontSize: 12, ...font.bold },

  emptyCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center' },
  emptyIcon: { fontSize: 28, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textSecondary, ...font.medium, marginBottom: 4 },
  emptyHint: { fontSize: 12, color: colors.textTertiary, textAlign: 'center' },

  menteeCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  menteeAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  menteeAvatarText: { fontSize: 14, ...font.bold },
  menteeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  menteeName: { fontSize: 14, ...font.semibold, color: colors.textPrimary, flex: 1 },
  menteeSub: { fontSize: 11, color: colors.textTertiary, marginBottom: spacing.xs },
  visitsLabel: { fontSize: 11, color: colors.textTertiary, ...font.medium },
  visitsLabelDone: { color: colors.green },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  progressFillDone: { backgroundColor: colors.green },
  menteeActions: { gap: spacing.xs },
  menteeActionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  menteeActionIcon: { fontSize: 16 },
  menteeLogBtn: { borderColor: colors.primary },
  menteeLogBtnDone: { borderColor: colors.green },
  menteeLogText: { fontSize: 13, ...font.bold, color: colors.primary },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, marginBottom: spacing.sm },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, padding: 0 },

  studentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  studentRowReal: { borderColor: colors.green, backgroundColor: colors.card },
  activeBadge: { backgroundColor: '#14532d22', borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: colors.green },
  activeBadgeText: { fontSize: 8, ...font.bold, color: colors.green, letterSpacing: 0.4 },
  studentAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  studentAvatarText: { fontSize: 13, ...font.bold },
  studentName: { fontSize: 14, ...font.semibold, color: colors.textPrimary, flexShrink: 1 },
  studentSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  studentChatBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  menteeBadge: { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: colors.primary },
  menteeBadgeText: { fontSize: 8, ...font.bold, color: colors.primary, letterSpacing: 0.5 },

  announceCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  announceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  announceTitle: { fontSize: 14, ...font.semibold, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  announceTime: { fontSize: 10, color: colors.textTertiary, ...font.medium },
  announceBody: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

  groupCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  groupCardLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  groupEmoji: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  groupName: { fontSize: 13, ...font.semibold, color: colors.textPrimary, marginBottom: 2 },
  groupDesc: { fontSize: 11, color: colors.textTertiary, marginBottom: spacing.xs },
  visibleToRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  visiblePill: { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: colors.primary },
  visiblePillText: { fontSize: 9, color: colors.primary, ...font.semibold },
  groupMeta: { alignItems: 'flex-end', gap: 6 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  groupMembers: { fontSize: 11, color: colors.textSecondary },

  clubAdminCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, marginBottom: spacing.sm, overflow: 'hidden' },
  clubDashBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.amber,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    backgroundColor: colors.amberLight,
  },
  clubDashBtnIcon: { fontSize: 16 },
  clubDashBtnText: { flex: 1, fontSize: 13, ...font.semibold, color: colors.amber },
  clubDashBtnArrow: { fontSize: 18, color: colors.amber },
  clubAdminHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  clubAdminEmoji: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  clubAdminName: { fontSize: 13, ...font.semibold, color: colors.textPrimary },
  clubAdminMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  clubAdminBody: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md },
  clubAdminEmpty: { fontSize: 12, color: colors.textTertiary, textAlign: 'center', paddingVertical: 8 },
  reqBadge: { backgroundColor: colors.amber, borderRadius: radius.full, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  reqBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  reqName: { fontSize: 13, ...font.semibold, color: colors.textPrimary },
  reqSub: { fontSize: 11, color: colors.textTertiary },
  reqMsg: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  reqApprove: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  reqApproveText: { fontSize: 14, color: '#fff', fontWeight: '700' },
  reqReject: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  reqRejectText: { fontSize: 14, color: colors.textSecondary, fontWeight: '700' },

  requestCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  requestCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  requestClubName: { fontSize: 14, ...font.semibold, color: colors.textPrimary, flex: 1 },
  statusPill: { borderWidth: 1, borderColor: colors.amber, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  statusApproved: { borderColor: colors.green },
  statusRejected: { borderColor: colors.red },
  statusText: { fontSize: 9, ...font.bold, color: colors.amber, letterSpacing: 0.5 },
  statusTextApproved: { color: colors.green },
  statusTextRejected: { color: colors.red },
  requestReason: { fontSize: 12, color: colors.textTertiary, fontStyle: 'italic' },
  requestError: { fontSize: 12, color: colors.red, marginBottom: spacing.sm },

  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.primaryLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.primary },
  profileAvatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { fontSize: 18, ...font.bold },
  profileName: { fontSize: 16, ...font.bold, color: colors.textPrimary },
  profileSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  profileRow: { marginBottom: spacing.md },
  profileLabel: { fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold, marginBottom: 6 },
  profileValue: { fontSize: 14, color: colors.textPrimary },
  visitsProgressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  profileActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  profileDmBtn: { flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  profileDmBtnText: { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  profileVisitBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  profileVisitBtnText: { fontSize: 14, ...font.bold, color: '#fff' },
  visitHistoryItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  visitHistoryDate: { fontSize: 12, color: colors.textSecondary, ...font.medium, minWidth: 90 },
  visitHistoryNote: { fontSize: 12, color: colors.textTertiary, flex: 1 },

  chatOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  chatPanel: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.border, maxHeight: '88%', flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chatAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  chatAvatarText: { fontSize: 13, ...font.bold },
  chatHeaderName: { fontSize: 14, ...font.bold, color: colors.textPrimary },
  chatHeaderSub: { fontSize: 11, color: colors.textSecondary },
  chatBody: { flex: 1 },
  chatEmpty: { alignItems: 'center', paddingTop: 60 },
  chatEmptyText: { fontSize: 13, color: colors.textTertiary },
  bubble: { maxWidth: '78%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  bubbleIn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleOut: { backgroundColor: colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleSender: { fontSize: 10, color: colors.textTertiary, ...font.semibold, marginBottom: 3 },
  bubbleText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  bubbleTextOut: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: colors.textTertiary, marginTop: 3, alignSelf: 'flex-end' },
  chatMediaBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  chatInput: { flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, color: colors.textPrimary },
  chatSendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  chatSendIcon: { fontSize: 16, color: '#fff' },
  chatNoAccount: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  chatNoAccountText: { fontSize: 12, color: colors.textTertiary, textAlign: 'center', lineHeight: 17 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '92%', borderWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: 18, ...font.bold, color: colors.textPrimary },
  modalClose: { fontSize: 22, color: colors.textSecondary, padding: 4 },
  modalLabel: { fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold, marginBottom: 6, marginTop: spacing.sm },
  modalHint: { fontSize: 11, color: colors.textTertiary, marginBottom: spacing.sm, marginTop: -4 },
  modalInput: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, fontSize: 14 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiOption: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  emojiOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  emojiOptionText: { fontSize: 22 },
  courseCheckRow: { gap: spacing.xs },
  courseCheck: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, paddingHorizontal: spacing.md, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  courseCheckActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { fontSize: 12, color: '#fff', ...font.bold },
  courseCheckText: { fontSize: 13, color: colors.textSecondary, ...font.medium },
  courseCheckTextActive: { color: colors.textPrimary, ...font.semibold },
  modalSubmit: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, marginTop: spacing.lg, alignItems: 'center' },
  modalSubmitText: { color: '#fff', fontSize: 15, ...font.bold },
  timetableCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md,
  },
  timetableCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  timetableCardIcon: {
    width: 50, height: 50, borderRadius: radius.md,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.primary,
  },
  timetableCardTitle: { fontSize: 14, ...font.bold, color: colors.textPrimary, marginBottom: 3 },
  timetablePreviewBadge: {
    backgroundColor: colors.amberLight, borderWidth: 1, borderColor: colors.amber,
    borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2,
  },
  timetablePreviewText: { fontSize: 8, ...font.bold, color: colors.amber, letterSpacing: 0.6 },
  timetableCardDesc: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },

  clubChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full },
  clubChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  clubChipText: { fontSize: 13, color: colors.textSecondary, ...font.medium },
  clubChipTextActive: { color: colors.primary, ...font.semibold },

  taskCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  taskCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  taskTitle: { fontSize: 14, ...font.semibold, color: colors.textPrimary, lineHeight: 20, flexShrink: 1 },
  taskTitleDone: { color: colors.textTertiary, textDecorationLine: 'line-through' },
  taskMeta: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: 4 },
  taskMetaText: { fontSize: 11, color: colors.textTertiary },
  taskDeleteBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  taskDeleteText: { fontSize: 14, color: colors.textTertiary },
  taskActions: { flexDirection: 'row', gap: 8, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  taskActionBtn: { borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 6, minWidth: 88, alignItems: 'center' },
  taskActionProgress: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary },
  taskActionProgressText: { fontSize: 12, color: colors.primary, ...font.semibold },
  taskActionDone: { backgroundColor: colors.green },
  taskActionDoneText: { fontSize: 12, color: '#fff', ...font.bold },
  taskGroupLabel: { fontSize: 9, color: colors.textTertiary, letterSpacing: 0.8, ...font.bold, marginBottom: spacing.xs, marginTop: spacing.sm, paddingLeft: 2 },

  suggestionCard: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  suggestionEmoji: { fontSize: 22, marginBottom: 6 },
  suggestionPeriod: { fontSize: 13, ...font.bold, color: colors.primary },
  suggestionTitle: { fontSize: 14, ...font.bold, color: colors.textPrimary, marginBottom: 4 },
  suggestionBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  suggestionTask: { color: colors.textPrimary, ...font.semibold },

  groupInviteCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  groupInviteEmoji: { fontSize: 26 },
  groupInviteName: { fontSize: 13, ...font.semibold, color: colors.textPrimary },
  groupInviteMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  groupInviteActions: { flexDirection: 'row', gap: 8 },
  groupInviteDeclineBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  groupInviteDeclineText: { fontSize: 12, color: colors.textSecondary, ...font.semibold },
  groupInviteAcceptBtn: {
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  groupInviteAcceptText: { fontSize: 12, color: '#fff', ...font.bold },

  // Subject request modal
  fieldLabel: { fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold, marginBottom: 6, marginTop: spacing.sm },
  textInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, fontSize: 14,
    marginBottom: spacing.sm,
  },
  classOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  classOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  classOptionText: { fontSize: 14, color: colors.textSecondary, ...font.medium },
  classOptionTextActive: { color: colors.primary, ...font.bold },
  errorText: { fontSize: 12, color: colors.red, marginBottom: spacing.sm, textAlign: 'center' },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm,
  },
  submitBtnText: { fontSize: 15, ...font.bold, color: '#fff' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },

  // My Subjects
  mySubjectCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  mySubjectName: { fontSize: 14, ...font.semibold, color: colors.textPrimary, marginBottom: 2 },
  mySubjectMeta: { fontSize: 11, color: colors.textTertiary },
  subjectRemoveBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.redLight, borderWidth: 1, borderColor: colors.red,
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm,
  },
  subjectRemoveText: { fontSize: 14, color: colors.red, ...font.bold },

  // Add Subject modal rows
  addSubjectRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: 2,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  addSubjectName: { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  addSubjectMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  addSubjectPlus: { fontSize: 20, color: colors.primary, ...font.bold, paddingHorizontal: 4 },

  // Event approval cards
  eventApprovalCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  eventApprovalTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: 4 },
  eventApprovalName: { fontSize: 14, ...font.bold, color: colors.textPrimary },
  eventApprovalMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  eventApprovalDesc: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 17 },
  affectedSlotsBox: {
    backgroundColor: colors.primaryLight, borderRadius: radius.sm,
    padding: spacing.sm, marginBottom: spacing.sm,
  },
  affectedSlotsLabel: { fontSize: 9, ...font.bold, color: colors.primary, letterSpacing: 0.6, marginBottom: 4 },
  affectedSlotRow: { fontSize: 12, color: colors.textPrimary, lineHeight: 18 },
  eventEditBtn: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0,
  },
  eventEditBtnText: { fontSize: 11, color: colors.textSecondary, ...font.semibold },

  todayClassCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  todayClassPeriodBadge: {
    backgroundColor: colors.primaryLight, borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    minWidth: 46, alignItems: 'center',
  },
  todayClassPeriodText: { fontSize: 13, ...font.bold, color: colors.primary },
  todayClassTime: { fontSize: 9, color: colors.primary, marginTop: 2 },
  todayClassBody: { flex: 1 },
  todayClassName: { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  todayClassSubject: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  // Mentee card next session
  menteeNextSession: { fontSize: 10, color: colors.primary, ...font.semibold, marginTop: 2 },

  // Profile modal sections
  profileRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  profileEditLink: { fontSize: 12, color: colors.primary, ...font.semibold },
  progressEditBox: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 12, gap: 6 },
  progressEditRow: { flexDirection: 'row', gap: 8 },
  progressEditLabel: { fontSize: 9, ...font.bold, color: colors.textTertiary, letterSpacing: 0.6, marginBottom: 4 },
  progressEditInput: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, padding: 10, color: colors.textPrimary, fontSize: 13,
    marginBottom: 8,
  },
  progressDisplayRow: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  progressStat: { fontSize: 12, color: colors.textSecondary },
  progressStatVal: { ...font.bold, color: colors.textPrimary },
  progressNoteText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },
  scheduleDate: { fontSize: 13, ...font.semibold, color: colors.primary, marginBottom: 2 },
  modalSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // Appearance / theme picker
  sectionHint: { fontSize: 12, color: colors.textTertiary, lineHeight: 18 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  themeCard: {
    width: '30%', flexGrow: 1,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: 5,
  },
  themeCardActive: { borderColor: colors.primary, borderWidth: 2 },
  themeCardDimmed: { opacity: 0.45 },
  swatchRow: { flexDirection: 'row', gap: 3, marginBottom: 2 },
  swatchDot: { width: 14, height: 14, borderRadius: 7 },
  themeLabel: { fontSize: 11, ...font.semibold, color: colors.textPrimary },
  themeLabelActive: { color: colors.primary },
  themeDesc: { fontSize: 10, color: colors.textTertiary },
});
