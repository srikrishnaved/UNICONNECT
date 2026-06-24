import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Switch, ActivityIndicator, Alert, Clipboard, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius, font } from '../theme';
import { createCompensatoryRequest } from '../lib/compensatoryUtils';
import * as DocumentPicker from 'expo-document-picker';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns the subject name a teacher is assigned to teach for the given class,
// or null if not found (e.g. teacher teaches a different class or isn't in DB).
// Returns { name, code } for the subject a teacher is assigned to in a given class,
// or null if not found.
async function getSubjectForTeacher(teacherName, className) {
  try {
    const { data: profiles } = await supabase
      .from('profiles').select('id').ilike('name', `%${teacherName}%`).limit(1);
    if (!profiles?.length) return null;
    const { data: ts } = await supabase
      .from('teacher_subjects').select('subject_id').eq('teacher_id', profiles[0].id);
    if (!ts?.length) return null;
    const { data: subs } = await supabase
      .from('subjects').select('name, code')
      .in('id', ts.map(t => t.subject_id))
      .eq('class', className);
    if (!subs?.length) return null;
    return { name: subs[0].name, code: subs[0].code };
  } catch {
    return null;
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const CLASSES = [
  '1BcomIBA', '1BcomF&A', '1BcomIAF',
  '3BcomIBA', '3BcomF&A(A)', '3BcomF&A(B)', '3BcomIAF',
  '5BcomF&A(A)', '5BcomF&A(B)', '5BcomIAF',
  '7BcomF&A',
];

const FACULTY_LIST = [
  'Dr. Bhagyalakshmi', 'Dr. Hridhya', 'Dr. Ravi', 'Dr. Thirupathi',
  'Dr. Narasimha Murthy', 'Dr. Kantharaju', 'Bhoomika Urs ACCA',
  'CS Monika Agarwal', 'Dr. Shruthi Joshi', 'Dr. Deon Babloo Thomas',
  'Prof. Shreshta', 'Prof. Bharath', 'Dr. Diliphan',
  'CA Abhay', 'CA Sarthak', 'CA Devansh', 'CA Rejo',
  'CA Sangharsh', 'CA Vishal Gupta',
];

const TIMETABLE_TEAM = ['Shruthi', 'Bhoomika', 'Thirupat'];

const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Classes that have HED reserved at TUE P2 (5th-year classes have real subjects there).
const HED_CLASSES = new Set([
  '1BcomIBA', '1BcomF&A', '1BcomIAF',
  '3BcomIBA', '3BcomF&A(A)', '3BcomF&A(B)', '3BcomIAF',
]);

// Returns up to 3 free slots for a compensatory class, ordered by "starting from tomorrow"
// in the weekly cycle. Respects teacher conflicts and availability constraints.
function findCompOptions(req, { slots, periods, mergedAdjunctConstraints, todayDay }) {
  const todayIdx = DAY_ORDER.indexOf(todayDay);
  const orderedDays = [
    ...DAY_ORDER.slice(todayIdx + 1),
    ...DAY_ORDER.slice(0, todayIdx + 1),
  ];

  const freeSlots = slots.filter(s =>
    s.class_name === req.original_class_name &&
    !s.course_name &&
    !(s.day === 'TUE' && s.period_name === 'P2' && HED_CLASSES.has(s.class_name))
  );

  const teacherLower = req.teacher_name.toLowerCase();
  const busyKeys = new Set(
    slots
      .filter(s => s.faculty_name && s.faculty_name.toLowerCase().includes(teacherLower))
      .map(s => `${s.day}__${s.period_name}`)
  );

  const sortMap = {};
  periods.forEach(p => { sortMap[p.name] = p.sort_order; });

  const options = [];
  for (const day of orderedDays) {
    const dayFree = freeSlots
      .filter(s => s.day === day)
      .sort((a, b) => (sortMap[a.period_name] || 99) - (sortMap[b.period_name] || 99));

    for (const slot of dayFree) {
      if (busyKeys.has(`${day}__${slot.period_name}`)) continue;
      const periodObj = periods.find(p => p.name === slot.period_name);
      const startMins = periodObj ? parseTimeToMinutes(periodObj.start_time) : null;
      if (adjunctWarning(req.teacher_name, day, startMins, mergedAdjunctConstraints)) continue;
      options.push(slot);
      if (options.length >= 3) break;
    }
    if (options.length >= 3) break;
  }
  return options;
}

// Adjunct / restricted faculty availability constraints.
// days: which days they come in (null = all days).
// windowEnd: latest period start they can teach (07:30 format).
// satWindowEnd: override windowEnd for Saturdays only.
const ADJUNCT_CONSTRAINTS = [
  { name: 'CA Sarthak',      days: ['THU', 'FRI'],                        windowEnd: '09:30' },
  { name: 'CA Devansh',      days: ['THU', 'FRI'],                        windowEnd: '09:30' },
  { name: 'CA Rejo',         days: ['MON', 'TUE', 'THU', 'SAT'],         windowEnd: '09:30', satWindowEnd: '10:30' },
  { name: 'CA Abhay',        days: ['MON', 'TUE', 'WED', 'THU', 'SAT'], windowEnd: '11:30', satWindowEnd: '10:30' },
  { name: 'CA Vishal Gupta', days: ['MON', 'TUE'],                        windowEnd: '09:30' },
  { name: 'CA Sangharsh',    days: null,                                   windowEnd: '09:30' },
  { name: 'Prof. Bharath',   days: ['MON', 'TUE', 'THU'],                 windowEnd: '12:00' },
  { name: 'Prof. Shreshta',  days: ['MON', 'TUE', 'WED'],                 windowEnd: '09:30' },
  { name: 'Dr. Hridhya',     days: ['MON', 'TUE', 'WED', 'THU', 'FRI'], windowEnd: null },
  { name: 'Dr. Diliphan',    days: ['MON', 'TUE', 'WED', 'THU', 'FRI'], windowEnd: null },
  { name: 'Dr. Thirupathi',  days: ['MON'],                                windowEnd: '10:00' },
];

const CELL_W = 130;
const PERIOD_COL_W = 58;

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function TimetablePlannerScreen({ onClose, embedded = false }) {
  const { userProfile, teacherProfile, createNotification, isAppAdmin,
    adminTestAsName: testAsName, setAdminTestAsName: setTestAsName } = useApp();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [periods, setPeriods] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [slots, setSlots] = useState([]);
  const [constraints, setConstraints] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedClass, setSelectedClass] = useState('1BcomIBA');
  const [activeTab, setActiveTab] = useState('grid');

  // ── Edit modal ────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    course_code: '', course_name: '', faculty_name: '',
    batch_details: '', is_elective: false, reason: '', change_type: 'edit', isPermanent: false,
  });
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [facultyQuery, setFacultyQuery] = useState('');
  const [showFacultyAC, setShowFacultyAC] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Today tab state ───────────────────────────────────────────────────────
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date().getDay();
    if (d === 0) return 'MON';
    return [null, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d] || 'MON';
  });
  const [absentFaculty, setAbsentFaculty] = useState(new Set());
  const [showRevisedView, setShowRevisedView] = useState(false);
  const [selectedSubs, setSelectedSubs] = useState({});
  const [pairedSessions, setPairedSessions] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [whatsappModal, setWhatsappModal] = useState(null);

  // ── Substitute request modal (regular teachers) ───────────────────────────
  const [subReqTarget, setSubReqTarget] = useState(null); // {slot, day, periodName}
  const [subReqReason, setSubReqReason] = useState('');
  const [subReqPrefSub, setSubReqPrefSub] = useState('');
  const [subReqSuggestions, setSubReqSuggestions] = useState([]);
  const [subReqSaving, setSubReqSaving] = useState(false);
  // ── Absent Today (teacher self-reporting) ─────────────────────────────────
  const [absentTodayModal, setAbsentTodayModal] = useState(false);
  const [absentTodayReason, setAbsentTodayReason] = useState('');
  const [absentTodaySubmitting, setAbsentTodaySubmitting] = useState(false);
  // ── Pending substitute requests (timetable team) ──────────────────────────
  const [pendingSubReqs, setPendingSubReqs] = useState([]);
  const [approveSubModal, setApproveSubModal] = useState(null);
  const [approveSubName, setApproveSubName] = useState('');
  // Grouped inline substitute assignments: { [reqId]: facultyName }
  const [subAssignments, setSubAssignments] = useState({});
  const [subAssignAC, setSubAssignAC] = useState(null); // reqId with open autocomplete
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  // ── Compensatory requests (timetable team) ────────────────────────────────
  const [compReqs, setCompReqs] = useState([]);
  // ── Permanent overrides ───────────────────────────────────────────────────
  const [permanentOverrides, setPermanentOverrides] = useState([]);
  // ── Resolve Manually modal ────────────────────────────────────────────────
  const [resolveManualModal, setResolveManualModal] = useState(null);
  const [resolveDay, setResolveDay] = useState('MON');
  const [resolvePeriod, setResolvePeriod] = useState('M1');
  const [resolveCourse, setResolveCourse] = useState('');
  const [resolveError, setResolveError] = useState('');
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveSubjectSuggestions, setResolveSubjectSuggestions] = useState([]);
  // ── Swap mode (timetable team, grid view) ────────────────────────────────
  const [swapMode, setSwapMode] = useState(false);
  const [swapSlotA, setSwapSlotA] = useState(null); // { slot, class_name, day, period_name }
  const [swapSlotB, setSwapSlotB] = useState(null);
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  // ── Faculty availability editor (timetable team) ─────────────────────────
  const [facultyAvailability, setFacultyAvailability] = useState([]);
  const [showAvailEditor, setShowAvailEditor] = useState(false);
  const [editingAvail, setEditingAvail] = useState(null); // null = closed, {} = new, {id,...} = edit
  const [availName, setAvailName] = useState('');
  const [availDays, setAvailDays] = useState([]);
  const [availWindowEnd, setAvailWindowEnd] = useState('');
  const [availSatWindow, setAvailSatWindow] = useState('');
  const [availSaving, setAvailSaving] = useState(false);
  // ── Timetable Assistant ────────────────────────────────────────────────────
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [chatMode, setChatMode] = useState('select'); // 'select' | 'upload' | 'scratch'
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingSession, setPendingSession] = useState(null); // { session_id, slot_count, class_names }
  const [applyingSlots, setApplyingSlots] = useState(false);
  const chatScrollRef = useRef(null);
  const [availDeleting, setAvailDeleting] = useState(null);
  // ── Admin test-as (App Admin only) — state now lives in AppContext (global) ──
  const [showTestDropdown, setShowTestDropdown] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentName = userProfile?.name || teacherProfile?.name || '';
  const isHOD = currentName.toLowerCase().includes('hridhya');
  const isPrivileged = (name) =>
    name.toLowerCase().includes('hridhya') ||
    TIMETABLE_TEAM.some(n => name.toLowerCase().includes(n.toLowerCase()));
  const isTimetableTeam = isAppAdmin || isHOD || TIMETABLE_TEAM.some(n =>
    currentName.toLowerCase().includes(n.toLowerCase())
  );
  // When test-as is active, team privileges depend on whether the test-as target is also privileged.
  // Admin with no test-as → full team. Admin test-as Dr.Ravi → no team. Admin test-as Bhoomika/HOD → team.
  const effectiveIsTeam = isAppAdmin
    ? (!testAsName || isPrivileged(testAsName))
    : isTimetableTeam;
  const isActiveTeam = effectiveIsTeam;

  // Hardcoded defaults merged with any DB overrides saved by the timetable team.
  // DB entry for a given faculty_name fully replaces the hardcoded entry.
  const mergedAdjunctConstraints = useMemo(() => {
    const base = ADJUNCT_CONSTRAINTS.map(c => ({ ...c }));
    for (const db of facultyAvailability) {
      const idx = base.findIndex(c => c.name.toLowerCase() === db.faculty_name.toLowerCase());
      const entry = {
        name: db.faculty_name,
        days: db.available_days?.length ? db.available_days : null,
        windowEnd: db.window_end || null,
        satWindowEnd: db.sat_window_end || null,
      };
      if (idx >= 0) base[idx] = entry;
      else base.push(entry);
    }
    return base;
  }, [facultyAvailability]);

  const isSundayPreview = useMemo(() => new Date().getDay() === 0, []);

  const todayDay = useMemo(() => {
    const d = new Date().getDay();
    if (d === 0) return 'MON';
    return [null, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d];
  }, []);

  const classroom = useMemo(
    () => classrooms.find(c => c.class_name === selectedClass),
    [classrooms, selectedClass]
  );

  const classSlots = useMemo(
    () => slots.filter(s => s.class_name === selectedClass),
    [slots, selectedClass]
  );

  const todaySlots = useMemo(
    () => slots.filter(s => s.day === selectedDay),
    [slots, selectedDay]
  );

  const todayFacultyCards = useMemo(() => {
    const map = {};
    todaySlots.forEach(s => {
      if (!s.faculty_name) return;
      s.faculty_name.split(' / ').forEach(f => {
        const name = f.trim();
        if (!name) return;
        map[name] = (map[name] || 0) + 1;
      });
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [todaySlots]);

  const todayPairedSessions = useMemo(
    () => pairedSessions.filter(ps => ps.day === selectedDay),
    [pairedSessions, selectedDay]
  );

  // Build class list from whatever class_name values actually exist in the DB,
  // preserving the canonical CLASSES order for known names.
  const derivedClasses = useMemo(() => {
    if (!slots.length) return CLASSES;
    const fromDB = [...new Set(slots.map(s => s.class_name).filter(Boolean))];
    if (!fromDB.length) return CLASSES;
    const ordered = CLASSES.filter(c => fromDB.includes(c));
    // Exclude space-format aliases that are duplicates of paren-format names already in CLASSES
    const spaceAliases = new Set(['3BcomF&A A', '3BcomF&A B', '5BcomF&A A', '5BcomF&A B']);
    const extra = fromDB.filter(c => !CLASSES.includes(c) && !spaceAliases.has(c)).sort();
    return [...ordered, ...extra];
  }, [slots]);

  // Snap selectedClass to the first real class whenever derivedClasses resolves.
  useEffect(() => {
    if (derivedClasses.length > 0 && !derivedClasses.includes(selectedClass)) {
      setSelectedClass(derivedClasses[0]);
    }
  }, [derivedClasses]);

  function getSlot(day, periodName) {
    return classSlots.find(s => s.day === day && s.period_name === periodName) || null;
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pRes, cRes, sRes, fcRes, psRes] = await Promise.all([
        supabase.from('timetable_periods').select('*').order('sort_order'),
        supabase.from('timetable_classrooms').select('*'),
        supabase.from('timetable_slots').select('*'),
        supabase.from('timetable_faculty_constraints').select('*'),
        supabase.from('timetable_paired_sessions').select('*'),
      ]);
      if (cancelled) return;
      setPeriods(pRes.data || []);
      setClassrooms(cRes.data || []);
      setSlots(sRes.data || []);
      setConstraints(fcRes.data || []);
      setPairedSessions(psRes.data || []);
      console.log('[TimetablePlanner] raw slots first 3:', JSON.stringify((sRes.data || []).slice(0, 3), null, 2));
      console.log('[TimetablePlanner] unique class_names in DB:', [...new Set((sRes.data || []).map(s => s.class_name))]);
      console.log('[TimetablePlanner] selectedClass at load:', selectedClass);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Load faculty availability overrides from DB on mount
  useEffect(() => {
    supabase.from('faculty_availability').select('*').order('faculty_name')
      .then(({ data }) => setFacultyAvailability(data || []));
    supabase.from('timetable_permanent_overrides').select('*')
      .then(({ data }) => setPermanentOverrides(data || []));
  }, []);

  // Fetch subject suggestions when Resolve Manually modal opens
  useEffect(() => {
    if (!resolveManualModal) { setResolveSubjectSuggestions([]); return; }
    (async () => {
      try {
        const { data: profiles } = await supabase
          .from('profiles').select('id')
          .ilike('name', `%${resolveManualModal.teacher_name}%`)
          .limit(1);
        if (!profiles?.length) return;
        const { data: ts } = await supabase
          .from('teacher_subjects').select('subject_id')
          .eq('teacher_id', profiles[0].id);
        if (!ts?.length) return;
        const { data: subs } = await supabase
          .from('subjects').select('name, code')
          .in('id', ts.map(t => t.subject_id))
          .eq('class', resolveManualModal.original_class_name);
        setResolveSubjectSuggestions(subs || []);
      } catch {}
    })();
  }, [resolveManualModal]);

  // Load pending substitute requests + compensatory requests when timetable team opens Today tab
  useEffect(() => {
    if (!isTimetableTeam || activeTab !== 'today') return;
    supabase
      .from('substitute_requests')
      .select('*, timetable_slots(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data }) => setPendingSubReqs(data || []));
    supabase
      .from('compensatory_requests')
      .select('*')
      .in('status', ['pending', 'unresolved'])
      .order('created_at', { ascending: false })
      .then(({ data }) => setCompReqs(data || []));
  }, [isTimetableTeam, activeTab]);

  // ── Unique period names (weekday only, deduplicated) ──────────────────────
  const weekdayPeriods = useMemo(
    () => [...new Map(
      periods.filter(p => !p.is_saturday).map(p => [p.name, p])
    ).values()],
    [periods]
  );

  // ── Conflict detection ───────────────────────────────────────────────────
  const detectConflicts = useCallback((facultyName, day, periodName, excludeClass) => {
    if (!facultyName?.trim()) return [];
    const warnings = [];
    const fn = facultyName.trim().toLowerCase();

    const clashes = slots.filter(s =>
      s.day === day && s.period_name === periodName &&
      s.class_name !== excludeClass &&
      s.faculty_name && s.faculty_name.toLowerCase().includes(fn)
    );
    for (const c of clashes) {
      warnings.push(`${facultyName} is already assigned to ${c.class_name} at this time.`);
    }

    // Adjunct / restricted faculty constraints (hardcoded, covers all known faculty)
    const periodObj = weekdayPeriods.find(p => p.name === periodName);
    const periodStartMins = periodObj ? parseTimeToMinutes(periodObj.start_time) : null;
    const adjWarn = adjunctWarning(facultyName, day, periodStartMins, mergedAdjunctConstraints);
    if (adjWarn) warnings.push(adjWarn);

    for (const c of constraints) {
      const nameMatch = facultyName.toLowerCase().includes(c.faculty_name.toLowerCase());
      if (!nameMatch) continue;
      if (c.no_saturdays && isSat) {
        warnings.push(`This faculty is not available on Saturdays.`);
      }
      if (c.monday_only_before && day === 'MON') {
        const period = weekdayPeriods.find(p => p.name === periodName);
        if (period) {
          const limitMins = parseTimeToMinutes(c.monday_only_before);
          const startMins = parseTimeToMinutes(period.start_time);
          if (startMins >= limitMins) {
            warnings.push(`${c.faculty_name} is only available on Mondays before ${c.monday_only_before}.`);
          }
        }
      }
    }

    return [...new Set(warnings)];
  }, [slots, constraints, weekdayPeriods, mergedAdjunctConstraints]);

  // ── Substitute suggester (grid tab Edit modal) ───────────────────────────
  const findSubstitutes = useCallback((day, periodName, courseName, targetClass) => {
    console.log('[findSubstitutes] day:', day, '| period:', periodName);
    console.log('[findSubstitutes] candidates BEFORE filter:', FACULTY_LIST);

    // Check 3 — faculty already teaching another class at this period
    const busyFaculty = new Set(
      slots
        .filter(s => s.day === day && s.period_name === periodName && s.faculty_name)
        .flatMap(s => s.faculty_name.split(' / ').map(f => f.trim().toLowerCase()))
    );

    // Period start time for time-window check
    const periodObj = periods.find(p => p.name === periodName);
    const periodStartMins = periodObj ? parseTimeToMinutes(periodObj.start_time) : null;

    // CA Vishal Gupta debug
    const vgConstraint = constraints.find(c =>
      c.faculty_name && c.faculty_name.toLowerCase() === 'ca vishal gupta'
    );
    console.log('[findSubstitutes] CA Vishal Gupta constraint row:', vgConstraint ?? 'NO ROW FOUND');
    console.log('[findSubstitutes] CA Vishal Gupta available_days:', vgConstraint?.available_days ?? 'N/A', '| SAT included:', vgConstraint?.available_days?.includes('SAT') ?? false);

    const available = FACULTY_LIST.filter(f => {
      const fl = f.toLowerCase();

      // Check: busy at this period
      if (busyFaculty.has(fl)) return false;

      // Check: adjunct / restricted availability (hardcoded + DB overrides)
      if (adjunctWarning(f, day, periodStartMins, mergedAdjunctConstraints)) return false;

      // Check: DB constraint row (legacy / extended overrides)
      const constraint = constraints.find(c =>
        c.faculty_name && c.faculty_name.toLowerCase() === fl
      );
      if (!constraint) return true;

      if (Array.isArray(constraint.available_days) && constraint.available_days.length > 0) {
        if (!constraint.available_days.includes(day)) return false;
      }
      if (constraint.time_window_start && constraint.time_window_end && periodStartMins !== null) {
        const winStart = parseTimeToMinutes(constraint.time_window_start);
        const winEnd   = parseTimeToMinutes(constraint.time_window_end);
        if (periodStartMins < winStart || periodStartMins >= winEnd) return false;
      }

      return true;
    });

    console.log('[findSubstitutes] candidates AFTER filter:', available);

    const familiarFaculty = new Set(
      slots
        .filter(s => s.class_name === targetClass && s.course_name === courseName && s.faculty_name)
        .flatMap(s => s.faculty_name.split(' / ').map(f => f.trim()))
    );

    return available
      .sort((a, b) => (familiarFaculty.has(a) ? 0 : 1) - (familiarFaculty.has(b) ? 0 : 1))
      .map(f => ({ name: f, familiar: familiarFaculty.has(f) }));
  }, [slots, constraints, periods, mergedAdjunctConstraints]);

  // ── Substitute suggester (Today tab) ─────────────────────────────────────
  const findTodaySubstitutes = useCallback((absentName, day, periodName, courseName, targetClass, assignedSubs = {}) => {
    // Build busy set from timetable slots for this period
    const busyAtPeriod = new Set(
      slots
        .filter(s => s.day === day && s.period_name === periodName && s.faculty_name)
        .flatMap(s => s.faculty_name.split(' / ').map(f => f.trim().toLowerCase()))
    );
    busyAtPeriod.add(absentName.trim().toLowerCase());
    // Also exclude teachers already assigned as subs for other absent slots this same period
    Object.entries(assignedSubs).forEach(([key, subFaculty]) => {
      const keyPeriod = key.split('__')[1];
      if (keyPeriod === periodName && subFaculty) busyAtPeriod.add(subFaculty.trim().toLowerCase());
    });

    // Period start time (minutes) for time-window check
    const periodObj = periods.find(p => p.name === periodName);
    const periodStartMins = periodObj ? parseTimeToMinutes(periodObj.start_time) : null;

    const available = FACULTY_LIST.filter(f => {
      const fl = f.toLowerCase();

      // Check 3 — already teaching this period
      if (busyAtPeriod.has(fl)) return false;

      // Adjunct / restricted availability (hardcoded + DB overrides)
      if (adjunctWarning(f, day, periodStartMins, mergedAdjunctConstraints)) return false;

      // DB constraint row (legacy / extended overrides)
      const constraint = constraints.find(c =>
        c.faculty_name && c.faculty_name.toLowerCase() === fl
      );
      if (!constraint) return true;

      if (Array.isArray(constraint.available_days) && constraint.available_days.length > 0) {
        if (!constraint.available_days.includes(day)) return false;
      }
      if (constraint.time_window_start && constraint.time_window_end && periodStartMins !== null) {
        const winStart = parseTimeToMinutes(constraint.time_window_start);
        const winEnd   = parseTimeToMinutes(constraint.time_window_end);
        if (periodStartMins < winStart || periodStartMins >= winEnd) return false;
      }

      return true;
    });

    console.log('[SubRank] day:', day, '| period:', periodName, '| periodStart:', periodObj?.start_time);
    console.log('[SubRank] busyAtPeriod:', [...busyAtPeriod]);
    console.log('[SubRank] available after constraint filter:', available);

    // ── Rank by course match ──────────────────────────────────────────────
    const courseNameL = (courseName || '').toLowerCase();
    const courseMatch = (slotCourse) => {
      if (!slotCourse) return false;
      const sl = slotCourse.toLowerCase();
      return sl.includes(courseNameL) || courseNameL.includes(sl);
    };

    const ranked = available.map(f => {
      const fLower = f.toLowerCase();
      const candidateSlots = slots.filter(s =>
        s.faculty_name &&
        s.faculty_name.split(' / ').some(n => n.trim().toLowerCase() === fLower)
      );
      const bestMatch = candidateSlots.some(s =>
        courseMatch(s.course_name) && s.class_name === targetClass
      );
      const subjectMatch = !bestMatch && candidateSlots.some(s =>
        courseMatch(s.course_name)
      );
      return {
        name: f,
        rank: bestMatch ? 'BEST MATCH' : subjectMatch ? 'SUBJECT MATCH' : 'AVAILABLE',
        _courses: [...new Set(candidateSlots.map(s => s.course_name).filter(Boolean))],
      };
    });

    const top3 = ranked
      .sort((a, b) => ({ 'BEST MATCH': 0, 'SUBJECT MATCH': 1, 'AVAILABLE': 2 }[a.rank] - { 'BEST MATCH': 0, 'SUBJECT MATCH': 1, 'AVAILABLE': 2 }[b.rank]))
      .slice(0, 3);

    console.log('[SubRank] absent course:', courseName, '| class:', targetClass);
    top3.forEach(s => console.log(`  ${s.name} → ${s.rank} | courses:`, s._courses));

    return top3.map(({ name, rank }) => ({ name, rank }));
  }, [slots, constraints, periods, mergedAdjunctConstraints]);

  // ── Show full slot info (for truncated cells) ────────────────────────────
  const showSlotInfo = (slot) => {
    const title = slot.course_name || slot.course_code || 'Unnamed course';
    const body = slot.faculty_name ? `Faculty: ${slot.faculty_name}` : 'No faculty assigned';
    if (Platform.OS === 'web') window.alert(`${title}\n\n${body}`);
    else Alert.alert(title, body);
  };

  // ── Open edit modal ──────────────────────────────────────────────────────
  const openEdit = (day, period) => {
    const existing = getSlot(day, period.name);
    const existingOverride = permanentOverrides.find(
      po => po.class_name === selectedClass && po.day === day && po.period_name === period.name
    );
    setEditTarget({ day, period_name: period.name, existing, existingOverride });
    setEditForm({
      course_code: existing?.course_code || '',
      course_name: existing?.course_name || '',
      faculty_name: existing?.faculty_name || '',
      batch_details: existing?.batch_details || '',
      is_elective: existing?.is_elective || false,
      reason: existingOverride?.reason || '',
      change_type: 'edit',
      isPermanent: !!existingOverride,
    });
    setFacultyQuery(existing?.faculty_name || '');
    setConflicts([]);
    setSuggestions([]);
    setShowSuggestions(false);
    setShowFacultyAC(false);
  };

  const closeEdit = () => setEditTarget(null);

  // ── Handle faculty field change + live conflict check ─────────────────────
  const onFacultyChange = (text) => {
    setFacultyQuery(text);
    setEditForm(f => ({ ...f, faculty_name: text }));
    setShowFacultyAC(text.length > 0);
    if (editTarget && text.trim()) {
      setConflicts(detectConflicts(text, editTarget.day, editTarget.period_name, selectedClass));
    } else {
      setConflicts([]);
    }
  };

  // Find what a teacher teaches to a given class — checks loaded timetable slots
  // first (fast, no DB round-trip), then falls back to teacher_subjects DB lookup.
  const resolveSubjectForSub = useCallback(async (teacherName, className, excludeSlotId = null) => {
    const nameLower = teacherName.toLowerCase();
    const fromSlots = slots.find(s =>
      s.class_name === className &&
      s.id !== excludeSlotId &&
      s.faculty_name?.toLowerCase() === nameLower &&
      s.course_name
    );
    if (fromSlots) return { name: fromSlots.course_name, code: fromSlots.course_code || '' };
    // Fallback: partial name match across all classes to get course code hint
    const partialSlot = slots.find(s =>
      s.class_name === className &&
      s.id !== excludeSlotId &&
      s.faculty_name?.toLowerCase().includes(nameLower.split(' ').pop()) &&
      s.course_name
    );
    if (partialSlot) return { name: partialSlot.course_name, code: partialSlot.course_code || '' };
    // Final fallback: DB lookup
    return getSubjectForTeacher(teacherName, className);
  }, [slots]);

  const notifyTeacherByName = useCallback(async (name, type, title, body) => {
    if (!name) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('name', `%${name.trim()}%`)
      .maybeSingle();
    if (profile?.id) createNotification('teacher-' + profile.id, type, title, body);
  }, [createNotification]);

  const selectFacultySuggestion = async (name) => {
    setFacultyQuery(name);
    setEditForm(f => ({ ...f, faculty_name: name }));
    setShowFacultyAC(false);
    if (editTarget) {
      setConflicts(detectConflicts(name, editTarget.day, editTarget.period_name, selectedClass));
      const subject = await resolveSubjectForSub(name, selectedClass, editTarget.existing?.id);
      if (subject) {
        setEditForm(f => ({ ...f, faculty_name: name, course_name: subject.name, course_code: subject.code }));
      }
    }
  };

  const facultyACResults = useMemo(() => {
    if (!facultyQuery || !showFacultyAC) return [];
    const q = facultyQuery.toLowerCase();
    return FACULTY_LIST.filter(f => f.toLowerCase().includes(q)).slice(0, 6);
  }, [facultyQuery, showFacultyAC]);

  // ── Save slot ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editTarget) return;
    if (editTarget.day === 'TUE' && editTarget.period_name === 'P2' && HED_CLASSES.has(selectedClass)) {
      Alert.alert('HED Slot Protected', 'This slot is reserved for HED and cannot be edited directly. Contact the timetable team lead for an override.');
      return;
    }
    if (editForm.change_type === 'substitute' && !editForm.reason.trim()) {
      Alert.alert('Reason required', 'Please enter a reason for the substitution.');
      return;
    }
    setSaving(true);
    try {
      const { day, period_name, existing } = editTarget;

      // For substitutions, resolve the substitute's subject (timetable-first, then DB)
      let resolvedCourseName = editForm.course_name.trim() || null;
      let resolvedCourseCode = editForm.course_code.trim() || null;
      if (editForm.change_type === 'substitute' && editForm.faculty_name.trim()) {
        const subSubject = await resolveSubjectForSub(editForm.faculty_name.trim(), selectedClass, existing?.id);
        if (subSubject) {
          resolvedCourseName = subSubject.name;
          resolvedCourseCode = subSubject.code;
        }
      }

      const payload = {
        class_name: selectedClass,
        day,
        period_name,
        course_code: resolvedCourseCode,
        course_name: resolvedCourseName,
        faculty_name: editForm.faculty_name.trim() || null,
        batch_details: editForm.batch_details.trim() || null,
        is_elective: editForm.is_elective,
        updated_at: new Date().toISOString(),
      };

      let savedSlotId = existing?.id;

      if (existing?.id) {
        await supabase.from('timetable_slots').update(payload).eq('id', existing.id);
      } else {
        const { data } = await supabase.from('timetable_slots').insert({ ...payload, created_at: new Date().toISOString() }).select('id').single();
        savedSlotId = data?.id;
      }

      setSlots(prev => {
        const filtered = prev.filter(s => !(s.class_name === selectedClass && s.day === day && s.period_name === period_name));
        return [...filtered, { ...payload, id: savedSlotId || existing?.id }];
      });

      const editorId = userProfile?.id || teacherProfile?.id;
      if (editorId) {
        supabase.from('timetable_change_log').insert({
          changed_by: typeof editorId === 'string' ? editorId : null,
          class_name: selectedClass,
          day,
          period_name,
          old_faculty: existing?.faculty_name || null,
          new_faculty: editForm.faculty_name.trim() || null,
          reason: editForm.reason.trim() || null,
          change_type: editForm.change_type,
        });
      }

      const oldFaculty = existing?.faculty_name || null;
      const newFaculty = editForm.faculty_name.trim() || null;
      const slotDesc = `${selectedClass} — ${day} ${period_name}`;
      if (oldFaculty && oldFaculty !== newFaculty) {
        notifyTeacherByName(oldFaculty, 'info',
          `Timetable Change — ${slotDesc}`,
          `Your slot has been reassigned.${newFaculty ? ` ${newFaculty} will now cover it.` : ''} Reason: ${editForm.reason.trim() || editForm.change_type}.`,
        );
      }
      if (newFaculty && newFaculty !== oldFaculty) {
        notifyTeacherByName(newFaculty, 'info',
          `You've Been Assigned — ${slotDesc}`,
          `You are now scheduled for ${resolvedCourseName || editForm.course_name || 'a class'} in ${selectedClass} (${day} ${period_name}).${editForm.reason.trim() ? ` Note: ${editForm.reason.trim()}` : ''}`,
        );
      }

      // Permanent override: upsert or remove
      if (editForm.isPermanent) {
        const editorName = userProfile?.name || teacherProfile?.name || null;
        await supabase.from('timetable_permanent_overrides').upsert({
          class_name: selectedClass, day, period_name,
          course_code: payload.course_code,
          course_name: payload.course_name,
          faculty_name: payload.faculty_name,
          batch_details: payload.batch_details,
          is_elective: payload.is_elective,
          reason: editForm.reason.trim() || null,
          changed_by_name: editorName,
        }, { onConflict: 'class_name,day,period_name' });
        setPermanentOverrides(prev => {
          const rest = prev.filter(po => !(po.class_name === selectedClass && po.day === day && po.period_name === period_name));
          return [...rest, { class_name: selectedClass, day, period_name, ...payload, reason: editForm.reason.trim() || null }];
        });
      } else if (editTarget?.existingOverride) {
        await supabase.from('timetable_permanent_overrides')
          .delete().eq('class_name', selectedClass).eq('day', day).eq('period_name', period_name);
        setPermanentOverrides(prev => prev.filter(po => !(po.class_name === selectedClass && po.day === day && po.period_name === period_name)));
      }


      closeEdit();
    } catch (e) {
      Alert.alert('Save failed', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Submit for HOD approval ───────────────────────────────────────────────
  const handleSubmitApproval = async (slotId, day, period_name, courseName, facultyName) => {
    setSubmitting(true);
    try {
      setSlots(prev => prev.map(s =>
        s.id === slotId ? { ...s, approval_status: 'pending' } : s
      ));

      const editorId = userProfile?.id || teacherProfile?.id;
      const { data: hodProfile } = await supabase
        .from('profiles').select('id').ilike('name', '%Hridhya%').maybeSingle();
      if (hodProfile?.id) {
        await createNotification(
          hodProfile.id,
          'info',
          `Timetable Change Pending Approval`,
          `${selectedClass} – ${day} ${period_name}: ${courseName || 'Slot'} (${facultyName || 'TBD'}) requires your approval.`,
          {
            approve_action: true,
            slot_id: slotId,
            class_name: selectedClass,
            day,
            period_name,
            course_name: courseName,
            faculty_name: facultyName,
            submitted_by: typeof editorId === 'string' ? editorId : null,
          }
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Could not submit for approval. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Export (clipboard) ────────────────────────────────────────────────────
  const handleExport = (day) => {
    const room = classroom?.room_number || '—';
    const daySlots = classSlots.filter(s => s.day === day);
    const period = weekdayPeriods;
    const lines = period
      .map(p => {
        const s = daySlots.find(sl => sl.period_name === p.name);
        if (!s) return null;
        return `${p.name} (${p.start_time}–${p.end_time}): ${s.course_name || '—'} — ${s.faculty_name || 'TBD'}`;
      })
      .filter(Boolean);

    if (!lines.length) {
      Alert.alert('No data', `No scheduled slots for ${selectedClass} on ${day}.`);
      return;
    }

    const text = `📅 *${selectedClass} – ${day}*\n🏫 Room: ${room}\n\n` + lines.join('\n');
    try { Clipboard.setString(text); } catch (e) {}
    Alert.alert('Copied!', 'Timetable copied to clipboard. Ready to paste in WhatsApp.');
  };

  // ── Today tab handlers ────────────────────────────────────────────────────
  const handleToggleAbsent = (name) => {
    setAbsentFaculty(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setShowRevisedView(false);
    setSelectedSubs({});
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const editorId = userProfile?.id || teacherProfile?.id;
      const now = new Date().toISOString();

      // 1. Resolve subject for every substitute — block if any don't match
      const subjectMap = {}; // key → { name, code }
      const noMatch = [];
      await Promise.all(
        Object.entries(selectedSubs).map(async ([key, subFaculty]) => {
          const [cls, periodName] = key.split('__');
          const slot = todaySlots.find(s => s.class_name === cls && s.period_name === periodName);
          const subject = await resolveSubjectForSub(subFaculty, cls, slot?.id);
          if (subject) {
            subjectMap[key] = subject;
          } else {
            noMatch.push(`${subFaculty} → ${cls} ${periodName}`);
          }
        })
      );
      if (noMatch.length > 0) {
        Alert.alert(
          'Subject Mismatch',
          `No subject found for:\n${noMatch.join('\n')}\n\nOnly assign teachers who teach these classes.`,
        );
        return;
      }

      // 2. Update timetable_slots with substitute faculty and their subject
      await Promise.all(
        Object.entries(selectedSubs).map(async ([key, subFaculty]) => {
          const [cls, periodName] = key.split('__');
          const slot = todaySlots.find(s => s.class_name === cls && s.period_name === periodName);
          if (!slot?.id) return;
          const subject = subjectMap[key];
          await supabase.from('timetable_slots').update({
            faculty_name: subFaculty,
            course_name: subject.name,
            course_code: subject.code,
            updated_at: now,
          }).eq('id', slot.id);
        })
      );

      // Mirror into local state so the grid reflects the substitution immediately
      setSlots(prev => prev.map(s => {
        if (s.day !== selectedDay) return s;
        const key = `${s.class_name}__${s.period_name}`;
        const subFaculty = selectedSubs[key];
        if (!subFaculty) return s;
        const subject = subjectMap[key];
        return { ...s, faculty_name: subFaculty, course_name: subject.name, course_code: subject.code };
      }));

      // 3. Write change_log — collect row IDs for compensatory linking
      const subEntries = Object.entries(selectedSubs);
      const logEntries = subEntries.map(([key, subFaculty]) => {
        const [cls, periodName] = key.split('__');
        const slot = todaySlots.find(s => s.class_name === cls && s.period_name === periodName);
        return {
          changed_by: typeof editorId === 'string' ? editorId : null,
          class_name: cls,
          day: selectedDay,
          period_name: periodName,
          old_faculty: slot?.faculty_name || null,
          new_faculty: subFaculty,
          reason: 'Absent — substitute assigned',
          change_type: 'substitute',
        };
      });
      let logRows = [];
      if (logEntries.length > 0) {
        const { data } = await supabase.from('timetable_change_log').insert(logEntries).select('id');
        logRows = data || [];
      }

      // 4. Auto-schedule compensatory classes for each absent teacher
      logRows.forEach((logRow, i) => {
        const [key] = subEntries[i];
        const [cls, periodName] = key.split('__');
        const slot = todaySlots.find(s => s.class_name === cls && s.period_name === periodName);
        if (slot?.faculty_name) {
          createCompensatoryRequest(supabase, {
            changeLogId: logRow.id,
            teacherName: slot.faculty_name,
            className: cls,
            day: selectedDay,
            periodName,
          }).catch(e => console.warn('[CompReq] publish error:', e.message));
        }
      });

      // 5. Notify HoD
      const { data: hodProfile } = await supabase
        .from('profiles').select('id').ilike('name', '%Hridhya%').maybeSingle();
      if (hodProfile?.id) {
        await createNotification(
          hodProfile.id,
          'info',
          `Substitute Schedule Published — ${selectedDay}`,
          `${Object.keys(selectedSubs).length} substitution(s) applied for today. Review the revised timetable.`,
        );
      }

      // 6. Notify absent teachers and their substitutes
      for (const [key, subFaculty] of subEntries) {
        const [cls, periodName] = key.split('__');
        const slot = todaySlots.find(s => s.class_name === cls && s.period_name === periodName);
        if (slot?.faculty_name) {
          notifyTeacherByName(slot.faculty_name, 'info',
            `Your Class Covered — ${cls} ${periodName}`,
            `${subFaculty} is covering your ${selectedDay} ${periodName} class in ${cls}.`,
          );
        }
        if (subFaculty) {
          notifyTeacherByName(subFaculty, 'info',
            `You're Covering a Class — ${cls} ${periodName}`,
            `You've been assigned to cover ${subjectMap[key]?.name || slot?.course_name || 'a class'} in ${cls} on ${selectedDay} ${periodName}.`,
          );
        }
      }

      // 7. Build WhatsApp export text
      const classData = derivedClasses
        .map(cls => {
          const clsSlots = todaySlots.filter(s => s.class_name === cls);
          if (!clsSlots.length) return null;
          const lines = weekdayPeriods
            .map(p => {
              const slot = clsSlots.find(s => s.period_name === p.name);
              if (!slot) return null;
              const subKey = `${cls}__${p.name}`;
              const sub = selectedSubs[subKey];
              const faculty = sub || slot.faculty_name || 'TBD';
              const courseName = (sub && subjectMap[subKey]?.name) || slot.course_name || slot.course_code || '—';
              const subLabel = sub ? ' 🔄 SUB' : '';
              return `${p.name} (${p.start_time}–${p.end_time}): ${courseName} — ${faculty}${subLabel}`;
            })
            .filter(Boolean);
          if (!lines.length) return null;
          return { name: cls, text: `📅 *${cls} – ${selectedDay}*\n\n${lines.join('\n')}` };
        })
        .filter(Boolean);

      setWhatsappModal({ classes: classData });
    } catch (e) {
      Alert.alert('Error', 'Could not publish changes. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  // ── Substitute request handlers ───────────────────────────────────────────

  const openSubReq = useCallback((slot, day, periodName) => {
    setSubReqTarget({ slot, day, periodName });
    setSubReqReason('');
    setSubReqPrefSub('');
    setSubReqSuggestions([]);
  }, []);

  const handleSubReqSubmit = useCallback(async () => {
    if (!subReqReason.trim()) {
      Alert.alert('Reason Required', 'Please enter a reason for your substitute request.');
      return;
    }
    setSubReqSaving(true);
    try {
      const teacherId = teacherProfile?.id || userProfile?.id;
      const effectiveName = testAsName || currentName;
      await supabase.from('substitute_requests').insert({
        slot_id: subReqTarget.slot?.id || null,
        class_name: subReqTarget.slot?.class_name || null,
        day: subReqTarget.day || null,
        period_name: subReqTarget.periodName || null,
        requesting_teacher_id: teacherId != null ? String(teacherId) : null,
        requesting_teacher_name: effectiveName,
        reason: subReqReason.trim(),
        preferred_substitute: subReqPrefSub || null,
        status: 'pending',
      });

      const { data: notifProfiles } = await supabase
        .from('profiles')
        .select('id, name')
        .or(['Shruti', 'Bhoomika', 'Tirupathi', 'Hridhya'].map(n => `name.ilike.%${n}%`).join(','));

      const slotDesc = `${subReqTarget.slot?.course_name || 'a class'} (${subReqTarget.day} ${subReqTarget.periodName})`;
      const msg = `${effectiveName} has requested a substitute for ${slotDesc}. Reason: ${subReqReason.trim()}${subReqPrefSub ? `. Preferred: ${subReqPrefSub}` : ''}.`;
      await Promise.all((notifProfiles || []).map(p =>
        createNotification('teacher-' + p.id, 'info', 'Substitute Request', msg)
      ));

      setSubReqTarget(null);
      Alert.alert('Request Sent', 'Your request has been sent to the timetable team.');
    } catch (e) {
      console.error('[SubReq] submit error:', e);
      Alert.alert('Error', 'Could not submit request. Please try again.');
    } finally {
      setSubReqSaving(false);
    }
  }, [subReqTarget, subReqReason, subReqPrefSub, currentName, teacherProfile, userProfile, createNotification]);

  const handleAbsentToday = useCallback(async () => {
    const effectiveName = testAsName || currentName;
    if (!effectiveName) return;
    const mySlots = todaySlots.filter(s =>
      s.faculty_name && s.faculty_name.split(' / ').some(f => f.trim().toLowerCase() === effectiveName.trim().toLowerCase())
    );
    if (!mySlots.length) {
      Alert.alert('No classes today', 'You have no scheduled classes today.');
      return;
    }
    setAbsentTodaySubmitting(true);
    try {
      const teacherId = teacherProfile?.id || userProfile?.id;
      const now = new Date().toISOString();
      await Promise.all(mySlots.map(slot =>
        supabase.from('timetable_slots').update({
          course_name: 'Class Cancelled',
          faculty_name: null,
          updated_at: now,
        }).eq('id', slot.id)
      ));
      await supabase.from('timetable_change_log').insert(mySlots.map(slot => ({
        changed_by: teacherId != null ? String(teacherId) : null,
        class_name: slot.class_name,
        day: slot.day,
        period_name: slot.period_name,
        old_faculty: slot.faculty_name || null,
        new_faculty: null,
        reason: absentTodayReason.trim() || 'Class cancelled — teacher absent',
        change_type: 'cancel',
      })));
      const classNames = [...new Set(mySlots.map(s => s.class_name))];
      for (const cls of classNames) {
        const clsSlots = mySlots.filter(s => s.class_name === cls);
        const { data: students } = await supabase.from('profiles').select('id').eq('class_name', cls);
        const periods = clsSlots.map(s => s.period_name).join(', ');
        for (const st of (students || [])) {
          createNotification(st.id, 'info',
            `Class Cancelled — ${cls}`,
            `${effectiveName}'s ${periods} ${clsSlots.length !== 1 ? 'classes are' : 'class is'} cancelled on ${selectedDay}.`,
          );
        }
      }
      setSlots(prev => prev.map(s =>
        mySlots.find(ms => ms.id === s.id) ? { ...s, course_name: 'Class Cancelled', faculty_name: null } : s
      ));
      setAbsentTodayModal(false);
      setAbsentTodayReason('');
      Alert.alert('Classes Cancelled', `${mySlots.length} class${mySlots.length !== 1 ? 'es' : ''} cancelled. Students have been notified.`);
    } catch (e) {
      Alert.alert('Error', 'Could not cancel classes. Please try again.');
    } finally {
      setAbsentTodaySubmitting(false);
    }
  }, [currentName, todaySlots, absentTodayReason, selectedDay, teacherProfile, userProfile, isAppAdmin, testAsName, createNotification]);

  const handleResetTimetable = useCallback(async () => {
    setResetLoading(true);
    try {
      const { error } = await supabase.rpc('reset_timetable_slots');
      if (error) { Alert.alert('Reset Failed', error.message); return; }
      await supabase.from('compensatory_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // Re-apply permanent overrides on top of the reset baseline
      const { data: overrides } = await supabase.from('timetable_permanent_overrides').select('*');
      if (overrides?.length) {
        for (const po of overrides) {
          await supabase.from('timetable_slots').update({
            course_code: po.course_code,
            course_name: po.course_name,
            faculty_name: po.faculty_name,
            batch_details: po.batch_details,
            is_elective: po.is_elective,
            updated_at: new Date().toISOString(),
          }).eq('class_name', po.class_name).eq('day', po.day).eq('period_name', po.period_name);
        }
        setPermanentOverrides(overrides);
      }
      const { data: freshSlots } = await supabase.from('timetable_slots').select('*');
      if (freshSlots) setSlots(freshSlots);
      setCompReqs([]);
      setResetModalVisible(false);
      setResetConfirmText('');
      const permCount = overrides?.length || 0;
      Alert.alert('Timetable Reset', permCount > 0
        ? `All slots restored. ${permCount} permanent change${permCount !== 1 ? 's' : ''} preserved.`
        : 'All slots have been restored to their original values.');
    } catch (e) {
      Alert.alert('Reset Failed', e.message);
    } finally {
      setResetLoading(false);
    }
  }, []);

  const handleApproveSubReq = useCallback(async (req, assignedSub) => {
    let slot = req.timetable_slots;
    // FK join may return null if slot_id was not stored; fall back to direct lookup
    if (!slot && (req.class_name || req.day)) {
      const { data: found } = await supabase
        .from('timetable_slots')
        .select('*')
        .eq('class_name', req.class_name)
        .eq('day', req.day)
        .eq('period_name', req.period_name)
        .maybeSingle();
      slot = found || null;
    }
    const reqDay = req.day || slot?.day;
    const reqPeriod = req.period_name || slot?.period_name;
    const reqClass = req.class_name || slot?.class_name;
    if (reqDay === 'TUE' && reqPeriod === 'P2' && HED_CLASSES.has(reqClass)) {
      Alert.alert('Cannot Substitute', 'This slot is reserved for HED and cannot be substituted.');
      return;
    }
    const newFaculty = (assignedSub && assignedSub.trim()) ? assignedSub.trim() : null;
    if (slot?.id) {
      const subSubject = newFaculty ? await getSubjectForTeacher(newFaculty, slot.class_name) : null;
      if (newFaculty && !subSubject) {
        Alert.alert(
          'Subject Mismatch',
          `${newFaculty} does not teach any subject for ${slot.class_name} — cannot assign as substitute.`,
        );
        return;
      }
      const slotPatch = { faculty_name: newFaculty, updated_at: new Date().toISOString() };
      if (subSubject) { slotPatch.course_name = subSubject.name; slotPatch.course_code = subSubject.code; }
      const { error: slotErr } = await supabase.from('timetable_slots')
        .update(slotPatch)
        .eq('id', slot.id);
      if (slotErr) { Alert.alert('Slot Update Failed', slotErr.message); return; }
      setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, ...slotPatch } : s));
      let subChangeLogId = null;
      const { data: logRow, error: logErr } = await supabase.from('timetable_change_log').insert({
        changed_by: userProfile?.id || null,
        class_name: slot.class_name,
        day: slot.day,
        period_name: slot.period_name,
        old_faculty: slot.faculty_name,
        new_faculty: newFaculty,
        reason: req.reason,
        change_type: 'substitute',
      }).select('id').single();
      if (logErr) console.warn('[ApproveSubReq] change_log insert failed:', logErr.message);
      subChangeLogId = logRow?.id || null;
      if (slot.faculty_name) {
        createCompensatoryRequest(supabase, {
          changeLogId: subChangeLogId,
          teacherName: slot.faculty_name,
          className: slot.class_name,
          day: slot.day,
          periodName: slot.period_name,
        }).catch(e => console.warn('[CompReq] sub approval error:', e.message));
      }
    } else {
      Alert.alert('Cannot Update Timetable', 'This request has no slot linked — timetable was not changed, but the request will be marked approved.');
    }
    await supabase.from('substitute_requests').update({ status: 'approved' }).eq('id', req.id);
    if (req.requesting_teacher_id) {
      const approvedMsg = `Your substitute request for ${slot?.course_name || 'your class'} has been approved.${newFaculty ? ` ${newFaculty} will cover the session.` : ''}`;
      await createNotification('teacher-' + req.requesting_teacher_id, 'info', 'Request Approved', approvedMsg);
    }
    if (newFaculty) {
      notifyTeacherByName(newFaculty, 'info',
        `You're Covering a Class — ${slot?.class_name || ''} ${slot?.period_name || ''}`,
        `You've been assigned to cover ${slot?.course_name || 'a class'} in ${slot?.class_name || 'a class'} (${req.day || slot?.day} ${slot?.period_name}).`,
      );
    }
    setPendingSubReqs(prev => prev.filter(r => r.id !== req.id));
  }, [userProfile, teacherProfile, createNotification]);

  const handleRejectSubReq = useCallback(async (req) => {
    await supabase.from('substitute_requests').update({ status: 'rejected' }).eq('id', req.id);
    if (req.requesting_teacher_id) {
      const slot = req.timetable_slots;
      await createNotification('teacher-' + req.requesting_teacher_id, 'info', 'Request Not Approved', `Your substitute request for ${slot?.course_name || 'your class'} could not be approved at this time.`);
    }
    setPendingSubReqs(prev => prev.filter(r => r.id !== req.id));
  }, [createNotification]);

  // Approve all requests in a group (one per slot, each with an assigned sub name)
  const handleApproveGroup = useCallback(async (reqs) => {
    for (const req of reqs) {
      const assigned = subAssignments[req.id]?.trim();
      await handleApproveSubReq(req, assigned || null);
    }
    setSubAssignments(prev => {
      const next = { ...prev };
      reqs.forEach(r => delete next[r.id]);
      return next;
    });
  }, [subAssignments, handleApproveSubReq]);

  // Reject all requests in a group at once
  const handleRejectGroup = useCallback(async (reqs) => {
    const doReject = async () => {
      for (const req of reqs) {
        await handleRejectSubReq(req);
      }
      setSubAssignments(prev => {
        const next = { ...prev };
        reqs.forEach(r => delete next[r.id]);
        return next;
      });
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Reject all ${reqs.length} requests from ${reqs[0]?.requesting_teacher_name}?`)) doReject();
    } else {
      Alert.alert('Reject All', `Reject all ${reqs.length} substitute requests from ${reqs[0]?.requesting_teacher_name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject All', style: 'destructive', onPress: doReject },
      ]);
    }
  }, [handleRejectSubReq]);

  // ── Compensatory request handlers ─────────────────────────────────────────

  const handleAssignComp = useCallback(async (req, slot) => {
    await supabase.from('timetable_slots').update({
      faculty_name: req.teacher_name,
      updated_at: new Date().toISOString(),
    }).eq('id', slot.id);
    setSlots(prev => prev.map(s =>
      s.id === slot.id ? { ...s, faculty_name: req.teacher_name } : s
    ));
    const editorId = userProfile?.id || teacherProfile?.id;
    await supabase.from('timetable_change_log').insert({
      changed_by: typeof editorId === 'string' ? editorId : null,
      class_name: req.original_class_name,
      day: slot.day,
      period_name: slot.period_name,
      old_faculty: null,
      new_faculty: req.teacher_name,
      reason: `Compensatory class for lost slot on ${req.original_day} ${req.original_period_name}`,
      change_type: 'compensatory',
    });
    await supabase.from('compensatory_requests').update({
      status: 'approved',
      proposed_slot_id: slot.id,
      proposed_day: slot.day,
      proposed_period_name: slot.period_name,
      reviewed_by: userProfile?.id || null,
    }).eq('id', req.id);
    notifyTeacherByName(req.teacher_name, 'info',
      `Compensatory Class Scheduled — ${slot.day} ${slot.period_name}`,
      `Your compensatory class for ${req.original_class_name} has been scheduled on ${slot.day} ${slot.period_name}.`,
    );
    setCompReqs(prev => prev.filter(r => r.id !== req.id));
  }, [userProfile, teacherProfile, notifyTeacherByName]);

  const handleRejectComp = useCallback(async (req) => {
    await supabase.from('compensatory_requests').update({
      status: 'rejected',
      reviewed_by: userProfile?.id || null,
    }).eq('id', req.id);
    setCompReqs(prev => prev.filter(r => r.id !== req.id));
  }, [userProfile]);

  const handleResolveManually = useCallback(async () => {
    if (!resolveManualModal) return;
    const req = resolveManualModal;
    setResolveError('');
    setResolveLoading(true);
    try {
      // Check the target slot
      const { data: targetSlot } = await supabase
        .from('timetable_slots')
        .select('id, course_name, faculty_name')
        .eq('class_name', req.original_class_name)
        .eq('day', resolveDay)
        .eq('period_name', resolvePeriod)
        .maybeSingle();

      if (!targetSlot) {
        setResolveError(`No timetable slot exists for ${req.original_class_name} on ${resolveDay} ${resolvePeriod}.`);
        return;
      }
      if (targetSlot.course_name) {
        setResolveError(
          `This slot is already occupied by ${targetSlot.course_name}` +
          (targetSlot.faculty_name ? ` / ${targetSlot.faculty_name}` : '') +
          `. Choose a different day/period.`
        );
        return;
      }

      // Check teacher conflict across all classes
      const { data: teacherConflict } = await supabase
        .from('timetable_slots')
        .select('class_name')
        .eq('faculty_name', req.teacher_name)
        .eq('day', resolveDay)
        .eq('period_name', resolvePeriod)
        .limit(1);

      if (teacherConflict && teacherConflict.length > 0) {
        setResolveError(
          `${req.teacher_name} is already teaching ${teacherConflict[0].class_name} at this time. Choose a different day/period.`
        );
        return;
      }

      // Check adjunct / restricted availability
      const periodObj = periods.find(p => p.name === resolvePeriod);
      const periodStartMins = periodObj ? parseTimeToMinutes(periodObj.start_time) : null;
      const adjWarn = adjunctWarning(req.teacher_name, resolveDay, periodStartMins, mergedAdjunctConstraints);
      if (adjWarn) {
        setResolveError(adjWarn + ' Choose a different day/period.');
        return;
      }

      const courseVal = resolveCourse.trim() || null;

      // Update the slot
      await supabase.from('timetable_slots').update({
        faculty_name: req.teacher_name,
        course_name: courseVal,
        updated_at: new Date().toISOString(),
      }).eq('id', targetSlot.id);

      setSlots(prev => prev.map(s =>
        s.id === targetSlot.id
          ? { ...s, faculty_name: req.teacher_name, course_name: courseVal ?? s.course_name }
          : s
      ));

      // Log the change
      await supabase.from('timetable_change_log').insert({
        changed_by: userProfile?.id || null,
        class_name: req.original_class_name,
        day: resolveDay,
        period_name: resolvePeriod,
        old_faculty: targetSlot.faculty_name || null,
        new_faculty: req.teacher_name,
        reason: `Compensatory class (manual) for lost slot on ${req.original_day} ${req.original_period_name}`,
        change_type: 'compensatory',
      });

      // Mark compensatory request approved
      await supabase.from('compensatory_requests').update({
        status: 'approved',
        proposed_slot_id: targetSlot.id,
        proposed_day: resolveDay,
        proposed_period_name: resolvePeriod,
        proposed_course_name: courseVal,
        reviewed_by: userProfile?.id || null,
      }).eq('id', req.id);

      setCompReqs(prev => prev.filter(r => r.id !== req.id));
      setResolveManualModal(null);
    } catch (e) {
      setResolveError(e.message || 'Could not resolve. Please try again.');
    } finally {
      setResolveLoading(false);
    }
  }, [resolveManualModal, resolveDay, resolvePeriod, resolveCourse, userProfile, periods, mergedAdjunctConstraints]);

  // ── Swap handlers ────────────────────────────────────────────────────────
  const cancelSwap = useCallback(() => {
    setSwapMode(false);
    setSwapSlotA(null);
    setSwapSlotB(null);
    setSwapModalVisible(false);
  }, []);

  const handleSwapCellPress = useCallback((cellInfo) => {
    // cellInfo = { slot, class_name, day, period_name }
    if (!swapSlotA) {
      setSwapSlotA(cellInfo);
      return;
    }
    // Tapping the same cell → deselect
    const sameId = swapSlotA.slot?.id && cellInfo.slot?.id && swapSlotA.slot.id === cellInfo.slot.id;
    const sameCoords = !swapSlotA.slot?.id && !cellInfo.slot?.id &&
      swapSlotA.class_name === cellInfo.class_name &&
      swapSlotA.day === cellInfo.day &&
      swapSlotA.period_name === cellInfo.period_name;
    if (sameId || sameCoords) {
      setSwapSlotA(null);
      return;
    }
    setSwapSlotB(cellInfo);
    setSwapModalVisible(true);
  }, [swapSlotA]);

  const handleConfirmSwap = useCallback(async () => {
    if (!swapSlotA || !swapSlotB) return;
    if (
      (swapSlotA.day === 'TUE' && swapSlotA.period_name === 'P2' && HED_CLASSES.has(swapSlotA.class_name)) ||
      (swapSlotB.day === 'TUE' && swapSlotB.period_name === 'P2' && HED_CLASSES.has(swapSlotB.class_name))
    ) {
      Alert.alert('Cannot Swap', 'TUE P2 is reserved for HED and cannot be swapped.');
      return;
    }
    setSwapLoading(true);
    try {
      // Resolve slot IDs — look up by class/day/period if slot row wasn't in local state
      let idA = swapSlotA.slot?.id;
      let idB = swapSlotB.slot?.id;
      if (!idA) {
        const { data } = await supabase.from('timetable_slots').select('id')
          .eq('class_name', swapSlotA.class_name).eq('day', swapSlotA.day).eq('period_name', swapSlotA.period_name)
          .maybeSingle();
        idA = data?.id;
      }
      if (!idB) {
        const { data } = await supabase.from('timetable_slots').select('id')
          .eq('class_name', swapSlotB.class_name).eq('day', swapSlotB.day).eq('period_name', swapSlotB.period_name)
          .maybeSingle();
        idB = data?.id;
      }
      if (!idA || !idB) {
        Alert.alert('Cannot Swap', 'One or both slots do not exist in the timetable.');
        return;
      }

      const pick = (s) => ({
        course_code: s?.course_code ?? null,
        course_name: s?.course_name ?? null,
        faculty_name: s?.faculty_name ?? null,
        batch_details: s?.batch_details ?? null,
        is_elective: s?.is_elective ?? false,
      });
      const aContent = pick(swapSlotA.slot);
      const bContent = pick(swapSlotB.slot);
      const now = new Date().toISOString();

      await Promise.all([
        supabase.from('timetable_slots').update({ ...bContent, updated_at: now }).eq('id', idA),
        supabase.from('timetable_slots').update({ ...aContent, updated_at: now }).eq('id', idB),
      ]);

      await supabase.from('timetable_change_log').insert([
        {
          changed_by: userProfile?.id || null,
          class_name: swapSlotA.class_name, day: swapSlotA.day, period_name: swapSlotA.period_name,
          old_faculty: aContent.faculty_name, new_faculty: bContent.faculty_name,
          reason: `Swapped with ${swapSlotB.class_name} ${swapSlotB.day} ${swapSlotB.period_name}`,
          change_type: 'swap',
        },
        {
          changed_by: userProfile?.id || null,
          class_name: swapSlotB.class_name, day: swapSlotB.day, period_name: swapSlotB.period_name,
          old_faculty: bContent.faculty_name, new_faculty: aContent.faculty_name,
          reason: `Swapped with ${swapSlotA.class_name} ${swapSlotA.day} ${swapSlotA.period_name}`,
          change_type: 'swap',
        },
      ]);

      setSlots(prev => prev.map(s => {
        if (s.id === idA) return { ...s, ...bContent };
        if (s.id === idB) return { ...s, ...aContent };
        return s;
      }));

      cancelSwap();
    } catch (e) {
      Alert.alert('Swap Failed', e.message);
    } finally {
      setSwapLoading(false);
    }
  }, [swapSlotA, swapSlotB, userProfile, cancelSwap]);

  // ── Faculty availability CRUD ─────────────────────────────────────────────
  const openNewAvail = () => {
    setAvailName(''); setAvailDays([]); setAvailWindowEnd(''); setAvailSatWindow('');
    setEditingAvail({});
  };
  const openEditAvail = (entry) => {
    setAvailName(entry.name);
    setAvailDays(entry.days || []);
    setAvailWindowEnd(entry.windowEnd || '');
    setAvailSatWindow(entry.satWindowEnd || '');
    setEditingAvail(entry);
  };
  const saveAvail = async () => {
    if (!availName.trim()) return;
    setAvailSaving(true);
    const payload = {
      faculty_name: availName.trim(),
      available_days: availDays.length ? availDays : null,
      window_end: availWindowEnd.trim() || null,
      sat_window_end: availSatWindow.trim() || null,
      updated_at: new Date().toISOString(),
    };
    try {
      if (editingAvail?.id) {
        await supabase.from('faculty_availability').update(payload).eq('id', editingAvail.id);
        setFacultyAvailability(prev => prev.map(r => r.id === editingAvail.id ? { ...r, ...payload } : r));
      } else {
        const { data } = await supabase.from('faculty_availability').insert(payload).select().single();
        if (data) setFacultyAvailability(prev => [...prev, data]);
      }
      setEditingAvail(null);
    } catch (e) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setAvailSaving(false);
    }
  };
  const deleteAvail = async (id) => {
    setAvailDeleting(id);
    await supabase.from('faculty_availability').delete().eq('id', id);
    setFacultyAvailability(prev => prev.filter(r => r.id !== id));
    setAvailDeleting(null);
  };

  // ── Timetable Assistant functions ─────────────────────────────────────────

  function resetAssistant() {
    setChatMessages([]);
    setChatInput('');
    setPendingSession(null);
    setChatMode('select');
  }

  function startScratchMode() {
    setChatMessages([{ role: 'assistant', content: "Let's build your timetable from scratch. First, what classes do you have? For example: 1BcomIBA, 3BcomIAF, 5BcomF&A(A)..." }]);
    setChatMode('scratch');
  }

  async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function handleChatSend(userText, fileBase64, fileName) {
    if (!userText?.trim() && !fileBase64) return;
    setChatLoading(true);
    const userMsg = { role: 'user', content: userText || `Uploaded file: ${fileName}` };
    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    setChatInput('');
    try {
      const { data, error } = await supabase.functions.invoke('parse-timetable', {
        body: { mode: chatMode, messages: nextMessages, file_base64: fileBase64 || null, file_name: fileName || null },
      });
      if (error) throw error;
      if (data.state === 'ready' && data.session_id) {
        const session = { session_id: data.session_id, slot_count: data.slot_count || 0, class_names: data.class_names || [] };
        setPendingSession(session);
        setChatMessages(prev => [...prev, { role: 'assistant', type: 'preview', session, content: data.message }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.message || 'No response.' }]);
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatScrollRef.current?.scrollToEnd?.({ animated: true }), 120);
    }
  }

  async function handleFileUpload() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Analyzing your timetable file. Please wait...' }]);
      setChatLoading(true);
      const response = await fetch(file.uri);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      await handleChatSend(`Uploaded: ${file.name}`, base64, file.name);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
      setChatLoading(false);
    }
  }

  async function handleApplySlots() {
    if (!pendingSession?.session_id) return;
    setApplyingSlots(true);
    try {
      // Fetch full slots from server — they were stored there to keep the response small.
      const { data: sessionData, error: fetchErr } = await supabase
        .from('timetable_assistant_sessions')
        .select('slots')
        .eq('session_id', pendingSession.session_id)
        .single();
      if (fetchErr) throw fetchErr;
      const rows = (sessionData.slots || []).map(s => ({
        class_name: s.class_name, day: s.day, period_name: s.period_name,
        course_name: s.course_name || null, faculty_name: s.faculty_name || null,
        approval_status: 'approved',
      }));
      const { error: upsertErr } = await supabase.from('timetable_slots').upsert(rows, { onConflict: 'class_name,day,period_name' });
      if (upsertErr) throw upsertErr;
      // Delete the session now that it's been applied.
      await supabase.from('timetable_assistant_sessions').delete().eq('session_id', pendingSession.session_id);
      const { data: newSlots } = await supabase.from('timetable_slots').select('*');
      if (newSlots) setSlots(newSlots);
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Done. ${rows.length} slot${rows.length !== 1 ? 's' : ''} applied to the timetable.` }]);
      setPendingSession(null);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong while applying the timetable. Please try again.' }]);
    } finally {
      setApplyingSlots(false);
    }
  }

  // ── Timetable Preview renderer (used in chat panel) ──────────────────────

  function renderTimetablePreview(msg, i) {
    const session = msg.session || {};
    const { slot_count = 0, class_names = [] } = session;

    return (
      <View key={i} style={styles.previewCard}>
        {/* Summary line */}
        <Text style={styles.previewSummary}>
          {class_names.length} class{class_names.length !== 1 ? 'es' : ''} · {slot_count} slot{slot_count !== 1 ? 's' : ''} ready to apply
        </Text>
        {msg.content ? <Text style={styles.previewAssistantMsg}>{msg.content}</Text> : null}

        {/* Class name chips */}
        <View style={styles.previewChipRow}>
          {class_names.map(cls => (
            <View key={cls} style={styles.previewChip}>
              <Text style={styles.previewChipText}>{cls}</Text>
            </View>
          ))}
        </View>

        {/* Apply button — fetches full slots from server on press */}
        <TouchableOpacity
          style={[styles.previewApplyBtn, applyingSlots && { opacity: 0.6 }]}
          onPress={handleApplySlots}
          disabled={applyingSlots}
          activeOpacity={0.85}
        >
          {applyingSlots
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.previewApplyBtnText}>✅ Apply to Timetable</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const Wrapper = embedded ? View : SafeAreaView;

  if (loading) {
    return (
      <Wrapper style={styles.safe}>
        <ActivityIndicator color={colors.primary} style={{ flex: 1, marginTop: 80 }} />
      </Wrapper>
    );
  }

  return (
    <Wrapper style={styles.safe}>
      {/* Header */}
      {!embedded && (
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>📅 Timetable Planner</Text>
          {isActiveTeam && (
            <View style={styles.teamBadge}><Text style={styles.teamBadgeText}>TEAM</Text></View>
          )}
        </View>
      )}

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'grid' && styles.tabBtnActive]}
          onPress={() => setActiveTab('grid')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabBtnText, activeTab === 'grid' && styles.tabBtnTextActive]}>Grid</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'today' && styles.tabBtnActive]}
          onPress={() => setActiveTab('today')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabBtnText, activeTab === 'today' && styles.tabBtnTextActive]}>Today</Text>
          {absentFaculty.size > 0 && <View style={styles.tabDot} />}
        </TouchableOpacity>
      </View>

      {/* ── Grid tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'grid' && (
        <>
          {/* Class selector */}
          <View style={[styles.classBar, { flexDirection: 'row', alignItems: 'center' }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classBarContent} style={{ flex: 1 }}>
              {derivedClasses.map(cls => (
                <TouchableOpacity
                  key={cls}
                  style={[styles.classPill, selectedClass === cls && styles.classPillActive]}
                  onPress={() => setSelectedClass(cls)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.classPillText, selectedClass === cls && styles.classPillTextActive]}>
                    {cls}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {isActiveTeam && (
              <TouchableOpacity
                style={[styles.swapToggleBtn, swapMode && styles.swapToggleBtnActive]}
                onPress={() => { setSwapMode(v => !v); setSwapSlotA(null); setSwapSlotB(null); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.swapToggleBtnText, swapMode && styles.swapToggleBtnTextActive]}>⇄</Text>
              </TouchableOpacity>
            )}
            {isActiveTeam && (
              <TouchableOpacity
                style={[styles.resetBtn, { marginLeft: 4, marginRight: 4 }]}
                onPress={() => { setResetConfirmText(''); setResetModalVisible(true); }}
                activeOpacity={0.7}
              >
                <Text style={styles.resetBtnText}>Reset</Text>
              </TouchableOpacity>
            )}
            {isTimetableTeam && (
              <TouchableOpacity
                style={styles.assistantComingSoonBtn}
                onPress={() => {
                  if (Platform.OS === 'web') window.alert('Timetable AI is coming soon.');
                  else Alert.alert('Coming Soon', 'Timetable AI is coming soon.');
                }}
                activeOpacity={1}
              >
                <Text style={styles.assistantComingSoonText}>🤖 Timetable AI — Coming Soon</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Swap mode hint bar */}
          {swapMode && (
            <View style={styles.swapHintBar}>
              <Text style={styles.swapHintText} numberOfLines={1}>
                {swapSlotA
                  ? `1st: ${swapSlotA.class_name} ${swapSlotA.day} ${swapSlotA.period_name}${swapSlotA.slot?.course_name ? ` · ${swapSlotA.slot.course_name}` : ''} — tap 2nd slot`
                  : 'Swap mode — tap first slot'}
              </Text>
              <TouchableOpacity onPress={cancelSwap} activeOpacity={0.7}>
                <Text style={styles.swapHintCancel}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Test-as strip — admin only */}
          {isAppAdmin && (
            <View>
              <View style={styles.testStrip}>
                <Text style={styles.testStripLabel}>TEST AS:</Text>
                <TouchableOpacity
                  style={styles.testStripBtn}
                  onPress={() => setShowTestDropdown(v => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.testStripBtnText}>{testAsName || currentName || 'Self'}</Text>
                  <Text style={styles.testStripArrow}>{showTestDropdown ? '▴' : '▾'}</Text>
                </TouchableOpacity>
                {testAsName ? (
                  <TouchableOpacity
                    style={styles.testStripReset}
                    onPress={() => { setTestAsName(''); setShowTestDropdown(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.testStripResetText}>Reset</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {showTestDropdown && (
                <View style={styles.testDropdown}>
                  <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                    {FACULTY_LIST.map(f => (
                      <TouchableOpacity
                        key={f}
                        style={[styles.testDropItem, testAsName === f && styles.testDropItemActive]}
                        onPress={() => { setTestAsName(f); setShowTestDropdown(false); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.testDropItemText, testAsName === f && styles.testDropItemTextActive]}>{f}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Classroom info */}
          {classroom && (
            <View style={styles.roomBar}>
              <Text style={styles.roomBarText}>🏫 {classroom.room_number}{classroom.max_time ? ` · until ${classroom.max_time}` : ''}</Text>
            </View>
          )}

          {/* Grid (+ optional Assistant split) */}
          <View style={{ flex: 1, flexDirection: assistantOpen ? 'row' : 'column' }}>
          <ScrollView style={assistantOpen ? { flex: 6 } : { flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 4 }}>
              <View>
                {/* Day header row */}
                <View style={styles.gridRow}>
                  <View style={[styles.cornerCell]} />
                  {DAYS.map(day => (
                    <View key={day} style={[styles.dayHeaderCell, day === todayDay && styles.satHeaderCell]}>
                      <Text style={[styles.dayHeaderText, day === todayDay && styles.satText]}>{day}</Text>
                    </View>
                  ))}
                </View>

                {/* Period rows */}
                {weekdayPeriods.map(period => (
                  <View key={period.name} style={styles.gridRow}>
                    {/* Period label */}
                    <View style={styles.periodLabelCell}>
                      <Text style={styles.periodLabelName}>{period.name}</Text>
                      <Text style={styles.periodLabelTime}>{period.start_time}</Text>
                    </View>

                    {/* Slot cells per day */}
                    {DAYS.map(day => {
                      const slot = getSlot(day, period.name);
                      // When admin is testing as a faculty, use that name and suppress team privileges
                      const gridName = testAsName || currentName;
                      const isGridTeam = effectiveIsTeam;
                      const isYou = slot?.faculty_name && gridName &&
                        slot.faculty_name.split(' / ').some(
                          f => f.trim().toLowerCase() === gridName.trim().toLowerCase()
                        );
                      const approvalStatus = slot?.approval_status || 'draft';
                      const isPending  = approvalStatus === 'pending';
                      const isApproved = approvalStatus === 'approved';
                      const isRejected = approvalStatus === 'rejected';
                      const isSatCol = day === todayDay;
                      const isSwapSelected = swapMode && swapSlotA &&
                        swapSlotA.class_name === selectedClass &&
                        swapSlotA.day === day &&
                        swapSlotA.period_name === period.name;
                      const cellInfo = { slot, class_name: selectedClass, day, period_name: period.name };
                      const isPerma = permanentOverrides.some(
                        po => po.class_name === selectedClass && po.day === day && po.period_name === period.name
                      );

                      return (
                        <View key={day} style={[styles.slotCell, isSatCol && styles.satSlotCell]}>
                          {slot && (slot.course_name || slot.faculty_name) ? (
                            <TouchableOpacity
                              style={[
                                styles.slotContent,
                                slot.is_elective && styles.slotElective,
                                isYou && !isRejected && styles.slotYou,
                                isRejected && styles.slotRejected,
                                isSwapSelected && styles.slotSwapSelected,
                              ]}
                              onPress={isGridTeam
                                ? () => swapMode ? handleSwapCellPress(cellInfo) : openEdit(day, period)
                                : (isYou ? () => openSubReq(slot, day, period.name) : () => showSlotInfo(slot))}
                              onLongPress={() => showSlotInfo(slot)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.badgeRow}>
                                {isPerma && (
                                  <View style={styles.permaBadge}>
                                    <Text style={styles.permaBadgeText}>PERMA</Text>
                                  </View>
                                )}
                                {slot.is_elective && (
                                  <View style={styles.electiveBadge}>
                                    <Text style={styles.electiveBadgeText}>ELEC</Text>
                                  </View>
                                )}
                                {isYou && (
                                  <View style={styles.youBadge}>
                                    <Text style={styles.youBadgeText}>YOU</Text>
                                  </View>
                                )}
                                {isPending && (
                                  <View style={styles.pendingBadge}>
                                    <Text style={styles.pendingBadgeText}>PENDING</Text>
                                  </View>
                                )}
                                {isApproved && (
                                  <View style={styles.approvedBadge}>
                                    <Text style={styles.approvedBadgeText}>✓</Text>
                                  </View>
                                )}
                                {isRejected && (
                                  <View style={styles.rejectedBadge}>
                                    <Text style={styles.rejectedBadgeText}>REJECTED</Text>
                                  </View>
                                )}
                                {isGridTeam && (
                                  <View style={styles.editDot} />
                                )}
                              </View>
                              <Text style={[styles.slotCourse, isRejected && styles.slotCourseRejected]} numberOfLines={2}>
                                {slot.course_name || slot.course_code}
                              </Text>
                              {slot.faculty_name ? (
                                <Text style={styles.slotFaculty} numberOfLines={1}>
                                  {slot.faculty_name}
                                </Text>
                              ) : null}
                              {isGridTeam && slot.id && !isPending && !isApproved && (
                                <TouchableOpacity
                                  style={styles.approvalBtn}
                                  onPress={() => handleSubmitApproval(slot.id, day, period.name, slot.course_name, slot.faculty_name)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.approvalBtnText}>Submit ↑</Text>
                                </TouchableOpacity>
                              )}
                              {!isGridTeam && isYou && (
                                <View style={styles.subReqBtn}>
                                  <Text style={styles.subReqBtnText}>Request Sub</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          ) : day === 'TUE' && period.name === 'P2' ? (
                            <TouchableOpacity
                              style={[styles.hedCell, isSwapSelected && styles.slotSwapSelected]}
                              onPress={isGridTeam ? () => openEdit(day, period) : undefined}
                              activeOpacity={isGridTeam ? 0.7 : 1}
                            >
                              <Text style={styles.hedLabel}>HED</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={[styles.emptyCell, isSwapSelected && styles.slotSwapSelected]}
                              onPress={isGridTeam
                                ? () => swapMode ? handleSwapCellPress(cellInfo) : openEdit(day, period)
                                : undefined}
                              activeOpacity={isGridTeam ? 0.6 : 1}
                            >
                              {isGridTeam && !swapMode && <Text style={styles.emptyCellPlus}>+</Text>}
                              {isGridTeam && swapMode && <Text style={styles.emptyCellPlus}>⇄</Text>}
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </ScrollView>

          {/* ── Assistant Chat Panel ── */}
          {assistantOpen && (
            <View style={styles.assistantPanel}>
              {/* Header */}
              <View style={styles.assistantHeader}>
                <Text style={styles.assistantTitle}>🤖 Timetable Assistant</Text>
                <TouchableOpacity onPress={() => { setAssistantOpen(false); resetAssistant(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.assistantCloseText}>✕ Close</Text>
                </TouchableOpacity>
              </View>

              {/* Mode buttons */}
              <View style={styles.assistantModeRow}>
                <TouchableOpacity
                  style={[styles.assistantModeBtn, chatMode === 'upload' && styles.assistantModeBtnActive]}
                  onPress={() => { resetAssistant(); setChatMode('upload'); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.assistantModeBtnText, chatMode === 'upload' && styles.assistantModeBtnTextActive]}>📤 Upload</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.assistantModeBtn, chatMode === 'scratch' && styles.assistantModeBtnActive]}
                  onPress={() => { resetAssistant(); startScratchMode(); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.assistantModeBtnText, chatMode === 'scratch' && styles.assistantModeBtnTextActive]}>💬 Build</Text>
                </TouchableOpacity>
                {chatMessages.length > 0 && (
                  <TouchableOpacity style={styles.assistantClearBtn} onPress={resetAssistant} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={styles.assistantClearText}>🗑</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Message history */}
              <ScrollView
                ref={chatScrollRef}
                style={styles.chatScroll}
                contentContainerStyle={{ padding: spacing.sm, paddingBottom: spacing.md }}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => chatScrollRef.current?.scrollToEnd?.({ animated: false })}
              >
                {chatMode === 'select' && chatMessages.length === 0 && (
                  <Text style={styles.chatWelcome}>
                    Hello. I'm your Timetable Assistant. How would you like to proceed — upload an existing timetable file, or build one from scratch?
                  </Text>
                )}
                {chatMessages.map((msg, i) => {
                  if (msg.type === 'preview') return renderTimetablePreview(msg, i);
                  return (
                    <View key={i} style={[styles.chatBubble, msg.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant]}>
                      <Text style={[styles.chatBubbleText, msg.role === 'user' ? styles.chatBubbleTextUser : styles.chatBubbleTextAssistant]}>
                        {msg.content}
                      </Text>
                    </View>
                  );
                })}
                {chatLoading && (
                  <View style={[styles.chatBubble, styles.chatBubbleAssistant, { paddingVertical: 12 }]}>
                    <ActivityIndicator color={colors.primary} size="small" />
                  </View>
                )}
              </ScrollView>

              {/* Upload file button (upload mode, no messages yet) */}
              {chatMode === 'upload' && !chatLoading && (
                <TouchableOpacity style={styles.chatUploadBtn} onPress={handleFileUpload} activeOpacity={0.85}>
                  <Text style={styles.chatUploadBtnText}>📎 Choose Excel File (.xlsx)</Text>
                </TouchableOpacity>
              )}

              {/* Text input (non-select mode) */}
              {chatMode !== 'select' && (
                <View style={styles.chatInputRow}>
                  <TextInput
                    value={chatInput}
                    onChangeText={setChatInput}
                    placeholder="Type a message..."
                    placeholderTextColor={colors.textTertiary}
                    style={styles.chatInput}
                    onSubmitEditing={() => handleChatSend(chatInput)}
                    returnKeyType="send"
                    editable={!chatLoading}
                    multiline={false}
                  />
                  <TouchableOpacity
                    style={[styles.chatSendBtn, (chatLoading || !chatInput.trim()) && { opacity: 0.45 }]}
                    onPress={() => handleChatSend(chatInput)}
                    disabled={chatLoading || !chatInput.trim()}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.chatSendBtnText}>↑</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          </View>{/* end split-screen row wrapper */}
        </>
      )}

      {/* ── Today tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'today' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          {isSundayPreview && selectedDay === 'MON' && (
            <View style={styles.sundayBanner}>
              <Text style={styles.sundayBannerText}>Sunday — showing Monday preview</Text>
            </View>
          )}

          {/* Day selector */}
          <View style={styles.daySelectorRow}>
            {DAYS.map(d => {
              const isSelected = d === selectedDay;
              const isToday = d === todayDay;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayPill, isSelected && styles.dayPillActive]}
                  onPress={() => {
                    if (isSelected) return;
                    setSelectedDay(d);
                    setAbsentFaculty(new Set());
                    setShowRevisedView(false);
                    setSelectedSubs({});
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayPillText, isSelected && styles.dayPillTextActive]}>{d}</Text>
                  {isToday && <View style={styles.dayPillDot} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Pending substitute requests — timetable team only */}
          {isActiveTeam && pendingSubReqs.length > 0 && (() => {
            // Group requests by teacher name
            const groups = pendingSubReqs.reduce((acc, req) => {
              const key = req.requesting_teacher_name || 'Unknown';
              if (!acc[key]) acc[key] = [];
              acc[key].push(req);
              return acc;
            }, {});
            const teacherNames = Object.keys(groups);
            return (
              <View>
                <View style={styles.todaySection}>
                  <Text style={styles.todaySectionTitle}>SUBSTITUTE REQUESTS</Text>
                  <Text style={styles.todaySectionSub}>
                    {teacherNames.length} teacher{teacherNames.length !== 1 ? 's' : ''} absent · {pendingSubReqs.length} class{pendingSubReqs.length !== 1 ? 'es' : ''} need subs
                  </Text>
                </View>
                {teacherNames.map(teacherName => {
                  const reqs = groups[teacherName];
                  const reason = reqs[0]?.reason || '';
                  const allAssigned = reqs.every(r => subAssignments[r.id]?.trim());
                  return (
                    <View key={teacherName} style={styles.subReqCard}>
                      {/* Header */}
                      <View style={styles.subReqCardHeader}>
                        <Text style={styles.subReqTeacher}>{teacherName}</Text>
                        <View style={styles.subReqPendingBadge}>
                          <Text style={styles.subReqPendingText}>{reqs.length} CLASS{reqs.length !== 1 ? 'ES' : ''}</Text>
                        </View>
                      </View>
                      {reason ? <Text style={styles.subReqReason}>{reason}</Text> : null}

                      {/* One row per absent class */}
                      {reqs.map(req => {
                        const slot = req.timetable_slots;
                        const assigned = subAssignments[req.id] || '';
                        const acOpen = subAssignAC === req.id && assigned.length > 0;
                        const acResults = acOpen
                          ? FACULTY_LIST.filter(f => f.toLowerCase().includes(assigned.toLowerCase())).slice(0, 5)
                          : [];
                        return (
                          <View key={req.id} style={styles.subReqSlotRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.subReqSlotInfo}>
                                {slot?.course_name || '—'} · {slot?.class_name} · {slot?.day} {slot?.period_name}
                              </Text>
                              <View style={{ position: 'relative' }}>
                                <TextInput
                                  value={assigned}
                                  onChangeText={t => {
                                    setSubAssignments(prev => ({ ...prev, [req.id]: t }));
                                    setSubAssignAC(req.id);
                                  }}
                                  onFocus={() => { if (assigned.length > 0) setSubAssignAC(req.id); }}
                                  onBlur={() => setTimeout(() => setSubAssignAC(null), 150)}
                                  placeholder={req.preferred_substitute ? `Preferred: ${req.preferred_substitute}` : 'Assign substitute…'}
                                  placeholderTextColor={colors.textTertiary}
                                  style={styles.subAssignInput}
                                />
                                {acResults.length > 0 && (
                                  <View style={styles.subAssignAC}>
                                    {acResults.map(f => (
                                      <TouchableOpacity
                                        key={f}
                                        style={styles.subAssignACItem}
                                        onPress={() => {
                                          setSubAssignments(prev => ({ ...prev, [req.id]: f }));
                                          setSubAssignAC(null);
                                        }}
                                        activeOpacity={0.7}
                                      >
                                        <Text style={styles.subAssignACText}>{f}</Text>
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                )}
                              </View>
                            </View>
                            <TouchableOpacity
                              style={styles.subSuggestMini}
                              onPress={() => {
                                const s = findTodaySubstitutes(teacherName, slot?.day, slot?.period_name, slot?.course_name, slot?.class_name, subAssignments);
                                if (s?.length) {
                                  setSubAssignments(prev => ({ ...prev, [req.id]: s[0].name }));
                                  setSubAssignAC(null);
                                }
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.subSuggestMiniText}>🔍</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}

                      {/* Group actions */}
                      <View style={styles.subReqActions}>
                        <TouchableOpacity
                          style={[styles.subReqApproveBtn, !allAssigned && { opacity: 0.4 }]}
                          onPress={() => allAssigned && handleApproveGroup(reqs)}
                          activeOpacity={allAssigned ? 0.7 : 1}
                        >
                          <Text style={styles.subReqApproveBtnText}>
                            {allAssigned ? 'Approve All' : `Assign all ${reqs.length} first`}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.subReqRejectBtn}
                          onPress={() => handleRejectGroup(reqs)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.subReqRejectBtnText}>Reject All</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })()}

          {/* Faculty Availability Editor button — timetable team only */}
          {isActiveTeam && (
            <TouchableOpacity
              style={styles.availEditorBtn}
              onPress={() => setShowAvailEditor(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.availEditorBtnText}>Edit Faculty Availability</Text>
            </TouchableOpacity>
          )}

          {/* Compensatory Classes — timetable team only */}
          {isActiveTeam && compReqs.filter(r => r.status === 'pending').length > 0 && (() => {
            const pendingComp = compReqs.filter(r => r.status === 'pending');
            return (
              <View>
                <View style={styles.todaySection}>
                  <Text style={styles.todaySectionTitle}>COMPENSATORY CLASSES NEEDED</Text>
                  <Text style={styles.todaySectionSub}>{pendingComp.length} pending · tap a slot to assign</Text>
                </View>
                {pendingComp.map(req => {
                  const options = findCompOptions(req, { slots, periods, mergedAdjunctConstraints, todayDay });
                  return (
                    <View key={req.id} style={styles.subReqCard}>
                      <View style={styles.subReqCardHeader}>
                        <Text style={styles.subReqTeacher}>{req.teacher_name}</Text>
                        <View style={styles.subReqPendingBadge}>
                          <Text style={styles.subReqPendingText}>COMP</Text>
                        </View>
                      </View>
                      <Text style={styles.subReqSlotInfo}>
                        Lost: {req.original_class_name} · {req.original_day} {req.original_period_name}
                      </Text>

                      {options.length > 0 ? (
                        <>
                          <Text style={[styles.subReqSlotInfo, { marginTop: 8, marginBottom: 4, color: colors.textSecondary }]}>
                            Available free slots (from tomorrow):
                          </Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            {options.map(slot => (
                              <TouchableOpacity
                                key={slot.id}
                                style={styles.compSlotOption}
                                onPress={() => handleAssignComp(req, slot)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.compSlotOptionText}>{slot.day} {slot.period_name}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      ) : (
                        <Text style={[styles.subReqSlotInfo, { color: colors.amber, marginTop: 6, marginBottom: 4 }]}>
                          No free slots found in this week's cycle
                        </Text>
                      )}

                      <View style={styles.subReqActions}>
                        <TouchableOpacity
                          style={styles.resolveManualBtn}
                          onPress={() => {
                            setResolveDay('MON');
                            setResolvePeriod('M1');
                            setResolveCourse('');
                            setResolveError('');
                            setResolveManualModal(req);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.resolveManualBtnText}>Assign Manually</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.subReqRejectBtn}
                          onPress={() => handleRejectComp(req)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.subReqRejectBtnText}>No Comp Needed</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })()}

          {/* Absent Today button — teachers only, not timetable team */}
          {!isActiveTeam && currentName && (
            <TouchableOpacity
              style={styles.absentTodayBtn}
              onPress={() => { setAbsentTodayReason(''); setAbsentTodayModal(true); }}
              activeOpacity={0.8}
            >
              <Text style={styles.absentTodayBtnText}>Cancel Classes Today</Text>
            </TouchableOpacity>
          )}

          {!showRevisedView ? (
            <>
              {/* Part 1: Absence marking */}
              <View style={styles.todaySection}>
                <Text style={styles.todaySectionTitle}>{selectedDay === todayDay ? 'TODAY' : selectedDay} — {selectedDay}</Text>
                <Text style={styles.todaySectionSub}>
                  {todayFacultyCards.length} faculty teaching today
                  {isActiveTeam ? ' · tap a card to mark absent' : ''}
                </Text>
              </View>

              {todayFacultyCards.length === 0 ? (
                <View style={styles.todayEmptyWrap}>
                  <Text style={styles.todayEmptyText}>No timetable slots found for today.</Text>
                </View>
              ) : (
                todayFacultyCards.map(({ name, count }) => {
                  const isAbsent = absentFaculty.has(name);
                  return (
                    <TouchableOpacity
                      key={name}
                      style={[styles.facultyCard, isAbsent && styles.facultyCardAbsent]}
                      onPress={isActiveTeam ? () => handleToggleAbsent(name) : undefined}
                      activeOpacity={isActiveTeam ? 0.7 : 1}
                    >
                      <View style={styles.facultyCardLeft}>
                        <Text style={[styles.facultyCardName, isAbsent && styles.facultyCardNameAbsent]}>
                          {name}
                        </Text>
                        <Text style={[styles.facultyCardCount, isAbsent && styles.facultyCardCountAbsent]}>
                          {count} class{count !== 1 ? 'es' : ''} today
                        </Text>
                      </View>
                      {isAbsent ? (
                        <View style={styles.absentBadge}>
                          <Text style={styles.absentBadgeText}>ABSENT</Text>
                        </View>
                      ) : isActiveTeam ? (
                        <View style={styles.presentBadge}>
                          <Text style={styles.presentBadgeText}>PRESENT ✓</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              )}

              {absentFaculty.size > 0 && (
                <TouchableOpacity
                  style={styles.generateBtn}
                  onPress={() => setShowRevisedView(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.generateBtnText}>
                    Generate Substitutes ({absentFaculty.size} absent)
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              {/* Part 2: Revised day view */}
              <View style={styles.revisedHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.revisedHeaderTitle}>Revised Schedule — {selectedDay}</Text>
                  <Text style={styles.revisedHeaderSub}>
                    {absentFaculty.size} absent · tap a suggestion to assign
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.revisedBackBtn}
                  onPress={() => { setShowRevisedView(false); setSelectedSubs({}); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.revisedBackBtnText}>← Back</Text>
                </TouchableOpacity>
              </View>

              {derivedClasses.map(cls => {
                const clsSlots = todaySlots.filter(s => s.class_name === cls);
                if (!clsSlots.length) return null;

                return (
                  <View key={cls} style={styles.revisedClassCard}>
                    <Text style={styles.revisedClassName}>{cls}</Text>

                    {weekdayPeriods.map(period => {
                      const slot = clsSlots.find(s => s.period_name === period.name);
                      if (!slot) return null;

                      const rawFaculty = slot.faculty_name?.trim() || '';
                      const isAbsent = rawFaculty && absentFaculty.has(rawFaculty);
                      const subKey = `${cls}__${period.name}`;
                      const selectedSub = selectedSubs[subKey];

                      const isPaired = isAbsent && todayPairedSessions.some(ps =>
                        ps.period_name === period.name && (
                          ps.faculty_a?.toLowerCase().includes(rawFaculty.toLowerCase()) ||
                          ps.faculty_b?.toLowerCase().includes(rawFaculty.toLowerCase())
                        )
                      );

                      const subs = isAbsent && !isPaired && !selectedSub
                        ? findTodaySubstitutes(rawFaculty, selectedDay, period.name, slot.course_name, cls, selectedSubs)
                        : [];

                      return (
                        <View key={period.name} style={styles.revisedPeriodRow}>
                          <View style={styles.revisedPeriodLabel}>
                            <Text style={styles.revisedPeriodName}>{period.name}</Text>
                            <Text style={styles.revisedPeriodTime}>{period.start_time}</Text>
                          </View>

                          <View style={styles.revisedPeriodContent}>
                            <Text style={[styles.revisedCourse, isAbsent && styles.revisedCourseAbsent]}>
                              {slot.course_name || slot.course_code || 'Unknown'}
                            </Text>
                            <Text style={[styles.revisedFaculty, isAbsent && styles.revisedFacultyAbsent]}>
                              {isAbsent
                                ? `${rawFaculty} — ABSENT`
                                : rawFaculty || 'TBD'}
                            </Text>

                            {isPaired && (
                              <View style={styles.cancelledBanner}>
                                <Text style={styles.cancelledBannerText}>CANCELLED — Paired / Elective Session</Text>
                              </View>
                            )}

                            {isAbsent && !isPaired && (
                              <View style={styles.subSuggestions}>
                                {selectedSub ? (
                                  <TouchableOpacity
                                    style={styles.selectedSubCard}
                                    onPress={() => setSelectedSubs(prev => {
                                      const next = { ...prev };
                                      delete next[subKey];
                                      return next;
                                    })}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={styles.selectedSubName}>{selectedSub} ✓</Text>
                                    <Text style={styles.selectedSubTap}>tap to change</Text>
                                  </TouchableOpacity>
                                ) : subs.length > 0 ? (
                                  subs.map(({ name: subName, rank }) => (
                                    <TouchableOpacity
                                      key={subName}
                                      style={styles.subCard}
                                      onPress={() => setSelectedSubs(prev => ({ ...prev, [subKey]: subName }))}
                                      activeOpacity={0.7}
                                    >
                                      <Text style={styles.subCardName}>{subName}</Text>
                                      <View style={[
                                        styles.rankBadge,
                                        rank === 'BEST MATCH' && styles.rankBest,
                                        rank === 'SUBJECT MATCH' && styles.rankSubject,
                                      ]}>
                                        <Text style={[
                                          styles.rankBadgeText,
                                          rank === 'BEST MATCH' && styles.rankBestText,
                                          rank === 'SUBJECT MATCH' && styles.rankSubjectText,
                                        ]}>
                                          {rank}
                                        </Text>
                                      </View>
                                    </TouchableOpacity>
                                  ))
                                ) : (
                                  <Text style={styles.noSubsText}>No available substitutes found</Text>
                                )}
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}

              {/* Part 3: Publish */}
              {Object.keys(selectedSubs).length > 0 && (
                <TouchableOpacity
                  style={[styles.publishBtn, publishing && styles.publishBtnDisabled]}
                  onPress={handlePublish}
                  disabled={publishing}
                  activeOpacity={0.8}
                >
                  {publishing
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.publishBtnText}>
                        Publish {Object.keys(selectedSubs).length} Substitution{Object.keys(selectedSubs).length !== 1 ? 's' : ''}
                      </Text>
                  }
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      <Modal visible={!!editTarget} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={closeEdit} activeOpacity={1} />
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Edit Slot</Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedClass} · {editTarget?.day} · {editTarget?.period_name}
                  </Text>
                </View>
                <TouchableOpacity onPress={closeEdit} style={styles.modalCloseBtn} activeOpacity={0.7}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Change type */}
              <Text style={styles.fieldLabel}>Change Type</Text>
              <View style={styles.changeTypeRow}>
                {['edit', 'substitute', 'cancel'].map(ct => (
                  <TouchableOpacity
                    key={ct}
                    style={[styles.changeTypeBtn, editForm.change_type === ct && styles.changeTypeBtnActive]}
                    onPress={() => setEditForm(f => ({ ...f, change_type: ct }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.changeTypeBtnText, editForm.change_type === ct && styles.changeTypeBtnTextActive]}>
                      {ct.charAt(0).toUpperCase() + ct.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Course code */}
              <Text style={styles.fieldLabel}>Course Code</Text>
              <TextInput
                value={editForm.course_code}
                onChangeText={t => setEditForm(f => ({ ...f, course_code: t }))}
                placeholder="e.g. COC101-1"
                placeholderTextColor={colors.textTertiary}
                style={styles.fieldInput}
              />

              {/* Course name */}
              <Text style={styles.fieldLabel}>Course Name</Text>
              <TextInput
                value={editForm.course_name}
                onChangeText={t => setEditForm(f => ({ ...f, course_name: t }))}
                placeholder="e.g. Fundamentals of Accounting"
                placeholderTextColor={colors.textTertiary}
                style={styles.fieldInput}
              />

              {/* Faculty name with autocomplete */}
              <Text style={styles.fieldLabel}>Faculty Name</Text>
              <View>
                <TextInput
                  value={facultyQuery}
                  onChangeText={onFacultyChange}
                  onFocus={() => setShowFacultyAC(facultyQuery.length > 0)}
                  onBlur={() => {
                    if (facultyQuery.trim() && editTarget) {
                      resolveSubjectForSub(facultyQuery.trim(), selectedClass, editTarget.existing?.id).then(subject => {
                        if (subject) setEditForm(f => ({ ...f, course_name: subject.name, course_code: subject.code }));
                      });
                    }
                  }}
                  placeholder="Start typing faculty name…"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.fieldInput}
                />
                {showFacultyAC && facultyACResults.length > 0 && (
                  <View style={styles.acDropdown}>
                    {facultyACResults.map(f => (
                      <TouchableOpacity
                        key={f}
                        style={styles.acItem}
                        onPress={() => selectFacultySuggestion(f)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.acItemText}>{f}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Conflict warnings */}
              {conflicts.length > 0 && (
                <View style={styles.conflictBox}>
                  {conflicts.map((c, i) => (
                    <Text key={i} style={styles.conflictText}>⚠️ {c}</Text>
                  ))}
                </View>
              )}

              {/* Substitute suggester */}
              {editForm.change_type === 'substitute' && (
                <TouchableOpacity
                  style={styles.suggestBtn}
                  onPress={() => {
                    const s = findSubstitutes(editTarget.day, editTarget.period_name, editForm.course_name, selectedClass);
                    setSuggestions(s);
                    setShowSuggestions(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.suggestBtnText}>🔍 Suggest Substitutes</Text>
                </TouchableOpacity>
              )}

              {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestList}>
                  <Text style={styles.suggestListLabel}>AVAILABLE FACULTY</Text>
                  {suggestions.map(({ name: f, familiar }) => (
                    <TouchableOpacity
                      key={f}
                      style={styles.suggestItem}
                      onPress={() => { selectFacultySuggestion(f); setShowSuggestions(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestItemText}>{f}</Text>
                      {familiar && (
                        <View style={styles.familiarBadge}>
                          <Text style={styles.familiarBadgeText}>Familiar</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Batch details */}
              <Text style={styles.fieldLabel}>Batch Details</Text>
              <TextInput
                value={editForm.batch_details}
                onChangeText={t => setEditForm(f => ({ ...f, batch_details: t }))}
                placeholder="e.g. Section A only"
                placeholderTextColor={colors.textTertiary}
                style={styles.fieldInput}
              />

              {/* Is elective */}
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Elective / Paired</Text>
                <Switch
                  value={editForm.is_elective}
                  onValueChange={v => setEditForm(f => ({ ...f, is_elective: v }))}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>

              {/* Permanent change */}
              <View style={[styles.switchRow, { marginTop: 4, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: editForm.isPermanent ? 'rgba(239,68,68,0.08)' : 'transparent', borderWidth: editForm.isPermanent ? 1 : 0, borderColor: '#EF4444' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: editForm.isPermanent ? '#EF4444' : colors.textSecondary, marginBottom: 2 }]}>Permanent Change</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary, lineHeight: 15 }}>Survives a timetable reset</Text>
                </View>
                <Switch
                  value={editForm.isPermanent}
                  onValueChange={v => setEditForm(f => ({ ...f, isPermanent: v }))}
                  trackColor={{ false: colors.border, true: '#EF4444' }}
                  thumbColor="#fff"
                />
              </View>

              {/* Reason */}
              <Text style={styles.fieldLabel}>
                Reason {editForm.change_type === 'substitute' ? '(required)' : '(optional)'}
              </Text>
              <TextInput
                value={editForm.reason}
                onChangeText={t => setEditForm(f => ({ ...f, reason: t }))}
                placeholder="e.g. Faculty on leave"
                placeholderTextColor={colors.textTertiary}
                style={[styles.fieldInput, { minHeight: 60 }]}
                multiline
              />

              {/* Save */}
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Save Changes</Text>
                }
              </TouchableOpacity>

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── WhatsApp modal ────────────────────────────────────────────────── */}
      {whatsappModal && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              onPress={() => setWhatsappModal(null)}
              activeOpacity={1}
            />
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>WhatsApp Summary</Text>
                  <Text style={styles.modalSubtitle}>Copy and paste in class WhatsApp groups</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setWhatsappModal(null)}
                  style={styles.modalCloseBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {whatsappModal.classes.map(({ name: cls, text }) => (
                  <View key={cls} style={styles.waClassBlock}>
                    <View style={styles.waClassHeader}>
                      <Text style={styles.waClassName}>{cls}</Text>
                      <TouchableOpacity
                        style={styles.waCopyBtn}
                        onPress={() => {
                          try { Clipboard.setString(text); } catch (e) {}
                          Alert.alert('Copied!', `${cls} schedule copied to clipboard.`);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.waCopyBtnText}>Copy</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.waTextBox}>
                      <Text style={styles.waText}>{text}</Text>
                    </View>
                  </View>
                ))}
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Reset Timetable Confirmation Modal ──────────────────────────── */}
      <Modal visible={resetModalVisible} animationType="fade" transparent>
        <View style={styles.approveSubOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setResetModalVisible(false)} activeOpacity={1} />
          <View style={styles.approveSubCard}>
            <Text style={[styles.modalTitle, { marginBottom: 6 }]}>Reset Timetable</Text>
            <Text style={{ color: colors.red, fontSize: 13, marginBottom: 16, lineHeight: 18 }}>
              This will overwrite ALL faculty assignments and course names back to the original seeded values for every class. Substitute logs and compensatory requests are not affected.
            </Text>
            <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>Type CONFIRM to enable the reset button</Text>
            <TextInput
              style={[styles.fieldInput, { marginBottom: 16 }]}
              placeholder="CONFIRM"
              placeholderTextColor="#64748b"
              value={resetConfirmText}
              onChangeText={setResetConfirmText}
              autoCorrect={false}
            />
            <View style={styles.subReqActions}>
              <TouchableOpacity
                style={styles.subReqRejectBtn}
                onPress={() => setResetModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.subReqRejectBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.subReqApproveBtn,
                  { backgroundColor: colors.red, opacity: resetConfirmText.toUpperCase() === 'CONFIRM' && !resetLoading ? 1 : 0.35 },
                ]}
                onPress={resetConfirmText.toUpperCase() === 'CONFIRM' && !resetLoading ? handleResetTimetable : undefined}
                activeOpacity={0.7}
              >
                <Text style={styles.subReqApproveBtnText}>
                  {resetLoading ? 'Resetting…' : 'Reset Timetable'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Approve Substitute Modal (timetable team) ───────────────────── */}
      <Modal visible={!!approveSubModal} animationType="fade" transparent>
        <View style={styles.approveSubOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setApproveSubModal(null)} activeOpacity={1} />
          <View style={styles.approveSubCard}>
            <Text style={[styles.modalTitle, { marginBottom: 4 }]}>Assign Substitute</Text>
            <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
              {approveSubModal?.timetable_slots?.course_name || approveSubModal?.class_name || 'Class'} · {approveSubModal?.timetable_slots?.day || approveSubModal?.day} {approveSubModal?.timetable_slots?.period_name || approveSubModal?.period_name}
            </Text>
            <Text style={styles.subReqPref}>Who will cover this class?</Text>
            <TextInput
              style={[styles.fieldInput, { marginTop: 8, marginBottom: 12 }]}
              placeholder="Enter substitute faculty name"
              placeholderTextColor="#64748b"
              value={approveSubName}
              onChangeText={setApproveSubName}
              autoFocus
            />
            <TouchableOpacity
              style={styles.autoAssignBtn}
              onPress={() => {
                const req = approveSubModal;
                const slot = req?.timetable_slots;
                const day = slot?.day || req?.day;
                const periodName = slot?.period_name || req?.period_name;
                const courseName = slot?.course_name;
                const className = slot?.class_name || req?.class_name;
                const suggestions = findSubstitutes(day, periodName, courseName, className);
                const best = suggestions.find(s => s.familiar) || suggestions[0];
                if (!best) { Alert.alert('No Available Faculty', 'No substitute could be found for this slot.'); return; }
                setApproveSubModal(null);
                handleApproveSubReq(req, best.name);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.autoAssignBtnText}>Auto-Assign</Text>
            </TouchableOpacity>
            <View style={[styles.subReqActions, { marginTop: 12 }]}>
              <TouchableOpacity
                style={styles.subReqRejectBtn}
                onPress={() => setApproveSubModal(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.subReqRejectBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.subReqApproveBtn}
                onPress={() => {
                  const req = approveSubModal;
                  setApproveSubModal(null);
                  handleApproveSubReq(req, approveSubName);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.subReqApproveBtnText}>Confirm Approval</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Resolve Manually Modal ──────────────────────────────────────── */}
      <Modal visible={!!resolveManualModal} animationType="fade" transparent>
        <View style={styles.approveSubOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setResolveManualModal(null)} activeOpacity={1} />
          <View style={[styles.approveSubCard, { maxHeight: '85%' }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { marginBottom: 4 }]}>Resolve Manually</Text>
              <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
                {resolveManualModal?.teacher_name} · lost {resolveManualModal?.original_class_name} {resolveManualModal?.original_day} {resolveManualModal?.original_period_name}
              </Text>

              <Text style={styles.fieldLabel}>SELECT DAY</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
                {DAYS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.resolvePickerPill, resolveDay === d && styles.resolvePickerPillActive]}
                    onPress={() => { setResolveDay(d); setResolveError(''); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.resolvePickerPillText, resolveDay === d && styles.resolvePickerPillTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>SELECT PERIOD</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
                {['M1', 'M2', 'P1', 'P2', 'P3', 'P4'].map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.resolvePickerPill, resolvePeriod === p && styles.resolvePickerPillActive]}
                    onPress={() => { setResolvePeriod(p); setResolveError(''); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.resolvePickerPillText, resolvePeriod === p && styles.resolvePickerPillTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>SUBJECT / COURSE</Text>
              <TextInput
                style={[styles.fieldInput, { marginBottom: resolveSubjectSuggestions.length > 0 ? 8 : spacing.md }]}
                placeholder="Enter course name"
                placeholderTextColor="#64748b"
                value={resolveCourse}
                onChangeText={t => { setResolveCourse(t); setResolveError(''); }}
              />
              {resolveSubjectSuggestions.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
                  {resolveSubjectSuggestions.map(s => (
                    <TouchableOpacity
                      key={s.code}
                      style={styles.subjectSuggestionPill}
                      onPress={() => setResolveCourse(s.name)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.subjectSuggestionText}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {!!resolveError && (
                <Text style={{ fontSize: 12, color: colors.red, marginBottom: spacing.md, lineHeight: 17 }}>
                  {resolveError}
                </Text>
              )}

              <View style={[styles.subReqActions, { marginTop: 4 }]}>
                <TouchableOpacity
                  style={styles.subReqRejectBtn}
                  onPress={() => setResolveManualModal(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.subReqRejectBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subReqApproveBtn, resolveLoading && { opacity: 0.6 }]}
                  onPress={!resolveLoading ? handleResolveManually : undefined}
                  activeOpacity={0.7}
                >
                  {resolveLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.subReqApproveBtnText}>Confirm</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Swap Confirmation Modal ─────────────────────────────────────── */}
      <Modal visible={swapModalVisible} animationType="fade" transparent>
        <View style={styles.approveSubOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => { setSwapModalVisible(false); setSwapSlotB(null); }} activeOpacity={1} />
          <View style={styles.approveSubCard}>
            <Text style={[styles.modalTitle, { marginBottom: 14 }]}>Confirm Swap</Text>
            <View style={styles.swapModalRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.swapModalLabel}>{swapSlotA?.class_name} · {swapSlotA?.day} {swapSlotA?.period_name}</Text>
                <Text style={styles.swapModalCourse} numberOfLines={2}>{swapSlotA?.slot?.course_name || '(empty)'}</Text>
                {swapSlotA?.slot?.faculty_name ? <Text style={styles.swapModalFaculty} numberOfLines={1}>{swapSlotA.slot.faculty_name}</Text> : null}
              </View>
              <Text style={styles.swapArrow}>⇄</Text>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={[styles.swapModalLabel, { textAlign: 'right' }]}>{swapSlotB?.class_name} · {swapSlotB?.day} {swapSlotB?.period_name}</Text>
                <Text style={[styles.swapModalCourse, { textAlign: 'right' }]} numberOfLines={2}>{swapSlotB?.slot?.course_name || '(empty)'}</Text>
                {swapSlotB?.slot?.faculty_name ? <Text style={[styles.swapModalFaculty, { textAlign: 'right' }]} numberOfLines={1}>{swapSlotB.slot.faculty_name}</Text> : null}
              </View>
            </View>
            <View style={[styles.subReqActions, { marginTop: 16 }]}>
              <TouchableOpacity
                style={styles.subReqRejectBtn}
                onPress={() => { setSwapModalVisible(false); setSwapSlotB(null); }}
                activeOpacity={0.7}
              >
                <Text style={styles.subReqRejectBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subReqApproveBtn, swapLoading && { opacity: 0.6 }]}
                onPress={!swapLoading ? handleConfirmSwap : undefined}
                activeOpacity={0.7}
              >
                {swapLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.subReqApproveBtnText}>Confirm Swap</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Faculty Availability Editor Modal ──────────────────────────── */}
      <Modal visible={showAvailEditor} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => { setShowAvailEditor(false); setEditingAvail(null); }} activeOpacity={1} />
          <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Faculty Availability</Text>
                <Text style={styles.modalSubtitle}>Overrides apply on top of the built-in defaults</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setShowAvailEditor(false); setEditingAvail(null); }} activeOpacity={0.7}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* ── Edit / Add form ── */}
              {editingAvail !== null && (
                <View style={styles.availForm}>
                  <Text style={styles.fieldLabel}>FACULTY NAME</Text>
                  <TextInput
                    style={[styles.fieldInput, { marginBottom: spacing.md }]}
                    placeholder="e.g. CA Sarthak"
                    placeholderTextColor="#64748b"
                    value={availName}
                    onChangeText={setAvailName}
                    editable={!editingAvail.id}
                  />

                  <Text style={styles.fieldLabel}>AVAILABLE DAYS (leave all unchecked = no restriction)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
                    {DAYS.map(d => {
                      const on = availDays.includes(d);
                      return (
                        <TouchableOpacity
                          key={d}
                          style={[styles.resolvePickerPill, on && styles.resolvePickerPillActive]}
                          onPress={() => setAvailDays(prev => on ? prev.filter(x => x !== d) : [...prev, d])}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.resolvePickerPillText, on && styles.resolvePickerPillTextActive]}>{d}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.fieldLabel}>LATEST PERIOD START (e.g. 09:30) — blank = no limit</Text>
                  <TextInput
                    style={[styles.fieldInput, { marginBottom: spacing.md }]}
                    placeholder="09:30"
                    placeholderTextColor="#64748b"
                    value={availWindowEnd}
                    onChangeText={setAvailWindowEnd}
                    keyboardType="numbers-and-punctuation"
                  />

                  <Text style={styles.fieldLabel}>SAT OVERRIDE — latest period start on Saturdays (optional)</Text>
                  <TextInput
                    style={[styles.fieldInput, { marginBottom: spacing.md }]}
                    placeholder="10:30"
                    placeholderTextColor="#64748b"
                    value={availSatWindow}
                    onChangeText={setAvailSatWindow}
                    keyboardType="numbers-and-punctuation"
                  />

                  <View style={styles.subReqActions}>
                    <TouchableOpacity
                      style={styles.subReqRejectBtn}
                      onPress={() => setEditingAvail(null)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.subReqRejectBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.subReqApproveBtn, (!availName.trim() || availSaving) && { opacity: 0.5 }]}
                      onPress={availName.trim() && !availSaving ? saveAvail : undefined}
                      activeOpacity={0.7}
                    >
                      {availSaving
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.subReqApproveBtnText}>{editingAvail.id ? 'Save Changes' : 'Add Override'}</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── Constraint list ── */}
              <View style={{ marginTop: editingAvail !== null ? spacing.lg : 0 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                  <Text style={styles.fieldLabel}>ALL CONSTRAINTS ({mergedAdjunctConstraints.length})</Text>
                  {editingAvail === null && (
                    <TouchableOpacity style={styles.availAddBtn} onPress={openNewAvail} activeOpacity={0.7}>
                      <Text style={styles.availAddBtnText}>+ Add</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {mergedAdjunctConstraints.map((c, idx) => {
                  const dbEntry = facultyAvailability.find(r => r.faculty_name.toLowerCase() === c.name.toLowerCase());
                  return (
                    <View key={c.name} style={styles.availRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.availRowName}>{c.name}</Text>
                          {dbEntry && (
                            <View style={styles.availOverrideBadge}>
                              <Text style={styles.availOverrideBadgeText}>OVERRIDE</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.availRowMeta}>
                          {c.days ? c.days.join(', ') : 'All days'}
                          {c.windowEnd ? ` · until ${c.windowEnd}` : ''}
                          {c.satWindowEnd ? ` · SAT until ${c.satWindowEnd}` : ''}
                        </Text>
                      </View>
                      {dbEntry ? (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            style={styles.availEditBtn}
                            onPress={() => openEditAvail({ id: dbEntry.id, name: dbEntry.faculty_name, days: dbEntry.available_days, windowEnd: dbEntry.window_end, satWindowEnd: dbEntry.sat_window_end })}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.availEditBtnText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.availDeleteBtn}
                            onPress={() => deleteAvail(dbEntry.id)}
                            disabled={availDeleting === dbEntry.id}
                            activeOpacity={0.7}
                          >
                            {availDeleting === dbEntry.id
                              ? <ActivityIndicator size="small" color={colors.red} />
                              : <Text style={styles.availDeleteBtnText}>✕</Text>
                            }
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.availEditBtn}
                          onPress={() => openEditAvail({ name: c.name, days: c.days || [], windowEnd: c.windowEnd || '', satWindowEnd: c.satWindowEnd || '' })}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.availEditBtnText}>Override</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Request Substitute Modal (regular teachers) ──────────────────── */}
      <Modal visible={!!subReqTarget} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setSubReqTarget(null)} activeOpacity={1} />
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Request Substitute</Text>
                  <Text style={styles.modalSubtitle}>
                    {subReqTarget?.slot?.course_name || 'Class'} · {subReqTarget?.day} · {subReqTarget?.periodName}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSubReqTarget(null)} style={styles.modalCloseBtn} activeOpacity={0.7}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>REASON (REQUIRED)</Text>
              <TextInput
                value={subReqReason}
                onChangeText={setSubReqReason}
                placeholder="e.g. On leave, Personal emergency…"
                placeholderTextColor={colors.textTertiary}
                style={[styles.fieldInput, { minHeight: 60 }]}
                multiline
              />

              <Text style={styles.fieldLabel}>PREFERRED SUBSTITUTE (OPTIONAL)</Text>
              <TouchableOpacity
                style={styles.suggestBtn}
                onPress={() => {
                  if (!subReqTarget) return;
                  const subs = findSubstitutes(
                    subReqTarget.day,
                    subReqTarget.periodName,
                    subReqTarget.slot?.course_name,
                    subReqTarget.slot?.class_name,
                  );
                  setSubReqSuggestions(subs);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.suggestBtnText}>🔍 Suggest Substitutes</Text>
              </TouchableOpacity>

              {subReqPrefSub ? (
                <TouchableOpacity
                  style={styles.selectedSubCard}
                  onPress={() => { setSubReqPrefSub(''); setSubReqSuggestions([]); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.selectedSubName}>{subReqPrefSub} ✓</Text>
                  <Text style={styles.selectedSubTap}>tap to clear</Text>
                </TouchableOpacity>
              ) : subReqSuggestions.length > 0 ? (
                <View style={styles.suggestList}>
                  <Text style={styles.suggestListLabel}>AVAILABLE FACULTY</Text>
                  {subReqSuggestions.map(({ name: f, familiar }) => (
                    <TouchableOpacity
                      key={f}
                      style={styles.suggestItem}
                      onPress={() => { setSubReqPrefSub(f); setSubReqSuggestions([]); }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestItemText}>{f}</Text>
                      {familiar && (
                        <View style={styles.familiarBadge}>
                          <Text style={styles.familiarBadgeText}>Familiar</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.saveBtn, subReqSaving && styles.saveBtnDisabled]}
                onPress={handleSubReqSubmit}
                disabled={subReqSaving}
                activeOpacity={0.8}
              >
                {subReqSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Send Request</Text>
                }
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Absent Today Modal ───────────────────────────────────────────── */}
      <Modal visible={absentTodayModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setAbsentTodayModal(false)} activeOpacity={1} />
          <View style={[styles.modalSheet, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Cancel Your Classes</Text>
                <Text style={styles.modalSubtitle}>
                  All your {selectedDay} classes will be marked cancelled and students notified.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAbsentTodayModal(false)} style={styles.modalCloseBtn} activeOpacity={0.7}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Reason (optional)</Text>
            <TextInput
              value={absentTodayReason}
              onChangeText={setAbsentTodayReason}
              placeholder="e.g. Unwell, personal emergency…"
              placeholderTextColor={colors.textTertiary}
              style={[styles.fieldInput, { marginBottom: 20 }]}
            />
            <TouchableOpacity
              style={[styles.saveBtn, absentTodaySubmitting && styles.saveBtnDisabled]}
              onPress={handleAbsentToday}
              disabled={absentTodaySubmitting}
              activeOpacity={0.8}
            >
              {absentTodaySubmitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>Confirm Cancellation</Text>
              }
            </TouchableOpacity>
            <View style={{ height: 16 }} />
          </View>
        </View>
      </Modal>

      {/* Submitting overlay */}
      {submitting && (
        <View style={styles.submittingOverlay}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.submittingText}>Submitting for approval…</Text>
        </View>
      )}
    </Wrapper>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns a human-readable warning string if facultyName violates an adjunct
// constraint for the given day/periodStartMins, or null if no violation.
// constraintsList defaults to the hardcoded array; pass mergedAdjunctConstraints to apply DB overrides.
function adjunctWarning(facultyName, day, periodStartMins, constraintsList = ADJUNCT_CONSTRAINTS) {
  if (!facultyName) return null;
  const fn = facultyName.toLowerCase();
  const c = constraintsList.find(x => fn.includes(x.name.toLowerCase()));
  if (!c) return null;
  if (c.days && !c.days.includes(day)) {
    return `${c.name} is only available on ${c.days.join(', ')}.`;
  }
  if (periodStartMins != null && c.windowEnd) {
    const effectiveEnd = (day === 'SAT' && c.satWindowEnd) ? c.satWindowEnd : c.windowEnd;
    if (periodStartMins >= parseTimeToMinutes(effectiveEnd)) {
      return `${c.name} is only available until ${effectiveEnd}${day === 'SAT' && c.satWindowEnd ? ' on SAT' : ''}.`;
    }
  }
  return null;
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim().toUpperCase();
  const match = cleaned.match(/(\d+):(\d+)\s*(AM|PM)?/);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const period = match[3];
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + mins;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: colors.textPrimary },
  headerTitle: { flex: 1, fontSize: 16, ...font.bold, color: colors.textPrimary },
  teamBadge: {
    backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  teamBadgeText: { fontSize: 9, ...font.bold, color: colors.primary, letterSpacing: 0.8 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, gap: 5,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: colors.primary },
  tabBtnText: { fontSize: 13, ...font.semibold, color: colors.textSecondary },
  tabBtnTextActive: { color: colors.primary },
  tabDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.red },

  classBar: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  classBarContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  classPill: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 5, backgroundColor: colors.bg,
  },
  classPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  classPillText: { fontSize: 11, ...font.semibold, color: colors.textSecondary },
  classPillTextActive: { color: '#fff' },

  roomBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.cardElevated,
  },
  roomBarText: { fontSize: 12, ...font.semibold, color: colors.textSecondary, flex: 1 },
  roomBarActions: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  exportBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 7, paddingVertical: 3, backgroundColor: colors.bg,
  },
  exportBtnText: { fontSize: 10, color: colors.textSecondary, ...font.medium },

  // Grid
  gridRow: { flexDirection: 'row' },

  cornerCell: {
    width: PERIOD_COL_W, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  dayHeaderCell: {
    width: CELL_W, paddingVertical: 8,
    alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  satHeaderCell: { backgroundColor: colors.amberLight },
  dayHeaderText: { fontSize: 11, ...font.bold, color: colors.textSecondary, letterSpacing: 0.6 },
  satText: { color: colors.amber },

  periodLabelCell: {
    width: PERIOD_COL_W, paddingVertical: spacing.sm, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  periodLabelName: { fontSize: 11, ...font.bold, color: colors.textPrimary },
  periodLabelTime: { fontSize: 9, color: colors.textTertiary, marginTop: 2 },

  slotCell: {
    width: CELL_W, minHeight: 80,
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
    padding: 3,
  },
  satSlotCell: { backgroundColor: 'rgba(251, 191, 36, 0.04)' },

  slotContent: {
    flex: 1, backgroundColor: colors.card,
    borderRadius: radius.sm, padding: 5,
    borderLeftWidth: 2, borderLeftColor: colors.primary,
  },
  slotElective: {
    borderLeftColor: '#A855F7',
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
  },
  slotYou: {
    borderLeftColor: colors.green,
    backgroundColor: colors.greenLight,
  },
  slotRejected: {
    borderLeftColor: colors.red,
    backgroundColor: colors.redLight,
    opacity: 0.75,
  },

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 3, flexWrap: 'wrap' },
  permaBadge: {
    backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 3,
    paddingHorizontal: 4, paddingVertical: 1,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)',
  },
  permaBadgeText: { fontSize: 7, ...font.bold, color: '#EF4444', letterSpacing: 0.4 },
  electiveBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)', borderRadius: 3,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  electiveBadgeText: { fontSize: 7, ...font.bold, color: '#C4B5FD', letterSpacing: 0.4 },
  youBadge: {
    backgroundColor: colors.greenLight, borderRadius: 3,
    paddingHorizontal: 4, paddingVertical: 1,
    borderWidth: 1, borderColor: colors.greenBorder,
  },
  youBadgeText: { fontSize: 7, ...font.bold, color: colors.green, letterSpacing: 0.4 },
  pendingBadge: {
    backgroundColor: colors.amberLight, borderRadius: 3,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  pendingBadgeText: { fontSize: 7, ...font.bold, color: colors.amber, letterSpacing: 0.4 },
  editDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: colors.primary, marginLeft: 'auto',
  },

  approvedBadge: {
    backgroundColor: colors.greenLight, borderRadius: 3,
    paddingHorizontal: 4, paddingVertical: 1,
    borderWidth: 1, borderColor: colors.greenBorder,
  },
  approvedBadgeText: { fontSize: 9, ...font.bold, color: colors.green },
  rejectedBadge: {
    backgroundColor: colors.redLight, borderRadius: 3,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  rejectedBadgeText: { fontSize: 7, ...font.bold, color: colors.red, letterSpacing: 0.4 },

  slotCourse: { fontSize: 10, ...font.semibold, color: colors.textPrimary, lineHeight: 13 },
  slotCourseRejected: { color: colors.red, textDecorationLine: 'line-through' },
  slotFaculty: { fontSize: 9, color: colors.textTertiary, marginTop: 2 },

  approvalBtn: {
    marginTop: 4, borderWidth: 1, borderColor: colors.border,
    borderRadius: 3, paddingHorizontal: 4, paddingVertical: 2, alignSelf: 'flex-start',
  },
  approvalBtnText: { fontSize: 8, color: colors.textTertiary },

  emptyCell: {
    flex: 1, minHeight: 74, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.border, borderStyle: 'dashed',
  },
  emptyCellPlus: { fontSize: 16, color: colors.border },
  hedCell: {
    flex: 1, minHeight: 74, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.sm, backgroundColor: colors.amberLight,
  },
  hedLabel: { fontSize: 11, ...font.bold, color: colors.amber, letterSpacing: 0.8 },

  // Edit modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  approveSubOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  approveSubCard: {
    backgroundColor: colors.bg, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, width: '100%', maxWidth: 400,
  },
  autoAssignBtn: {
    backgroundColor: colors.primary + '22', borderWidth: 1, borderColor: colors.primary,
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  autoAssignBtnText: { fontSize: 13, ...font.bold, color: colors.primary },
  resetBtn: {
    borderWidth: 1, borderColor: colors.red, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8,
  },
  resetBtnText: { fontSize: 11, ...font.bold, color: colors.red },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: colors.border,
    maxHeight: '85%', paddingHorizontal: spacing.lg, paddingTop: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  modalTitle: { fontSize: 17, ...font.bold, color: colors.textPrimary },
  modalSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  modalCloseText: { fontSize: 14, color: colors.textSecondary },

  changeTypeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  changeTypeBtn: {
    flex: 1, paddingVertical: 8, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.card,
  },
  changeTypeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  changeTypeBtnText: { fontSize: 12, ...font.medium, color: colors.textSecondary },
  changeTypeBtnTextActive: { color: '#fff', ...font.semibold },

  fieldLabel: {
    fontSize: 10, ...font.bold, color: colors.textTertiary, letterSpacing: 0.6,
    marginBottom: 6, marginTop: spacing.sm,
  },
  fieldInput: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10,
    fontSize: 13, color: colors.textPrimary, marginBottom: 2, outlineWidth: 0,
  },

  acDropdown: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  acItem: {
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  acItemText: { fontSize: 13, color: colors.textPrimary },

  conflictBox: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)', borderWidth: 1, borderColor: colors.red,
    borderRadius: radius.md, padding: spacing.sm, marginVertical: spacing.sm,
  },
  conflictText: { fontSize: 12, color: colors.red, marginBottom: 3, lineHeight: 16 },

  suggestBtn: {
    backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center',
    marginVertical: spacing.sm,
  },
  suggestBtnText: { fontSize: 13, ...font.semibold, color: colors.primary },

  suggestList: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, marginBottom: spacing.sm, overflow: 'hidden',
  },
  suggestListLabel: {
    fontSize: 9, ...font.bold, color: colors.textTertiary, letterSpacing: 0.6,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 4,
  },
  suggestItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  suggestItemText: { flex: 1, fontSize: 13, color: colors.textPrimary },
  familiarBadge: {
    backgroundColor: colors.greenLight, borderRadius: radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  familiarBadgeText: { fontSize: 9, color: colors.green, ...font.semibold },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginVertical: spacing.sm,
  },

  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 14, ...font.bold, color: '#fff' },

  submittingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  submittingText: { fontSize: 13, color: '#fff', ...font.medium },

  // ── Today tab styles ───────────────────────────────────────────────────────

  sundayBanner: {
    backgroundColor: colors.amberLight,
    borderBottomWidth: 1, borderBottomColor: colors.amber,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  sundayBannerText: {
    fontSize: 13, ...font.medium, color: colors.amber,
  },

  daySelectorRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  dayPill: {
    flex: 1, alignItems: 'center', paddingVertical: 6,
    marginHorizontal: 2, borderRadius: radius.md,
    backgroundColor: 'transparent',
  },
  dayPillActive: {
    backgroundColor: colors.primary,
  },
  dayPillText: {
    fontSize: 11, ...font.bold, color: colors.textTertiary, letterSpacing: 0.5,
  },
  dayPillTextActive: {
    color: '#fff',
  },
  dayPillDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: colors.primary, marginTop: 2,
  },

  todayEmptyWrap: {
    alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl, marginTop: 60,
  },
  todayEmptyText: {
    fontSize: 15, color: colors.textTertiary, textAlign: 'center',
  },
  todaySection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  todaySectionTitle: {
    fontSize: 12, ...font.bold, color: colors.textTertiary, letterSpacing: 0.8,
  },
  todaySectionSub: {
    fontSize: 11, color: colors.textTertiary, marginTop: 2,
  },

  facultyCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  facultyCardAbsent: {
    backgroundColor: 'rgba(248, 113, 113, 0.06)',
    borderColor: colors.red,
  },
  facultyCardLeft: { flex: 1 },
  facultyCardName: { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  facultyCardNameAbsent: { color: colors.red },
  facultyCardCount: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  facultyCardCountAbsent: { color: 'rgba(248, 113, 113, 0.65)' },

  absentBadge: {
    backgroundColor: colors.redLight, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.red,
  },
  absentBadgeText: { fontSize: 10, ...font.bold, color: colors.red, letterSpacing: 0.6 },
  presentBadge: {
    backgroundColor: colors.greenLight, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  presentBadgeText: { fontSize: 10, ...font.medium, color: colors.green },

  generateBtn: {
    margin: spacing.md,
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  generateBtnText: { fontSize: 14, ...font.bold, color: '#fff' },

  // Revised view
  revisedHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg, paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  revisedHeaderTitle: { fontSize: 15, ...font.bold, color: colors.textPrimary },
  revisedHeaderSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  revisedBackBtn: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
  },
  revisedBackBtnText: { fontSize: 12, color: colors.textSecondary, ...font.medium },

  revisedClassCard: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    marginHorizontal: spacing.md, marginBottom: spacing.md,
    overflow: 'hidden',
  },
  revisedClassName: {
    fontSize: 13, ...font.bold, color: colors.textPrimary,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.cardElevated,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  revisedPeriodRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  revisedPeriodLabel: {
    width: 52, alignItems: 'center', paddingTop: 2, paddingHorizontal: 4,
    borderRightWidth: 1, borderRightColor: colors.border,
  },
  revisedPeriodName: { fontSize: 11, ...font.bold, color: colors.textPrimary },
  revisedPeriodTime: { fontSize: 9, color: colors.textTertiary, marginTop: 1 },
  revisedPeriodContent: { flex: 1, paddingHorizontal: spacing.sm },
  revisedCourse: { fontSize: 12, ...font.semibold, color: colors.textPrimary },
  revisedCourseAbsent: { color: colors.red },
  revisedFaculty: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  revisedFacultyAbsent: { color: colors.red, textDecorationLine: 'line-through' },

  cancelledBanner: {
    marginTop: 6, alignSelf: 'flex-start',
    backgroundColor: colors.redLight,
    borderWidth: 1, borderColor: colors.red,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  cancelledBannerText: { fontSize: 10, ...font.bold, color: colors.red, letterSpacing: 0.4 },

  subSuggestions: { marginTop: spacing.sm, gap: 4 },
  subCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.cardElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 7,
  },
  subCardName: { flex: 1, fontSize: 12, ...font.medium, color: colors.textPrimary },
  rankBadge: {
    backgroundColor: colors.primaryLight, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  rankBest: { backgroundColor: colors.greenLight },
  rankSubject: { backgroundColor: colors.amberLight },
  rankBadgeText: { fontSize: 8, ...font.bold, color: colors.primary, letterSpacing: 0.4 },
  rankBestText: { color: colors.green },
  rankSubjectText: { color: colors.amber },

  selectedSubCard: {
    backgroundColor: colors.greenLight,
    borderWidth: 1, borderColor: colors.greenBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 7,
  },
  selectedSubName: { fontSize: 12, ...font.semibold, color: colors.green },
  selectedSubTap: { fontSize: 9, color: colors.green, opacity: 0.7, marginTop: 1 },
  noSubsText: { fontSize: 11, color: colors.textTertiary, paddingVertical: 4 },

  publishBtn: {
    margin: spacing.md,
    backgroundColor: colors.green, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  publishBtnDisabled: { opacity: 0.6 },
  publishBtnText: { fontSize: 14, ...font.bold, color: '#fff' },

  // Test-as strip (Admin only)
  testStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: 7,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderBottomWidth: 1, borderBottomColor: colors.amber,
  },
  testStripLabel: { fontSize: 9, ...font.bold, color: colors.amber, letterSpacing: 0.6 },
  testStripBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.amberLight, borderWidth: 1, borderColor: colors.amber,
    borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4,
  },
  testStripBtnText: { flex: 1, fontSize: 11, ...font.semibold, color: colors.amber },
  testStripArrow: { fontSize: 9, color: colors.amber },
  testStripReset: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.amber, borderRadius: radius.sm,
  },
  testStripResetText: { fontSize: 10, ...font.semibold, color: colors.amber },
  testDropdown: {
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border,
  },
  testDropItem: {
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  testDropItemActive: { backgroundColor: colors.primaryLight },
  testDropItemText: { fontSize: 13, color: colors.textPrimary },
  testDropItemTextActive: { color: colors.primary, ...font.semibold },

  // "Request Sub" label on grid slot
  subReqBtn: {
    marginTop: 4, borderWidth: 1, borderColor: colors.primary,
    borderRadius: 3, paddingHorizontal: 4, paddingVertical: 2, alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
  },
  subReqBtnText: { fontSize: 8, ...font.semibold, color: colors.primary },

  // Substitute request cards in Today tab
  subReqCard: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    padding: spacing.md,
  },
  subReqCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6,
  },
  subReqTeacher: { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  subReqPendingBadge: {
    backgroundColor: colors.amberLight, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.amber,
  },
  subReqPendingText: { fontSize: 9, ...font.bold, color: colors.amber, letterSpacing: 0.5 },
  subReqSlotInfo: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  subReqReason: { fontSize: 12, color: colors.textPrimary, marginBottom: 8, fontStyle: 'italic' },
  subReqPref: { fontSize: 11, color: colors.textTertiary, marginBottom: 8 },
  subReqSlotRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 8, marginTop: 4, marginBottom: 4,
  },
  subAssignInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6,
    fontSize: 12, color: colors.textPrimary, marginTop: 4,
  },
  subAssignAC: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 99,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, overflow: 'hidden',
  },
  subAssignACItem: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  subAssignACText: { fontSize: 12, color: colors.textPrimary },
  subSuggestMini: {
    marginTop: 28, padding: 8, backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
  },
  subSuggestMiniText: { fontSize: 14 },
  subReqActions: { flexDirection: 'row', gap: spacing.sm, marginTop: 10 },
  subReqApproveBtn: {
    flex: 1, backgroundColor: colors.green, borderRadius: radius.sm,
    paddingVertical: 8, alignItems: 'center',
  },
  subReqApproveBtnText: { fontSize: 12, ...font.bold, color: '#fff' },
  subReqRejectBtn: {
    flex: 1, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.red,
    borderRadius: radius.sm, paddingVertical: 8, alignItems: 'center',
  },
  subReqRejectBtnText: { fontSize: 12, ...font.bold, color: colors.red },

  // WhatsApp modal
  waClassBlock: { marginBottom: spacing.md },
  waClassHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.xs,
  },
  waClassName: { fontSize: 14, ...font.bold, color: colors.textPrimary },
  waCopyBtn: {
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 6,
  },
  waCopyBtnText: { fontSize: 12, ...font.semibold, color: '#fff' },
  waTextBox: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, padding: spacing.sm,
  },
  waText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

  // Compensatory requests
  swapToggleBtn: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4, marginLeft: 6,
  },
  swapToggleBtnActive: { backgroundColor: colors.primary },
  swapToggleBtnText: { fontSize: 14, color: colors.primary, ...font.bold },
  swapToggleBtnTextActive: { color: '#fff' },

  swapHintBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary + '18', borderBottomWidth: 1, borderBottomColor: colors.primary + '33',
    paddingHorizontal: spacing.md, paddingVertical: 7,
  },
  swapHintText: { fontSize: 11, color: colors.primary, ...font.medium, flex: 1, marginRight: 8 },
  swapHintCancel: { fontSize: 14, color: colors.primary, ...font.bold, padding: 4 },

  slotSwapSelected: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primary + '18' },

  swapModalRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md,
  },
  swapModalLabel: { fontSize: 10, color: colors.textTertiary, ...font.bold, letterSpacing: 0.5, marginBottom: 4 },
  swapModalCourse: { fontSize: 13, color: colors.textPrimary, ...font.semibold },
  swapModalFaculty: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  swapArrow: { fontSize: 20, color: colors.primary, alignSelf: 'center', ...font.bold },

  availEditorBtn: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 9, alignItems: 'center',
    backgroundColor: colors.primary + '12',
  },
  availEditorBtnText: { fontSize: 13, ...font.semibold, color: colors.primary },

  availForm: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
    marginBottom: spacing.md,
  },
  availAddBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.md, backgroundColor: colors.primary,
  },
  availAddBtnText: { fontSize: 12, ...font.bold, color: '#fff' },

  availRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  availRowName: { fontSize: 13, ...font.semibold, color: colors.textPrimary },
  availRowMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  availOverrideBadge: {
    backgroundColor: colors.primary + '22', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  availOverrideBadgeText: { fontSize: 9, ...font.bold, color: colors.primary, letterSpacing: 0.5 },
  availEditBtn: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  availEditBtnText: { fontSize: 11, ...font.semibold, color: colors.primary },
  availDeleteBtn: {
    borderWidth: 1, borderColor: colors.red, borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  availDeleteBtnText: { fontSize: 11, ...font.bold, color: colors.red },

  absentTodayBtn: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: '#EF444420',
    borderWidth: 1, borderColor: '#EF4444',
    borderRadius: radius.md,
    paddingVertical: 12, alignItems: 'center',
  },
  absentTodayBtnText: { fontSize: 14, ...font.semibold, color: '#EF4444' },

  compSlotOption: {
    backgroundColor: colors.primary + '22',
    borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  compSlotOptionText: { fontSize: 12, ...font.semibold, color: colors.primary },

  resolveManualBtn: {
    flex: 1,
    borderWidth: 1, borderColor: colors.amber, borderRadius: radius.md,
    paddingVertical: 8, alignItems: 'center',
  },
  resolveManualBtnText: { fontSize: 13, ...font.semibold, color: colors.amber },

  resolvePickerPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  resolvePickerPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  resolvePickerPillText: { fontSize: 12, color: colors.textSecondary, ...font.medium },
  resolvePickerPillTextActive: { color: '#fff', ...font.bold },

  subjectSuggestionPill: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md,
    backgroundColor: colors.primary + '18', borderWidth: 1, borderColor: colors.primary + '44',
  },
  subjectSuggestionText: { fontSize: 11, color: colors.primary, ...font.medium },

  compUnresolvedCard: {
    backgroundColor: 'rgba(251,191,36,0.04)',
    borderColor: colors.amber,
  },
  compUnresolvedBadge: {
    backgroundColor: colors.amberLight, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.amber,
  },
  compUnresolvedBadgeText: { fontSize: 9, ...font.bold, color: colors.amber, letterSpacing: 0.5 },

  // ── Timetable Assistant ──────────────────────────────────────────────────
  assistantToggleBtn: {
    marginLeft: 4, marginRight: 4,
    backgroundColor: colors.cardElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 9, paddingVertical: 6,
  },
  assistantToggleBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  assistantToggleBtnText: { fontSize: 14 },
  assistantComingSoonBtn: {
    marginLeft: 4, marginRight: 4,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 9, paddingVertical: 6,
    opacity: 0.5,
  },
  assistantComingSoonText: { fontSize: 11, color: colors.textTertiary, ...font.medium },

  assistantPanel: {
    flex: 4,
    borderLeftWidth: 1, borderLeftColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'column',
  },
  assistantHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.cardElevated,
  },
  assistantTitle: { fontSize: 13, ...font.bold, color: colors.textPrimary },
  assistantCloseText: { fontSize: 11, color: colors.textSecondary, ...font.semibold },

  assistantModeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  assistantModeBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  assistantModeBtnActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  assistantModeBtnText: { fontSize: 11, ...font.semibold, color: colors.textSecondary },
  assistantModeBtnTextActive: { color: colors.primary },
  assistantClearBtn: { padding: 6 },
  assistantClearText: { fontSize: 14 },

  // ── Timetable preview card ───────────────────────────────────────────────
  previewCard: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: 8,
    alignSelf: 'stretch',
  },
  previewSummary: {
    fontSize: 11, ...font.bold, color: colors.textPrimary,
    marginBottom: 4,
  },
  previewAssistantMsg: {
    fontSize: 11, color: colors.textSecondary, lineHeight: 15,
    marginBottom: spacing.sm,
  },
  previewClassBlock: {
    marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, overflow: 'hidden',
  },
  previewClassName: {
    fontSize: 10, ...font.bold, color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8, paddingVertical: 4,
    letterSpacing: 0.4,
  },
  previewRow: { flexDirection: 'row' },
  previewCornerCell: { width: 28, borderRightWidth: 1, borderRightColor: colors.border },
  previewDayHeader: {
    width: 64, borderRightWidth: 1, borderRightColor: colors.border,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    alignItems: 'center', paddingVertical: 4,
    backgroundColor: colors.card,
  },
  previewDayHeaderText: { fontSize: 9, ...font.bold, color: colors.textSecondary },
  previewPeriodLabel: {
    width: 28,
    borderRightWidth: 1, borderRightColor: colors.border,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card,
  },
  previewPeriodLabelText: { fontSize: 9, ...font.bold, color: colors.textTertiary },
  previewCell: {
    width: 64, minHeight: 40,
    borderRightWidth: 1, borderRightColor: colors.border,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    padding: 3, justifyContent: 'center',
  },
  previewCellEmpty: { backgroundColor: colors.bg },
  previewCellHed: { backgroundColor: 'rgba(251,191,36,0.12)' },
  previewHedText: { fontSize: 9, ...font.bold, color: colors.amber, textAlign: 'center' },
  previewCourse: { fontSize: 9, ...font.semibold, color: colors.textPrimary, lineHeight: 12 },
  previewFaculty: { fontSize: 8, color: colors.textTertiary, lineHeight: 11, marginTop: 1 },
  previewDash: { fontSize: 11, color: colors.textTertiary, textAlign: 'center' },
  previewChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  previewChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.primary,
  },
  previewChipText: { fontSize: 10, ...font.semibold, color: colors.primary },
  previewApplyBtn: {
    backgroundColor: '#10B981',
    borderRadius: radius.sm,
    paddingVertical: 9, alignItems: 'center',
    marginTop: spacing.sm,
  },
  previewApplyBtnText: { fontSize: 12, color: '#fff', ...font.bold },

  chatScroll: { flex: 1 },
  chatWelcome: {
    fontSize: 12, color: colors.textSecondary, lineHeight: 18,
    padding: spacing.sm,
    backgroundColor: colors.cardElevated,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  chatBubble: {
    maxWidth: '88%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: 8,
    marginBottom: 6,
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  chatBubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardElevated,
    borderWidth: 1, borderColor: colors.border,
  },
  chatBubbleText: { fontSize: 12, lineHeight: 17 },
  chatBubbleTextUser: { color: '#fff', ...font.medium },
  chatBubbleTextAssistant: { color: colors.textPrimary },

  chatUploadBtn: {
    margin: spacing.sm,
    borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: 10, alignItems: 'center',
  },
  chatUploadBtnText: { fontSize: 12, color: colors.primary, ...font.semibold },

  chatInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  chatInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: 8,
    fontSize: 12, color: colors.textPrimary,
  },
  chatSendBtn: {
    width: 34, height: 34,
    backgroundColor: colors.primary,
    borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  chatSendBtnText: { fontSize: 16, color: '#fff', ...font.bold },
});
