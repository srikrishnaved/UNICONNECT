import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, ActivityIndicator, Platform, KeyboardAvoidingView, Clipboard, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius, font, avatarColor } from '../theme';
import { EmptyState } from '../components/EmptyState';
import { SquareCheck } from 'lucide-react-native';

// ── Period definitions ─────────────────────────────────────────────────────────
const PERIODS = [
  { id: 'M1', label: 'M1', time: '7:30 – 8:23 AM' },
  { id: 'M2', label: 'M2', time: '8:30 – 9:23 AM' },
  { id: 'M',  label: 'M',  time: '9:00 – 9:53 AM' },
  { id: 'P1', label: 'P1', time: '10:00 – 10:53 AM' },
  { id: 'P2', label: 'P2', time: '11:00 – 11:53 AM' },
  { id: 'P3', label: 'P3', time: '12:00 – 12:53 PM' },
  { id: 'P4', label: 'P4', time: '1:00 – 1:53 PM' },
  { id: 'P5', label: 'P5', time: '2:00 – 2:53 PM' },
  { id: 'P6', label: 'P6', time: '3:00 – 3:53 PM' },
];

// ── Registration number prefixes per class ─────────────────────────────────────
// These are fallbacks only — the primary path derives prefix from CLASS_REG_BASES
// (section-aware). F&A values updated: 3rd year section A = 24146, B = 24145.
const REG_PREFIXES = {
  'BCom IAF': { '1st Year': '26223', '2nd Year': '25223', '3rd Year': '24223' },
  'BCom IBA': { '1st Year': '26224', '2nd Year': '25224', '3rd Year': '24224' },
  'BCom F&A': { '1st Year': '26146', '2nd Year': '25146', '3rd Year': '24146' },
};

// ── Quick action templates ─────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  {
    id: 'email_teacher',
    label: 'Email Teacher',
    desc: 'Professional & warm',
    emoji: '✉️',
    color: '#3B82F6',
    template: (name, course) =>
`Subject: [Query] ${course} — Class Request

Dear [Teacher's Name],

I hope you're doing well. My name is ${name}, and I'm the Class Representative for ${course}.

I'm writing on behalf of the class regarding [your topic here].

[Describe the request or concern clearly in 2–3 sentences.]

We would greatly appreciate your guidance on this matter at your earliest convenience.

Thank you for your time and support.

Warm regards,
${name}
Class Representative — ${course}
Christ University, Yeshwanthpur`,
  },
  {
    id: 'class_announcement',
    label: 'Class Announcement',
    desc: 'WhatsApp-ready',
    emoji: '📣',
    color: '#059669',
    template: (name, course) =>
`📢 *CLASS ANNOUNCEMENT*

Dear ${course},

[Your announcement here.]

📅 [Date / deadline if applicable]
📍 [Venue / platform if applicable]

Please acknowledge once read.

— ${name}
Class Representative`,
  },
  {
    id: 'escalate',
    label: 'Escalate Complaint',
    desc: 'Formal escalation',
    emoji: '⚠️',
    color: '#DC2626',
    template: (name, course) =>
`Subject: Formal Student Concern — ${course}

Dear [Faculty / HOD Name],

I am writing as the Class Representative of ${course} to formally bring to your attention a concern raised by the class.

*Issue:*
[Describe the issue clearly and factually.]

*Impact on students:*
[Explain how it affects the batch.]

We respectfully request that this matter be addressed at the earliest. We remain open to a discussion at your convenience.

Thank you for your time.

Regards,
${name}
Class Representative — ${course}`,
  },
  {
    id: 'minutes',
    label: 'Meeting Minutes',
    desc: 'Structured notes',
    emoji: '📋',
    color: '#D97706',
    template: (name, course) =>
`*MEETING MINUTES*
━━━━━━━━━━━━━━━━━━━━
📅 Date: [Date]
🕐 Time: [Start] – [End]
📍 Venue: [Location]
👥 Present: [Names / count]
━━━━━━━━━━━━━━━━━━━━

*Agenda Items Discussed:*
1. [Topic 1]
   → [Decision / Action]

2. [Topic 2]
   → [Decision / Action]

3. [Topic 3]
   → [Decision / Action]

*Action Items:*
□ [Task] — Responsible: [Name] — By: [Date]
□ [Task] — Responsible: [Name] — By: [Date]

*Next meeting:* [Date / TBD]

— Recorded by ${name}, CR, ${course}`,
  },
];

// ── Email templates ───────────────────────────────────────────────────────────
const EMAIL_TEMPLATES = [
  {
    id: 'deadline_ext',
    label: 'Assignment deadline extension',
    emoji: '🕐',
    template: (name, course) =>
`Subject: Request for Assignment Deadline Extension — ${course}

Dear [Teacher's Name],

I am ${name}, Class Representative of ${course}. On behalf of the class, I would like to request a short extension for the [Assignment Name] submission.

Several students are facing difficulty completing the assignment by [current deadline] due to [brief reason — e.g. clashing submissions, exam preparation].

We would be grateful if the deadline could be extended to [proposed date]. We understand your time and assure you that submissions will be of quality.

Thank you for your understanding.

Regards,
${name}
CR — ${course}`,
  },
  {
    id: 'schedule_change',
    label: 'Class schedule change',
    emoji: '📅',
    template: (name, course) =>
`Subject: Notification — Class Schedule Change, ${course}

Dear Students,

Please note that there is a change in our class schedule for [Subject]:

📅 Original slot: [Day, Time]
🔁 New slot: [Day, Time]
📍 Venue: [Room]

Please plan accordingly. Apologies for any inconvenience caused.

— ${name}, CR, ${course}`,
  },
  {
    id: 'exam_query',
    label: 'Exam-related query',
    emoji: '📝',
    template: (name, course) =>
`Subject: Exam Query — ${course}

Dear [Teacher's Name],

I am ${name}, CR of ${course}. The class has the following query regarding the upcoming [Exam Name]:

• [Question 1 — e.g. syllabus coverage]
• [Question 2 — e.g. format / marks]
• [Question 3 — e.g. reference materials allowed]

Could you please clarify these at your earliest convenience? It would help the class prepare better.

Thank you,
${name}
CR — ${course}`,
  },
  {
    id: 'feedback',
    label: 'Student feedback to faculty',
    emoji: '💬',
    template: (name, course) =>
`Subject: Student Feedback — ${course}

Dear [Teacher's Name],

As CR of ${course}, I'm sharing consolidated feedback from the class regarding [Subject / Topic]:

*Positive feedback:*
— [What students appreciated]

*Areas where support is needed:*
— [What the class would like more of]
— [Specific requests, if any]

We hope this is helpful for future sessions. Thank you for your continued dedication.

Regards,
${name}, CR — ${course}`,
  },
  {
    id: 'event',
    label: 'Event / activity announcement',
    emoji: '⭐',
    template: (name, course) =>
`📣 *EVENT ANNOUNCEMENT*

Dear ${course},

We're excited to invite you to:

🎉 *[Event Name]*
📅 Date: [Date]
🕐 Time: [Time]
📍 Venue: [Location]

[Brief description of the event — 2 lines]

[Mandatory / Optional] attendance. Please register at [link / form] by [deadline].

For queries, reach out to me.

— ${name}, CR — ${course}`,
  },
  {
    id: 'study_group',
    label: 'Study group coordination',
    emoji: '👥',
    template: (name, course) =>
`📚 *STUDY GROUP — ${course}*

Hi everyone,

We're organising a study group for [Subject / Topic]:

🗓 Date: [Date]
🕐 Time: [Time]
📍 Venue: [Location / Online link]

Topics to cover:
• [Topic 1]
• [Topic 2]

Limited spots — please confirm by [date].

— ${name}, CR`,
  },
];

// ── WhatsApp announcements ────────────────────────────────────────────────────
const WA_TEMPLATES = [
  {
    id: 'test_reminder',
    label: 'Upcoming test / exam reminder',
    emoji: '📝',
    template: (name, course) =>
`📝 *TEST REMINDER — ${course}*

📅 Date: [Date]
🕐 Time: [Time]
📚 Subject: [Subject]

Topics: [List main topics]

All the best! Study smart 💪

— ${name}, CR`,
  },
  {
    id: 'class_cancelled',
    label: 'Class cancelled / rescheduled',
    emoji: '📵',
    template: (name, course) =>
`📵 *CLASS UPDATE — ${course}*

[Subject] class on [Day, Date] has been *[cancelled / rescheduled]*.

[If rescheduled → New time: [Day, Date, Time, Room]]

Reason: [Brief reason if shared by faculty]

— ${name}, CR`,
  },
  {
    id: 'deadline',
    label: 'Deadline reminder',
    emoji: '⏰',
    template: (name, course) =>
`⏰ *DEADLINE REMINDER — ${course}*

📌 [Assignment / Project Name]
📅 Due: [Date & Time]
📤 Submission: [Portal / email / in-person]

Don't leave it last minute! Reach out if you need help.

— ${name}, CR`,
  },
  {
    id: 'event_wa',
    label: 'Event / activity',
    emoji: '🎉',
    template: (name, course) =>
`🎉 *[EVENT NAME] — ${course}*

📅 [Date]
🕐 [Time]
📍 [Venue]

[1-line description]

[Register here / confirm attendance by: [date]]

— ${name}, CR`,
  },
  {
    id: 'general',
    label: 'General class update',
    emoji: '🔔',
    template: (name, course) =>
`🔔 *CLASS UPDATE — ${course}*

[Your update here — keep it short and clear.]

[Action required / FYI]

— ${name}, CR`,
  },
];

// ── Register-number bases per class (full reg = base + roll_number) ───────────
const CLASS_REG_BASES = {
  '1BcomF&A':   2614600,
  '1BcomIAF':   2622400,
  '1BcomIBA':   2614500,
  '3BcomF&A A': 2514600,
  '3BcomF&A B': 2514600,
  '3BcomIAF':   2522400,
  '3BcomIBA':   2514500,
  '5BcomF&A A': 2414600,
  '5BcomF&A B': 2414500,
  '5BcomIAF':   2422300,
};

// ── Class-name mapping (course + year + section → cr_class_rolls.class_name[]) ─
// year prefix: 1st Year→1, 2nd Year→3, 3rd Year→5  (semester numbering)
// Returns array of class_name values to query, or null if not supported.
function getClassNames(course, year, section) {
  const prefix = { '1st Year': '1', '2nd Year': '3', '3rd Year': '5' }[year];
  const suffix = { 'BCom IAF': 'BcomIAF', 'BCom IBA': 'BcomIBA', 'BCom F&A': 'BcomF&A' }[course];
  if (!prefix || !suffix) return null;
  const base = `${prefix}${suffix}`;
  // F&A 2nd/3rd year has A and B sections — use profile.section when known
  if (suffix === 'BcomF&A' && (prefix === '3' || prefix === '5')) {
    if (section === 'A') return [`${base} A`];
    if (section === 'B') return [`${base} B`];
    return [`${base} A`, `${base} B`]; // fallback: both (section not set)
  }
  return [base];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(val) {
  if (!val) return '';
  const [y, m, d] = val.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function copyToClipboard(text) {
  if (Platform.OS === 'web') {
    try { navigator.clipboard.writeText(text); } catch { /* fallback */ }
  } else {
    Clipboard.setString(text);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CRDashboardScreen({ onClose }) {
  const { userProfile, resignCR } = useApp();
  const name    = userProfile?.name    || 'CR';
  const course  = userProfile?.course  || 'BCom IAF';
  const year    = userProfile?.year    || '3rd Year';
  const section = userProfile?.section || null;
  // Derive prefix from CLASS_REG_BASES (section-aware) — fallback to REG_PREFIXES
  const _classKey   = getClassNames(course, year, section)?.[0];
  const _regBase    = _classKey ? CLASS_REG_BASES[_classKey] : null;
  const regPrefix   = _regBase
    ? String(_regBase).slice(0, -2)
    : (REG_PREFIXES[course]?.[year] || '24223');
  const av     = avatarColor(name);

  const [activeTab, setActiveTab] = useState('overview');
  const [resignLoading, setResignLoading] = useState(false);

  const handleResign = () => {
    Alert.alert(
      'Resign as CR?',
      'This will remove your Class Representative role. You can re-apply later if needed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resign',
          style: 'destructive',
          onPress: async () => {
            setResignLoading(true);
            try {
              await resignCR();
              onClose();
            } catch (e) {
              Alert.alert('Error', e.message || 'Could not resign. Please try again.');
            } finally {
              setResignLoading(false);
            }
          },
        },
      ]
    );
  };

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState([]);
  const [taskInput, setTaskInput] = useState('');
  const [taskPriority, setTaskPriority] = useState('med');
  const [addingTask, setAddingTask] = useState(false);

  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from('cr_tasks')
      .select('*')
      .eq('user_id', userProfile.id)
      .order('created_at', { ascending: false });
    if (data) setTasks(data);
  }, [userProfile?.id]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const addTask = async () => {
    if (!taskInput.trim()) return;
    setAddingTask(true);
    const { data, error } = await supabase.from('cr_tasks').insert({
      user_id: userProfile.id,
      text: taskInput.trim(),
      priority: taskPriority,
      done: false,
    }).select().single();
    if (!error && data) setTasks(prev => [data, ...prev]);
    setTaskInput('');
    setTaskPriority('med');
    setAddingTask(false);
  };

  const toggleTask = async (task) => {
    const newDone = !task.done;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: newDone } : t));
    await supabase.from('cr_tasks').update({ done: newDone }).eq('id', task.id);
  };

  const deleteTask = async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from('cr_tasks').delete().eq('id', id);
  };

  const pendingCount = tasks.filter(t => !t.done).length;
  const doneCount    = tasks.filter(t => t.done).length;

  // ── Template modal ─────────────────────────────────────────────────────────
  const [templateModal, setTemplateModal] = useState(null); // { title, text }
  const [templateText, setTemplateText] = useState('');
  const [copied, setCopied] = useState(false);

  const openTemplate = (title, templateFn) => {
    const text = templateFn(name, course);
    setTemplateText(text);
    setTemplateModal(title);
    setCopied(false);
  };

  const handleCopy = () => {
    copyToClipboard(templateText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Attendance ─────────────────────────────────────────────────────────────
  const [attDate, setAttDate] = useState(todayISO());
  const [selPeriod, setSelPeriod] = useState(null);
  const [customPeriods, setCustomPeriods] = useState([]);
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [newPeriodLabel, setNewPeriodLabel] = useState('');
  const [newPeriodTime, setNewPeriodTime] = useState('');
  const allPeriods = [...PERIODS, ...customPeriods];
  const [attLogs, setAttLogs] = useState([]);
  const [expandedLog, setExpandedLog] = useState(null);

  // ── Take Attendance (checklist) mode ────────────────────────────────────────
  const [takeAttMode, setTakeAttMode] = useState(false);
  const [classRolls, setClassRolls] = useState([]);
  const [rollsLoading, setRollsLoading] = useState(false);
  const [checkedRolls, setCheckedRolls] = useState(new Set()); // Set of row UUIDs
  const multiSection = classRolls.length > 1 &&
    classRolls.some(r => r.class_name !== classRolls[0].class_name);

  const loadAttLogs = useCallback(async () => {
    const { data } = await supabase
      .from('cr_attendance_logs')
      .select('*')
      .eq('user_id', userProfile.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setAttLogs(data);
  }, [userProfile?.id]);

  useEffect(() => { loadAttLogs(); }, [loadAttLogs]);

  const clearAttLogs = () => {
    const doDelete = async () => {
      await supabase.from('cr_attendance_logs').delete().eq('user_id', userProfile.id);
      setAttLogs([]);
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Clear all session logs?')) doDelete();
    } else {
      Alert.alert('Clear Logs', 'Clear all session logs?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const deleteAttLog = (log) => {
    const doDelete = async () => {
      await supabase.from('cr_attendance_logs').delete().eq('id', log.id);
      setAttLogs(prev => prev.filter(l => l.id !== log.id));
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete the ${log.period} log for ${log.date}?`)) doDelete();
    } else {
      Alert.alert('Delete Log', `Delete the ${log.period} log for ${log.date}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // ── Take Attendance handlers ───────────────────────────────────────────────
  const handleTakeAttendance = async () => {
    const classNames = getClassNames(course, year, userProfile?.section || null);
    if (!classNames) {
      Alert.alert('Not available', 'No roll list is set up for your class yet. Use the manual form below.');
      return;
    }
    setTakeAttMode(true);
    setCheckedRolls(new Set());
    setRollsLoading(true);
    const { data } = await supabase
      .from('cr_class_rolls')
      .select('id, roll_number, class_name')
      .in('class_name', classNames)
      .order('class_name', { ascending: true })
      .order('roll_number', { ascending: true });
    setClassRolls(data || []);
    setRollsLoading(false);
  };

  const toggleCheckedRoll = (id) => {
    setCheckedRolls(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDeleteRoll = async (roll) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Permanently remove Roll No. ${roll.roll_number} from ${roll.class_name}? This cannot be undone.`)
      : await new Promise(resolve =>
          Alert.alert(
            'Remove Roll Number',
            `Permanently remove Roll No. ${roll.roll_number} from ${roll.class_name}? This cannot be undone.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Remove', style: 'destructive', onPress: () => resolve(true) },
            ]
          )
        );
    if (!confirmed) return;
    await supabase.from('cr_class_rolls').delete().eq('id', roll.id);
    setClassRolls(prev => prev.filter(r => r.id !== roll.id));
    setCheckedRolls(prev => { const next = new Set(prev); next.delete(roll.id); return next; });
  };

  const generateFromChecklist = async () => {
    if (!attDate)   { Alert.alert('No date',    'Please select a date.');    return; }
    if (!selPeriod) { Alert.alert('No period',  'Please select a period.');  return; }
    const absentRows = classRolls.filter(r => checkedRolls.has(r.id));
    if (!absentRows.length) { Alert.alert('No absentees', 'No roll numbers are marked absent.'); return; }

    const absentNums = absentRows.map(r => r.roll_number);
    const regNos = absentRows.map(r => {
      const base = CLASS_REG_BASES[r.class_name];
      return base != null ? String(base + r.roll_number) : String(r.roll_number);
    });
    const dateStr = fmtDate(attDate);
    const period  = allPeriods.find(p => p.id === selPeriod);

    const msg = `📋 *Attendance Update*\n\n📅 Date: ${dateStr}\n🕐 ${period.id} (${period.time})\n\n❌ *Absentees (${absentNums.length}):*\n${regNos.join('\n')}\n\n— ${name}, Class Representative\n${course}`;

    setTemplateText(msg);
    setTemplateModal(`Attendance — ${period.id} · ${dateStr}`);
    setCopied(false);

    const { data } = await supabase.from('cr_attendance_logs').insert({
      user_id:       userProfile.id,
      date:          dateStr,
      period:        period.id,
      period_time:   period.time,
      absentee_count: absentNums.length,
      absentees:     regNos,
      message:       msg,
    }).select().single();
    if (data) setAttLogs(prev => [data, ...prev]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>📋 CR Dashboard</Text>
          <Text style={styles.headerSub}>{course} · Christ University, Yeshwanthpur</Text>
        </View>
        <View style={[styles.crBadge, { backgroundColor: av.bg }]}>
          <Text style={styles.crBadgeText}>CR</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {[
          { key: 'overview',    label: '🗂 Overview'   },
          { key: 'attendance',  label: '✅ Attendance' },
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ══ OVERVIEW TAB ══════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <>
            {/* Stats row */}
            <View style={styles.statsRow}>
              <StatCard label="Pending" value={pendingCount} color={colors.amber} />
              <StatCard label="Done" value={doneCount} color={colors.green} />
              <StatCard label="Templates" value={EMAIL_TEMPLATES.length} color={colors.primary} />
              <StatCard label="Actions" value={QUICK_ACTIONS.length} color={colors.textSecondary} />
            </View>

            {/* Quick actions + Email templates side by side (stacked on narrow) */}
            <View style={styles.grid2}>
              {/* Quick actions */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>QUICK ACTIONS</Text>
                <View style={styles.qaGrid}>
                  {QUICK_ACTIONS.map(qa => (
                    <TouchableOpacity
                      key={qa.id}
                      style={styles.qaBtn}
                      onPress={() => openTemplate(qa.label, qa.template)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.qaIcon, { backgroundColor: qa.color + '22' }]}>
                        <Text style={{ fontSize: 16 }}>{qa.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.qaLabel}>{qa.label}</Text>
                        <Text style={styles.qaDesc}>{qa.desc}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Email templates */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>EMAIL TEMPLATES</Text>
                {EMAIL_TEMPLATES.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.tmplRow}
                    onPress={() => openTemplate(t.label, t.template)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 16 }}>{t.emoji}</Text>
                    <Text style={styles.tmplName} numberOfLines={1}>{t.label}</Text>
                    <Text style={styles.tmplArrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Task tracker + WhatsApp announcements */}
            <View style={styles.grid2}>
              {/* Task tracker */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>TASK TRACKER</Text>
                {tasks.length === 0 ? (
                  <EmptyState icon={SquareCheck} heading="No tasks yet" subtext="Add your first task to get started" />
                ) : (
                  tasks.map(t => (
                    <View key={t.id} style={styles.taskRow}>
                      <TouchableOpacity onPress={() => toggleTask(t)} style={styles.taskCheck} activeOpacity={0.7}>
                        <View style={[styles.checkCircle, t.done && styles.checkCircleDone]}>
                          {t.done && <Text style={styles.checkMark}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                      <Text style={[styles.taskText, t.done && styles.taskTextDone]} numberOfLines={2}>{t.text}</Text>
                      <View style={[styles.priorityPill, t.priority === 'high' && styles.pHigh, t.priority === 'low' && styles.pLow]}>
                        <Text style={[styles.priorityText, t.priority === 'high' && styles.pHighText, t.priority === 'low' && styles.pLowText]}>
                          {t.priority}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => deleteTask(t.id)} style={styles.taskDelete} activeOpacity={0.7}>
                        <Text style={styles.taskDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                {/* Add task */}
                <View style={styles.addTaskRow}>
                  <TextInput
                    value={taskInput}
                    onChangeText={setTaskInput}
                    placeholder="Add a task…"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.taskInput}
                    onSubmitEditing={addTask}
                    returnKeyType="done"
                  />
                  <View style={styles.priorityPicker}>
                    {['high', 'med', 'low'].map(p => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.prioBtn, taskPriority === p && styles.prioBtnActive]}
                        onPress={() => setTaskPriority(p)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.prioBtnText, taskPriority === p && styles.prioBtnTextActive]}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity onPress={addTask} style={styles.addTaskBtn} disabled={addingTask} activeOpacity={0.8}>
                    {addingTask
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.addTaskBtnText}>+</Text>}
                  </TouchableOpacity>
                </View>
              </View>

              {/* WhatsApp announcements */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>WHATSAPP ANNOUNCEMENTS</Text>
                {WA_TEMPLATES.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.tmplRow}
                    onPress={() => openTemplate(t.label, t.template)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 16 }}>{t.emoji}</Text>
                    <Text style={styles.tmplName} numberOfLines={1}>{t.label}</Text>
                    <Text style={styles.tmplArrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Resign as CR */}
            <TouchableOpacity
              style={[styles.resignBtn, resignLoading && { opacity: 0.5 }]}
              onPress={handleResign}
              disabled={resignLoading}
              activeOpacity={0.8}
            >
              {resignLoading
                ? <ActivityIndicator size="small" color={colors.red} />
                : <Text style={styles.resignBtnText}>Resign as Class Representative</Text>
              }
            </TouchableOpacity>
          </>
        )}

        {/* ══ ATTENDANCE TAB ════════════════════════════════════════════════════ */}
        {activeTab === 'attendance' && (
          <>
            {/* ── Take Attendance CTA (primary) ─────────────────────────────── */}
            {!takeAttMode && (
              <TouchableOpacity style={styles.takeAttCard} onPress={handleTakeAttendance} activeOpacity={0.85}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.takeAttTitle}>📋 Take Attendance</Text>
                  <Text style={styles.takeAttSub}>Mark absentees from your class roll list</Text>
                </View>
                <Text style={styles.takeAttArrow}>›</Text>
              </TouchableOpacity>
            )}

            {/* ── Checklist mode ─────────────────────────────────────────────── */}
            {takeAttMode && (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>TAKE ATTENDANCE — {course} · {year}</Text>

                {/* Date */}
                <Text style={styles.fieldLabel}>DATE</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={attDate}
                    onChange={e => setAttDate(e.target.value)}
                    style={{
                      fontSize: 14, padding: '8px 10px',
                      border: `1px solid ${colors.border}`,
                      borderRadius: 8, backgroundColor: colors.bg,
                      color: colors.textPrimary, width: '100%',
                      marginBottom: 12, fontFamily: 'inherit',
                    }}
                  />
                ) : (
                  <TextInput
                    value={attDate}
                    onChangeText={setAttDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.rollInput, { marginBottom: spacing.md }]}
                  />
                )}

                {/* Period */}
                <Text style={styles.fieldLabel}>SELECT PERIOD</Text>
                <View style={styles.periodGrid}>
                  {allPeriods.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.periodBtn, selPeriod === p.id && styles.periodBtnActive]}
                      onPress={() => setSelPeriod(p.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.periodName, selPeriod === p.id && styles.periodNameActive]}>{p.label}</Text>
                      <Text style={[styles.periodTime, selPeriod === p.id && styles.periodTimeActive]}>{p.time}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.periodAddBtn}
                    onPress={() => setShowAddPeriod(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.periodAddText}>＋ Add</Text>
                  </TouchableOpacity>
                </View>

                {/* Custom period input */}
                {showAddPeriod && (
                  <View style={styles.addPeriodRow}>
                    <TextInput
                      value={newPeriodLabel}
                      onChangeText={setNewPeriodLabel}
                      placeholder="Label (e.g. P7)"
                      placeholderTextColor={colors.textTertiary}
                      style={[styles.rollInput, { flex: 1, marginBottom: 0 }]}
                    />
                    <TextInput
                      value={newPeriodTime}
                      onChangeText={setNewPeriodTime}
                      placeholder="Time (e.g. 4:30 – 5:23 PM)"
                      placeholderTextColor={colors.textTertiary}
                      style={[styles.rollInput, { flex: 2, marginBottom: 0 }]}
                    />
                    <TouchableOpacity
                      style={styles.addPeriodConfirm}
                      onPress={() => {
                        if (!newPeriodLabel.trim()) return;
                        const id = 'custom_' + Date.now();
                        setCustomPeriods(prev => [...prev, { id, label: newPeriodLabel.trim(), time: newPeriodTime.trim() }]);
                        setSelPeriod(id);
                        setNewPeriodLabel('');
                        setNewPeriodTime('');
                        setShowAddPeriod(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.addPeriodConfirmText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Roll checklist */}
                <Text style={styles.fieldLabel}>
                  {`MARK ABSENTEES${checkedRolls.size > 0 ? ` (${checkedRolls.size} absent)` : ''}`}
                </Text>
                {rollsLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
                ) : classRolls.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No rolls found for this class.</Text>
                  </View>
                ) : (
                  classRolls.map((roll, idx) => {
                    const showHeader = multiSection && (idx === 0 || classRolls[idx - 1].class_name !== roll.class_name);
                    const absent = checkedRolls.has(roll.id);
                    return (
                      <React.Fragment key={roll.id}>
                        {showHeader && (
                          <Text style={styles.rollSectionLabel}>{roll.class_name}</Text>
                        )}
                        <View style={[styles.rollRow, absent && styles.rollRowAbsent]}>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
                            onPress={() => toggleCheckedRoll(roll.id)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.rollCheckBox, absent && styles.rollCheckBoxOn]}>
                              {absent && <Text style={styles.rollCheckMark}>✓</Text>}
                            </View>
                            <Text style={[styles.rollNumText, absent && styles.rollNumAbsent]}>
                              Roll {roll.roll_number}
                            </Text>
                            {absent && <Text style={styles.absentPill}>Absent</Text>}
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteRoll(roll)} style={styles.rollDeleteBtn} activeOpacity={0.7}>
                            <Text style={styles.rollDeleteText}>🗑</Text>
                          </TouchableOpacity>
                        </View>
                      </React.Fragment>
                    );
                  })
                )}

                <View style={[styles.btnRow, { marginTop: spacing.md }]}>
                  <TouchableOpacity style={styles.generateBtn} onPress={generateFromChecklist} activeOpacity={0.85}>
                    <Text style={styles.generateBtnText}>Generate Message</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={() => { setTakeAttMode(false); setCheckedRolls(new Set()); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.clearBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Session log */}
            <View style={styles.card}>
              <View style={styles.logHeader}>
                <Text style={styles.cardLabel}>SESSION LOG ({attLogs.length})</Text>
                {attLogs.length > 0 && (
                  <TouchableOpacity onPress={clearAttLogs} activeOpacity={0.7}>
                    <Text style={styles.clearLogBtn}>Clear all</Text>
                  </TouchableOpacity>
                )}
              </View>
              {attLogs.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No sessions recorded yet</Text>
                </View>
              ) : (
                attLogs.map((log, i) => (
                  <View key={log.id ?? i} style={styles.logItem}>
                    <View style={styles.logItemHead}>
                      <Text style={styles.logItemTitle}>{log.period} — {log.date}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={styles.absentBadge}>
                          <Text style={styles.absentBadgeText}>{log.absentee_count} absent</Text>
                        </View>
                        <TouchableOpacity onPress={() => deleteAttLog(log)} activeOpacity={0.7}>
                          <Text style={{ fontSize: 15 }}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.logItemMeta}>{log.period_time}</Text>
                    {expandedLog === (log.id ?? i) && (
                      <Text style={styles.logItemRegs} selectable>
                        {(log.absentees || []).join(', ')}
                      </Text>
                    )}
                    <TouchableOpacity
                      onPress={() => setExpandedLog(expandedLog === (log.id ?? i) ? null : (log.id ?? i))}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.logExpandBtn}>
                        {expandedLog === (log.id ?? i) ? 'Hide reg numbers ▴' : 'Show reg numbers ▾'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Template Modal ───────────────────────────────────────────────────── */}
      <Modal visible={!!templateModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} numberOfLines={1}>{templateModal}</Text>
                <TouchableOpacity onPress={() => setTemplateModal(null)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ paddingBottom: 8 }}>
                <TextInput
                  value={templateText}
                  onChangeText={setTemplateText}
                  multiline
                  style={styles.templateEditor}
                  placeholderTextColor={colors.textTertiary}
                  scrollEnabled={false}
                />
              </ScrollView>
              <View style={styles.modalActions}>
                <Text style={styles.copyFeedback}>{copied ? '✓ Copied!' : ' '}</Text>
                <TouchableOpacity style={styles.generateBtn} onPress={handleCopy} activeOpacity={0.85}>
                  <Text style={styles.generateBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: colors.textPrimary },
  headerTitle: { fontSize: 16, ...font.bold, color: colors.textPrimary },
  headerSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  crBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  crBadgeText: { fontSize: 12, ...font.bold, color: '#fff' },

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
  tabBtnText: { fontSize: 13, ...font.semibold, color: colors.textTertiary },
  tabBtnTextActive: { color: colors.primary },

  content: { padding: spacing.md },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.sm, alignItems: 'center',
  },
  statLabel: { fontSize: 10, color: colors.textTertiary, ...font.medium, marginBottom: 4 },
  statValue: { fontSize: 22, ...font.bold },

  grid2: { gap: spacing.md, marginBottom: spacing.md },

  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
  },
  cardLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold, marginBottom: spacing.sm,
  },

  qaGrid: { gap: spacing.sm },
  qaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.sm,
  },
  qaIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { fontSize: 13, ...font.semibold, color: colors.textPrimary },
  qaDesc: { fontSize: 10, color: colors.textTertiary, marginTop: 1 },

  tmplRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tmplName: { flex: 1, fontSize: 13, color: colors.textPrimary },
  tmplArrow: { fontSize: 18, color: colors.textTertiary },

  taskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  taskCheck: { padding: 2 },
  checkCircle: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleDone: { backgroundColor: colors.green, borderColor: colors.green },
  checkMark: { fontSize: 11, color: '#fff', ...font.bold },
  taskText: { flex: 1, fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
  taskTextDone: { textDecorationLine: 'line-through', color: colors.textTertiary },
  priorityPill: {
    borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2,
    backgroundColor: colors.amberLight, borderWidth: 1, borderColor: colors.amber,
  },
  priorityText: { fontSize: 9, ...font.bold, color: colors.amber, letterSpacing: 0.4 },
  pHigh: { backgroundColor: colors.redLight, borderColor: colors.red },
  pHighText: { color: colors.red },
  pLow: { backgroundColor: colors.greenLight, borderColor: colors.greenBorder },
  pLowText: { color: colors.green },
  taskDelete: { padding: 4 },
  taskDeleteText: { fontSize: 13, color: colors.textTertiary },

  addTaskRow: { marginTop: spacing.sm, gap: spacing.xs },
  taskInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 9,
    fontSize: 13, color: colors.textPrimary,
  },
  priorityPicker: { flexDirection: 'row', gap: 6 },
  prioBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 6,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  prioBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  prioBtnText: { fontSize: 11, color: colors.textTertiary, ...font.medium },
  prioBtnTextActive: { color: colors.primary, ...font.semibold },
  addTaskBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 9, alignItems: 'center', justifyContent: 'center',
  },
  addTaskBtnText: { fontSize: 20, color: '#fff', ...font.bold },

  emptyCard: { paddingVertical: spacing.lg, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.textTertiary },

  // Attendance
  fieldLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold, marginBottom: 6, marginTop: spacing.sm,
  },
  periodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  periodBtn: {
    flex: 1, minWidth: '45%', alignItems: 'center', paddingVertical: 12,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
  },
  periodBtnActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  periodName: { fontSize: 15, ...font.bold, color: colors.textPrimary },
  periodNameActive: { color: colors.primary },
  periodTime: { fontSize: 10, color: colors.textTertiary, marginTop: 3 },
  periodTimeActive: { color: colors.primary },

  periodAddBtn: {
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8,
    alignItems: 'center', justifyContent: 'center', minWidth: 64,
  },
  periodAddText: { fontSize: 12, color: colors.textSecondary, ...font.medium },
  addPeriodRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md, alignItems: 'center' },
  addPeriodConfirm: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  addPeriodConfirmText: { fontSize: 13, ...font.bold, color: '#fff' },
  rollInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 9,
    fontSize: 14, color: colors.textPrimary, marginBottom: 6,
  },
  rollHint: { fontSize: 11, color: colors.textTertiary, marginBottom: spacing.md, lineHeight: 16 },
  btnRow: { flexDirection: 'row', gap: spacing.sm },
  generateBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 11, alignItems: 'center',
  },
  generateBtnText: { fontSize: 14, ...font.bold, color: '#fff' },
  clearBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: 11, paddingHorizontal: spacing.lg, alignItems: 'center',
  },
  clearBtnText: { fontSize: 14, color: colors.textSecondary, ...font.medium },

  previewBox: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  previewText: { fontSize: 13, color: colors.textPrimary, lineHeight: 22 },
  copyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  copyNote: { fontSize: 12, color: colors.green, ...font.medium },

  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  clearLogBtn: { fontSize: 12, color: colors.red, ...font.medium },
  logItem: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  logItemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  logItemTitle: { fontSize: 13, ...font.semibold, color: colors.textPrimary },
  logItemMeta: { fontSize: 11, color: colors.textTertiary, marginBottom: 4 },
  logItemRegs: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  logExpandBtn: { fontSize: 12, color: colors.primary, marginTop: 4, ...font.medium },
  absentBadge: {
    backgroundColor: colors.redLight, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: colors.red,
  },
  absentBadgeText: { fontSize: 10, ...font.bold, color: colors.red },

  // Template modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, maxHeight: '88%', borderWidth: 1, borderColor: colors.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: 16, ...font.bold, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  modalClose: { fontSize: 22, color: colors.textSecondary, padding: 4 },
  templateEditor: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, fontSize: 13,
    color: colors.textPrimary, lineHeight: 22, minHeight: 200,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md,
  },
  copyFeedback: { fontSize: 13, color: colors.green, ...font.medium },

  resignBtn: {
    borderWidth: 1, borderColor: colors.red,
    borderRadius: radius.md,
    paddingVertical: 13, alignItems: 'center',
    marginBottom: spacing.md,
  },
  resignBtnText: { fontSize: 14, color: colors.red, ...font.semibold },

  // Take Attendance entry card
  takeAttCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
  },
  takeAttTitle: { fontSize: 15, ...font.bold, color: colors.primary },
  takeAttSub:   { fontSize: 12, color: colors.primary, opacity: 0.75, marginTop: 2 },
  takeAttArrow: { fontSize: 24, color: colors.primary, ...font.bold },

  // Roll checklist rows
  rollSectionLabel: {
    fontSize: 10, ...font.bold, color: colors.textSecondary, letterSpacing: 0.8,
    marginTop: spacing.sm, marginBottom: 4,
  },
  rollRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rollRowAbsent: { backgroundColor: colors.redLight },
  rollCheckBox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  rollCheckBoxOn: { backgroundColor: colors.red, borderColor: colors.red },
  rollCheckMark:  { fontSize: 12, color: '#fff', ...font.bold },
  rollNumText:    { fontSize: 14, color: colors.textPrimary, ...font.medium },
  rollNumAbsent:  { color: colors.red, textDecorationLine: 'line-through' },
  absentPill: {
    fontSize: 10, ...font.bold, color: colors.red,
    backgroundColor: colors.redLight, borderRadius: radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.red,
  },
  rollDeleteBtn: { padding: 8 },
  rollDeleteText: { fontSize: 16 },
});
