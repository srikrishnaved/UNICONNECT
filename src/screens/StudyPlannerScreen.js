import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, font } from '../theme';

const DAYS_OF_WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const EXAM_COLORS = [
  { bg: 'rgba(59,130,246,0.18)',  text: '#60A5FA', border: 'rgba(59,130,246,0.4)' },
  { bg: 'rgba(168,85,247,0.18)',  text: '#C084FC', border: 'rgba(168,85,247,0.4)' },
  { bg: 'rgba(16,185,129,0.18)',  text: '#34D399', border: 'rgba(16,185,129,0.4)' },
  { bg: 'rgba(245,158,11,0.18)',  text: '#FBBF24', border: 'rgba(245,158,11,0.4)' },
  { bg: 'rgba(239,68,68,0.18)',   text: '#F87171', border: 'rgba(239,68,68,0.4)' },
  { bg: 'rgba(236,72,153,0.18)',  text: '#F472B6', border: 'rgba(236,72,153,0.4)' },
  { bg: 'rgba(20,184,166,0.18)',  text: '#2DD4BF', border: 'rgba(20,184,166,0.4)' },
  { bg: 'rgba(249,115,22,0.18)',  text: '#FB923C', border: 'rgba(249,115,22,0.4)' },
];

const DOW_IDX = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

function daysUntil(dateStr) {
  const exam = new Date(dateStr);
  exam.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((exam - today) / (1000 * 60 * 60 * 24));
}

export default function StudyPlannerScreen() {
  const { userProfile } = useApp();

  const [activeTab, setActiveTab] = useState('plan');

  // Exams list
  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(true);

  // Add Exam modal
  const [showAddExam, setShowAddExam] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [syllabusMode, setSyllabusMode] = useState('manual');
  const [syllabusText, setSyllabusText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [examError, setExamError] = useState('');

  // Daily schedule
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(true);

  // AI plan generation
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  // Tap-to-move & regenerate
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  // Date picker modal
  const [showDatePicker, setShowDatePicker] = useState(false);
  const now = new Date();
  const [pickerYear, setPickerYear] = useState(now.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(now.getMonth() + 1);
  const [pickerDay, setPickerDay] = useState(now.getDate());

  // Availability modal
  const [showAvailability, setShowAvailability] = useState(false);
  const [availability, setAvailability] = useState(
    DAYS_OF_WEEK.reduce((acc, d) => ({ ...acc, [d]: { enabled: false, hours: '2' } }), {})
  );
  const [availSaving, setAvailSaving] = useState(false);

  useEffect(() => {
    if (!userProfile?.id) return;
    loadExams();
    loadTopics();
    loadAvailability();
  }, [userProfile?.id]);

  async function loadExams() {
    setExamsLoading(true);
    const { data } = await supabase
      .from('study_exams')
      .select('*, study_topics(id)')
      .eq('user_id', userProfile.id)
      .order('exam_date', { ascending: true });
    setExams(data || []);
    setExamsLoading(false);
  }

  async function loadTopics() {
    setTopicsLoading(true);
    const { data } = await supabase
      .from('study_topics')
      .select('*, study_exams(subject_name, exam_date)')
      .eq('user_id', userProfile.id)
      .order('scheduled_date', { ascending: true })
      .order('sort_order', { ascending: true });
    setTopics(data || []);
    setTopicsLoading(false);
  }

  async function toggleTopicDone(topic) {
    const newStatus = topic.status === 'done' ? 'pending' : 'done';
    setTopics(prev => prev.map(t => t.id === topic.id ? { ...t, status: newStatus } : t));
    await supabase.from('study_topics').update({ status: newStatus }).eq('id', topic.id);
  }

  async function handleMoveTopic(topicId, newDate) {
    setTopics(prev => prev.map(t => t.id === topicId ? { ...t, scheduled_date: newDate } : t));
    setSelectedTopicId(null);
    await supabase.from('study_topics').update({ scheduled_date: newDate }).eq('id', topicId);
  }

  async function handleRegenerate() {
    const msg = 'Recalculating remaining schedule. Completed topics will stay fixed. Continue?';
    const confirmed = Platform.OS === 'web'
      ? window.confirm(msg)
      : await new Promise(resolve =>
          Alert.alert('Reschedule Remaining', msg, [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Continue', onPress: () => resolve(true) },
          ])
        );
    if (!confirmed) return;
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-study-plan', {
        body: { user_id: userProfile.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await Promise.all([loadExams(), loadTopics()]);
    } catch (e) {
      if (Platform.OS === 'web') window.alert('Something went wrong. Please try again.');
      else Alert.alert('SAGE', 'Something went wrong. Please try again.');
    } finally {
      setRegenerating(false);
    }
  }

  async function loadAvailability() {
    const { data } = await supabase
      .from('study_availability')
      .select('*')
      .eq('user_id', userProfile.id);
    if (data && data.length > 0) {
      setAvailability(prev => {
        const next = { ...prev };
        data.forEach(row => {
          next[row.day_of_week] = { enabled: true, hours: String(row.hours_available) };
        });
        return next;
      });
    }
  }

  function openAddExam() {
    setSubjectName('');
    setExamDate('');
    setSyllabusMode('manual');
    setSyllabusText('');
    setSelectedFile(null);
    setExamError('');
    setShowAddExam(true);
  }

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setSelectedFile(result.assets[0]);
    }
  }

  async function handleAddExam() {
    if (!subjectName.trim()) { setExamError('Please enter a subject name.'); return; }
    if (!examDate) { setExamError('Please select an exam date.'); return; }

    setSubmitting(true);
    setExamError('');

    try {
      let syllabusFileUrl = null;

      if (syllabusMode === 'file' && selectedFile) {
        const ext = selectedFile.name.split('.').pop();
        const path = `${userProfile.id}/${Date.now()}.${ext}`;
        const response = await fetch(selectedFile.uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('study-syllabus')
          .upload(path, blob, { contentType: selectedFile.mimeType });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('study-syllabus')
          .getPublicUrl(path);
        syllabusFileUrl = urlData.publicUrl;
      }

      const { data: exam, error: insertError } = await supabase
        .from('study_exams')
        .insert({
          user_id: userProfile.id,
          subject_name: subjectName.trim(),
          exam_date: examDate,
          syllabus_text: syllabusMode === 'manual' ? syllabusText.trim() || null : null,
          syllabus_file_url: syllabusFileUrl,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (syllabusMode === 'manual' && syllabusText.trim()) {
        const topics = syllabusText.trim().split('\n').filter(t => t.trim());
        if (topics.length > 0) {
          await supabase.from('study_topics').insert(
            topics.map((t, i) => ({
              exam_id: exam.id,
              user_id: userProfile.id,
              topic_name: t.trim(),
              status: 'pending',
              sort_order: i,
            }))
          );
        }
      }

      setShowAddExam(false);
      loadExams();
    } catch (e) {
      setExamError(e.message || 'Failed to save exam. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGeneratePlan() {
    setGenerating(true);
    setGenerateError('');
    try {
      const { data, error } = await supabase.functions.invoke('generate-study-plan', {
        body: { user_id: userProfile.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await Promise.all([loadExams(), loadTopics()]);
    } catch (e) {
      setGenerateError('Something went wrong. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  function confirmPickerDate() {
    const maxDay = daysInMonth(pickerYear, pickerMonth);
    const day = Math.min(pickerDay, maxDay);
    const mm = String(pickerMonth).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    setExamDate(`${pickerYear}-${mm}-${dd}`);
    setShowDatePicker(false);
  }

  async function saveAvailability() {
    setAvailSaving(true);
    try {
      await supabase.from('study_availability').delete().eq('user_id', userProfile.id);
      const rows = DAYS_OF_WEEK
        .filter(d => availability[d].enabled)
        .map(d => ({
          user_id: userProfile.id,
          day_of_week: d,
          hours_available: parseFloat(availability[d].hours) || 2,
        }));
      if (rows.length > 0) {
        await supabase.from('study_availability').insert(rows);
      }
      setShowAvailability(false);
    } catch {
      Alert.alert('Error', 'Could not save availability. Please try again.');
    } finally {
      setAvailSaving(false);
    }
  }

  const pickerYears = [];
  for (let y = now.getFullYear(); y <= now.getFullYear() + 3; y++) pickerYears.push(y);

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'plan' && styles.tabActive]}
          onPress={() => setActiveTab('plan')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'plan' && styles.tabTextActive]}>Study Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'schedule' && styles.tabActive]}
          onPress={() => setActiveTab('schedule')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'schedule' && styles.tabTextActive]}>Daily Schedule</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'plan' ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.primaryBtn} onPress={openAddExam} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>+ Add Exam</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowAvailability(true)} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>⏱ Availability</Text>
            </TouchableOpacity>
          </View>

          {/* Generate Plan button — only when at least one future exam exists */}
          {exams.some(e => daysUntil(e.exam_date) >= 0) && (
            <View style={styles.generateWrap}>
              <TouchableOpacity
                style={[styles.generateBtn, generating && { opacity: 0.6 }]}
                onPress={handleGeneratePlan}
                disabled={generating}
                activeOpacity={0.85}
              >
                {generating
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.generateBtnText}>✦ Generate with SAGE</Text>}
              </TouchableOpacity>
              {generating && (
                <Text style={styles.generateHint}>
                  SAGE is analysing your syllabus. Calculating your optimal study schedule…
                </Text>
              )}
              {generateError ? (
                <Text style={styles.generateError}>{generateError}</Text>
              ) : null}
              <Text style={styles.aiDisclaimer}>AI-generated content should be reviewed before official use. Content may be processed by Anthropic's API.</Text>
              <Text style={styles.poweredBy}>✦ Powered by SAGE</Text>
            </View>
          )}

          {/* Exams list */}
          {examsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
          ) : exams.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyTitle}>No exams on record yet.</Text>
              <Text style={styles.emptySub}>
                Add an exam and let SAGE build your study plan.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>YOUR EXAMS</Text>
              {exams.map(exam => {
                const topicCount = exam.study_topics?.length ?? 0;
                const left = daysUntil(exam.exam_date);
                return (
                  <View key={exam.id} style={styles.examCard}>
                    <View style={styles.examIconBox}>
                      <Text style={styles.examEmoji}>📝</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.examSubject} numberOfLines={1}>{exam.subject_name}</Text>
                      <Text style={styles.examDate}>{formatDisplayDate(exam.exam_date)}</Text>
                      <View style={styles.examPills}>
                        {topicCount > 0 && (
                          <View style={styles.pill}>
                            <Text style={styles.pillText}>{topicCount} topic{topicCount !== 1 ? 's' : ''}</Text>
                          </View>
                        )}
                        {left >= 0 && (
                          <View style={[styles.pill, left <= 7 && styles.pillUrgent]}>
                            <Text style={[styles.pillText, left <= 7 && styles.pillTextUrgent]}>
                              {left === 0 ? 'Today!' : left === 1 ? '1 day left' : `${left} days left`}
                            </Text>
                          </View>
                        )}
                        {left < 0 && (
                          <View style={[styles.pill, styles.pillPast]}>
                            <Text style={[styles.pillText, styles.pillTextPast]}>Exam passed</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      ) : topicsLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const hasScheduled = topics.some(t => t.scheduled_date);

        if (exams.length === 0) return (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>No exams on record yet.</Text>
            <Text style={styles.emptySub}>Head to the Study Plan tab and add an exam. SAGE will handle the rest.</Text>
          </View>
        );

        if (!hasScheduled) return (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🤖</Text>
            <Text style={styles.emptyTitle}>Ready to build your study plan.</Text>
            <Text style={styles.emptySub}>
              Go to the Study Plan tab and tap "Generate with SAGE" to get started.
            </Text>
          </View>
        );

        // Exam color map
        const examColorMap = {};
        exams.forEach((exam, i) => { examColorMap[exam.id] = EXAM_COLORS[i % EXAM_COLORS.length]; });

        // Calendar range: today → furthest exam date
        const maxExamDate = exams.reduce((max, e) => e.exam_date > max ? e.exam_date : max, todayStr);
        const calDays = [];
        const cur = new Date(todayStr + 'T00:00:00');
        const endD = new Date(maxExamDate + 'T00:00:00');
        while (cur <= endD) { calDays.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1); }

        // Group topics by date, pending before done
        const byDate = {};
        for (const t of topics) {
          if (!t.scheduled_date) continue;
          if (!byDate[t.scheduled_date]) byDate[t.scheduled_date] = [];
          byDate[t.scheduled_date].push(t);
        }
        for (const d of Object.keys(byDate)) {
          byDate[d].sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0));
        }

        // Availability helpers
        const anyAvailSet = DAYS_OF_WEEK.some(d => availability[d].enabled);
        function isDayAvail(dateStr) {
          if (!anyAvailSet) return true;
          return availability[DOW_IDX[new Date(dateStr + 'T00:00:00').getDay()]]?.enabled ?? false;
        }

        // Exam day lookup
        const examDateSet = new Set(exams.map(e => e.exam_date));
        const examsByDate = {};
        for (const e of exams) { if (!examsByDate[e.exam_date]) examsByDate[e.exam_date] = []; examsByDate[e.exam_date].push(e); }

        function calLabel(dateStr) {
          return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
        }

        const hasPending = topics.some(t => t.status !== 'done' && t.scheduled_date);
        const unscheduled = topics.filter(t => !t.scheduled_date);
        const inMoveMode = !!selectedTopicId;

        return (
          <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

            {/* ── Progress summary cards ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.progressScroll}>
              {exams.map((exam, i) => {
                const color = examColorMap[exam.id];
                const et = topics.filter(t => t.exam_id === exam.id);
                const done = et.filter(t => t.status === 'done').length;
                const pct = et.length ? done / et.length : 0;
                const left = daysUntil(exam.exam_date);
                return (
                  <View key={exam.id} style={[styles.progressCard, { backgroundColor: color.bg, borderColor: color.border }]}>
                    <Text style={[styles.progressSubject, { color: color.text }]} numberOfLines={1}>{exam.subject_name}</Text>
                    <Text style={styles.progressLeft}>{left >= 0 ? `${left}d left` : 'Passed'}</Text>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color.text }]} />
                    </View>
                    <Text style={[styles.progressFraction, { color: color.text }]}>{done}/{et.length} done</Text>
                  </View>
                );
              })}
            </ScrollView>

            {/* ── Reschedule remaining ── */}
            {hasPending && (
              <View style={styles.regenWrap}>
                <TouchableOpacity
                  style={[styles.regenBtn, regenerating && { opacity: 0.6 }]}
                  onPress={handleRegenerate}
                  disabled={regenerating}
                  activeOpacity={0.85}
                >
                  {regenerating
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.regenBtnText}>✦ SAGE — Recalculate</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* ── Move-mode banner ── */}
            {inMoveMode && (
              <View style={styles.moveBanner}>
                <Text style={styles.moveBannerText}>Tap a day to move the selected topic there</Text>
                <TouchableOpacity onPress={() => setSelectedTopicId(null)} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                  <Text style={styles.moveBannerCancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Calendar ── */}
            {calDays.map(dateStr => {
              const isToday = dateStr === todayStr;
              const isExamDay = examDateSet.has(dateStr);
              const avail = isDayAvail(dateStr);
              const dayTopics = byDate[dateStr] || [];

              return (
                <View key={dateStr} style={styles.calDayWrap}>
                  {/* Day header */}
                  <TouchableOpacity
                    style={[styles.calDayHeader, isToday && styles.calDayHeaderToday]}
                    onPress={() => inMoveMode && !isExamDay && handleMoveTopic(selectedTopicId, dateStr)}
                    activeOpacity={inMoveMode && !isExamDay ? 0.65 : 1}
                  >
                    <Text style={[styles.calDayLabel, isToday && styles.calDayLabelToday]}>
                      {isToday ? `Today  ·  ${calLabel(dateStr)}` : calLabel(dateStr)}
                    </Text>
                    {inMoveMode && !isExamDay && (
                      <View style={styles.calDropBadge}>
                        <Text style={styles.calDropBadgeText}>Move here</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Day body */}
                  {isExamDay ? (
                    <View style={styles.examDayArea}>
                      {(examsByDate[dateStr] || []).map(e => {
                        const color = examColorMap[e.id];
                        return (
                          <View key={e.id} style={[styles.examDayPill, { backgroundColor: color?.bg, borderColor: color?.border }]}>
                            <Text style={{ fontSize: 13 }}>📝</Text>
                            <Text style={[styles.examDayPillText, { color: color?.text }]}>{e.subject_name} — Exam Day</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : !avail ? (
                    <View style={styles.notAvailRow}>
                      <Text style={styles.notAvailText}>Not available</Text>
                    </View>
                  ) : dayTopics.length === 0 ? (
                    <TouchableOpacity
                      style={[styles.restDayRow, inMoveMode && styles.restDayRowTarget]}
                      onPress={() => inMoveMode && handleMoveTopic(selectedTopicId, dateStr)}
                      activeOpacity={inMoveMode ? 0.65 : 1}
                    >
                      <Text style={[styles.restDayText, inMoveMode && styles.restDayTextTarget]}>
                        {inMoveMode ? '+ Drop here' : 'Rest day'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.calTopicsWrap}>
                      {dayTopics.map(topic => {
                        const color = examColorMap[topic.exam_id] || EXAM_COLORS[0];
                        const done = topic.status === 'done';
                        const isSelected = selectedTopicId === topic.id;
                        return (
                          <TouchableOpacity
                            key={topic.id}
                            style={[
                              styles.calTopicCard,
                              { backgroundColor: color.bg, borderColor: isSelected ? color.text : color.border },
                              done && styles.calTopicCardDone,
                              isSelected && styles.calTopicCardSelected,
                            ]}
                            onPress={() => {
                              if (inMoveMode && !isSelected) {
                                handleMoveTopic(selectedTopicId, dateStr);
                              } else {
                                setSelectedTopicId(isSelected ? null : topic.id);
                              }
                            }}
                            activeOpacity={0.75}
                          >
                            <TouchableOpacity
                              style={[styles.calCheckbox, done && styles.calCheckboxDone]}
                              onPress={() => toggleTopicDone(topic)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              {done && <Text style={styles.calCheckmark}>✓</Text>}
                            </TouchableOpacity>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={[styles.calTopicName, done && styles.calTopicNameDone]} numberOfLines={2}>
                                {topic.topic_name}
                              </Text>
                              <Text style={styles.calTopicSubject} numberOfLines={1}>
                                {topic.study_exams?.subject_name}
                              </Text>
                            </View>
                            {isSelected
                              ? <Text style={[styles.calSelIcon, { color: color.text }]}>✦</Text>
                              : !done && <Text style={styles.calGrabIcon}>⋮⋮</Text>}
                          </TouchableOpacity>
                        );
                      })}
                      {inMoveMode && (
                        <TouchableOpacity style={styles.restDayRowTarget} onPress={() => handleMoveTopic(selectedTopicId, dateStr)} activeOpacity={0.65}>
                          <Text style={styles.restDayTextTarget}>+ Add here</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {/* ── Unscheduled ── */}
            {unscheduled.length > 0 && (
              <View style={styles.calDayWrap}>
                <View style={[styles.calDayHeader, { opacity: 0.55 }]}>
                  <Text style={styles.calDayLabel}>Unscheduled</Text>
                </View>
                {unscheduled.map(topic => {
                  const color = examColorMap[topic.exam_id] || EXAM_COLORS[0];
                  const isSelected = selectedTopicId === topic.id;
                  return (
                    <TouchableOpacity
                      key={topic.id}
                      style={[styles.calTopicCard, { backgroundColor: color.bg, borderColor: isSelected ? color.text : color.border }, isSelected && styles.calTopicCardSelected]}
                      onPress={() => setSelectedTopicId(isSelected ? null : topic.id)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.calCheckbox} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.calTopicName} numberOfLines={2}>{topic.topic_name}</Text>
                        <Text style={styles.calTopicSubject}>{topic.study_exams?.subject_name}</Text>
                      </View>
                      {isSelected
                        ? <Text style={[styles.calSelIcon, { color: color.text }]}>✦</Text>
                        : <Text style={styles.calGrabIcon}>⋮⋮</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

          </ScrollView>
        );
      })()}

      {/* ── Add Exam Modal ── */}
      <Modal visible={showAddExam} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.modal}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Exam</Text>
              <TouchableOpacity onPress={() => setShowAddExam(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>SUBJECT NAME</Text>
            <TextInput
              value={subjectName}
              onChangeText={setSubjectName}
              placeholder="e.g. Corporate Taxation, Financial Accounting"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>EXAM DATE</Text>
            <TouchableOpacity
              style={styles.dateTrigger}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dateTriggerText, !examDate && styles.dateTriggerPlaceholder]}>
                {examDate ? formatDisplayDate(examDate) : 'Select date'}
              </Text>
              <Text style={styles.dateTriggerArrow}>›</Text>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>SYLLABUS</Text>
            <View style={styles.syllabusToggleRow}>
              {['manual', 'file'].map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.syllabusToggleBtn, syllabusMode === mode && styles.syllabusToggleBtnActive]}
                  onPress={() => setSyllabusMode(mode)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.syllabusToggleBtnText, syllabusMode === mode && styles.syllabusToggleBtnTextActive]}>
                    {mode === 'manual' ? 'Type Topics' : 'Upload File'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {syllabusMode === 'manual' ? (
              <>
                <TextInput
                  value={syllabusText}
                  onChangeText={setSyllabusText}
                  placeholder={'One topic per line:\nChapter 1 — Income Tax Basics\nChapter 2 — Deductions\nGST Overview'}
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.input, styles.syllabusTextArea]}
                  multiline
                  textAlignVertical="top"
                />
                <Text style={styles.inputHint}>Each line will be saved as a separate study topic.</Text>
              </>
            ) : (
              <View style={styles.filePickerArea}>
                {selectedFile ? (
                  <View style={styles.fileSelected}>
                    <Text style={styles.fileSelectedIcon}>📄</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fileSelectedName} numberOfLines={1}>{selectedFile.name}</Text>
                      <Text style={styles.fileSelectedSize}>{(selectedFile.size / 1024).toFixed(1)} KB</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedFile(null)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.fileRemove}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.filePickerBtn} onPress={pickFile} activeOpacity={0.8}>
                    <Text style={styles.filePickerBtnIcon}>📁</Text>
                    <Text style={styles.filePickerBtnLabel}>Choose File</Text>
                    <Text style={styles.filePickerBtnHint}>PDF only</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {examError ? <Text style={styles.errorText}>{examError}</Text> : null}

            <TouchableOpacity
              style={[styles.submitBtn, (submitting || !subjectName.trim() || !examDate) && { opacity: 0.45 }]}
              onPress={handleAddExam}
              disabled={submitting || !subjectName.trim() || !examDate}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Save Exam</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Date Picker Modal ── */}
      <Modal visible={showDatePicker} transparent animationType="slide">
        <View style={styles.datePickerOverlay}>
          <View style={styles.datePickerSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.datePickerCols}>
              {/* Month */}
              <View style={styles.datePickerCol}>
                <Text style={styles.datePickerColLabel}>Month</Text>
                <ScrollView style={styles.datePickerScroll} showsVerticalScrollIndicator={false}>
                  {MONTH_NAMES.map((m, i) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.datePickerItem, pickerMonth === i + 1 && styles.datePickerItemActive]}
                      onPress={() => setPickerMonth(i + 1)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.datePickerItemText, pickerMonth === i + 1 && styles.datePickerItemTextActive]}>
                        {m.slice(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Day */}
              <View style={styles.datePickerCol}>
                <Text style={styles.datePickerColLabel}>Day</Text>
                <ScrollView style={styles.datePickerScroll} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: daysInMonth(pickerYear, pickerMonth) }, (_, i) => i + 1).map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.datePickerItem, pickerDay === d && styles.datePickerItemActive]}
                      onPress={() => setPickerDay(d)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.datePickerItemText, pickerDay === d && styles.datePickerItemTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Year */}
              <View style={styles.datePickerCol}>
                <Text style={styles.datePickerColLabel}>Year</Text>
                <ScrollView style={styles.datePickerScroll} showsVerticalScrollIndicator={false}>
                  {pickerYears.map(y => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.datePickerItem, pickerYear === y && styles.datePickerItemActive]}
                      onPress={() => setPickerYear(y)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.datePickerItemText, pickerYear === y && styles.datePickerItemTextActive]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={confirmPickerDate} activeOpacity={0.85}>
              <Text style={styles.submitBtnText}>Confirm Date</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Availability Modal ── */}
      <Modal visible={showAvailability} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.modal}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Study Availability</Text>
              <TouchableOpacity onPress={() => setShowAvailability(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.availHint}>
              Set how many hours per day you're available to study. This will be used in Stage 2 to auto-build your daily plan.
            </Text>

            {DAYS_OF_WEEK.map(day => {
              const avail = availability[day];
              return (
                <View key={day} style={styles.availRow}>
                  <TouchableOpacity
                    style={[styles.dayToggle, avail.enabled && styles.dayToggleActive]}
                    onPress={() => setAvailability(prev => ({
                      ...prev,
                      [day]: { ...prev[day], enabled: !prev[day].enabled },
                    }))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dayToggleText, avail.enabled && styles.dayToggleTextActive]}>{day}</Text>
                  </TouchableOpacity>

                  {avail.enabled ? (
                    <View style={styles.hoursRow}>
                      <TextInput
                        value={avail.hours}
                        onChangeText={v => setAvailability(prev => ({
                          ...prev,
                          [day]: { ...prev[day], hours: v },
                        }))}
                        keyboardType="decimal-pad"
                        style={styles.hoursInput}
                        maxLength={4}
                      />
                      <Text style={styles.hoursLabel}>hrs / day</Text>
                    </View>
                  ) : (
                    <Text style={styles.dayOffText}>Not available</Text>
                  )}
                </View>
              );
            })}

            <TouchableOpacity
              style={[styles.submitBtn, availSaving && { opacity: 0.55 }]}
              onPress={saveAvailability}
              disabled={availSaving}
              activeOpacity={0.85}
            >
              {availSaving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Save Availability</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, ...font.semibold, color: colors.textTertiary },
  tabTextActive: { color: colors.primary },

  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 14, color: '#fff', ...font.bold },
  secondaryBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 14, color: colors.textPrimary, ...font.semibold },

  sectionLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold, marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  examCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  examIconBox: {
    width: 48, height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  examEmoji: { fontSize: 22 },
  examSubject: { fontSize: 14, ...font.bold, color: colors.textPrimary, marginBottom: 2 },
  examDate: { fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  examPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: 9, paddingVertical: 3,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  pillText: { fontSize: 10, color: colors.textSecondary, ...font.semibold },
  pillUrgent: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: colors.red },
  pillTextUrgent: { color: colors.red },
  pillPast: { backgroundColor: colors.cardElevated, borderColor: colors.border },
  pillTextPast: { color: colors.textTertiary },

  emptyCard: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: { fontSize: 44, marginBottom: spacing.md },
  emptyTitle: { fontSize: 15, ...font.bold, color: colors.textPrimary, marginBottom: 6 },
  emptySub: { fontSize: 13, color: colors.textTertiary, textAlign: 'center', lineHeight: 19 },

  // Shared modal base
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: { fontSize: 17, ...font.bold, color: colors.textPrimary },
  modalClose: { fontSize: 20, color: colors.textSecondary, padding: 4 },

  fieldLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold, marginBottom: 6, marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary, fontSize: 14,
  },
  syllabusTextArea: {
    minHeight: 120,
  },
  inputHint: {
    fontSize: 11, color: colors.textTertiary, marginTop: 4, marginBottom: spacing.sm,
  },

  syllabusToggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  syllabusToggleBtn: {
    flex: 1,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10, alignItems: 'center',
    backgroundColor: colors.bg,
  },
  syllabusToggleBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  syllabusToggleBtnText: { fontSize: 13, color: colors.textSecondary, ...font.semibold },
  syllabusToggleBtnTextActive: { color: colors.primary },

  filePickerArea: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  filePickerBtn: {
    alignItems: 'center', paddingVertical: 24,
  },
  filePickerBtnIcon: { fontSize: 32, marginBottom: 6 },
  filePickerBtnLabel: { fontSize: 14, ...font.semibold, color: colors.textPrimary, marginBottom: 2 },
  filePickerBtnHint: { fontSize: 11, color: colors.textTertiary },
  fileSelected: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.primaryLight,
  },
  fileSelectedIcon: { fontSize: 24 },
  fileSelectedName: { fontSize: 13, ...font.semibold, color: colors.textPrimary },
  fileSelectedSize: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  fileRemove: { fontSize: 16, color: colors.textTertiary, padding: 4 },

  dateTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  dateTriggerText: { fontSize: 14, color: colors.textPrimary },
  dateTriggerPlaceholder: { color: colors.textTertiary },
  dateTriggerArrow: {
    fontSize: 18, color: colors.textTertiary,
    transform: [{ rotate: '90deg' }],
  },

  errorText: { fontSize: 12, color: colors.red, marginTop: spacing.sm },

  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitBtnText: { fontSize: 15, color: '#fff', ...font.bold },

  // Date picker
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  datePickerSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: 40,
  },
  datePickerCols: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  datePickerCol: { flex: 1 },
  datePickerColLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold, textAlign: 'center', marginBottom: spacing.sm,
  },
  datePickerScroll: { maxHeight: 180 },
  datePickerItem: {
    paddingVertical: 9, paddingHorizontal: 8,
    borderRadius: radius.sm, marginBottom: 3,
    alignItems: 'center',
  },
  datePickerItemActive: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: colors.primary,
  },
  datePickerItemText: { fontSize: 13, color: colors.textSecondary, ...font.medium },
  datePickerItemTextActive: { color: colors.primary, ...font.bold },

  // Availability
  availHint: {
    fontSize: 12, color: colors.textSecondary, lineHeight: 18,
    marginBottom: spacing.md,
  },
  availRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.md,
  },
  dayToggle: {
    width: 52, paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  dayToggleActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  dayToggleText: { fontSize: 12, ...font.bold, color: colors.textTertiary },
  dayToggleTextActive: { color: colors.primary },
  dayOffText: { fontSize: 12, color: colors.textTertiary, flex: 1 },
  hoursRow: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  hoursInput: {
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
    fontSize: 14, color: colors.textPrimary,
    width: 56, textAlign: 'center',
  },
  hoursLabel: { fontSize: 12, color: colors.textSecondary },

  generateWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  generateBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  generateBtnText: { fontSize: 14, color: '#fff', ...font.bold },
  generateHint: {
    fontSize: 11, color: colors.textTertiary,
    textAlign: 'center', marginTop: 8,
  },
  generateError: {
    fontSize: 12, color: colors.red,
    textAlign: 'center', marginTop: 8,
  },
  aiDisclaimer: {
    fontSize: 11, color: colors.textTertiary,
    textAlign: 'center', marginTop: 8, lineHeight: 16,
  },
  poweredBy: {
    fontSize: 10, color: colors.textTertiary,
    textAlign: 'center', marginTop: 4, opacity: 0.7,
  },

  // ── Progress summary
  progressScroll: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  progressCard: {
    width: 150,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  progressSubject: { fontSize: 13, ...font.bold, marginBottom: 2 },
  progressLeft: { fontSize: 10, color: colors.textTertiary, marginBottom: spacing.sm },
  progressBarBg: {
    height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 6, overflow: 'hidden',
  },
  progressBarFill: { height: 4, borderRadius: 2 },
  progressFraction: { fontSize: 11, ...font.semibold },

  // ── Regen button
  regenWrap: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  regenBtn: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  regenBtnText: { fontSize: 13, color: colors.textSecondary, ...font.semibold },

  // ── Move-mode banner
  moveBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: colors.primary,
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  moveBannerText: { fontSize: 12, color: colors.primary, ...font.semibold, flex: 1 },
  moveBannerCancel: { fontSize: 12, color: colors.primary, ...font.bold, marginLeft: spacing.sm },

  // ── Calendar
  calDayWrap: { marginBottom: 2 },
  calDayHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: colors.bg,
  },
  calDayHeaderToday: { backgroundColor: colors.primaryLight },
  calDayLabel: { fontSize: 12, ...font.bold, color: colors.textSecondary, letterSpacing: 0.4 },
  calDayLabelToday: { color: colors.primary },
  calDropBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  calDropBadgeText: { fontSize: 10, color: '#fff', ...font.bold },

  examDayArea: { paddingHorizontal: spacing.md, paddingBottom: 8, gap: 6 },
  examDayPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  examDayPillText: { fontSize: 13, ...font.bold },

  notAvailRow: {
    paddingHorizontal: spacing.md, paddingVertical: 8,
  },
  notAvailText: { fontSize: 11, color: colors.textTertiary, fontStyle: 'italic' },

  restDayRow: {
    marginHorizontal: spacing.md, marginBottom: 4,
    paddingVertical: 8,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  restDayRowTarget: {
    marginHorizontal: spacing.md, marginBottom: 4,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed',
    alignItems: 'center',
  },
  restDayText: { fontSize: 11, color: colors.textTertiary },
  restDayTextTarget: { fontSize: 11, color: colors.primary, ...font.semibold },

  calTopicsWrap: { paddingHorizontal: spacing.md, paddingBottom: 4, gap: 6 },
  calTopicCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1.5, borderRadius: radius.md,
    padding: spacing.md,
  },
  calTopicCardDone: { opacity: 0.45 },
  calTopicCardSelected: { borderWidth: 2 },
  calCheckbox: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  calCheckboxDone: { backgroundColor: '#10B981', borderColor: '#10B981' },
  calCheckmark: { fontSize: 11, color: '#fff', ...font.bold },
  calTopicName: { fontSize: 13, ...font.semibold, color: colors.textPrimary, marginBottom: 1 },
  calTopicNameDone: { textDecorationLine: 'line-through', color: colors.textTertiary },
  calTopicSubject: { fontSize: 10, color: colors.textSecondary },
  calSelIcon: { fontSize: 14, flexShrink: 0 },
  calGrabIcon: { fontSize: 12, color: colors.textTertiary, flexShrink: 0, letterSpacing: -2 },
});
