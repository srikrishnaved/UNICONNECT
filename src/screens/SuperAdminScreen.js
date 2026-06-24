import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius, font } from '../theme';
import { useApp } from '../context/AppContext';
import { metaFromClass, ALL_CLASSES } from '../lib/subjectUtils';
import { teachers as SEED_TEACHERS, hubClubs } from '../data/index';

const TABS = ['Teachers', 'CR', 'Subjects', 'SAPS', 'Stats'];
const SAPS_ROLES = ['President', 'Vice President', 'Member Secretary', 'Secretary', 'Vice Secretary'];

export default function SuperAdminScreen({ navigation }) {
  const { isAppAdmin, approveTeacher, rejectTeacher, userProfile } = useApp();
  const [activeTab, setActiveTab] = useState('Teachers');
  const [pendingTeachers, setPendingTeachers] = useState([]);
  const [activeTeachers, setActiveTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);

  // Teacher approval modal
  const [approvalTarget, setApprovalTarget] = useState(null);   // teacher profile being approved
  const [approvalSeedPick, setApprovalSeedPick] = useState(null); // selected entry or null
  const [approvalSearch, setApprovalSearch] = useState('');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalFacultyList, setApprovalFacultyList] = useState([]); // merged timetable+seed list

  // CR state
  const [crRequests, setCrRequests] = useState([]);
  const [crLoading, setCrLoading] = useState(false);
  const [resolvingCR, setResolvingCR] = useState(null);

  // SAPS state
  const [sapsApplications, setSapsApplications] = useState([]);
  const [sapsTeam, setSapsTeam] = useState([]);
  const [sapsLoading, setSapsLoading] = useState(false);
  const [resolvingSaps, setResolvingSaps] = useState(null);
  const [removingSapsMember, setRemovingSapsMember] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignRole, setAssignRole] = useState(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignResults, setAssignResults] = useState([]);
  const [assigning, setAssigning] = useState(false);

  // Stats state
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Timetable-derived subjects map for teachers whose teacher_profiles.subjects is empty.
  // Key: lowercased teacher name; value: sorted course_name array.
  const [timetableSubjectsMap, setTimetableSubjectsMap] = useState({});

  // Subjects state
  const [subjects, setSubjects] = useState([]);
  const [subjectsPending, setSubjectsPending] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectClass, setSubjectClass] = useState(null);
  const [subjectFormError, setSubjectFormError] = useState('');
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState(null);
  const [resolvingSubject, setResolvingSubject] = useState(null);

  useEffect(() => {
    if (activeTab === 'Teachers') loadTeachers();
    if (activeTab === 'CR') loadCrRequests();
    if (activeTab === 'Subjects') loadSubjects();
    if (activeTab === 'SAPS') loadSapsData();
    if (activeTab === 'Stats') loadStats();
  }, [activeTab]);

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const [pendingRes, activeRes, slotRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'teacher').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('role', 'teacher').eq('status', 'active').order('created_at', { ascending: false }),
        supabase.from('timetable_slots').select('faculty_name, course_name').not('faculty_name', 'is', null).not('course_name', 'is', null),
      ]);

      // Build faculty_name → Set<course_name> map from timetable slots.
      const subMap = {};
      for (const row of slotRes.data || []) {
        for (const n of (row.faculty_name || '').split(' / ').map(s => s.trim()).filter(Boolean)) {
          const key = n.toLowerCase();
          if (!subMap[key]) subMap[key] = new Set();
          subMap[key].add(row.course_name);
        }
      }
      const normalized = {};
      for (const [k, v] of Object.entries(subMap)) normalized[k] = [...v].sort();
      setTimetableSubjectsMap(normalized);

      const allIds = [
        ...(pendingRes.data || []).map(p => p.id),
        ...(activeRes.data || []).map(p => p.id),
      ];

      let tpMap = {};
      if (allIds.length > 0) {
        const { data: tps } = await supabase.from('teacher_profiles').select('*').in('id', allIds);
        if (tps) tps.forEach(tp => { tpMap[tp.id] = tp; });
      }

      const merge = (profiles) => (profiles || []).map(p => ({ ...p, tp: tpMap[p.id] || null }));

      setPendingTeachers(merge(pendingRes.data));
      setActiveTeachers(merge(activeRes.data));
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const count = (res) => res.count ?? 0;
      const [
        usersRes, teachersRes, studentsRes,
        membershipsRes, hubEventsRes,
        subRes, compRes, nfaRes, actRes,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('club_memberships').select('id', { count: 'exact', head: true }),
        supabase.from('hub_events').select('id', { count: 'exact', head: true }),
        supabase.from('substitute_requests').select('id', { count: 'exact', head: true }),
        supabase.from('compensatory_requests').select('id', { count: 'exact', head: true }),
        supabase.from('nfa_requests').select('id', { count: 'exact', head: true }),
        supabase.from('activity_reports').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        users:         count(usersRes),
        teachers:      count(teachersRes),
        students:      count(studentsRes),
        clubs:         hubClubs.length,
        memberships:   count(membershipsRes),
        hubEvents:     count(hubEventsRes),
        subRequests:   count(subRes),
        compRequests:  count(compRes),
        nfaRequests:   count(nfaRes),
        activityReports: count(actRes),
      });
    } finally {
      setStatsLoading(false);
    }
  };

  const loadCrRequests = async () => {
    setCrLoading(true);
    const { data } = await supabase.from('cr_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    setCrRequests(data || []);
    setCrLoading(false);
  };

  const loadSapsData = async () => {
    setSapsLoading(true);
    const [appsRes, teamRes] = await Promise.all([
      supabase.from('saps_applications').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('saps_members').select('id, profile_id, role, created_at').order('created_at'),
    ]);
    const members = appsRes.data || [];
    const team = teamRes.data || [];
    // Fetch names for team members
    const ids = team.map(m => m.profile_id).filter(Boolean);
    let nameMap = {};
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', ids);
      (profiles || []).forEach(p => { nameMap[p.id] = p.name; });
    }
    setSapsApplications(members);
    setSapsTeam(team.map(m => ({ ...m, memberName: nameMap[m.profile_id] || 'Unknown' })));
    setSapsLoading(false);
  };

  const resolveSapsApp = async (app, action) => {
    if (!window.confirm(`${action === 'approved' ? 'Approve' : 'Reject'} ${app.applicant_name}'s application for ${app.role}?`)) return;
    setResolvingSaps(app.id);
    try {
      if (action === 'approved') {
        const taken = sapsTeam.find(m => m.role === app.role);
        if (taken) {
          window.alert(`The ${app.role} role is already filled by ${taken.memberName}.`);
          setResolvingSaps(null);
          return;
        }
        await supabase.from('saps_members').insert({
          profile_id: app.applicant_id,
          role: app.role,
          assigned_by: userProfile?.id || null,
        });
        await supabase.from('notifications').insert({
          user_id: app.applicant_id, type: 'info',
          title: 'You are now part of the SAPS Core Team!',
          body: `Your application for ${app.role} has been approved. Welcome to the SAPS Core Team!`,
          read: false,
        });
      } else {
        await supabase.from('notifications').insert({
          user_id: app.applicant_id, type: 'info',
          title: 'SAPS Application Update',
          body: `Your application for ${app.role} in SAPS Core Team was not approved at this time.`,
          read: false,
        });
      }
      await supabase.from('saps_applications').update({ status: action, reviewed_by: userProfile?.id }).eq('id', app.id);
      setSapsApplications(prev => prev.filter(a => a.id !== app.id));
      if (action === 'approved') loadSapsData();
    } catch (e) {
      window.alert('Error: ' + (e.message || 'Could not process request.'));
    } finally {
      setResolvingSaps(null);
    }
  };

  const handleRemoveSapsMember = async (member) => {
    if (!window.confirm(`Remove ${member.memberName} from SAPS Core Team (${member.role})?`)) return;
    setRemovingSapsMember(member.id);
    await supabase.from('saps_members').delete().eq('id', member.id);
    setSapsTeam(prev => prev.filter(m => m.id !== member.id));
    setRemovingSapsMember(null);
  };

  const openAssignModal = (role) => {
    setAssignRole(role);
    setAssignSearch('');
    setAssignResults([]);
    setShowAssignModal(true);
  };

  const searchAssignStudents = async (query) => {
    setAssignSearch(query);
    if (query.trim().length < 2) { setAssignResults([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, name, course, year')
      .eq('role', 'student')
      .eq('status', 'active')
      .ilike('name', `%${query.trim()}%`)
      .limit(10);
    setAssignResults(data || []);
  };

  const handleAssignDirect = async (student) => {
    if (!window.confirm(`Assign ${student.name} as ${assignRole}?`)) return;
    setAssigning(true);
    try {
      const { error } = await supabase.from('saps_members').insert({
        profile_id: student.id,
        role: assignRole,
        assigned_by: userProfile?.id || null,
      });
      if (error) throw error;
      await supabase.from('notifications').insert({
        user_id: student.id, type: 'info',
        title: 'You have been added to the SAPS Core Team!',
        body: `You have been assigned as ${assignRole} in the SAPS Core Team.`,
        read: false,
      });
      setShowAssignModal(false);
      loadSapsData();
    } catch (e) {
      window.alert('Error: ' + (e.message || 'Could not assign. The role may already be filled.'));
    } finally {
      setAssigning(false);
    }
  };

  const resolveCrRequest = async (req, action) => {
    if (!window.confirm(`${action === 'approved' ? 'Approve' : 'Reject'} CR application from ${req.user_name}?`)) return;
    setResolvingCR(req.id);
    try {
      if (action === 'approved') {
        const { data: existing } = await supabase
          .from('cr_requests').select('id')
          .eq('course', req.course).eq('year', req.year).eq('campus', req.campus).eq('status', 'approved');
        if (existing && existing.length >= 2) {
          window.alert(`Cannot approve — ${req.course} · ${req.year} already has 2 approved CRs.`);
          setResolvingCR(null);
          return;
        }
        await supabase.from('notifications').insert({
          user_id: req.user_id, type: 'info',
          title: 'You are now a Class Representative!',
          body: 'Your CR application has been approved. Open your profile to access the CR Dashboard.',
          read: false,
        });
      } else {
        await supabase.from('notifications').insert({
          user_id: req.user_id, type: 'info',
          title: 'CR Application Update',
          body: 'Your Class Representative application was reviewed and could not be approved at this time.',
          read: false,
        });
      }
      await supabase.from('cr_requests').update({ status: action }).eq('id', req.id);
      setCrRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (e) {
      window.alert('Error: ' + (e.message || 'Could not process request.'));
    } finally {
      setResolvingCR(null);
    }
  };

  const handleApprove = (teacher) => {
    setApprovalTarget(teacher);
    setApprovalSeedPick(null);
    setApprovalSearch('');
    setApprovalFacultyList([]);
    supabase.from('timetable_slots').select('faculty_name')
      .not('faculty_name', 'is', null).neq('faculty_name', '')
      .then(({ data }) => {
        const names = [...new Set(
          (data || []).flatMap(r =>
            r.faculty_name ? r.faculty_name.split(' / ').map(n => n.trim()) : []
          ).filter(Boolean)
        )];
        const merged = names.map(name => {
          const seed = SEED_TEACHERS.find(t => t.name.toLowerCase() === name.toLowerCase());
          return seed
            ? { name: seed.name, subjects: seed.subjects, id: seed.id }
            : { name, subjects: [], id: null };
        }).sort((a, b) => a.name.localeCompare(b.name));
        setApprovalFacultyList(merged);
      });
  };

  const handleConfirmApproval = async () => {
    if (!approvalTarget) return;
    setApprovalLoading(true);
    const teacher = approvalTarget;
    const seed = approvalSeedPick;
    try {
      // 1. Approve: sets profiles.status = 'active' + sends notification
      await approveTeacher(teacher.id);

      if (seed) {
        // 2. Overwrite profiles.name with the seed teacher's canonical name
        //    so timetable slot matching works on first login
        await supabase.from('profiles').update({ name: seed.name }).eq('id', teacher.id);

        // 3. Link seed_teacher_id + copy text subjects into teacher_profiles
        await supabase.from('teacher_profiles')
          .update({ seed_teacher_id: seed.id, subjects: seed.subjects })
          .eq('id', teacher.id);

        // 4. Best-effort: look up subject UUIDs by name and insert into teacher_subjects
        if (seed.subjects.length > 0) {
          const { data: matched } = await supabase
            .from('subjects')
            .select('id, name')
            .in('name', seed.subjects);
          if (matched?.length > 0) {
            await supabase.from('teacher_subjects').insert(
              matched.map(s => ({ teacher_id: teacher.id, subject_id: s.id })),
            );
          }
        }
      }

      setPendingTeachers(prev => prev.filter(t => t.id !== teacher.id));
      setActiveTeachers(prev => [{
        ...teacher,
        name: seed?.name ?? teacher.name,
        status: 'active',
      }, ...prev]);
      setApprovalTarget(null);
    } catch (e) {
      window.alert('Error: ' + (e.message || 'Could not approve teacher.'));
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleReject = async (teacher) => {
    if (!window.confirm(`Reject ${teacher.name}'s teacher account application?`)) return;
    setResolving(teacher.id);
    try {
      await rejectTeacher(teacher.id);
      setPendingTeachers(prev => prev.filter(t => t.id !== teacher.id));
    } catch (e) {
      window.alert('Error: ' + (e.message || 'Could not reject application.'));
    } finally {
      setResolving(null);
    }
  };

  if (!isAppAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>Unauthorized</Text>
        </View>
      </SafeAreaView>
    );
  }

  const loadSubjects = async () => {
    setSubjectsLoading(true);
    const [{ data: active }, { data: pending }] = await Promise.all([
      supabase.from('subjects').select('*').eq('status', 'active').order('class').order('name'),
      supabase.from('subject_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
    ]);
    setSubjects(active || []);
    setSubjectsPending(pending || []);
    setSubjectsLoading(false);
  };

  const openAddSubject = () => {
    setEditingSubject(null);
    setSubjectName('');
    setSubjectCode('');
    setSubjectClass(null);
    setSubjectFormError('');
    setShowSubjectModal(true);
  };

  const openEditSubject = (s) => {
    setEditingSubject(s);
    setSubjectName(s.name);
    setSubjectCode(s.code);
    setSubjectClass(s.class);
    setSubjectFormError('');
    setShowSubjectModal(true);
  };

  const saveSubject = async () => {
    if (!subjectName.trim() || !subjectCode.trim() || !subjectClass) {
      setSubjectFormError('All fields are required.');
      return;
    }
    setSubjectSaving(true);
    setSubjectFormError('');
    try {
      const meta = metaFromClass(subjectClass);
      if (editingSubject) {
        await supabase.from('subjects').update({
          name: subjectName.trim(), code: subjectCode.trim(),
          class: subjectClass, programme: meta.programme, semester: meta.semester,
        }).eq('id', editingSubject.id);
      } else {
        await supabase.from('subjects').insert({
          name: subjectName.trim(), code: subjectCode.trim(),
          class: subjectClass, programme: meta.programme, semester: meta.semester,
          status: 'active', created_by: null,
        });
      }
      setShowSubjectModal(false);
      loadSubjects();
    } catch (e) {
      setSubjectFormError(e.message || 'Could not save subject.');
    } finally {
      setSubjectSaving(false);
    }
  };

  const deleteSubject = async (id) => {
    if (!window.confirm('Delete this subject? This cannot be undone.')) return;
    setDeletingSubject(id);
    await supabase.from('subjects').delete().eq('id', id);
    setSubjects(prev => prev.filter(s => s.id !== id));
    setDeletingSubject(null);
  };

  const resolveSubjectRequest = async (req, action) => {
    if (!window.confirm(`${action === 'approved' ? 'Approve' : 'Reject'} subject request for "${req.subject_name}"?`)) return;
    setResolvingSubject(req.id);
    try {
      if (action === 'approved') {
        const meta = metaFromClass(req.class);
        await supabase.from('subjects').insert({
          name: req.subject_name, code: req.subject_code,
          class: req.class, programme: meta.programme, semester: meta.semester,
          status: 'active', created_by: null,
        });
        if (req.requested_by) {
          await supabase.from('notifications').insert({
            user_id: req.requested_by, type: 'info',
            title: 'Subject Request Approved',
            body: `"${req.subject_name}" has been approved and added to the subjects list.`,
            read: false,
          });
        }
      } else if (req.requested_by) {
        await supabase.from('notifications').insert({
          user_id: req.requested_by, type: 'info',
          title: 'Subject Request Rejected',
          body: `Your request for "${req.subject_name}" was not approved.`,
          read: false,
        });
      }
      await supabase.from('subject_requests').update({ status: action === 'approved' ? 'approved' : 'rejected' }).eq('id', req.id);
      setSubjectsPending(prev => prev.filter(r => r.id !== req.id));
      if (action === 'approved') loadSubjects();
    } catch (e) {
      window.alert('Error: ' + (e.message || 'Could not process request.'));
    } finally {
      setResolvingSubject(null);
    }
  };

  const renderSubjectsTab = () => {
    if (subjectsLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
    const filtered = subjectFilter === 'All' ? subjects : subjects.filter(s => s.class === subjectFilter);
    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Pending requests */}
        {subjectsPending.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Requests</Text>
              <View style={styles.countBadge}><Text style={styles.countBadgeText}>{subjectsPending.length}</Text></View>
            </View>
            {subjectsPending.map(req => (
              <View key={req.id} style={styles.teacherCard}>
                <View style={styles.teacherCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teacherName}>{req.subject_name}</Text>
                    <Text style={styles.teacherEmail}>{req.subject_code} · {req.class} · by {req.requester_name}</Text>
                  </View>
                  <View style={[styles.facultyBadge]}><Text style={styles.facultyBadgeText}>PENDING</Text></View>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.rejectBtn, resolvingSubject === req.id && { opacity: 0.5 }]}
                    onPress={() => resolveSubjectRequest(req, 'rejected')}
                    disabled={resolvingSubject === req.id}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.rejectBtnText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.approveBtn, resolvingSubject === req.id && { opacity: 0.5 }]}
                    onPress={() => resolveSubjectRequest(req, 'approved')}
                    disabled={resolvingSubject === req.id}
                    activeOpacity={0.8}
                  >
                    {resolvingSubject === req.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.approveBtnText}>Approve</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Filter + Add */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Subjects ({filtered.length})</Text>
            <TouchableOpacity
              style={[styles.approveBtn, { paddingHorizontal: spacing.md, paddingVertical: 8 }]}
              onPress={openAddSubject}
              activeOpacity={0.8}
            >
              <Text style={styles.approveBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {/* Class filter pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['All', ...ALL_CLASSES].map(cls => {
                const active = subjectFilter === cls;
                return (
                  <TouchableOpacity
                    key={cls}
                    style={[styles.filterPill, active && styles.filterPillActive]}
                    onPress={() => setSubjectFilter(cls)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{cls}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No subjects for this class</Text>
            </View>
          ) : filtered.map(s => (
            <View key={s.id} style={[styles.teacherCard, { paddingVertical: spacing.sm }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teacherName}>{s.name}</Text>
                  <Text style={styles.teacherEmail}>{s.code} · {s.class} · Sem {s.semester}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.rejectBtn, { paddingHorizontal: spacing.sm, paddingVertical: 6 }]}
                  onPress={() => deleteSubject(s.id)}
                  disabled={deletingSubject === s.id}
                  activeOpacity={0.8}
                >
                  {deletingSubject === s.id ? <ActivityIndicator size="small" color={colors.red} /> : <Text style={styles.rejectBtnText}>🗑</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approveBtn, { paddingHorizontal: spacing.sm, paddingVertical: 6 }]}
                  onPress={() => openEditSubject(s)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.approveBtnText}>✏️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderTeacherCard = (teacher, isPending) => {
    const profileSubjects = teacher.tp?.subjects;
    const timetableSubjects = timetableSubjectsMap[(teacher.name || '').toLowerCase()];
    const subjects = (profileSubjects?.length ? profileSubjects : timetableSubjects)?.join(', ') || '—';
    const facultyType = teacher.tp?.faculty_type || '—';
    const days = teacher.tp?.available_days?.join(', ') || '—';
    const isResolving = resolving === teacher.id;

    return (
      <View key={teacher.id} style={styles.teacherCard}>
        <View style={styles.teacherCardHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{(teacher.name || '?')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.teacherName}>{teacher.name}</Text>
            <Text style={styles.teacherEmail}>{teacher.email}</Text>
          </View>
          <View style={[styles.facultyBadge, facultyType === 'full-time' && styles.badgeGreen]}>
            <Text style={styles.facultyBadgeText}>{facultyType}</Text>
          </View>
        </View>

        <View style={styles.teacherMeta}>
          <Text style={styles.metaLabel}>SUBJECTS</Text>
          <Text style={styles.metaValue}>{subjects}</Text>
        </View>
        {days !== '—' && (
          <View style={styles.teacherMeta}>
            <Text style={styles.metaLabel}>AVAILABLE</Text>
            <Text style={styles.metaValue}>{days}</Text>
          </View>
        )}

        {isPending && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.rejectBtn, isResolving && { opacity: 0.5 }]}
              onPress={() => handleReject(teacher)}
              disabled={isResolving}
              activeOpacity={0.8}
            >
              {isResolving ? <ActivityIndicator size="small" color={colors.red} /> : <Text style={styles.rejectBtnText}>Reject</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.approveBtn, isResolving && { opacity: 0.5 }]}
              onPress={() => handleApprove(teacher)}
              disabled={isResolving}
              activeOpacity={0.8}
            >
              {isResolving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.approveBtnText}>Approve</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderTeachersTab = () => {
    if (loading) {
      return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
    }

    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending Approvals</Text>
            {pendingTeachers.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{pendingTeachers.length}</Text>
              </View>
            )}
          </View>
          {pendingTeachers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No pending applications</Text>
            </View>
          ) : (
            pendingTeachers.map(t => renderTeacherCard(t, true))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Teachers</Text>
          {activeTeachers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No active teachers yet</Text>
            </View>
          ) : (
            activeTeachers.map(t => renderTeacherCard(t, false))
          )}
        </View>
      </ScrollView>
    );
  };

  const renderCRTab = () => {
    if (crLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending CR Applications</Text>
            {crRequests.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{crRequests.length}</Text>
              </View>
            )}
          </View>
          {crRequests.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>🎉</Text>
              <Text style={styles.emptyText}>No pending CR applications</Text>
            </View>
          ) : crRequests.map(req => (
            <View key={req.id} style={styles.teacherCard}>
              <View style={styles.teacherCardHeader}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{(req.user_name || '?')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teacherName}>{req.user_name}</Text>
                  <Text style={styles.teacherEmail}>{req.course} · {req.year} · {req.campus}</Text>
                </View>
                <View style={[styles.facultyBadge]}>
                  <Text style={styles.facultyBadgeText}>CR</Text>
                </View>
              </View>
              {req.reason ? (
                <View style={styles.teacherMeta}>
                  <Text style={styles.metaLabel}>REASON</Text>
                  <Text style={[styles.metaValue, { fontStyle: 'italic' }]}>"{req.reason}"</Text>
                </View>
              ) : null}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.rejectBtn, resolvingCR === req.id && { opacity: 0.5 }]}
                  onPress={() => resolveCrRequest(req, 'rejected')}
                  disabled={resolvingCR === req.id}
                  activeOpacity={0.8}
                >
                  {resolvingCR === req.id ? <ActivityIndicator size="small" color={colors.red} /> : <Text style={styles.rejectBtnText}>Reject</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approveBtn, resolvingCR === req.id && { opacity: 0.5 }]}
                  onPress={() => resolveCrRequest(req, 'approved')}
                  disabled={resolvingCR === req.id}
                  activeOpacity={0.8}
                >
                  {resolvingCR === req.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.approveBtnText}>Approve</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderSapsTab = () => {
    if (sapsLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Pending Applications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending Applications</Text>
            {sapsApplications.length > 0 && (
              <View style={styles.countBadge}><Text style={styles.countBadgeText}>{sapsApplications.length}</Text></View>
            )}
          </View>
          {sapsApplications.length === 0 ? (
            <View style={styles.emptyCard}><Text style={styles.emptyText}>No pending applications</Text></View>
          ) : sapsApplications.map(app => (
            <View key={app.id} style={styles.teacherCard}>
              <View style={styles.teacherCardHeader}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{(app.applicant_name || '?')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teacherName}>{app.applicant_name}</Text>
                  <Text style={styles.teacherEmail}>Applied for: {app.role}</Text>
                </View>
                <View style={styles.facultyBadge}><Text style={styles.facultyBadgeText}>SAPS</Text></View>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.rejectBtn, resolvingSaps === app.id && { opacity: 0.5 }]}
                  onPress={() => resolveSapsApp(app, 'rejected')}
                  disabled={resolvingSaps === app.id}
                  activeOpacity={0.8}
                >
                  {resolvingSaps === app.id ? <ActivityIndicator size="small" color={colors.red} /> : <Text style={styles.rejectBtnText}>Reject</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approveBtn, resolvingSaps === app.id && { opacity: 0.5 }]}
                  onPress={() => resolveSapsApp(app, 'approved')}
                  disabled={resolvingSaps === app.id}
                  activeOpacity={0.8}
                >
                  {resolvingSaps === app.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.approveBtnText}>Approve</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Current SAPS Team */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current SAPS Team</Text>
          <View style={{ height: spacing.sm }} />
          {SAPS_ROLES.map(role => {
            const member = sapsTeam.find(m => m.role === role);
            return (
              <View key={role} style={[styles.teacherCard, { paddingVertical: spacing.sm }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teacherName}>{role}</Text>
                    {member ? (
                      <Text style={styles.teacherEmail}>{member.memberName}</Text>
                    ) : (
                      <Text style={[styles.teacherEmail, { color: colors.textTertiary, fontStyle: 'italic' }]}>Vacant</Text>
                    )}
                  </View>
                  {member ? (
                    <TouchableOpacity
                      style={[styles.rejectBtn, { paddingHorizontal: spacing.sm, paddingVertical: 6 }, removingSapsMember === member.id && { opacity: 0.5 }]}
                      onPress={() => handleRemoveSapsMember(member)}
                      disabled={removingSapsMember === member.id}
                      activeOpacity={0.8}
                    >
                      {removingSapsMember === member.id ? <ActivityIndicator size="small" color={colors.red} /> : <Text style={styles.rejectBtnText}>Remove</Text>}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.approveBtn, { paddingHorizontal: spacing.sm, paddingVertical: 6 }]}
                      onPress={() => openAssignModal(role)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.approveBtnText}>Assign</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderPlaceholder = (label) => (
    <View style={styles.centerBox}>
      <Text style={{ fontSize: 32, marginBottom: 12 }}>🚧</Text>
      <Text style={styles.emptyText}>{label} — coming soon</Text>
    </View>
  );

  const STAT_CARDS = stats ? [
    { label: 'Total Users',            value: stats.users,          icon: '👤' },
    { label: 'Teachers',               value: stats.teachers,       icon: '🧑‍🏫' },
    { label: 'Students',               value: stats.students,       icon: '🎓' },
    { label: 'Clubs',                  value: stats.clubs,          icon: '🏛️' },
    { label: 'Club Memberships',       value: stats.memberships,    icon: '🪪' },
    { label: 'Hub Events',             value: stats.hubEvents,      icon: '📅' },
    { label: 'Substitute Requests',    value: stats.subRequests,    icon: '🔄' },
    { label: 'Compensatory Requests',  value: stats.compRequests,   icon: '📋' },
    { label: 'NFAs Created',           value: stats.nfaRequests,    icon: '📝' },
    { label: 'Activity Reports',       value: stats.activityReports, icon: '📊' },
  ] : [];

  const renderStatsTab = () => {
    if (statsLoading) {
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>Loading stats…</Text>
        </View>
      );
    }
    if (!stats) return null;
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 12, ...font.bold, color: colors.textTertiary, letterSpacing: 1, marginBottom: spacing.md }}>
          APP STATISTICS
        </Text>
        <View style={styles.statsGrid}>
          {STAT_CARDS.map(card => (
            <View key={card.label} style={styles.statsCard}>
              <Text style={styles.statsCardIcon}>{card.icon}</Text>
              <Text style={styles.statsCardValue}>{card.value}</Text>
              <Text style={styles.statsCardLabel}>{card.label}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={{ marginTop: spacing.lg, alignItems: 'center', paddingVertical: 10 }}
          onPress={loadStats}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 12, color: colors.primary, ...font.medium }}>↺ Refresh</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={{ padding: 4 }}>
          <Text style={{ fontSize: 18, color: colors.textSecondary }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Super Admin</Text>
        </View>
        <TouchableOpacity onPress={loadTeachers} activeOpacity={0.7} style={{ padding: 4 }}>
          <Text style={{ fontSize: 16 }}>↺</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Teacher Dashboard shortcut */}
      <TouchableOpacity
        style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
        onPress={() => navigation.navigate('TeacherDashboard')}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#fff', fontSize: 14, ...font.bold }}>📋 Open Teacher Dashboard</Text>
      </TouchableOpacity>

      {/* Tab content */}
      {activeTab === 'Teachers' && renderTeachersTab()}
      {activeTab === 'CR' && renderCRTab()}
      {activeTab === 'Subjects' && renderSubjectsTab()}
      {activeTab === 'SAPS' && renderSapsTab()}
      {activeTab === 'Stats' && renderStatsTab()}

      {/* Teacher approval + seed link modal */}
      <Modal visible={!!approvalTarget} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
            <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => !approvalLoading && setApprovalTarget(null)} activeOpacity={1} />
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '85%', borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 16, ...font.bold, color: colors.textPrimary }}>
                  Approve {approvalTarget?.name}
                </Text>
                <TouchableOpacity onPress={() => !approvalLoading && setApprovalTarget(null)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 22, color: colors.textSecondary, padding: 4 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: spacing.md }}>
                Link to a seed faculty member so their timetable, subjects, and position load automatically on first login.
              </Text>
              <TextInput
                value={approvalSearch}
                onChangeText={setApprovalSearch}
                placeholder="Search faculty name…"
                placeholderTextColor={colors.textTertiary}
                style={{ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.sm }}
              />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
                {approvalFacultyList.filter(t =>
                  approvalSearch.trim() === '' ||
                  t.name.toLowerCase().includes(approvalSearch.trim().toLowerCase())
                ).map(t => {
                  const sel = approvalSeedPick?.name === t.name;
                  return (
                    <TouchableOpacity
                      key={t.name}
                      style={[styles.seedRow, sel && styles.seedRowActive]}
                      onPress={() => setApprovalSeedPick(sel ? null : t)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.seedRowName, sel && { color: colors.primary }]}>{t.name}</Text>
                        <Text style={styles.seedRowMeta}>Faculty</Text>
                      </View>
                      {sel && <Text style={{ color: colors.primary, fontSize: 16, ...font.bold }}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.seedRow, !approvalSeedPick && styles.seedRowActive, { marginBottom: spacing.sm }]}
                  onPress={() => setApprovalSeedPick(null)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.seedRowName, !approvalSeedPick && { color: colors.primary }]}>
                      Not on this list
                    </Text>
                    <Text style={styles.seedRowMeta}>Approve without linking — teacher selects subjects manually</Text>
                  </View>
                  {!approvalSeedPick && <Text style={{ color: colors.primary, fontSize: 16, ...font.bold }}>✓</Text>}
                </TouchableOpacity>
              </ScrollView>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.rejectBtn, approvalLoading && { opacity: 0.5 }]}
                  onPress={() => setApprovalTarget(null)}
                  disabled={approvalLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.rejectBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approveBtn, approvalLoading && { opacity: 0.5 }]}
                  onPress={handleConfirmApproval}
                  disabled={approvalLoading}
                  activeOpacity={0.8}
                >
                  {approvalLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.approveBtnText}>
                        {approvalSeedPick ? 'Link & Approve' : 'Approve'}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* SAPS Assign Directly modal */}
      <Modal visible={showAssignModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
            <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setShowAssignModal(false)} activeOpacity={1} />
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '80%', borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                <Text style={{ fontSize: 16, ...font.bold, color: colors.textPrimary }}>Assign {assignRole}</Text>
                <TouchableOpacity onPress={() => setShowAssignModal(false)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 22, color: colors.textSecondary, padding: 4 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={assignSearch}
                onChangeText={searchAssignStudents}
                placeholder="Search students by name…"
                placeholderTextColor={colors.textTertiary}
                style={{ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.md }}
                autoFocus
              />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {assignSearch.trim().length > 0 && assignResults.length === 0 && (
                  <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.lg }}>No students found</Text>
                )}
                {assignResults.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.teacherCard, { paddingVertical: spacing.sm }, assigning && { opacity: 0.5 }]}
                    onPress={() => !assigning && handleAssignDirect(s)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View style={[styles.avatarCircle, { width: 34, height: 34, borderRadius: 17 }]}>
                        <Text style={[styles.avatarText, { fontSize: 13 }]}>{s.name[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.teacherName}>{s.name}</Text>
                        <Text style={styles.teacherEmail}>{s.course} · {s.year}</Text>
                      </View>
                      {assigning ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ color: colors.primary, fontSize: 18 }}>→</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Subject add/edit modal */}
      <Modal visible={showSubjectModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
            <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setShowSubjectModal(false)} activeOpacity={1} />
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '90%', borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
                <Text style={{ fontSize: 18, ...font.bold, color: colors.textPrimary }}>
                  {editingSubject ? '✏️ Edit Subject' : '📖 Add Subject'}
                </Text>
                <TouchableOpacity onPress={() => setShowSubjectModal(false)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 22, color: colors.textSecondary, padding: 4 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.subFormLabel}>SUBJECT NAME *</Text>
                <TextInput
                  value={subjectName}
                  onChangeText={t => { setSubjectName(t); setSubjectFormError(''); }}
                  placeholder="e.g. Financial Accounting"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.subFormInput}
                  maxLength={100}
                />
                <Text style={styles.subFormLabel}>SUBJECT CODE *</Text>
                <TextInput
                  value={subjectCode}
                  onChangeText={t => { setSubjectCode(t); setSubjectFormError(''); }}
                  placeholder="e.g. BIAF101-1"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.subFormInput}
                  autoCapitalize="characters"
                  maxLength={20}
                />
                <Text style={styles.subFormLabel}>CLASS *</Text>
                <View style={{ gap: 6, marginBottom: spacing.md }}>
                  {ALL_CLASSES.map(cls => {
                    const active = subjectClass === cls;
                    return (
                      <TouchableOpacity
                        key={cls}
                        style={[styles.subClassOption, active && styles.subClassOptionActive]}
                        onPress={() => { setSubjectClass(cls); setSubjectFormError(''); }}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.subClassOptionText, active && styles.subClassOptionTextActive]}>{cls}</Text>
                        {active && <Text style={{ color: colors.primary, fontSize: 14 }}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {subjectFormError ? <Text style={{ fontSize: 12, color: colors.red, marginBottom: spacing.sm, textAlign: 'center' }}>{subjectFormError}</Text> : null}
                <TouchableOpacity
                  style={[{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm }, subjectSaving && { opacity: 0.6 }]}
                  onPress={saveSubject}
                  disabled={subjectSaving}
                  activeOpacity={0.85}
                >
                  {subjectSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, ...font.bold, color: '#fff' }}>{editingSubject ? 'Save Changes' : 'Add Subject'}</Text>}
                </TouchableOpacity>
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: { fontSize: 16, ...font.bold, color: colors.textPrimary },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabBtn: {
    flex: 1, paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: colors.primary },
  tabBtnText: { fontSize: 14, color: colors.textSecondary, ...font.medium },
  tabBtnTextActive: { color: colors.primary, ...font.bold },

  tabContent: { padding: spacing.lg, paddingBottom: 40 },

  section: { marginBottom: spacing.xxl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { fontSize: 13, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold },
  countBadge: {
    backgroundColor: colors.amber,
    borderRadius: radius.full,
    width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  countBadgeText: { fontSize: 11, color: '#fff', ...font.bold },

  teacherCard: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  teacherCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, ...font.bold, color: '#fff' },
  teacherName: { fontSize: 15, ...font.bold, color: colors.textPrimary },
  teacherEmail: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },

  facultyBadge: {
    backgroundColor: colors.amberLight,
    borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeGreen: { backgroundColor: colors.greenLight },
  facultyBadgeText: { fontSize: 10, color: colors.amber, ...font.bold },

  teacherMeta: { marginBottom: spacing.sm },
  metaLabel: { fontSize: 9, color: colors.textTertiary, letterSpacing: 0.6, ...font.bold, marginBottom: 2 },
  metaValue: { fontSize: 13, color: colors.textSecondary },

  actionRow: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md,
  },
  rejectBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.red,
    alignItems: 'center',
  },
  rejectBtnText: { fontSize: 14, color: colors.red, ...font.semibold },
  approveBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.md,
    backgroundColor: colors.green,
    alignItems: 'center',
  },
  approveBtnText: { fontSize: 14, color: '#fff', ...font.semibold },

  emptyCard: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: colors.textTertiary },

  centerBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl,
  },

  filterPill: {
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.full, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  filterPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterPillText: { fontSize: 12, color: colors.textSecondary, ...font.medium },
  filterPillTextActive: { color: '#fff', ...font.bold },

  subFormLabel: { fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold, marginBottom: 6, marginTop: spacing.sm },
  subFormInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, fontSize: 14,
    marginBottom: spacing.sm,
  },
  subClassOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  subClassOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  subClassOptionText: { fontSize: 14, color: colors.textSecondary, ...font.medium },
  subClassOptionTextActive: { color: colors.primary, ...font.bold },

  seedRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12,
    marginBottom: 6,
  },
  seedRowActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  seedRowName: { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  seedRowMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },

  // ── Stats tab ──────────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  statsCard: {
    width: '48%', backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: 2,
  },
  statsCardIcon: { fontSize: 22, marginBottom: 6 },
  statsCardValue: { fontSize: 28, ...font.bold, color: colors.textPrimary },
  statsCardLabel: { fontSize: 11, color: colors.textTertiary, ...font.medium, textAlign: 'center', marginTop: 4 },
});
