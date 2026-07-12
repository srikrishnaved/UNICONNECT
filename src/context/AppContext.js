import React, { createContext, useState, useContext, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { hubEvents as seedEvents, teachers, studyGroups as seedGroups } from '../data';
import { computeClass } from '../lib/classUtils';

const getSignUpUniversityId = async () => {
  if (typeof window !== 'undefined' && window.location) {
    const searchParams = new URLSearchParams(window.location.search);
    const uniParam = searchParams.get('uni');
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    let subdomain = uniParam;
    if (!subdomain && parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'dist-psi-ten-59') {
      subdomain = parts[0];
    }
    if (subdomain) {
      const { data: rows } = await supabase
        .from('university_setup_progress')
        .select('university_id')
        .eq('is_setup_complete', true)
        .ilike('university_website', `%${subdomain}%`)
        .limit(1);
      if (rows && rows.length > 0) {
        return rows[0].university_id;
      }
    }
  }
  return '290a9e2c-c6b3-4397-a3ee-fd95f6e0addd';
};

const AppContext = createContext();

export function AppProvider({ children }) {
  // 'loading' | 'onboarding' | 'admin' | 'app' | 'teacher'
  const [mode, setMode] = useState('loading');
  const [isAppAdmin, setIsAppAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [teacherGroups, setTeacherGroups] = useState([]);
  const [studentGroups, setStudentGroups] = useState(seedGroups);
  const [events, setEvents] = useState(seedEvents);
  const [clubAdminRequests, setClubAdminRequests] = useState([]);
  const [approvedClubAdmins, setApprovedClubAdmins] = useState(new Set());
  const [clubMemberships, setClubMemberships] = useState(new Set());
  const [userCreatedClubs, setUserCreatedClubs] = useState([]);
  const [myClubRequests, setMyClubRequests] = useState([]);
  const [hiddenClubIds, setHiddenClubIds] = useState(new Set());

  // ── Notifications ───────────────────────────────────────────────────────────
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = async (userId) => {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    setUnreadCount(count || 0);
  };

  const createNotification = async (userId, type, title, body = null, meta = null) => {
    if (!userId) return;
    await supabase.from('notifications').insert({ user_id: userId, type, title, body, meta });
    if (userId === userProfile?.id) setUnreadCount(prev => prev + 1);
  };

  const loadHubEvents = async () => {
    const { data } = await supabase
      .from('hub_events')
      .select('*')
      .order('created_at', { ascending: false });
    if (data && data.length > 0) {
      const dbEvents = data.map(e => ({
        id: e.id,
        clubId: e.club_id,
        title: e.title,
        time: e.time || '',
        venue: e.venue || '',
        when: e.when || 'upcoming',
        event_date: e.event_date || null,
        interested: e.interested || 0,
        desc: e.description || '',
        isRecruitment: e.is_recruitment || false,
        imageUri: e.image_uri || null,
        teams_needed: e.teams_needed || [],
      }));
      setEvents(prev => {
        const dbIds = new Set(dbEvents.map(e => String(e.id)));
        const seedOnly = prev.filter(e => !dbIds.has(String(e.id)));
        return [...dbEvents, ...seedOnly];
      });
    }
  };

  // ── Persistent user data ────────────────────────────────────────────────────
  const [joinedGroupIds, setJoinedGroupIds] = useState(new Set());
  const [interestedEventIds, setInterestedEventIds] = useState(new Set());
  const [followingClubIds, setFollowingClubIds] = useState(new Set());
  const [connections, setConnections] = useState(new Set());
  const [pendingOutgoing, setPendingOutgoing] = useState(new Set());
  const [createdGroupIds, setCreatedGroupIds] = useState(new Set());
  const [blockedIds, setBlockedIds] = useState(new Set());
  // ── CR (Class Representative) ───────────────────────────────────────────────
  const [crStatus, setCrStatus] = useState(null); // null | 'pending' | 'approved' | 'rejected'
  const [requiresBio, setRequiresBio] = useState(false);
  const [sapsRole, setSapsRole] = useState(null); // null or one of the 5 SAPS roles
  // App Admin "Test as faculty" — persists across all screens
  const [adminTestAsName, setAdminTestAsName] = useState('');

  // Load all persisted user data from Supabase after sign-in
  const loadUserData = async (userId) => {
    const [groupsRes, eventsRes, clubsRes, connsRes, createdRes, studentGroupsRes, blockedRes, clubAdminsRes, membershipsRes, pendingRes, acceptedSentRes, sapsRes] = await Promise.all([
      supabase.from('group_memberships').select('group_id').eq('user_id', userId),
      supabase.from('event_interests').select('event_id').eq('user_id', userId),
      supabase.from('club_following').select('club_id').eq('user_id', userId),
      supabase.from('user_connections').select('connected_to').eq('user_id', userId),
      supabase.from('created_groups').select('group_id').eq('user_id', userId),
      supabase.from('student_groups').select('*').order('created_at', { ascending: false }),
      supabase.from('blocked_users').select('blocked_id').eq('user_id', userId),
      supabase.from('club_admins').select('club_id').eq('user_id', userId),
      supabase.from('club_memberships').select('club_id').eq('user_id', userId),
      supabase.from('connection_requests').select('to_user_id').eq('from_user_id', userId).eq('status', 'pending'),
      supabase.from('connection_requests').select('to_user_id').eq('from_user_id', userId).eq('status', 'accepted'),
      supabase.from('saps_members').select('role').eq('profile_id', userId).maybeSingle(),
    ]);
    loadUnreadCount(userId);
    loadHubEvents();
    // Load CR status
    supabase.from('cr_requests').select('status').eq('user_id', userId).order('created_at', { ascending: false }).limit(1)
      .then(({ data, error }) => { if (!error && data && data.length > 0) setCrStatus(data[0].status); });
    // Load user-created clubs and the user's own club creation requests
    supabase.from('user_clubs').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setUserCreatedClubs(data); });
    supabase.from('hidden_clubs').select('club_id')
      .then(({ data }) => { if (data) setHiddenClubIds(new Set(data.map(r => r.club_id))); });
    supabase.from('club_creation_requests').select('*').eq('creator_id', userId).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setMyClubRequests(data); });
    if (groupsRes.data) setJoinedGroupIds(new Set(groupsRes.data.map(r => r.group_id)));
    if (eventsRes.data) setInterestedEventIds(new Set(eventsRes.data.map(r => r.event_id)));
    if (clubsRes.data) setFollowingClubIds(new Set(clubsRes.data.map(r => r.club_id)));
    // Merge user_connections rows + accepted sent requests (RLS prevents acceptor inserting on sender's behalf)
    setConnections(new Set([
      ...(connsRes.data || []).map(r => r.connected_to),
      ...(acceptedSentRes.data || []).map(r => r.to_user_id),
    ]));
    if (createdRes.data) setCreatedGroupIds(new Set(createdRes.data.map(r => r.group_id)));
    if (blockedRes.data) setBlockedIds(new Set(blockedRes.data.map(r => r.blocked_id)));
    if (clubAdminsRes.data) setApprovedClubAdmins(new Set(clubAdminsRes.data.map(r => r.club_id)));
    if (membershipsRes.data) setClubMemberships(new Set(membershipsRes.data.map(r => r.club_id)));
    if (pendingRes.data) setPendingOutgoing(new Set(pendingRes.data.map(r => r.to_user_id)));
    setSapsRole(sapsRes.data?.role || null);
    if (studentGroupsRes.data && studentGroupsRes.data.length > 0) {
      const dbGroups = studentGroupsRes.data.map(g => ({
        id: Number(g.id),
        name: g.name,
        course: g.course,
        emoji: g.emoji,
        desc: g.description,
        members: g.members,
        active: g.active,
        recentMessages: [],
      }));
      setStudentGroups(prev => {
        const existingIds = new Set(prev.map(g => String(g.id)));
        const newGroups = dbGroups.filter(g => !existingIds.has(String(g.id)));
        return [...newGroups, ...prev];
      });
    }
  };

  useEffect(() => {
    const recovery = { active: false };

    const checkRecoveryUrl = () => {
      if (typeof window === 'undefined') return false;
      return (
        window.location.hash.includes('type=recovery') ||
        window.location.search.includes('type=recovery')
      );
    };

    // Synchronous check before registering the listener — this runs before
    // Supabase fires any events, so recovery.active is true from the start
    // if the user landed here via a password-reset link.
    if (checkRecoveryUrl()) {
      recovery.active = true;
      setMode('resetPassword');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          recovery.active = true;
          setMode('resetPassword');
          return;
        }

        if (event === 'INITIAL_SESSION') {
          if (recovery.active) return;

          if (session?.user) {
            try {
              const { data: profile, error: profileErr } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

              if (profileErr) throw profileErr;
              if (recovery.active) return;

              if (profile) {
                if (profile.role === 'teacher') {
                  if (profile.status === 'pending') {
                    setUserProfile(profile);
                    if (recovery.active) return;
                    setMode('teacherPending');
                    return;
                  }
                  if (profile.status === 'rejected') {
                    if (recovery.active) return;
                    await supabase.auth.signOut();
                    setMode('onboarding');
                    return;
                  }
                  if (profile.status === 'active') {
                    const [{ data: tp }, { data: fcRows }] = await Promise.all([
                      supabase.from('teacher_profiles').select('*').eq('id', profile.id).maybeSingle(),
                      supabase.from('faculty_coordinators').select('club_id').eq('teacher_name', profile.name),
                    ]);
                    setUserProfile(profile);
                    setTeacherProfile({
                      id: profile.id,
                      name: profile.name,
                      email: profile.email,
                      subjects: tp?.subjects || [],
                      faculty_type: tp?.faculty_type || 'full-time',
                      available_days: tp?.available_days || [],
                      department: tp?.department || '',
                      seed_teacher_id: tp?.seed_teacher_id ?? null,
                      coordinatorClubIds: (fcRows || []).map(r => /^\d+$/.test(String(r.club_id)) ? Number(r.club_id) : r.club_id),
                      isSupabaseTeacher: true,
                      isHOD: false,
                      university_id: profile.university_id,
                    });
                    if (recovery.active) return;
                    setMode('teacher');
                    return;
                  }
                }

                setUserProfile(profile);
                await loadUserData(session.user.id);
                if (recovery.active) return;
                if (profile.is_super_admin) {
                  setIsAppAdmin(true);
                  loadClubAdminRequests();
                }
                setRequiresBio(!profile.is_super_admin && (!profile.bio || profile.bio.trim().length < 20));
                setMode('app');
              } else {
                setMode('onboarding');
              }
            } catch (err) {
              console.error('[INITIAL_SESSION] failed to load profile:', err);
              setMode('onboarding');
            }
          } else {
            Promise.all([
              AsyncStorage.getItem('adminSession'),
              AsyncStorage.getItem('teacherProfile'),
            ])
              .then(([admin, teacher]) => {
                if (recovery.active) return;
                if (admin) { setIsAppAdmin(true); loadClubAdminRequests(); setMode('app'); }
                else if (teacher) { const stored = JSON.parse(teacher); const fresh = teachers.find(t => t.id === stored.id) || stored; setTeacherProfile(fresh); setMode('teacher'); }
                else { setMode('onboarding'); }
              })
              .catch(() => setMode('onboarding'));
          }
          return;
        }

        if (event === 'SIGNED_OUT') {
          recovery.active = false;
          setUserProfile(null);
          setTeacherProfile(null);
          setIsAppAdmin(false);
          setJoinedGroupIds(new Set());
          setInterestedEventIds(new Set());
          setFollowingClubIds(new Set());
          setConnections(new Set());
          setCreatedGroupIds(new Set());
          setBlockedIds(new Set());
          setApprovedClubAdmins(new Set());
          setClubAdminRequests([]);
          setClubMemberships(new Set());
          setStudentGroups(seedGroups);
          setUnreadCount(0);
          setPendingOutgoing(new Set());
          setCrStatus(null);
          setRequiresBio(false);
          setSapsRole(null);
          setUserCreatedClubs([]);
          setMyClubRequests([]);
          setMode('onboarding');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Re-fetch connection state (used on visibility change) ────────────────────
  const refreshConnections = async (userId) => {
    const [connsRes, pendingRes, acceptedSentRes] = await Promise.all([
      supabase.from('user_connections').select('connected_to').eq('user_id', userId),
      supabase.from('connection_requests').select('to_user_id').eq('from_user_id', userId).eq('status', 'pending'),
      supabase.from('connection_requests').select('to_user_id').eq('from_user_id', userId).eq('status', 'accepted'),
    ]);
    setConnections(new Set([
      ...(connsRes.data || []).map(r => r.connected_to),
      ...(acceptedSentRes.data || []).map(r => r.to_user_id),
    ]));
    if (pendingRes.data) setPendingOutgoing(new Set(pendingRes.data.map(r => r.to_user_id)));
  };

  // Poll every 5s while there are pending outgoing requests
  useEffect(() => {
    if (!userProfile?.id || pendingOutgoing.size === 0) return;
    const id = setInterval(() => refreshConnections(userProfile.id), 5000);
    return () => clearInterval(id);
  }, [userProfile?.id, pendingOutgoing.size]);

  // ── Student auth ────────────────────────────────────────────────────────────

  const signUp = async ({ email, password, name, course, year, campus, interests = [], bio = '', section = null }) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      if (error.message?.toLowerCase().includes('already registered') || error.message?.toLowerCase().includes('already exists')) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      }
      throw error;
    }
    const userId = data.user?.id;
    if (!userId) throw new Error('Account creation failed. Please try again.');

    const uniId = await getSignUpUniversityId();
    const profile = {
      id: userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      course,
      year,
      class: computeClass(course, year),
      campus: campus || 'Yeshwanthpur',
      bio: bio.trim(),
      interests,
      role: 'student',
      status: 'active',
      section: section || null,
      university_id: uniId,
    };

    const { error: profileError } = await supabase.from('profiles').insert(profile);
    if (profileError) {
      if (profileError.code !== '23505') {
        console.error('[signUp] profile insert failed:', profileError);
        throw profileError;
      }
      // 23505 = duplicate key — account exists, continue to sign in
    }

    setJoinedGroupIds(new Set());
    setInterestedEventIds(new Set());
    setFollowingClubIds(new Set());
    setConnections(new Set());
    setCreatedGroupIds(new Set());
    setStudentGroups(seedGroups);

    setRequiresBio(bio.trim().length < 20);
    setUserProfile(profile);
    setMode('app');
  };

  const verifyOTP = async ({ email, token, name, course, year, campus, interests = [] }) => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
    if (error) throw error;
    const userId = data.user?.id;
    if (!userId) throw new Error('Verification failed. Please try again.');

    const uniId = await getSignUpUniversityId();
    const profile = {
      id: userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      course,
      year,
      class: computeClass(course, year),
      campus: campus || 'Yeshwanthpur',
      bio: '',
      interests,
      role: 'student',
      status: 'active',
      university_id: uniId,
    };

    const { error: profileError } = await supabase.from('profiles').insert(profile);
    if (profileError && profileError.code !== '23505') throw profileError;

    setJoinedGroupIds(new Set());
    setInterestedEventIds(new Set());
    setFollowingClubIds(new Set());
    setConnections(new Set());
    setCreatedGroupIds(new Set());
    setStudentGroups(seedGroups);

    setUserProfile(profile);
    setMode('app');
  };

  const resendOTP = async (email) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
  };

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) throw new Error('Account setup incomplete. Please delete this account and sign up again.');

    if (profile.role === 'teacher') {
      if (profile.status === 'pending') {
        setUserProfile(profile);
        setMode('teacherPending');
        return;
      }
      if (profile.status === 'rejected') {
        await supabase.auth.signOut();
        throw new Error('Your teacher account application was not approved. Please contact the department administrator.');
      }
      if (profile.status === 'active') {
        const [{ data: tp }, { data: fcRows }] = await Promise.all([
          supabase.from('teacher_profiles').select('*').eq('id', profile.id).maybeSingle(),
          supabase.from('faculty_coordinators').select('club_id').eq('teacher_name', profile.name),
        ]);
        setUserProfile(profile);
        setTeacherProfile({
          id: profile.id,
          name: profile.name,
          display_name: profile.display_name || null,
          email: profile.email,
          subjects: tp?.subjects || [],
          faculty_type: tp?.faculty_type || 'full-time',
          available_days: tp?.available_days || [],
          department: tp?.department || '',
          seed_teacher_id: tp?.seed_teacher_id ?? null,
          coordinatorClubIds: (fcRows || []).map(r => /^\d+$/.test(String(r.club_id)) ? Number(r.club_id) : r.club_id),
          isSupabaseTeacher: true,
          isHOD: false,
          university_id: profile.university_id,
        });
        setMode('teacher');
        return;
      }
    }

    setUserProfile(profile);
    await loadUserData(data.user.id);
    if (profile.is_super_admin) {
      setIsAppAdmin(true);
      loadClubAdminRequests();
    }
    setMode('app');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    AsyncStorage.removeItem('adminSession').catch(() => {});
    setUserProfile(null);
    setIsAppAdmin(false);
    setJoinedGroupIds(new Set());
    setInterestedEventIds(new Set());
    setFollowingClubIds(new Set());
    setConnections(new Set());
    setCreatedGroupIds(new Set());
    setBlockedIds(new Set());
    setApprovedClubAdmins(new Set());
    setClubAdminRequests([]);
    setClubMemberships(new Set());
    setPendingOutgoing(new Set());
    setStudentGroups(seedGroups);
    setMode('onboarding');
  };

  const updateProfile = async (updates) => {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (!userId) return;

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (!error) setUserProfile(prev => ({ ...prev, ...updates }));
  };

  const setUserProfileLocal = (profile) => setUserProfile(profile);

  const sendPasswordReset = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'https://uniconnect-platform-gamma.vercel.app',
    });
    if (error) throw error;
  };

  const resetPassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    await signOut();
  };

  const deleteAccount = async () => {
    await supabase.rpc('delete_current_user');
    await signOut();
  };

  // ── Teacher auth ────────────────────────────────────────────────────────────

  const teacherLogin = (code, rememberMe) => {
    const teacher = teachers.find(t => t.code === code.trim());
    if (!teacher) return false;
    setTeacherProfile(teacher);
    if (rememberMe) {
      AsyncStorage.setItem('teacherProfile', JSON.stringify(teacher)).catch(() => {});
    }
    setMode('teacher');
    return true;
  };

  const teacherSignOut = () => {
    AsyncStorage.removeItem('teacherProfile').catch(() => {});
    setTeacherProfile(null);
    setUserProfile(null);
    setMode('onboarding');
    supabase.auth.signOut().catch(() => {});
  };

  const checkTeacherApproval = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (!profile) return;
    if (profile.status === 'active' && profile.role === 'teacher') {
      const [{ data: tp }, { data: fcRows }] = await Promise.all([
        supabase.from('teacher_profiles').select('*').eq('id', profile.id).maybeSingle(),
        supabase.from('faculty_coordinators').select('club_id').eq('teacher_name', profile.name),
      ]);
      setUserProfile(profile);
      setTeacherProfile({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        subjects: tp?.subjects || [],
        faculty_type: tp?.faculty_type || 'full-time',
        available_days: tp?.available_days || [],
        department: tp?.department || '',
        seed_teacher_id: tp?.seed_teacher_id ?? null,
        coordinatorClubIds: (fcRows || []).map(r => /^\d+$/.test(String(r.club_id)) ? Number(r.club_id) : r.club_id),
        isSupabaseTeacher: true,
        isHOD: false,
        university_id: profile.university_id,
      });
      setMode('teacher');
    }
    return profile.status;
  };

  const registerTeacher = async ({ name, email, password, subjects = '', facultyType, availableDays, subjectIds = [], seedTeacherId = null }) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      if (error.message?.toLowerCase().includes('already registered') || error.message?.toLowerCase().includes('already exists')) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      }
      throw error;
    }
    const userId = data.user?.id;
    if (!userId) throw new Error('Account creation failed. Please try again.');

    const subjectsArray = subjects ? subjects.split(',').map(s => s.trim()).filter(Boolean) : [];

    const uniId = await getSignUpUniversityId();
    const profile = {
      id: userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: 'teacher',
      status: 'pending',
      course: 'Faculty',
      year: 'N/A',
      campus: 'Yeshwanthpur',
      bio: '',
      interests: [],
      university_id: uniId,
    };

    const { error: profileError } = await supabase.from('profiles').insert(profile);
    if (profileError && profileError.code !== '23505') throw profileError;

    const { error: tpError } = await supabase.from('teacher_profiles').insert({
      id: userId,
      subjects: subjectsArray,
      faculty_type: facultyType,
      available_days: availableDays,
      ...(seedTeacherId != null ? { seed_teacher_id: seedTeacherId } : {}),
    });
    if (tpError) throw tpError;

    if (subjectIds.length > 0) {
      try {
        await supabase.from('teacher_subjects').insert(
          subjectIds.map(sid => ({ teacher_id: userId, subject_id: sid }))
        );
      } catch (_) {}
    }

    setUserProfile(profile);
    setMode('teacherPending');
    // Notify all super admins of new teacher registration
    supabase.from('profiles').select('id').eq('is_super_admin', true).then(({ data: admins }) => {
      for (const admin of (admins || [])) {
        createNotification(admin.id, 'info', 'New Teacher Registration', `${name.trim()} has registered and is awaiting approval.`);
      }
    });
  };

  const approveTeacher = async (teacherId) => {
    const { error } = await supabase.from('profiles').update({ status: 'active' }).eq('id', teacherId);
    if (error) throw error;
    await supabase.from('notifications').insert({
      user_id: teacherId,
      type: 'info',
      title: 'Your teacher account has been approved!',
      body: 'Welcome to UniConnect. You can now sign in to access the Teacher Dashboard.',
      read: false,
    });
  };

  const rejectTeacher = async (teacherId) => {
    const { error } = await supabase.from('profiles').update({ status: 'rejected' }).eq('id', teacherId);
    if (error) throw error;
    await supabase.from('notifications').insert({
      user_id: teacherId,
      type: 'info',
      title: 'Teacher account application not approved',
      body: 'Your application was reviewed and could not be approved at this time. Please contact the department administrator.',
      read: false,
    });
  };

  // ── Admin auth ──────────────────────────────────────────────────────────────

  const loadClubAdminRequests = async () => {
    const { data } = await supabase
      .from('club_admin_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (data) {
      setClubAdminRequests(data.map(r => ({
        id: r.id,
        userId: r.user_id,
        clubId: r.club_id,
        clubName: r.club_name,
        studentName: r.student_name,
        course: r.course,
        year: r.year,
        reason: r.reason,
        submitted: new Date(r.created_at).toLocaleDateString(),
      })));
    }
  };

  const enterAppAsAdmin = (rememberMe) => {
    setIsAppAdmin(true);
    if (rememberMe) {
      AsyncStorage.setItem('adminSession', 'true').catch(() => {});
    }
    loadClubAdminRequests();
    setMode('app');
  };

  // ── Groups ──────────────────────────────────────────────────────────────────

  const addTeacherGroup = (group) => setTeacherGroups(prev => [group, ...prev]);

  const addStudentGroup = (group) => {
    setStudentGroups(prev => [group, ...prev]);
    if (userProfile?.id) {
      supabase.from('student_groups').insert({
        id: String(group.id),
        creator_id: userProfile.id,
        name: group.name,
        course: group.course,
        emoji: group.emoji,
        description: group.desc,
        members: group.members,
        active: group.active,
      }).then(() => {});
      // Notify all active students about the new group
      supabase.from('profiles').select('id').eq('status', 'active').eq('role', 'student').then(({ data: activeStudents }) => {
        for (const p of (activeStudents || [])) {
          if (p.id !== userProfile.id) {
            createNotification(p.id, 'info', `New Study Group: ${group.name}`, `${userProfile.name || 'A student'} created a new study group`);
          }
        }
      });
    }
  };

  const trackCreatedGroup = (groupId) => {
    const id = String(groupId);
    setCreatedGroupIds(prev => new Set([...prev, id]));
    if (!userProfile?.id) return;
    supabase.from('created_groups').insert({ user_id: userProfile.id, group_id: id }).then(() => {});
  };

  const toggleGroupJoin = (groupId) => {
    const id = String(groupId);
    const isCurrentlyJoined = joinedGroupIds.has(id);

    setJoinedGroupIds(prev => {
      const next = new Set(prev);
      isCurrentlyJoined ? next.delete(id) : next.add(id);
      return next;
    });

    if (!userProfile?.id) return;
    if (isCurrentlyJoined) {
      supabase.from('group_memberships').delete()
        .eq('user_id', userProfile.id).eq('group_id', id).then(() => {});
    } else {
      supabase.from('group_memberships').insert({ user_id: userProfile.id, group_id: id }).then(() => {});
    }
  };

  // ── Event interests ─────────────────────────────────────────────────────────

  const toggleEventInterest = (eventId) => {
    const id = String(eventId);
    const isCurrent = interestedEventIds.has(id);

    setInterestedEventIds(prev => {
      const next = new Set(prev);
      isCurrent ? next.delete(id) : next.add(id);
      return next;
    });

    if (!userProfile?.id) return;
    if (isCurrent) {
      supabase.from('event_interests').delete()
        .eq('user_id', userProfile.id).eq('event_id', id).then(() => {});
    } else {
      supabase.from('event_interests').insert({ user_id: userProfile.id, event_id: id }).then(() => {});
    }
  };

  // ── Club following ──────────────────────────────────────────────────────────

  const toggleClubFollow = (clubId) => {
    const id = String(clubId);
    const isCurrent = followingClubIds.has(id);

    setFollowingClubIds(prev => {
      const next = new Set(prev);
      isCurrent ? next.delete(id) : next.add(id);
      return next;
    });

    if (!userProfile?.id) return;
    if (isCurrent) {
      supabase.from('club_following').delete()
        .eq('user_id', userProfile.id).eq('club_id', id).then(() => {});
    } else {
      supabase.from('club_following').insert({ user_id: userProfile.id, club_id: id }).then(() => {});
    }
  };

  // ── Connections ─────────────────────────────────────────────────────────────

  const toggleConnect = (id) => {
    const strId = String(id);
    const isCurrentlyConnected = connections.has(strId);

    setConnections(prev => {
      const next = new Set(prev);
      isCurrentlyConnected ? next.delete(strId) : next.add(strId);
      return next;
    });

    if (!userProfile?.id) return;
    if (isCurrentlyConnected) {
      supabase.from('user_connections').delete()
        .eq('user_id', userProfile.id).eq('connected_to', strId).then(() => {});
    } else {
      supabase.from('user_connections').insert({ user_id: userProfile.id, connected_to: strId }).then(() => {});
    }
  };

  const isConnected = (id) => connections.has(String(id));

  const hasPendingRequest = (toUserId) => pendingOutgoing.has(String(toUserId));

  const disconnectUser = async (otherUserId) => {
    if (!userProfile?.id) return;
    const strId = String(otherUserId);
    await Promise.all([
      supabase.from('user_connections').delete().eq('user_id', userProfile.id).eq('connected_to', strId),
      supabase.from('user_connections').delete().eq('user_id', strId).eq('connected_to', userProfile.id),
    ]);
    setConnections(prev => { const next = new Set(prev); next.delete(strId); return next; });
  };

  // Pending notification timers — keyed by recipient user ID string.
  // Cleared if the sender undoes within 5 seconds so no notification fires.
  const pendingConnNotifs = React.useRef({});

  const cancelConnectionRequest = async (toUserId) => {
    if (!userProfile?.id) return;
    const strId = String(toUserId);
    // Clear the notification timer if still within the 5-second window
    if (pendingConnNotifs.current[strId]) {
      clearTimeout(pendingConnNotifs.current[strId]);
      delete pendingConnNotifs.current[strId];
    }
    await supabase.from('connection_requests')
      .delete()
      .eq('from_user_id', userProfile.id)
      .eq('to_user_id', strId)
      .eq('status', 'pending');
    setPendingOutgoing(prev => { const next = new Set(prev); next.delete(strId); return next; });
  };

  const sendConnectionRequest = async (toUserId, toUserName) => {
    if (!userProfile?.id) return;
    const strId = String(toUserId);
    if (connections.has(strId) || pendingOutgoing.has(strId)) return;
    setPendingOutgoing(prev => new Set([...prev, strId]));
    const { data } = await supabase.from('connection_requests').insert({
      from_user_id: userProfile.id,
      to_user_id: strId,
    }).select().single();
    if (data) {
      // Delay notification 5 seconds — cancelled if sender rescinds in time
      pendingConnNotifs.current[strId] = setTimeout(() => {
        delete pendingConnNotifs.current[strId];
        createNotification(
          strId, 'connection',
          `${userProfile.name} wants to connect`,
          'Tap to accept or decline',
          { request_id: data.id, from_user_id: userProfile.id, from_name: userProfile.name }
        );
      }, 5000);
    }
  };

  const acceptConnectionRequest = async (requestId, fromUserId) => {
    if (!userProfile?.id) return;
    const strId = String(fromUserId);
    await Promise.all([
      supabase.from('user_connections').insert({ user_id: userProfile.id, connected_to: strId }),
      supabase.from('user_connections').insert({ user_id: strId, connected_to: userProfile.id }),
      supabase.from('connection_requests').update({ status: 'accepted' }).eq('id', requestId),
    ]);
    setConnections(prev => new Set([...prev, strId]));
  };

  const declineConnectionRequest = async (requestId, fromUserId) => {
    await supabase.from('connection_requests').update({ status: 'declined' }).eq('id', requestId);
    if (fromUserId) {
      const strId = String(fromUserId);
      setPendingOutgoing(prev => { const next = new Set(prev); next.delete(strId); return next; });
    }
  };

  // ── Faculty club admin requests ─────────────────────────────────────────────

  const submitFacultyClubRequest = async ({ teacherId, teacherName, clubId, clubName, reason }) => {
    const { error } = await supabase.from('faculty_club_requests').insert({
      teacher_id: String(teacherId),
      teacher_name: teacherName,
      club_id: String(clubId),
      club_name: clubName,
      reason,
      status: 'pending',
    });
    if (error) throw error;
  };

  // ── Club admin requests ─────────────────────────────────────────────────────

  const submitClubAdminRequest = async ({ clubId, clubName, reason }) => {
    if (!userProfile?.id) return;
    const { data, error } = await supabase.from('club_admin_requests').insert({
      user_id: userProfile.id,
      student_name: userProfile.name,
      club_id: clubId,
      club_name: clubName,
      course: userProfile.course ?? '—',
      year: userProfile.year ?? '—',
      reason: reason.trim(),
      status: 'pending',
    }).select().single();
    if (error) throw error;
    setClubAdminRequests(prev => [...prev, {
      id: data.id,
      userId: data.user_id,
      clubId: data.club_id,
      clubName: data.club_name,
      studentName: data.student_name,
      course: data.course,
      year: data.year,
      reason: data.reason,
      submitted: 'just now',
    }]);
    // Notify all current admins of that club
    const requesterName = userProfile?.name || 'A student';
    supabase.from('club_admins').select('user_id').eq('club_id', clubId).then(({ data: admins }) => {
      for (const admin of (admins || [])) {
        if (admin.user_id !== userProfile?.id) {
          createNotification(admin.user_id, 'info', `Admin Request: ${clubName}`, `${requesterName} wants to become an admin of ${clubName}.`);
        }
      }
    });
  };

  const resolveClubAdminRequest = async (id, action) => {
    const req = clubAdminRequests.find(r => r.id === id);
    if (action === 'approve' && req) {
      const { error: insertErr } = await supabase.from('club_admins').insert({
        user_id: req.userId,
        club_id: Number(req.clubId),
        club_name: req.clubName,
      });
      if (insertErr && insertErr.code !== '23505') console.warn('club_admins insert:', insertErr.message);

      // Ensure the admin is also a club member
      await supabase.from('club_memberships').upsert({
        user_id: req.userId,
        club_id: Number(req.clubId),
        club_name: req.clubName,
      }, { onConflict: 'user_id,club_id' });

      if (req.userId === userProfile?.id) {
        setApprovedClubAdmins(prev => new Set([...prev, Number(req.clubId)]));
        setClubMemberships(prev => new Set([...prev, Number(req.clubId)]));
      }
    }
    await supabase.from('club_admin_requests')
      .update({ status: action === 'approve' ? 'approved' : 'rejected' })
      .eq('id', id);
    setClubAdminRequests(prev => prev.filter(r => r.id !== id));
  };

  // ── Club join requests ──────────────────────────────────────────────────────

  const submitClubJoinRequest = async ({ clubId, clubName, message }) => {
    if (!userProfile?.id) return;
    const { data: existing } = await supabase
      .from('club_join_requests')
      .select('id')
      .eq('user_id', userProfile.id)
      .eq('club_id', clubId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('club_join_requests')
        .update({ status: 'pending', message: message?.trim() || null })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('club_join_requests').insert({
        user_id: userProfile.id,
        student_name: userProfile.name,
        club_id: clubId,
        club_name: clubName,
        course: userProfile.course ?? '—',
        year: userProfile.year ?? '—',
        message: message?.trim() || null,
        status: 'pending',
      });
      if (error) throw error;
    }
    // Notify all current admins of that club
    const joiningName = userProfile?.name || 'A student';
    supabase.from('club_admins').select('user_id').eq('club_id', clubId).then(({ data: clubAdmins }) => {
      for (const admin of (clubAdmins || [])) {
        if (admin.user_id !== userProfile?.id) {
          createNotification(admin.user_id, 'info', `Join Request: ${clubName}`, `${joiningName} wants to join ${clubName}.`);
        }
      }
    });
  };

  const loadClubJoinRequests = async (clubId) => {
    const { data } = await supabase
      .from('club_join_requests')
      .select('*')
      .eq('club_id', clubId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    return data || [];
  };

  const resolveClubJoinRequest = async (id, action, { userId, clubId, clubName }) => {
    if (action === 'approve') {
      await supabase.from('club_memberships').insert({ user_id: userId, club_id: clubId, club_name: clubName });
      if (userId === userProfile?.id) {
        setClubMemberships(prev => new Set([...prev, clubId]));
      }
      createNotification(userId, 'info', `Welcome to ${clubName}!`, `Your request to join ${clubName} has been approved.`);
    }
    await supabase.from('club_join_requests')
      .update({ status: action === 'approve' ? 'approved' : 'rejected' })
      .eq('id', id);
  };

  const leaveClub = async (clubId) => {
    if (!userProfile?.id) return;
    const cid = Number(clubId);
    await supabase.from('club_memberships').delete().eq('user_id', userProfile.id).eq('club_id', cid);
    setClubMemberships(prev => { const next = new Set(prev); next.delete(cid); return next; });
  };

  const resignClubAdmin = async (clubId) => {
    if (!userProfile?.id) return;
    const { error } = await supabase.from('club_admins').delete()
      .eq('user_id', userProfile.id).eq('club_id', clubId);
    if (error) throw new Error(error.message);
    setApprovedClubAdmins(prev => {
      const next = new Set(prev);
      next.delete(clubId);
      next.delete(Number(clubId));
      next.delete(String(clubId));
      return next;
    });
  };

  const checkClubAdminRequest = async (clubId) => {
    if (!userProfile?.id) return null;
    const { data } = await supabase
      .from('club_admin_requests')
      .select('id, status')
      .eq('user_id', userProfile.id)
      .eq('club_id', clubId)
      .eq('status', 'pending')
      .maybeSingle();
    return data;
  };

  const checkClubJoinRequest = async (clubId) => {
    if (!userProfile?.id) return null;
    const { data } = await supabase
      .from('club_join_requests')
      .select('id, status')
      .eq('user_id', userProfile.id)
      .eq('club_id', clubId)
      .maybeSingle();
    return data;
  };

  // ── Block / Report ──────────────────────────────────────────────────────────

  const blockUser = async (id) => {
    const strId = String(id);
    setBlockedIds(prev => new Set([...prev, strId]));
    if (!userProfile?.id) return;
    const { error } = await supabase.from('blocked_users')
      .insert({ user_id: userProfile.id, blocked_id: strId });
    if (error) {
      console.error('Block insert failed:', error.message);
      // Revert local state so the UI stays consistent with DB
      setBlockedIds(prev => { const next = new Set(prev); next.delete(strId); return next; });
    }
  };

  const unblockUser = async (id) => {
    const strId = String(id);
    setBlockedIds(prev => { const next = new Set(prev); next.delete(strId); return next; });
    if (!userProfile?.id) return;
    const { error } = await supabase.from('blocked_users')
      .delete()
      .eq('user_id', userProfile.id)
      .eq('blocked_id', strId);
    if (error) console.error('Unblock failed:', error.message);
  };

  const isBlocked = (id) => blockedIds.has(String(id));

  const submitReport = async ({ reportedId, reportedName, reason, note }) => {
    if (!userProfile?.id) return;
    await supabase.from('reports').insert({
      reporter_id: userProfile.id,
      reported_id: String(reportedId),
      reported_name: reportedName,
      reason,
      note: note?.trim() || null,
    });
  };

  // ── Events ──────────────────────────────────────────────────────────────────

  const addEvent = (event) => setEvents(prev => [event, ...prev]);

  const deleteEvent = async (eventId) => {
    const id = String(eventId);
    // Remove child rows first to avoid FK constraint violations
    await supabase.from('event_interests').delete().eq('event_id', id);
    await supabase.from('event_member_assignments').delete().eq('event_id', id);
    const { error } = await supabase.from('hub_events').delete().eq('id', id);
    if (error) { Alert.alert('Error', 'Could not delete event: ' + error.message); return; }
    setEvents(prev => prev.filter(e => String(e.id) !== id));
  };

  const deleteClub = async (clubId) => {
    const isUUID = /^[0-9a-f-]{36}$/i.test(String(clubId));
    if (isUUID) {
      const { error } = await supabase.from('user_clubs').delete().eq('id', clubId);
      if (error) { Alert.alert('Error', error.message); return false; }
      await supabase.from('club_memberships').delete().eq('club_id', clubId);
      await supabase.from('club_admins').delete().eq('club_id', clubId);
      setUserCreatedClubs(prev => prev.filter(c => c.id !== clubId));
    } else {
      const { error } = await supabase.from('hidden_clubs').insert({ club_id: String(clubId), hidden_by: userProfile?.id });
      if (error && error.code !== '23505') { Alert.alert('Error', error.message); return false; }
      setHiddenClubIds(prev => new Set([...prev, String(clubId)]));
    }
    return true;
  };

  // ── DMs ─────────────────────────────────────────────────────────────────────

  const [dms, setDms] = useState({});
  const sendDM = (personKey, message) => {
    setDms(prev => ({
      ...prev,
      [personKey]: [...(prev[personKey] || []), message],
    }));
  };

  return (
    <AppContext.Provider value={{
      mode, setMode,
      isAppAdmin, enterAppAsAdmin,
      userProfile, setUserProfile: setUserProfileLocal, updateProfile,
      unreadCount, setUnreadCount, createNotification, setClubMemberships,
      signUp, verifyOTP, resendOTP, signIn, signOut, sendPasswordReset, resetPassword, deleteAccount,
      registerTeacher, approveTeacher, rejectTeacher, checkTeacherApproval,
      teacherProfile, setTeacherProfile, teacherLogin, teacherSignOut,
      teacherGroups, addTeacherGroup,
      studentGroups, addStudentGroup,
      joinedGroupIds, toggleGroupJoin,
      createdGroupIds, trackCreatedGroup,
      interestedEventIds, toggleEventInterest,
      followingClubIds, toggleClubFollow,
      submitFacultyClubRequest,
      clubAdminRequests, approvedClubAdmins,
      submitClubAdminRequest, resolveClubAdminRequest, loadClubAdminRequests, checkClubAdminRequest,
      clubMemberships, submitClubJoinRequest, loadClubJoinRequests, resolveClubJoinRequest, checkClubJoinRequest, leaveClub, resignClubAdmin,
      events, addEvent, deleteEvent,
      dms, sendDM,
      connections, toggleConnect, isConnected,
      pendingOutgoing, sendConnectionRequest, hasPendingRequest, cancelConnectionRequest, acceptConnectionRequest, declineConnectionRequest, disconnectUser,
      blockedIds, blockUser, unblockUser, isBlocked, submitReport,
      userCreatedClubs, myClubRequests, hiddenClubIds, deleteClub,
      resolveClubCreationRequest: async (req, action) => {
        if (action === 'approved') {
          const { data: club, error } = await supabase.from('user_clubs').insert({
            name: req.name, full_name: req.full_name || req.name,
            description: req.description, emoji: req.emoji || '🏛️',
            color: req.color || '#6366F1', type: req.type || 'Club',
            creator_id: req.creator_id, creator_name: req.creator_name,
            members: 1,
          }).select().single();
          if (error) throw error;
          await supabase.from('club_admins').insert({ user_id: req.creator_id, club_id: club.id });
          await supabase.from('club_memberships').insert({ user_id: req.creator_id, club_id: club.id, club_name: club.name });
          await supabase.from('notifications').insert({
            user_id: req.creator_id, type: 'info',
            title: `${req.name} has been approved! 🎉`,
            body: 'Your club creation request was approved. Open the Hub to manage your new club.',
            read: false,
          });
          setUserCreatedClubs(prev => [club, ...prev]);
        } else {
          await supabase.from('notifications').insert({
            user_id: req.creator_id, type: 'info',
            title: `Club request for "${req.name}" was not approved`,
            body: 'Your club creation request was reviewed and not approved at this time.',
            read: false,
          });
        }
        await supabase.from('club_creation_requests').update({ status: action }).eq('id', req.id);
      },
      submitClubCreationRequest: async ({ name, fullName, description, emoji, color, type }) => {
        const userId = userProfile?.id;
        const { data, error } = await supabase.from('club_creation_requests').insert({
          name, full_name: fullName || name,
          description, emoji: emoji || '🏛️',
          color: color || '#6366F1', type: type || 'Club',
          creator_id: userId, creator_name: userProfile?.name,
          status: 'pending',
        }).select().single();
        if (error) throw error;
        setMyClubRequests(prev => [data, ...prev]);
        // Notify super admins + Department Coordinator
        const creatorName = userProfile?.name || 'A student';
        supabase.from('profiles').select('id').eq('is_super_admin', true).then(({ data: admins }) => {
          for (const admin of (admins || [])) {
            createNotification(admin.id, 'info', 'New Club Creation Request', `${creatorName} requested to create "${name}".`);
          }
        });
        createNotification('teacher-1', 'info', 'New Club Creation Request', `${creatorName} requested to create "${name}".`);
        return data;
      },
      isSapsCore: !!sapsRole,
      sapsRole,
      adminTestAsName,
      setAdminTestAsName,
      // The seed teacher object being impersonated (null when not testing)
      adminTestTeacher: (isAppAdmin && adminTestAsName)
        ? teachers.find(t => t.name === adminTestAsName) || null
        : null,
      requiresBio,
      saveBio: async (bioText) => {
        const trimmed = bioText.trim();
        const { error } = await supabase.from('profiles').update({ bio: trimmed }).eq('id', userProfile.id);
        if (error) throw error;
        setUserProfile(prev => ({ ...prev, bio: trimmed }));
        setRequiresBio(false);
      },
      crStatus, setCrStatus,
      resignCR: async () => {
        await supabase
          .from('cr_requests')
          .update({ status: 'resigned' })
          .eq('user_id', userProfile.id)
          .eq('status', 'approved');
        setCrStatus(null);
      },
      submitCrRequest: async ({ userId, userName, course, year, campus, reason }) => {
        const { data, error } = await supabase.from('cr_requests').insert({
          user_id: userId, user_name: userName, course, year, campus, reason, status: 'pending',
        }).select().single();
        if (error) throw error;
        setCrStatus('pending');
        // Notify super admins + Department Coordinator (teacher-1)
        supabase.from('profiles').select('id').eq('is_super_admin', true).then(({ data: admins }) => {
          for (const admin of (admins || [])) {
            createNotification(admin.id, 'info', 'New CR Application', `${userName} applied to be Class Representative for ${course} · ${year}.`);
          }
        });
        createNotification('teacher-1', 'info', 'New CR Application', `${userName} applied to be Class Representative for ${course} · ${year}.`);
        return data;
      },
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
