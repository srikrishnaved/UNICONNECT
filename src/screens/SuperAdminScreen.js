import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { useApp } from '../context/AppContext';
import { teachers as SEED_TEACHERS, hubClubs } from '../data/index';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import RosterUploadModal from '../components/RosterUploadModal';
import AttendanceReportScreen from '../components/AttendanceReportScreen';
import UniversitySetupWizard from '../components/UniversitySetupWizard';
import NAACScreen from '../components/NAACScreen';
import { useUniversityConfig } from '../hooks/useUniversityConfig';
import { User, UserCheck, GraduationCap, Landmark, BadgeCheck, Calendar, RefreshCw, ClipboardList, FileText, BarChart2, Gift, Wrench, Settings, X, Check, Trash2 } from 'lucide-react-native';

const TABS = ['Teachers', 'CR', 'Subjects', 'SAPS', 'Stats'];
const SAPS_ROLES = ['President', 'Vice President', 'Member Secretary', 'Secretary', 'Vice Secretary'];

export default function SuperAdminScreen({ navigation }) {
  const { isAppAdmin, approveTeacher, rejectTeacher, userProfile } = useApp();
  const { classes: uniClasses } = useUniversityConfig();
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

  // Roster upload
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showNAAC, setShowNAAC] = useState(false);

  // University setup wizard
  const [showWizard, setShowWizard] = useState(false);
  const [setupComplete, setSetupComplete] = useState(true);
  const [resumeStep, setResumeStep] = useState(1);
  const [universityId, setUniversityId] = useState(null);

  // Timetable-derived subjects map for teachers whose teacher_profiles.subjects is empty.
  // Key: lowercased teacher name; value: sorted course_name array.
  const [timetableSubjectsMap, setTimetableSubjectsMap] = useState({});

  // University Subjects tab state
  const [uniSubjects, setUniSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState('');       // selected class name
  const [showAddForm, setShowAddForm] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectTeacher, setSubjectTeacher] = useState('');
  const [subjectIsElective, setSubjectIsElective] = useState(false);
  const [subjectFormError, setSubjectFormError] = useState('');
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState(null);
  const [importingSubjects, setImportingSubjects] = useState(false);

  useEffect(() => {
    if (activeTab === 'Teachers') loadTeachers();
    if (activeTab === 'CR') loadCrRequests();
    if (activeTab === 'Subjects') loadUniSubjects();
    if (activeTab === 'SAPS') loadSapsData();
    if (activeTab === 'Stats') loadStats();
  }, [activeTab]);

  useEffect(() => {
    if (!userProfile?.id || !userProfile?.is_super_admin) return;
    const uid = userProfile.id;
    setUniversityId(uid);
    (async () => {
      const { data } = await supabase
        .from('university_setup_progress')
        .select('is_setup_complete, step_details_done, step_classes_done')
        .eq('university_id', uid)
        .maybeSingle();
      if (!data || !data.is_setup_complete) {
        let step = 1;
        if (data?.step_details_done && !data?.step_classes_done) step = 2;
        else if (data?.step_details_done && data?.step_classes_done) step = 3;
        setResumeStep(step);
        setSetupComplete(false);
        setShowWizard(true);
      }
    })();
  }, [userProfile?.id]);

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

  const loadUniSubjects = async () => {
    if (!universityId) return;
    setSubjectsLoading(true);
    const { data } = await supabase
      .from('university_subjects')
      .select('id, class_name, subject_name, subject_code, teacher_name, is_elective')
      .eq('university_id', universityId)
      .order('class_name').order('subject_name');
    setUniSubjects(data || []);
    setSubjectsLoading(false);
  };

  const openAddSubjectForm = () => {
    setSubjectName('');
    setSubjectCode('');
    setSubjectTeacher('');
    setSubjectIsElective(false);
    setSubjectFormError('');
    setShowAddForm(true);
  };

  const saveUniSubject = async () => {
    if (!subjectName.trim()) { setSubjectFormError('Subject name is required.'); return; }
    if (!subjectFilter) { setSubjectFormError('Select a class first.'); return; }
    setSubjectSaving(true); setSubjectFormError('');
    try {
      const { data, error } = await supabase.from('university_subjects').insert({
        university_id: universityId,
        class_name: subjectFilter,
        subject_name: subjectName.trim(),
        subject_code: subjectCode.trim() || null,
        teacher_name: subjectTeacher.trim() || null,
        is_elective: subjectIsElective,
      }).select().single();
      if (error) throw error;
      setUniSubjects(prev => [...prev, data].sort((a, b) => a.subject_name.localeCompare(b.subject_name)));
      setShowAddForm(false);
    } catch (e) {
      setSubjectFormError(e.message || 'Could not save subject.');
    } finally {
      setSubjectSaving(false);
    }
  };

  const deleteUniSubject = async (id) => {
    if (!window.confirm('Delete this subject? This cannot be undone.')) return;
    setDeletingSubject(id);
    await supabase.from('university_subjects').delete().eq('id', id);
    setUniSubjects(prev => prev.filter(s => s.id !== id));
    setDeletingSubject(null);
  };

  const importSubjectsFromFile = async () => {
    if (!subjectFilter) { window.alert('Select a class before importing.'); return; }
    setImportingSubjects(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv', 'text/plain',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;

      let workbook;
      if (asset.file) {
        workbook = XLSX.read(await asset.file.arrayBuffer(), { type: 'array' });
      } else {
        workbook = XLSX.read(
          await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 }),
          { type: 'base64' },
        );
      }
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      // Detect header row: first row is headers if it contains text like "subject", "name", "code"
      const HEADER_RE = /subject|name|code|teacher/i;
      const firstRow = rows[0]?.map(c => String(c).trim()) ?? [];
      const dataRows = firstRow.some(c => HEADER_RE.test(c)) ? rows.slice(1) : rows;

      const toInsert = dataRows
        .filter(row => String(row[0] ?? '').trim())
        .map(row => ({
          university_id: universityId,
          class_name: subjectFilter,
          subject_name: String(row[0] ?? '').trim(),
          subject_code: String(row[1] ?? '').trim() || null,
          teacher_name: String(row[2] ?? '').trim() || null,
          is_elective: false,
        }));

      if (toInsert.length === 0) { window.alert('No rows found in the file.'); return; }

      const { data, error } = await supabase
        .from('university_subjects')
        .insert(toInsert)
        .select();
      if (error) throw error;
      setUniSubjects(prev =>
        [...prev, ...(data || [])].sort((a, b) =>
          a.class_name.localeCompare(b.class_name) || a.subject_name.localeCompare(b.subject_name),
        ),
      );
      window.alert(`Imported ${(data || []).length} subjects.`);
    } catch (e) {
      window.alert('Import failed: ' + (e.message || 'Unknown error'));
    } finally {
      setImportingSubjects(false);
    }
  };

  const renderSubjectsTab = () => {
    if (subjectsLoading) return <ActivityIndicator color={tColors.student.primary} style={{ marginTop: 40 }} />;
    const filtered = subjectFilter
      ? uniSubjects.filter(s => s.class_name === subjectFilter)
      : [];

    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Class chip picker */}
        {uniClasses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No classes configured — complete University Setup first.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: tSpacing.md }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {uniClasses.map(cls => {
                const active = subjectFilter === cls;
                return (
                  <TouchableOpacity
                    key={cls}
                    style={[styles.filterPill, active && styles.filterPillActive]}
                    onPress={() => { setSubjectFilter(cls); setShowAddForm(false); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{cls}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {subjectFilter ? (
          <>
            {/* Action row */}
            <View style={{ flexDirection: 'row', gap: tSpacing.sm, marginBottom: tSpacing.md }}>
              <TouchableOpacity
                style={[styles.approveBtn, { flex: 1 }]}
                onPress={showAddForm ? () => setShowAddForm(false) : openAddSubjectForm}
                activeOpacity={0.8}
              >
                <Text style={styles.approveBtnText}>{showAddForm ? 'Cancel' : '+ Add Subject'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectBtn, { flex: 1 }, importingSubjects && { opacity: 0.5 }]}
                onPress={importSubjectsFromFile}
                disabled={importingSubjects}
                activeOpacity={0.8}
              >
                {importingSubjects
                  ? <ActivityIndicator size="small" color={tColors.error} />
                  : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><FileText size={14} color={tColors.error} /><Text style={styles.rejectBtnText}>Import Excel</Text></View>}
              </TouchableOpacity>
            </View>

            {/* Inline add form */}
            {showAddForm && (
              <View style={[styles.teacherCard, { marginBottom: tSpacing.md }]}>
                <Text style={styles.subFormLabel}>SUBJECT NAME *</Text>
                <TextInput
                  value={subjectName}
                  onChangeText={t => { setSubjectName(t); setSubjectFormError(''); }}
                  placeholder="e.g. Financial Accounting"
                  placeholderTextColor={tColors.textTertiary}
                  style={styles.subFormInput}
                  maxLength={120}
                />
                <Text style={styles.subFormLabel}>SUBJECT CODE</Text>
                <TextInput
                  value={subjectCode}
                  onChangeText={setSubjectCode}
                  placeholder="e.g. BIAF101-1"
                  placeholderTextColor={tColors.textTertiary}
                  style={styles.subFormInput}
                  autoCapitalize="characters"
                  maxLength={30}
                />
                <Text style={styles.subFormLabel}>TEACHER NAME</Text>
                <TextInput
                  value={subjectTeacher}
                  onChangeText={setSubjectTeacher}
                  placeholder="e.g. Dr. Anita Sharma"
                  placeholderTextColor={tColors.textTertiary}
                  style={styles.subFormInput}
                  maxLength={80}
                />
                <TouchableOpacity
                  style={[styles.filterPill, subjectIsElective && styles.filterPillActive, { alignSelf: 'flex-start', marginBottom: tSpacing.md }]}
                  onPress={() => setSubjectIsElective(v => !v)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.filterPillText, subjectIsElective && styles.filterPillTextActive]}>
                    {subjectIsElective ? 'Elective' : 'Elective?'}
                  </Text>
                </TouchableOpacity>
                {!!subjectFormError && (
                  <Text style={{ fontSize: 12, color: tColors.error, marginBottom: tSpacing.sm }}>{subjectFormError}</Text>
                )}
                <TouchableOpacity
                  style={[styles.approveBtn, subjectSaving && { opacity: 0.6 }]}
                  onPress={saveUniSubject}
                  disabled={subjectSaving}
                  activeOpacity={0.85}
                >
                  {subjectSaving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.approveBtnText}>Save Subject</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Subject list */}
            {filtered.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No subjects for {subjectFilter}</Text>
              </View>
            ) : filtered.map(s => (
              <View key={s.id} style={[styles.teacherCard, { paddingVertical: tSpacing.sm }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.teacherName}>{s.subject_name}</Text>
                      {s.is_elective && (
                        <View style={[styles.facultyBadge, { backgroundColor: tColors.student.primaryDim }]}>
                          <Text style={[styles.facultyBadgeText, { color: tColors.student.primary }]}>ELEC</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.teacherEmail}>
                      {[s.subject_code, s.teacher_name].filter(Boolean).join(' · ') || '—'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.rejectBtn, { paddingHorizontal: tSpacing.sm, paddingVertical: 6 }, deletingSubject === s.id && { opacity: 0.5 }]}
                    onPress={() => deleteUniSubject(s.id)}
                    disabled={deletingSubject === s.id}
                    activeOpacity={0.8}
                  >
                    {deletingSubject === s.id
                      ? <ActivityIndicator size="small" color={tColors.error} />
                      : <Trash2 size={16} color={tColors.error} />}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Select a class above to manage its subjects</Text>
          </View>
        )}
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
              {isResolving ? <ActivityIndicator size="small" color={tColors.error} /> : <Text style={styles.rejectBtnText}>Reject</Text>}
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
      return <ActivityIndicator color={tColors.student.primary} style={{ marginTop: 40 }} />;
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
    if (crLoading) return <ActivityIndicator color={tColors.student.primary} style={{ marginTop: 40 }} />;
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
              <Gift size={28} color={tColors.accent} style={{ marginBottom: 8 }} />
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
                  {resolvingCR === req.id ? <ActivityIndicator size="small" color={tColors.error} /> : <Text style={styles.rejectBtnText}>Reject</Text>}
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
    if (sapsLoading) return <ActivityIndicator color={tColors.student.primary} style={{ marginTop: 40 }} />;
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
                  {resolvingSaps === app.id ? <ActivityIndicator size="small" color={tColors.error} /> : <Text style={styles.rejectBtnText}>Reject</Text>}
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
          <View style={{ height: tSpacing.sm }} />
          {SAPS_ROLES.map(role => {
            const member = sapsTeam.find(m => m.role === role);
            return (
              <View key={role} style={[styles.teacherCard, { paddingVertical: tSpacing.sm }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teacherName}>{role}</Text>
                    {member ? (
                      <Text style={styles.teacherEmail}>{member.memberName}</Text>
                    ) : (
                      <Text style={[styles.teacherEmail, { color: tColors.textTertiary, fontStyle: 'italic' }]}>Vacant</Text>
                    )}
                  </View>
                  {member ? (
                    <TouchableOpacity
                      style={[styles.rejectBtn, { paddingHorizontal: tSpacing.sm, paddingVertical: 6 }, removingSapsMember === member.id && { opacity: 0.5 }]}
                      onPress={() => handleRemoveSapsMember(member)}
                      disabled={removingSapsMember === member.id}
                      activeOpacity={0.8}
                    >
                      {removingSapsMember === member.id ? <ActivityIndicator size="small" color={tColors.error} /> : <Text style={styles.rejectBtnText}>Remove</Text>}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.approveBtn, { paddingHorizontal: tSpacing.sm, paddingVertical: 6 }]}
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
      <Wrench size={32} color={tColors.warning} style={{ marginBottom: 12 }} />
      <Text style={styles.emptyText}>{label} — coming soon</Text>
    </View>
  );

  const STAT_CARDS = stats ? [
    { label: 'Total Users',            value: stats.users,          Icon: User },
    { label: 'Teachers',               value: stats.teachers,       Icon: UserCheck },
    { label: 'Students',               value: stats.students,       Icon: GraduationCap },
    { label: 'Clubs',                  value: stats.clubs,          Icon: Landmark },
    { label: 'Club Memberships',       value: stats.memberships,    Icon: BadgeCheck },
    { label: 'Hub Events',             value: stats.hubEvents,      Icon: Calendar },
    { label: 'Substitute Requests',    value: stats.subRequests,    Icon: RefreshCw },
    { label: 'Compensatory Requests',  value: stats.compRequests,   Icon: ClipboardList },
    { label: 'NFAs Created',           value: stats.nfaRequests,    Icon: FileText },
    { label: 'Activity Reports',       value: stats.activityReports, Icon: BarChart2 },
  ] : [];

  const renderStatsTab = () => {
    if (statsLoading) {
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator color={tColors.student.primary} size="large" />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>Loading stats…</Text>
        </View>
      );
    }
    if (!stats) return null;
    return (
      <ScrollView contentContainerStyle={{ padding: tSpacing.md, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 12, fontWeight: typography.bold, color: tColors.textTertiary, letterSpacing: 1, marginBottom: tSpacing.md }}>
          APP STATISTICS
        </Text>
        <View style={styles.statsGrid}>
          {STAT_CARDS.map(card => (
            <View key={card.label} style={styles.statsCard}>
              <card.Icon size={22} color={tColors.textSecondary} style={{ marginBottom: 6 }} />
              <Text style={styles.statsCardValue}>{card.value}</Text>
              <Text style={styles.statsCardLabel}>{card.label}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={{ marginTop: tSpacing.base, alignItems: 'center', paddingVertical: 10 }}
          onPress={loadStats}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 12, color: tColors.student.primary, fontWeight: typography.medium }}>↺ Refresh</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={{ padding: 4 }}>
          <Text style={{ fontSize: 18, color: tColors.textSecondary }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Super Admin</Text>
        </View>
        <TouchableOpacity onPress={loadTeachers} activeOpacity={0.7} style={{ padding: 4 }}>
          <Text style={{ fontSize: 16 }}>↺</Text>
        </TouchableOpacity>
      </View>

      {/* Setup incomplete banner */}
      {userProfile?.is_super_admin && !setupComplete && (
        <View style={styles.setupBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <Settings size={14} color={tColors.warning} />
            <Text style={styles.setupBannerText}>University setup incomplete — some features won't work until you finish setup.</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowWizard(true)}
            activeOpacity={0.8}
            style={styles.setupBannerBtn}
          >
            <Text style={styles.setupBannerBtnText}>Complete Setup →</Text>
          </TouchableOpacity>
        </View>
      )}

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
        style={{ marginHorizontal: tSpacing.md, marginBottom: tSpacing.sm, backgroundColor: tColors.student.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
        onPress={() => navigation.navigate('TeacherDashboard')}
        activeOpacity={0.8}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><ClipboardList size={14} color="#fff" /><Text style={{ color: '#fff', fontSize: 14, fontWeight: typography.bold }}>Open Teacher Dashboard</Text></View>
      </TouchableOpacity>

      {/* Upload Roster shortcut */}
      <TouchableOpacity
        style={{ marginHorizontal: tSpacing.md, marginBottom: tSpacing.sm, backgroundColor: tColors.cardAlt, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: tColors.border }}
        onPress={() => setShowRosterModal(true)}
        activeOpacity={0.8}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><BarChart2 size={14} color={tColors.textPrimary} /><Text style={{ color: tColors.textPrimary, fontSize: 14, fontWeight: typography.bold }}>Upload Class Roster</Text></View>
      </TouchableOpacity>

      {/* Attendance Reports shortcut */}
      <TouchableOpacity
        style={{ marginHorizontal: tSpacing.md, marginBottom: tSpacing.sm, backgroundColor: tColors.cardAlt, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: tColors.border }}
        onPress={() => setShowReport(true)}
        activeOpacity={0.8}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><ClipboardList size={14} color={tColors.textPrimary} /><Text style={{ color: tColors.textPrimary, fontSize: 14, fontWeight: typography.bold }}>Attendance Reports</Text></View>
      </TouchableOpacity>

      {/* NAAC shortcut */}
      <TouchableOpacity
        style={{ marginHorizontal: tSpacing.md, marginBottom: tSpacing.sm, backgroundColor: tColors.cardAlt, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: tColors.border }}
        onPress={() => setShowNAAC(true)}
        activeOpacity={0.8}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Landmark size={14} color={tColors.textPrimary} /><Text style={{ color: tColors.textPrimary, fontSize: 14, fontWeight: typography.bold }}>NAAC Documentation</Text></View>
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
            <View style={{ backgroundColor: tColors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: tSpacing.base, maxHeight: '85%', borderWidth: 1, borderColor: tColors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: typography.bold, color: tColors.textPrimary }}>
                  Approve {approvalTarget?.name}
                </Text>
                <TouchableOpacity onPress={() => !approvalLoading && setApprovalTarget(null)} activeOpacity={0.7} style={{ padding: 4 }}>
                  <X size={22} color={tColors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 12, color: tColors.textSecondary, marginBottom: tSpacing.md }}>
                Link to a seed faculty member so their timetable, subjects, and position load automatically on first login.
              </Text>
              <TextInput
                value={approvalSearch}
                onChangeText={setApprovalSearch}
                placeholder="Search faculty name…"
                placeholderTextColor={tColors.textTertiary}
                style={{ backgroundColor: tColors.bg, borderWidth: 1, borderColor: tColors.border, borderRadius: tRadius.md, padding: tSpacing.md, fontSize: 14, color: tColors.textPrimary, marginBottom: tSpacing.sm }}
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
                        <Text style={[styles.seedRowName, sel && { color: tColors.student.primary }]}>{t.name}</Text>
                        <Text style={styles.seedRowMeta}>Faculty</Text>
                      </View>
                      {sel && <Check size={16} color={tColors.student.primary} />}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.seedRow, !approvalSeedPick && styles.seedRowActive, { marginBottom: tSpacing.sm }]}
                  onPress={() => setApprovalSeedPick(null)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.seedRowName, !approvalSeedPick && { color: tColors.student.primary }]}>
                      Not on this list
                    </Text>
                    <Text style={styles.seedRowMeta}>Approve without linking — teacher selects subjects manually</Text>
                  </View>
                  {!approvalSeedPick && <Check size={16} color={tColors.student.primary} />}
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
            <View style={{ backgroundColor: tColors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: tSpacing.base, maxHeight: '80%', borderWidth: 1, borderColor: tColors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tSpacing.md }}>
                <Text style={{ fontSize: 16, fontWeight: typography.bold, color: tColors.textPrimary }}>Assign {assignRole}</Text>
                <TouchableOpacity onPress={() => setShowAssignModal(false)} activeOpacity={0.7} style={{ padding: 4 }}>
                  <X size={22} color={tColors.textSecondary} />
                </TouchableOpacity>
              </View>
              <TextInput
                value={assignSearch}
                onChangeText={searchAssignStudents}
                placeholder="Search students by name…"
                placeholderTextColor={tColors.textTertiary}
                style={{ backgroundColor: tColors.bg, borderWidth: 1, borderColor: tColors.border, borderRadius: tRadius.md, padding: tSpacing.md, fontSize: 14, color: tColors.textPrimary, marginBottom: tSpacing.md }}
                autoFocus
              />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {assignSearch.trim().length > 0 && assignResults.length === 0 && (
                  <Text style={{ fontSize: 13, color: tColors.textTertiary, textAlign: 'center', marginTop: tSpacing.base }}>No students found</Text>
                )}
                {assignResults.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.teacherCard, { paddingVertical: tSpacing.sm }, assigning && { opacity: 0.5 }]}
                    onPress={() => !assigning && handleAssignDirect(s)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm }}>
                      <View style={[styles.avatarCircle, { width: 34, height: 34, borderRadius: 17 }]}>
                        <Text style={[styles.avatarText, { fontSize: 13 }]}>{s.name[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.teacherName}>{s.name}</Text>
                        <Text style={styles.teacherEmail}>{s.course} · {s.year}</Text>
                      </View>
                      {assigning ? <ActivityIndicator size="small" color={tColors.student.primary} /> : <Text style={{ color: tColors.student.primary, fontSize: 18 }}>→</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Roster Upload Modal ──────────────────────────────────────────── */}
      <RosterUploadModal
        visible={showRosterModal}
        onClose={() => setShowRosterModal(false)}
      />

      {/* ── Attendance Report Modal ──────────────────────────────────────── */}
      <AttendanceReportScreen
        visible={showReport}
        onClose={() => setShowReport(false)}
        mode="admin"
        userProfile={userProfile}
      />

      {/* ── University Setup Wizard ──────────────────────────────────────── */}
      <UniversitySetupWizard
        visible={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={() => { setShowWizard(false); setSetupComplete(true); }}
        universityId={universityId}
        initialStep={resumeStep}
      />

      {/* ── NAAC Documentation Modal ─────────────────────────────────────── */}
      <NAACScreen
        visible={showNAAC}
        onClose={() => setShowNAAC(false)}
        userProfile={userProfile}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tColors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: tSpacing.base, paddingVertical: tSpacing.md,
    borderBottomWidth: 1, borderBottomColor: tColors.border,
    backgroundColor: tColors.card,
  },
  headerTitle: { fontSize: 16, fontWeight: typography.bold, color: tColors.textPrimary },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: tColors.card,
    borderBottomWidth: 1, borderBottomColor: tColors.border,
  },
  tabBtn: {
    flex: 1, paddingVertical: tSpacing.md,
    alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: tColors.student.primary },
  tabBtnText: { fontSize: 14, color: tColors.textSecondary, fontWeight: typography.medium },
  tabBtnTextActive: { color: tColors.student.primary, fontWeight: typography.bold },

  tabContent: { padding: tSpacing.base, paddingBottom: 40 },

  section: { marginBottom: tSpacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm, marginBottom: tSpacing.md },
  sectionTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: tColors.textPrimary, letterSpacing: 0.8 },
  countBadge: {
    backgroundColor: tColors.warning,
    borderRadius: tRadius.full,
    width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  countBadgeText: { fontSize: 11, color: '#fff', fontWeight: typography.bold },

  teacherCard: {
    backgroundColor: tColors.card,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.lg,
    padding: tSpacing.base,
    marginBottom: tSpacing.md,
    ...shadows.card,
  },
  teacherCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.md,
    marginBottom: tSpacing.md,
  },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: tColors.student.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: typography.bold, color: '#fff' },
  teacherName: { fontSize: 15, fontWeight: typography.bold, color: tColors.textPrimary },
  teacherEmail: { fontSize: 12, color: tColors.textSecondary, marginTop: 1 },

  facultyBadge: {
    backgroundColor: tColors.warningDim,
    borderRadius: tRadius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeGreen: { backgroundColor: tColors.successDim },
  facultyBadgeText: { fontSize: 10, color: tColors.warning, fontWeight: typography.bold },

  teacherMeta: { marginBottom: tSpacing.sm },
  metaLabel: { fontSize: 9, color: tColors.textTertiary, letterSpacing: 0.6, fontWeight: typography.bold, marginBottom: 2 },
  metaValue: { fontSize: 13, color: tColors.textSecondary },

  actionRow: {
    flexDirection: 'row', gap: tSpacing.sm, marginTop: tSpacing.md,
    borderTopWidth: 1, borderTopColor: tColors.border, paddingTop: tSpacing.md,
  },
  rejectBtn: {
    flex: 1, paddingVertical: 10, borderRadius: tRadius.md,
    borderWidth: 1, borderColor: tColors.error,
    alignItems: 'center',
  },
  rejectBtnText: { fontSize: 14, color: tColors.error, fontWeight: typography.semibold },
  approveBtn: {
    flex: 1, paddingVertical: 10, borderRadius: tRadius.md,
    backgroundColor: tColors.success,
    alignItems: 'center',
  },
  approveBtnText: { fontSize: 14, color: '#fff', fontWeight: typography.semibold },

  emptyCard: {
    backgroundColor: tColors.card,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.lg,
    padding: tSpacing.lg,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: tColors.textTertiary },

  centerBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: tSpacing.lg,
  },

  filterPill: {
    paddingHorizontal: tSpacing.md, paddingVertical: 7,
    borderRadius: tRadius.full, backgroundColor: tColors.card,
    borderWidth: 1, borderColor: tColors.border,
  },
  filterPillActive: { backgroundColor: tColors.student.primary, borderColor: tColors.student.primary },
  filterPillText: { fontSize: 12, color: tColors.textSecondary, fontWeight: typography.medium },
  filterPillTextActive: { color: '#fff', fontWeight: typography.bold },

  subFormLabel: { fontSize: 10, color: tColors.textSecondary, letterSpacing: 0.8, fontWeight: typography.bold, marginBottom: 6, marginTop: tSpacing.sm },
  subFormInput: {
    backgroundColor: tColors.bg, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md, color: tColors.textPrimary, fontSize: 14,
    marginBottom: tSpacing.sm,
  },

  seedRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: tColors.bg, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, paddingHorizontal: tSpacing.md, paddingVertical: 12,
    marginBottom: 6,
  },
  seedRowActive: { borderColor: tColors.student.primary, backgroundColor: tColors.student.primaryDim },
  seedRowName: { fontSize: 14, fontWeight: typography.semibold, color: tColors.textPrimary },
  seedRowMeta: { fontSize: 11, color: tColors.textTertiary, marginTop: 2 },

  // ── Setup banner ──────────────────────────────────────────────────────────
  setupBanner: {
    backgroundColor: tColors.warningDim,
    borderBottomWidth: 1,
    borderBottomColor: tColors.warning,
    paddingHorizontal: tSpacing.base,
    paddingVertical: tSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tSpacing.sm,
  },
  setupBannerText: {
    flex: 1,
    fontSize: 12,
    color: tColors.warning,
    fontWeight: typography.medium,
    lineHeight: 17,
  },
  setupBannerBtn: {
    backgroundColor: tColors.warning,
    borderRadius: tRadius.sm,
    paddingHorizontal: tSpacing.md,
    paddingVertical: 6,
  },
  setupBannerBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: typography.bold,
  },

  // ── Stats tab ──────────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: tSpacing.sm,
  },
  statsCard: {
    width: '48%', backgroundColor: tColors.card,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.lg,
    padding: tSpacing.md,
    alignItems: 'center',
    marginBottom: 2,
    ...shadows.card,
  },
  statsCardValue: { fontSize: 28, fontWeight: typography.bold, color: tColors.textPrimary },
  statsCardLabel: { fontSize: 11, color: tColors.textTertiary, fontWeight: typography.medium, textAlign: 'center', marginTop: 4 },
});
