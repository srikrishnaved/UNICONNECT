import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { hubClubs } from '../data';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius, font } from '../theme';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';

// ── Default form states ───────────────────────────────────────────────────────

const DEFAULT_NFA = {
  title_of_session: '', abstract: '', objectives: [''], expected_outcomes: [''],
  resource_person: '', target_audience: '', stakeholders_count: '',
  event_date: '', event_time: '', mode: 'Offline', link: '', venue: '',
  organised_by: '', key_takeaways: [''],
  budget_items: [{ particular: '', amount: '' }],
  club_id: null, club_name: '',
  linked_event_id: null,
};

const DEFAULT_AR = {
  type_of_activity: '', title_of_activity: '', activity_date: '', activity_time: '',
  venue: '', speaker_names: '', speaker_titles: '', speaker_org: '',
  presentation_title: '', participant_type: '', participant_count: '',
  highlights: '', key_takeaways: '', summary: '',
  organiser_name: '', organiser_designation: '', atr: '',
  club_id: '', club_name: '',
};

// ── Small reusable pieces ─────────────────────────────────────────────────────

function FieldLabel({ text }) {
  return <Text style={s.fieldLabel}>{text}</Text>;
}

function FieldInput({ value, onChangeText, placeholder, multiline, style }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder || ''}
      placeholderTextColor={colors.textTertiary}
      style={[s.fieldInput, multiline && { height: 80, textAlignVertical: 'top' }, style]}
      multiline={!!multiline}
    />
  );
}

function BulletList({ items, onChange, placeholder }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>•</Text>
          <TextInput
            value={item}
            onChangeText={t => {
              const next = [...items];
              next[i] = t;
              onChange(next);
            }}
            placeholder={placeholder || 'Add point…'}
            placeholderTextColor={colors.textTertiary}
            style={[s.fieldInput, { flex: 1, marginBottom: 0 }]}
          />
          {items.length > 1 && (
            <TouchableOpacity onPress={() => onChange(items.filter((_, j) => j !== i))} activeOpacity={0.7}>
              <Text style={{ color: colors.red, fontSize: 18, paddingHorizontal: 4 }}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity
        style={s.addPointBtn}
        onPress={() => onChange([...items, ''])}
        activeOpacity={0.7}
      >
        <Text style={s.addPointBtnText}>+ Add point</Text>
      </TouchableOpacity>
    </View>
  );
}

function StatusBadge({ label, color }) {
  return (
    <View style={[s.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DocumentationScreen({ effectiveProfile, effectiveSapsCore, userProfile, createNotification, nfaPrefill, onPrefillConsumed }) {
  const coordinatedClubIds = (effectiveProfile?.coordinatorClubIds || []).map(String);
  const isCoordinator = coordinatedClubIds.length > 0;
  const isSAPS = !!effectiveSapsCore;

  // ── State ─────────────────────────────────────────────────────────────────
  const [section, setSection] = useState('nfa');
  const [myClubAdminIds, setMyClubAdminIds] = useState([]);
  const [loading, setLoading] = useState(true);

  const [myNFAs, setMyNFAs] = useState([]);
  const [pendingNFAs, setPendingNFAs] = useState([]);
  const [myARs, setMyARs] = useState([]);
  const [pendingARsCoord, setPendingARsCoord] = useState([]);
  const [pendingARsSAPS, setPendingARsSAPS] = useState([]);

  // NFA form
  const [showNFAForm, setShowNFAForm] = useState(false);
  const [nfaForm, setNFAForm] = useState({ ...DEFAULT_NFA });
  const [nfaSaving, setNFASaving] = useState(false);

  // NFA rejection modal
  const [rejectNFA, setRejectNFA] = useState(null);
  const [rejectNFAReason, setRejectNFAReason] = useState('');
  const [rejectNFASaving, setRejectNFASaving] = useState(false);

  // AR form
  const [showARForm, setShowARForm] = useState(false);
  const [arForm, setARForm] = useState({ ...DEFAULT_AR });
  const [arSaving, setARSaving] = useState(false);

  // AR rejection modal
  const [rejectAR, setRejectAR] = useState(null); // { ar, stage: 'coord' | 'saps' }
  const [rejectARReason, setRejectARReason] = useState('');
  const [rejectARSaving, setRejectARSaving] = useState(false);

  // AI generation modal
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiMode, setAIMode] = useState(null); // null | 'poster' | 'describe'
  const [aiDescription, setAIDescription] = useState('');
  const [aiPoster, setAIPoster] = useState(null); // { base64, mimeType }
  const [aiGenerating, setAIGenerating] = useState(false);

  // ── Consume prefill from event card shortcut ──────────────────────────────
  useEffect(() => {
    if (!nfaPrefill) return;
    setNFAForm({ ...DEFAULT_NFA, ...nfaPrefill });
    setShowNFAForm(true);
    onPrefillConsumed?.();
  }, [nfaPrefill]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI generation ─────────────────────────────────────────────────────────
  const pickPoster = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setAIPoster({ base64: asset.base64, mimeType: asset.mimeType || 'image/jpeg' });
    }
  };

  const generateWithAI = async () => {
    if (aiMode === 'poster' && !aiPoster) {
      Alert.alert('No Poster', 'Please upload a poster first.'); return;
    }
    if (aiMode === 'describe' && !aiDescription.trim()) {
      Alert.alert('Empty', 'Please enter a description.'); return;
    }
    setAIGenerating(true);
    try {
      const body = (aiMode === 'poster' && aiPoster)
        ? { imageBase64: aiPoster.base64, imageMimeType: aiPoster.mimeType }
        : { description: aiDescription.trim() };

      const { data, error } = await supabase.functions.invoke('ai-nfa', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setNFAForm(f => ({
        ...f,
        abstract:          data.abstract           || f.abstract,
        objectives:        Array.isArray(data.objectives)        && data.objectives.length        ? data.objectives        : f.objectives,
        expected_outcomes: Array.isArray(data.expected_outcomes) && data.expected_outcomes.length ? data.expected_outcomes : f.expected_outcomes,
        key_takeaways:     Array.isArray(data.key_takeaways)     && data.key_takeaways.length     ? data.key_takeaways     : f.key_takeaways,
      }));

      setShowAIModal(false);
      setAIMode(null);
      setAIDescription('');
      setAIPoster(null);

      if (Platform.OS === 'web') {
        window.alert('Fields generated — please review and edit as needed.');
      } else {
        Alert.alert('Done', 'Fields generated — please review and edit as needed.');
      }
    } catch {
      if (Platform.OS === 'web') {
        window.alert('Generation failed. Please try again or fill the fields manually.');
      } else {
        Alert.alert('Failed', 'Generation failed. Please try again or fill the fields manually.');
      }
    } finally {
      setAIGenerating(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const isDocTeamAdmin = myClubAdminIds.includes('11');
  const canCreateNFA = myClubAdminIds.length > 0 || isCoordinator;
  const canCreateAR = isDocTeamAdmin;

  const myNFAClubs = (() => {
    const seen = new Set();
    const clubs = [];
    [...myClubAdminIds, ...coordinatedClubIds].forEach(id => {
      if (!seen.has(id)) {
        seen.add(id);
        const club = hubClubs.find(c => String(c.id) === id);
        if (club) clubs.push(club);
      }
    });
    return clubs;
  })();

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    const uid = userProfile?.id;
    const name = effectiveProfile?.name;

    // Club admin IDs
    if (uid) {
      const { data } = await supabase.from('club_admins').select('club_id').eq('user_id', uid);
      setMyClubAdminIds((data || []).map(r => String(r.club_id)));
    }

    // My NFAs (match by UUID if available, else by name)
    {
      let q = supabase.from('nfa_requests').select('*').order('created_at', { ascending: false });
      q = uid ? q.eq('created_by', uid) : q.eq('creator_name', name);
      const { data } = await q;
      setMyNFAs(data || []);
    }

    // Pending NFAs for coordinator approval
    if (isCoordinator && coordinatedClubIds.length > 0) {
      const { data } = await supabase
        .from('nfa_requests')
        .select('*')
        .in('club_id', coordinatedClubIds)
        .eq('status', 'pending')
        .eq('creator_role', 'club_admin')
        .order('created_at', { ascending: false });
      setPendingNFAs(data || []);
    }

    // My Activity Reports
    {
      let q = supabase.from('activity_reports').select('*').order('created_at', { ascending: false });
      q = uid ? q.eq('created_by', uid) : q.eq('creator_name', name);
      const { data } = await q;
      setMyARs(data || []);
    }

    // Pending ARs for coordinator approval
    if (isCoordinator && coordinatedClubIds.length > 0) {
      const { data } = await supabase
        .from('activity_reports')
        .select('*')
        .in('club_id', coordinatedClubIds)
        .eq('coordinator_status', 'pending')
        .order('created_at', { ascending: false });
      setPendingARsCoord(data || []);
    }

    // Pending ARs for SAPS approval
    if (isSAPS) {
      const { data } = await supabase
        .from('activity_reports')
        .select('*')
        .eq('coordinator_status', 'approved')
        .eq('saps_status', 'pending')
        .order('created_at', { ascending: false });
      setPendingARsSAPS(data || []);
    }

    setLoading(false);
  }, [userProfile?.id, effectiveProfile?.name, isCoordinator, isSAPS, coordinatedClubIds.join(',')]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── NFA submit ────────────────────────────────────────────────────────────
  const submitNFA = async () => {
    if (!nfaForm.title_of_session.trim()) {
      Alert.alert('Required', 'Title of session is required.'); return;
    }
    if (!nfaForm.club_id) {
      Alert.alert('Required', 'Please select a club.'); return;
    }
    setNFASaving(true);
    try {
      const creatorRole = isCoordinator ? 'faculty_coordinator' : 'club_admin';
      const status = creatorRole === 'faculty_coordinator' ? 'approved' : 'pending';
      const { data, error } = await supabase.from('nfa_requests').insert({
        created_by: userProfile?.id || null,
        creator_name: effectiveProfile.name,
        creator_role: creatorRole,
        club_id: String(nfaForm.club_id),
        club_name: nfaForm.club_name,
        title_of_session: nfaForm.title_of_session.trim(),
        abstract: nfaForm.abstract.trim() || null,
        objectives: nfaForm.objectives.filter(Boolean).join('\n') || null,
        expected_outcomes: nfaForm.expected_outcomes.filter(Boolean).join('\n') || null,
        resource_person: nfaForm.resource_person.trim() || null,
        target_audience: nfaForm.target_audience.trim() || null,
        stakeholders_count: nfaForm.stakeholders_count.trim() || null,
        event_date: nfaForm.event_date.trim() || null,
        event_time: nfaForm.event_time.trim() || null,
        mode: nfaForm.mode || null,
        link: nfaForm.link.trim() || null,
        venue: nfaForm.venue.trim() || null,
        organised_by: nfaForm.organised_by.trim() || null,
        key_takeaways: nfaForm.key_takeaways.filter(Boolean).join('\n') || null,
        budget_items: nfaForm.budget_items.filter(b => b.particular.trim() || b.amount.trim()),
        linked_event_id: nfaForm.linked_event_id || null,
        status,
        reviewed_by: status === 'approved' ? effectiveProfile.name : null,
      }).select().single();
      if (error) throw error;
      setMyNFAs(prev => [data, ...prev]);
      setNFAForm({ ...DEFAULT_NFA });
      setShowNFAForm(false);
      Alert.alert('Submitted', status === 'approved'
        ? 'NFA auto-approved (faculty coordinator).'
        : 'NFA submitted for coordinator approval.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not submit NFA.');
    } finally {
      setNFASaving(false);
    }
  };

  const approveNFA = async (nfa) => {
    const { error } = await supabase.from('nfa_requests').update({
      status: 'approved', reviewed_by: effectiveProfile.name,
    }).eq('id', nfa.id);
    if (error) { Alert.alert('Error', error.message); return; }
    setPendingNFAs(prev => prev.filter(n => n.id !== nfa.id));
    setMyNFAs(prev => prev.map(n => n.id === nfa.id ? { ...n, status: 'approved' } : n));
    Alert.alert('Approved', 'NFA approved.');
  };

  const submitRejectNFA = async () => {
    if (!rejectNFAReason.trim()) { Alert.alert('Required', 'Rejection reason is required.'); return; }
    setRejectNFASaving(true);
    const { error } = await supabase.from('nfa_requests').update({
      status: 'rejected', rejection_reason: rejectNFAReason.trim(), reviewed_by: effectiveProfile.name,
    }).eq('id', rejectNFA.id);
    setRejectNFASaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setPendingNFAs(prev => prev.filter(n => n.id !== rejectNFA.id));
    setRejectNFA(null); setRejectNFAReason('');
    Alert.alert('Rejected', 'NFA rejected.');
  };

  // ── AR submit ─────────────────────────────────────────────────────────────
  const submitAR = async () => {
    if (!arForm.title_of_activity.trim()) {
      Alert.alert('Required', 'Title of activity is required.'); return;
    }
    setARSaving(true);
    try {
      const { data, error } = await supabase.from('activity_reports').insert({
        created_by: userProfile?.id || null,
        creator_name: effectiveProfile.name,
        club_id: arForm.club_id ? String(arForm.club_id) : null,
        club_name: arForm.club_name || null,
        type_of_activity: arForm.type_of_activity.trim() || null,
        title_of_activity: arForm.title_of_activity.trim(),
        activity_date: arForm.activity_date.trim() || null,
        activity_time: arForm.activity_time.trim() || null,
        venue: arForm.venue.trim() || null,
        speaker_names: arForm.speaker_names.trim() || null,
        speaker_titles: arForm.speaker_titles.trim() || null,
        speaker_org: arForm.speaker_org.trim() || null,
        presentation_title: arForm.presentation_title.trim() || null,
        participant_type: arForm.participant_type.trim() || null,
        participant_count: arForm.participant_count.trim() || null,
        highlights: arForm.highlights.trim() || null,
        key_takeaways: arForm.key_takeaways.trim() || null,
        summary: arForm.summary.trim() || null,
        organiser_name: arForm.organiser_name.trim() || null,
        organiser_designation: arForm.organiser_designation.trim() || null,
        atr: arForm.atr.trim() || null,
        coordinator_status: 'pending',
        saps_status: 'pending',
      }).select().single();
      if (error) throw error;
      setMyARs(prev => [data, ...prev]);
      setARForm({ ...DEFAULT_AR });
      setShowARForm(false);
      Alert.alert('Submitted', 'Activity report submitted for faculty coordinator approval.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not submit activity report.');
    } finally {
      setARSaving(false);
    }
  };

  const approveARCoord = async (ar) => {
    const { error } = await supabase.from('activity_reports').update({
      coordinator_status: 'approved',
    }).eq('id', ar.id);
    if (error) { Alert.alert('Error', error.message); return; }
    setPendingARsCoord(prev => prev.filter(a => a.id !== ar.id));
    Alert.alert('Approved', 'Activity report forwarded to SAPS.');
  };

  const approveARSAPS = async (ar) => {
    const { error } = await supabase.from('activity_reports').update({
      saps_status: 'approved',
    }).eq('id', ar.id);
    if (error) { Alert.alert('Error', error.message); return; }
    setPendingARsSAPS(prev => prev.filter(a => a.id !== ar.id));
    Alert.alert('Approved', 'Activity report fully approved.');
  };

  const submitRejectAR = async () => {
    if (!rejectARReason.trim()) { Alert.alert('Required', 'Rejection reason is required.'); return; }
    setRejectARSaving(true);
    const { stage, ar } = rejectAR;
    const patch = stage === 'coord'
      ? { coordinator_status: 'rejected', coordinator_rejection_reason: rejectARReason.trim() }
      : { saps_status: 'rejected', saps_rejection_reason: rejectARReason.trim() };
    const { error } = await supabase.from('activity_reports').update(patch).eq('id', ar.id);
    setRejectARSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    if (stage === 'coord') setPendingARsCoord(prev => prev.filter(a => a.id !== ar.id));
    else setPendingARsSAPS(prev => prev.filter(a => a.id !== ar.id));
    setRejectAR(null); setRejectARReason('');
    Alert.alert('Rejected', 'Activity report rejected.');
  };

  // ── .docx download ────────────────────────────────────────────────────────
  const [downloading, setDownloading] = useState(null); // docId being downloaded

  const handleDownloadDocx = async (type, docId, docTitle) => {
    if (downloading) return;
    setDownloading(docId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-docx', {
        body: { type, id: docId },
      });
      if (error) throw error;
      if (!data?.base64) throw new Error('No document data returned');

      const { base64, filename } = data;

      if (Platform.OS === 'web') {
        // Web: decode base64 → Blob → anchor click
        const byteChars = atob(base64);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNums)], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `${docTitle || 'document'}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Mobile: write to document directory, share
        const safe = (docTitle || 'document').replace(/[^a-zA-Z0-9_\-]/g, '_');
        const fileUri = FileSystem.documentDirectory + (filename || `${safe}.docx`);
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            dialogTitle: filename || 'Download document',
          });
        } else {
          Alert.alert('Saved', `Document saved to: ${fileUri}`);
        }
      }
    } catch (e) {
      Alert.alert('Download Failed', e.message || 'Could not generate document. Make sure the Edge Function is deployed.');
    } finally {
      setDownloading(null);
    }
  };

  // ── Status helpers ────────────────────────────────────────────────────────
  const nfaStatusColor = st => st === 'approved' ? colors.green : st === 'rejected' ? colors.red : colors.amber;
  const nfaStatusLabel = st => st === 'approved' ? '✓ Approved' : st === 'rejected' ? '✗ Rejected' : '⏳ Pending';
  const arStatusColor = (cs, ss) => cs === 'rejected' || ss === 'rejected' ? colors.red : cs === 'approved' && ss === 'approved' ? colors.green : colors.amber;
  const arStatusLabel = (cs, ss) => {
    if (cs === 'rejected') return '✗ Coordinator Rejected';
    if (cs === 'pending') return '⏳ Awaiting Coordinator';
    if (ss === 'rejected') return '✗ SAPS Rejected';
    if (ss === 'pending') return '⏳ Awaiting SAPS';
    return '✓ Fully Approved';
  };

  const budgetTotal = items => items.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 13 }}>Loading documents…</Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Section pills */}
      <View style={s.sectionPills}>
        {[{ key: 'nfa', label: '📄 NFA' }, { key: 'activity', label: '📋 Activity Report' }].map(p => (
          <TouchableOpacity
            key={p.key}
            style={[s.sectionPill, section === p.key && s.sectionPillActive]}
            onPress={() => setSection(p.key)}
            activeOpacity={0.7}
          >
            <Text style={[s.sectionPillText, section === p.key && s.sectionPillTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── NFA Section ───────────────────────────────────────────────────── */}
      {section === 'nfa' && (
        <>
          {canCreateNFA && (
            <TouchableOpacity style={s.createBtn} onPress={() => setShowNFAForm(true)} activeOpacity={0.85}>
              <Text style={s.createBtnText}>+ Create NFA</Text>
            </TouchableOpacity>
          )}

          {/* My NFAs */}
          <Text style={s.listHeader}>MY SUBMITTED NFAs</Text>
          {myNFAs.length === 0
            ? <Text style={s.emptyText}>No NFAs submitted yet.</Text>
            : myNFAs.map(nfa => (
              <View key={nfa.id} style={s.docCard}>
                <View style={s.docCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.docTitle}>{nfa.title_of_session || '(no title)'}</Text>
                    <Text style={s.docMeta}>{nfa.club_name} · {nfa.event_date || 'Date TBD'}</Text>
                  </View>
                  <StatusBadge label={nfaStatusLabel(nfa.status)} color={nfaStatusColor(nfa.status)} />
                </View>
                {nfa.status === 'rejected' && nfa.rejection_reason ? (
                  <Text style={s.rejectionText}>Reason: {nfa.rejection_reason}</Text>
                ) : null}
                <TouchableOpacity
                  style={s.docxBtn}
                  onPress={() => handleDownloadDocx('nfa_docx', nfa.id, nfa.title_of_session)}
                  disabled={downloading === nfa.id}
                  activeOpacity={0.8}
                >
                  {downloading === nfa.id
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Text style={s.docxBtnText}>⬇ Download .docx</Text>}
                </TouchableOpacity>
              </View>
            ))
          }

          {/* Pending NFA Approvals — coordinators only */}
          {isCoordinator && (
            <>
              <Text style={[s.listHeader, { marginTop: spacing.lg }]}>
                PENDING NFA APPROVALS {pendingNFAs.length > 0 ? `(${pendingNFAs.length})` : ''}
              </Text>
              {pendingNFAs.length === 0
                ? <Text style={s.emptyText}>No pending NFAs for your clubs.</Text>
                : pendingNFAs.map(nfa => (
                  <View key={nfa.id} style={[s.docCard, s.pendingCard]}>
                    <Text style={s.docTitle}>{nfa.title_of_session || '(no title)'}</Text>
                    <Text style={s.docMeta}>{nfa.club_name} · by {nfa.creator_name}</Text>
                    <Text style={s.docMeta}>Date: {nfa.event_date || 'TBD'} · Mode: {nfa.mode || '—'}</Text>
                    {nfa.abstract ? <Text style={s.docSnippet} numberOfLines={2}>{nfa.abstract}</Text> : null}
                    <TouchableOpacity
                      style={s.docxBtn}
                      onPress={() => handleDownloadDocx('nfa_docx', nfa.id, nfa.title_of_session)}
                      disabled={downloading === nfa.id}
                      activeOpacity={0.8}
                    >
                      {downloading === nfa.id
                        ? <ActivityIndicator size="small" color={colors.primary} />
                        : <Text style={s.docxBtnText}>⬇ Preview .docx</Text>}
                    </TouchableOpacity>
                    <View style={s.approvalRow}>
                      <TouchableOpacity style={s.approveBtn} onPress={() => approveNFA(nfa)} activeOpacity={0.8}>
                        <Text style={s.approveBtnText}>✓ Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.rejectBtn} onPress={() => { setRejectNFA(nfa); setRejectNFAReason(''); }} activeOpacity={0.8}>
                        <Text style={s.rejectBtnText}>✗ Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              }
            </>
          )}
        </>
      )}

      {/* ── Activity Report Section ───────────────────────────────────────── */}
      {section === 'activity' && (
        <>
          {canCreateAR && (
            <TouchableOpacity style={s.createBtn} onPress={() => setShowARForm(true)} activeOpacity={0.85}>
              <Text style={s.createBtnText}>+ Create Activity Report</Text>
            </TouchableOpacity>
          )}

          {/* My Activity Reports */}
          {(canCreateAR) && (
            <>
              <Text style={s.listHeader}>MY ACTIVITY REPORTS</Text>
              {myARs.length === 0
                ? <Text style={s.emptyText}>No activity reports submitted yet.</Text>
                : myARs.map(ar => (
                  <View key={ar.id} style={s.docCard}>
                    <View style={s.docCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.docTitle}>{ar.title_of_activity || '(no title)'}</Text>
                        <Text style={s.docMeta}>{ar.club_name || 'No club'} · {ar.activity_date || 'Date TBD'}</Text>
                      </View>
                      <StatusBadge
                        label={arStatusLabel(ar.coordinator_status, ar.saps_status)}
                        color={arStatusColor(ar.coordinator_status, ar.saps_status)}
                      />
                    </View>
                    {ar.coordinator_status === 'rejected' && ar.coordinator_rejection_reason
                      ? <Text style={s.rejectionText}>Coordinator: {ar.coordinator_rejection_reason}</Text>
                      : null}
                    {ar.saps_status === 'rejected' && ar.saps_rejection_reason
                      ? <Text style={s.rejectionText}>SAPS: {ar.saps_rejection_reason}</Text>
                      : null}
                    <TouchableOpacity
                      style={s.docxBtn}
                      onPress={() => handleDownloadDocx('activity_report', ar.id, ar.title_of_activity)}
                      disabled={downloading === ar.id}
                      activeOpacity={0.8}
                    >
                      {downloading === ar.id
                        ? <ActivityIndicator size="small" color={colors.primary} />
                        : <Text style={s.docxBtnText}>⬇ Download .docx</Text>}
                    </TouchableOpacity>
                  </View>
                ))
              }
            </>
          )}

          {/* Coordinator approval stage */}
          {isCoordinator && (
            <>
              <Text style={[s.listHeader, { marginTop: spacing.lg }]}>
                PENDING APPROVALS — COORDINATOR STAGE {pendingARsCoord.length > 0 ? `(${pendingARsCoord.length})` : ''}
              </Text>
              {pendingARsCoord.length === 0
                ? <Text style={s.emptyText}>No reports pending your approval.</Text>
                : pendingARsCoord.map(ar => (
                  <View key={ar.id} style={[s.docCard, s.pendingCard]}>
                    <Text style={s.docTitle}>{ar.title_of_activity || '(no title)'}</Text>
                    <Text style={s.docMeta}>{ar.club_name} · by {ar.creator_name}</Text>
                    <Text style={s.docMeta}>Date: {ar.activity_date || 'TBD'} · Venue: {ar.venue || '—'}</Text>
                    {ar.summary ? <Text style={s.docSnippet} numberOfLines={2}>{ar.summary}</Text> : null}
                    <TouchableOpacity
                      style={s.docxBtn}
                      onPress={() => handleDownloadDocx('activity_report', ar.id, ar.title_of_activity)}
                      disabled={downloading === ar.id}
                      activeOpacity={0.8}
                    >
                      {downloading === ar.id
                        ? <ActivityIndicator size="small" color={colors.primary} />
                        : <Text style={s.docxBtnText}>⬇ Preview .docx</Text>}
                    </TouchableOpacity>
                    <View style={s.approvalRow}>
                      <TouchableOpacity style={s.approveBtn} onPress={() => approveARCoord(ar)} activeOpacity={0.8}>
                        <Text style={s.approveBtnText}>✓ Approve → SAPS</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.rejectBtn} onPress={() => { setRejectAR({ ar, stage: 'coord' }); setRejectARReason(''); }} activeOpacity={0.8}>
                        <Text style={s.rejectBtnText}>✗ Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              }
            </>
          )}

          {/* SAPS approval stage */}
          {isSAPS && (
            <>
              <Text style={[s.listHeader, { marginTop: spacing.lg }]}>
                PENDING APPROVALS — SAPS STAGE {pendingARsSAPS.length > 0 ? `(${pendingARsSAPS.length})` : ''}
              </Text>
              {pendingARsSAPS.length === 0
                ? <Text style={s.emptyText}>No reports pending SAPS approval.</Text>
                : pendingARsSAPS.map(ar => (
                  <View key={ar.id} style={[s.docCard, s.pendingCard]}>
                    <Text style={s.docTitle}>{ar.title_of_activity || '(no title)'}</Text>
                    <Text style={s.docMeta}>{ar.club_name} · by {ar.creator_name}</Text>
                    <Text style={s.docMeta}>Date: {ar.activity_date || 'TBD'}</Text>
                    {ar.summary ? <Text style={s.docSnippet} numberOfLines={2}>{ar.summary}</Text> : null}
                    <TouchableOpacity
                      style={s.docxBtn}
                      onPress={() => handleDownloadDocx('activity_report', ar.id, ar.title_of_activity)}
                      disabled={downloading === ar.id}
                      activeOpacity={0.8}
                    >
                      {downloading === ar.id
                        ? <ActivityIndicator size="small" color={colors.primary} />
                        : <Text style={s.docxBtnText}>⬇ Preview .docx</Text>}
                    </TouchableOpacity>
                    <View style={s.approvalRow}>
                      <TouchableOpacity style={s.approveBtn} onPress={() => approveARSAPS(ar)} activeOpacity={0.8}>
                        <Text style={s.approveBtnText}>✓ Final Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.rejectBtn} onPress={() => { setRejectAR({ ar, stage: 'saps' }); setRejectARReason(''); }} activeOpacity={0.8}>
                        <Text style={s.rejectBtnText}>✗ Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              }
            </>
          )}
        </>
      )}

      {/* ── NFA Form Modal ────────────────────────────────────────────────── */}
      <Modal visible={showNFAForm} animationType="slide" transparent onRequestClose={() => setShowNFAForm(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBackdrop}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowNFAForm(false)} activeOpacity={1} />
          </View>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New NFA Request</Text>
              <TouchableOpacity onPress={() => setShowNFAForm(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Club selector */}
              <FieldLabel text="CLUB / TEAM *" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
                {myNFAClubs.map(club => (
                  <TouchableOpacity
                    key={club.id}
                    style={[s.clubPill, nfaForm.club_id === club.id && s.clubPillActive]}
                    onPress={() => setNFAForm(f => ({ ...f, club_id: club.id, club_name: club.name }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.clubPillText, nfaForm.club_id === club.id && s.clubPillTextActive]}>
                      {club.emoji} {club.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FieldLabel text="TITLE OF SESSION *" />
              <FieldInput value={nfaForm.title_of_session} onChangeText={t => setNFAForm(f => ({ ...f, title_of_session: t }))} placeholder="e.g. Guest Lecture on Financial Modelling" />

              <TouchableOpacity
                style={s.aiGenerateBtn}
                onPress={() => setShowAIModal(true)}
                activeOpacity={0.85}
              >
                <Text style={s.aiGenerateBtnText}>✨ Generate with AI</Text>
              </TouchableOpacity>
              <Text style={s.aiDisclaimer}>AI-generated content should be reviewed before official use. Content may be processed by Anthropic's API.</Text>

              <FieldLabel text="ABSTRACT" />
              <FieldInput value={nfaForm.abstract} onChangeText={t => setNFAForm(f => ({ ...f, abstract: t }))} placeholder="Brief overview of the session…" multiline />

              <FieldLabel text="OBJECTIVES" />
              <BulletList
                items={nfaForm.objectives}
                onChange={v => setNFAForm(f => ({ ...f, objectives: v }))}
                placeholder="Add objective…"
              />

              <FieldLabel text="EXPECTED OUTCOMES" />
              <BulletList
                items={nfaForm.expected_outcomes}
                onChange={v => setNFAForm(f => ({ ...f, expected_outcomes: v }))}
                placeholder="Add outcome…"
              />

              <FieldLabel text="RESOURCE PERSON" />
              <FieldInput value={nfaForm.resource_person} onChangeText={t => setNFAForm(f => ({ ...f, resource_person: t }))} placeholder="Speaker / resource person name" />

              <FieldLabel text="TARGET AUDIENCE" />
              <FieldInput value={nfaForm.target_audience} onChangeText={t => setNFAForm(f => ({ ...f, target_audience: t }))} placeholder="e.g. 2nd & 3rd year B.Com students" />

              <FieldLabel text="ESTIMATED STAKEHOLDERS" />
              <FieldInput value={nfaForm.stakeholders_count} onChangeText={t => setNFAForm(f => ({ ...f, stakeholders_count: t }))} placeholder="e.g. 60" />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel text="EVENT DATE" />
                  <FieldInput value={nfaForm.event_date} onChangeText={t => setNFAForm(f => ({ ...f, event_date: t }))} placeholder="e.g. 25 Jul 2026" />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel text="EVENT TIME" />
                  <FieldInput value={nfaForm.event_time} onChangeText={t => setNFAForm(f => ({ ...f, event_time: t }))} placeholder="e.g. 10:00 AM" />
                </View>
              </View>

              <FieldLabel text="MODE" />
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
                {['Offline', 'Online', 'Hybrid'].map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[s.modePill, nfaForm.mode === m && s.modePillActive]}
                    onPress={() => setNFAForm(f => ({ ...f, mode: m }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.modePillText, nfaForm.mode === m && s.modePillTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {nfaForm.mode !== 'Offline' && (
                <>
                  <FieldLabel text="MEETING LINK" />
                  <FieldInput value={nfaForm.link} onChangeText={t => setNFAForm(f => ({ ...f, link: t }))} placeholder="https://meet.google.com/…" />
                </>
              )}

              {nfaForm.mode !== 'Online' && (
                <>
                  <FieldLabel text="VENUE" />
                  <FieldInput value={nfaForm.venue} onChangeText={t => setNFAForm(f => ({ ...f, venue: t }))} placeholder="e.g. Seminar Hall, Block A" />
                </>
              )}

              <FieldLabel text="ORGANISED BY" />
              <FieldInput value={nfaForm.organised_by} onChangeText={t => setNFAForm(f => ({ ...f, organised_by: t }))} placeholder="e.g. ACE Club, Department of Commerce" />

              <FieldLabel text="KEY TAKEAWAYS" />
              <BulletList
                items={nfaForm.key_takeaways}
                onChange={v => setNFAForm(f => ({ ...f, key_takeaways: v }))}
                placeholder="Add takeaway…"
              />

              {/* Budget table */}
              <FieldLabel text="BUDGET" />
              <View style={s.budgetTable}>
                <View style={[s.budgetRow, s.budgetHeader]}>
                  <Text style={[s.budgetCell, s.budgetCellLabel, s.budgetHeaderText]}>Particular</Text>
                  <Text style={[s.budgetCell, s.budgetCellAmt, s.budgetHeaderText]}>Amount (₹)</Text>
                  <View style={{ width: 28 }} />
                </View>
                {nfaForm.budget_items.map((item, i) => (
                  <View key={i} style={s.budgetRow}>
                    <TextInput
                      value={item.particular}
                      onChangeText={t => {
                        const next = [...nfaForm.budget_items];
                        next[i] = { ...next[i], particular: t };
                        setNFAForm(f => ({ ...f, budget_items: next }));
                      }}
                      placeholder="e.g. Refreshments"
                      placeholderTextColor={colors.textTertiary}
                      style={[s.fieldInput, s.budgetCell, s.budgetCellLabel, { marginBottom: 0 }]}
                    />
                    <TextInput
                      value={item.amount}
                      onChangeText={t => {
                        const next = [...nfaForm.budget_items];
                        next[i] = { ...next[i], amount: t };
                        setNFAForm(f => ({ ...f, budget_items: next }));
                      }}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      style={[s.fieldInput, s.budgetCell, s.budgetCellAmt, { marginBottom: 0 }]}
                    />
                    <TouchableOpacity
                      style={{ width: 28, alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => setNFAForm(f => ({ ...f, budget_items: f.budget_items.filter((_, j) => j !== i) }))}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: colors.red, fontSize: 18 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={[s.budgetRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <Text style={[s.budgetCell, s.budgetCellLabel, { color: colors.textSecondary, fontSize: 12, ...font.semibold }]}>TOTAL</Text>
                  <Text style={[s.budgetCell, s.budgetCellAmt, { ...font.bold, color: colors.textPrimary }]}>
                    ₹{budgetTotal(nfaForm.budget_items).toLocaleString()}
                  </Text>
                  <View style={{ width: 28 }} />
                </View>
              </View>
              <TouchableOpacity
                style={s.addPointBtn}
                onPress={() => setNFAForm(f => ({ ...f, budget_items: [...f.budget_items, { particular: '', amount: '' }] }))}
                activeOpacity={0.7}
              >
                <Text style={s.addPointBtnText}>+ Add row</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.submitBtn, nfaSaving && { opacity: 0.6 }]}
                onPress={submitNFA}
                disabled={nfaSaving}
                activeOpacity={0.85}
              >
                {nfaSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.submitBtnText}>Submit NFA</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Activity Report Form Modal ────────────────────────────────────── */}
      <Modal visible={showARForm} animationType="slide" transparent onRequestClose={() => setShowARForm(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBackdrop}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowARForm(false)} activeOpacity={1} />
          </View>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Activity Report</Text>
              <TouchableOpacity onPress={() => setShowARForm(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Club whose event is being documented */}
              <FieldLabel text="ORGANISING CLUB / TEAM" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
                {hubClubs.map(club => (
                  <TouchableOpacity
                    key={club.id}
                    style={[s.clubPill, arForm.club_id === String(club.id) && s.clubPillActive]}
                    onPress={() => setARForm(f => ({ ...f, club_id: String(club.id), club_name: club.name }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.clubPillText, arForm.club_id === String(club.id) && s.clubPillTextActive]}>
                      {club.emoji} {club.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FieldLabel text="TYPE OF ACTIVITY" />
              <FieldInput value={arForm.type_of_activity} onChangeText={t => setARForm(f => ({ ...f, type_of_activity: t }))} placeholder="e.g. Guest Lecture, Workshop, Cultural Event" />

              <FieldLabel text="TITLE OF ACTIVITY *" />
              <FieldInput value={arForm.title_of_activity} onChangeText={t => setARForm(f => ({ ...f, title_of_activity: t }))} placeholder="Full title of the activity" />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel text="DATE" />
                  <FieldInput value={arForm.activity_date} onChangeText={t => setARForm(f => ({ ...f, activity_date: t }))} placeholder="e.g. 20 Jun 2026" />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel text="TIME" />
                  <FieldInput value={arForm.activity_time} onChangeText={t => setARForm(f => ({ ...f, activity_time: t }))} placeholder="e.g. 10:00 AM" />
                </View>
              </View>

              <FieldLabel text="VENUE" />
              <FieldInput value={arForm.venue} onChangeText={t => setARForm(f => ({ ...f, venue: t }))} placeholder="e.g. Seminar Hall, Block B" />

              <FieldLabel text="SPEAKER NAME(S)" />
              <FieldInput value={arForm.speaker_names} onChangeText={t => setARForm(f => ({ ...f, speaker_names: t }))} placeholder="e.g. Dr. John Smith" />

              <FieldLabel text="SPEAKER TITLE(S)" />
              <FieldInput value={arForm.speaker_titles} onChangeText={t => setARForm(f => ({ ...f, speaker_titles: t }))} placeholder="e.g. Professor, CFO" />

              <FieldLabel text="SPEAKER ORGANISATION" />
              <FieldInput value={arForm.speaker_org} onChangeText={t => setARForm(f => ({ ...f, speaker_org: t }))} placeholder="e.g. IIM Bangalore" />

              <FieldLabel text="PRESENTATION TITLE" />
              <FieldInput value={arForm.presentation_title} onChangeText={t => setARForm(f => ({ ...f, presentation_title: t }))} placeholder="Title of the presentation / topic" />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel text="PARTICIPANT TYPE" />
                  <FieldInput value={arForm.participant_type} onChangeText={t => setARForm(f => ({ ...f, participant_type: t }))} placeholder="e.g. B.Com Students" />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel text="PARTICIPANT COUNT" />
                  <FieldInput value={arForm.participant_count} onChangeText={t => setARForm(f => ({ ...f, participant_count: t }))} placeholder="e.g. 75" />
                </View>
              </View>

              <FieldLabel text="HIGHLIGHTS" />
              <FieldInput value={arForm.highlights} onChangeText={t => setARForm(f => ({ ...f, highlights: t }))} placeholder="Key highlights from the activity…" multiline />

              <FieldLabel text="KEY TAKEAWAYS" />
              <FieldInput value={arForm.key_takeaways} onChangeText={t => setARForm(f => ({ ...f, key_takeaways: t }))} placeholder="What participants gained…" multiline />

              <FieldLabel text="SUMMARY" />
              <FieldInput value={arForm.summary} onChangeText={t => setARForm(f => ({ ...f, summary: t }))} placeholder="Narrative summary of the event…" multiline />

              <FieldLabel text="ORGANISER NAME" />
              <FieldInput value={arForm.organiser_name} onChangeText={t => setARForm(f => ({ ...f, organiser_name: t }))} placeholder="Name of the faculty / student organiser" />

              <FieldLabel text="ORGANISER DESIGNATION" />
              <FieldInput value={arForm.organiser_designation} onChangeText={t => setARForm(f => ({ ...f, organiser_designation: t }))} placeholder="e.g. Faculty Coordinator, Club President" />

              <FieldLabel text="ACTION TAKEN REPORT (ATR)" />
              <FieldInput value={arForm.atr} onChangeText={t => setARForm(f => ({ ...f, atr: t }))} placeholder="Follow-up actions taken after the event…" multiline />

              <TouchableOpacity
                style={[s.submitBtn, arSaving && { opacity: 0.6 }]}
                onPress={submitAR}
                disabled={arSaving}
                activeOpacity={0.85}
              >
                {arSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.submitBtnText}>Submit Activity Report</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── AI Generate Modal ────────────────────────────────────────────── */}
      <Modal visible={showAIModal} animationType="fade" transparent onRequestClose={() => setShowAIModal(false)}>
        <View style={s.smallModalOverlay}>
          <View style={s.aiModalBox}>
            <Text style={s.smallModalTitle}>✨ Generate with AI</Text>
            <Text style={s.smallModalSub}>Choose how to describe the event:</Text>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
              <TouchableOpacity
                style={[s.aiModeBtn, aiMode === 'poster' && s.aiModeBtnActive]}
                onPress={() => { setAIMode('poster'); setAIDescription(''); }}
                activeOpacity={0.7}
              >
                <Text style={[s.aiModeBtnText, aiMode === 'poster' && s.aiModeBtnTextActive]}>📸 Upload Poster</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.aiModeBtn, aiMode === 'describe' && s.aiModeBtnActive]}
                onPress={() => { setAIMode('describe'); setAIPoster(null); }}
                activeOpacity={0.7}
              >
                <Text style={[s.aiModeBtnText, aiMode === 'describe' && s.aiModeBtnTextActive]}>✏️ Describe the Event</Text>
              </TouchableOpacity>
            </View>

            {aiMode === 'poster' && (
              <TouchableOpacity style={s.uploadPosterBtn} onPress={pickPoster} activeOpacity={0.8}>
                <Text style={s.uploadPosterBtnText}>
                  {aiPoster ? '✓ Poster selected — tap to replace' : '+ Choose JPG / PNG'}
                </Text>
              </TouchableOpacity>
            )}

            {aiMode === 'describe' && (
              <TextInput
                value={aiDescription}
                onChangeText={setAIDescription}
                placeholder="Briefly describe the event — name, type, topic, speaker, audience…"
                placeholderTextColor={colors.textTertiary}
                style={[s.fieldInput, { height: 100, textAlignVertical: 'top' }]}
                multiline
                autoFocus
              />
            )}

            <View style={[s.approvalRow, { marginTop: spacing.md }]}>
              <TouchableOpacity
                style={[s.approveBtn, (!aiMode || aiGenerating) && { opacity: 0.45 }]}
                onPress={generateWithAI}
                disabled={!aiMode || aiGenerating}
                activeOpacity={0.8}
              >
                {aiGenerating
                  ? <ActivityIndicator size="small" color={colors.green} />
                  : <Text style={s.approveBtnText}>Generate</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => { setShowAIModal(false); setAIMode(null); setAIDescription(''); setAIPoster(null); }}
                activeOpacity={0.8}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── NFA Reject Modal ─────────────────────────────────────────────── */}
      <Modal visible={!!rejectNFA} animationType="fade" transparent onRequestClose={() => setRejectNFA(null)}>
        <View style={s.smallModalOverlay}>
          <View style={s.smallModalBox}>
            <Text style={s.smallModalTitle}>Reject NFA</Text>
            <Text style={s.smallModalSub}>Provide a reason for the rejection (shown to the requester):</Text>
            <TextInput
              value={rejectNFAReason}
              onChangeText={setRejectNFAReason}
              placeholder="Enter rejection reason…"
              placeholderTextColor={colors.textTertiary}
              style={[s.fieldInput, { height: 80, textAlignVertical: 'top' }]}
              multiline
            />
            <View style={s.approvalRow}>
              <TouchableOpacity style={s.rejectBtn} onPress={submitRejectNFA} disabled={rejectNFASaving} activeOpacity={0.8}>
                {rejectNFASaving ? <ActivityIndicator color={colors.red} size="small" /> : <Text style={s.rejectBtnText}>Confirm Reject</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setRejectNFA(null)} activeOpacity={0.8}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── AR Reject Modal ───────────────────────────────────────────────── */}
      <Modal visible={!!rejectAR} animationType="fade" transparent onRequestClose={() => setRejectAR(null)}>
        <View style={s.smallModalOverlay}>
          <View style={s.smallModalBox}>
            <Text style={s.smallModalTitle}>
              Reject Activity Report{rejectAR?.stage === 'saps' ? ' (SAPS)' : ' (Coordinator)'}
            </Text>
            <Text style={s.smallModalSub}>Provide a reason:</Text>
            <TextInput
              value={rejectARReason}
              onChangeText={setRejectARReason}
              placeholder="Enter rejection reason…"
              placeholderTextColor={colors.textTertiary}
              style={[s.fieldInput, { height: 80, textAlignVertical: 'top' }]}
              multiline
            />
            <View style={s.approvalRow}>
              <TouchableOpacity style={s.rejectBtn} onPress={submitRejectAR} disabled={rejectARSaving} activeOpacity={0.8}>
                {rejectARSaving ? <ActivityIndicator color={colors.red} size="small" /> : <Text style={s.rejectBtnText}>Confirm Reject</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setRejectAR(null)} activeOpacity={0.8}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  sectionPills: { flexDirection: 'row', gap: 8, padding: spacing.md, paddingBottom: 0 },
  sectionPill: {
    flex: 1, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', backgroundColor: colors.card,
  },
  sectionPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sectionPillText: { fontSize: 12, color: colors.textSecondary, ...font.semibold },
  sectionPillTextActive: { color: '#fff' },

  createBtn: {
    margin: spacing.md, marginBottom: 0,
    backgroundColor: colors.primary,
    borderRadius: radius.md, paddingVertical: 12,
    alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontSize: 14, ...font.bold },

  listHeader: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold,
    marginHorizontal: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 13, color: colors.textTertiary, marginHorizontal: spacing.md,
    marginBottom: spacing.sm, fontStyle: 'italic',
  },

  docCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    padding: spacing.md,
  },
  pendingCard: { borderColor: colors.amber + '88', backgroundColor: colors.amberLight },
  docCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: 6 },
  docTitle: { fontSize: 14, ...font.bold, color: colors.textPrimary, marginBottom: 2 },
  docMeta: { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
  docSnippet: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 4, marginBottom: 4 },
  rejectionText: { fontSize: 11, color: colors.red, marginTop: 4, marginBottom: 4 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  badgeText: { fontSize: 10, ...font.semibold },

  docxBtn: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start',
    marginTop: 8,
  },
  docxBtnText: { fontSize: 11, color: colors.primary, ...font.semibold },

  approvalRow: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  approveBtn: {
    flex: 1, backgroundColor: colors.greenLight, borderWidth: 1, borderColor: colors.greenBorder,
    borderRadius: radius.sm, paddingVertical: 7, alignItems: 'center',
  },
  approveBtnText: { fontSize: 12, color: colors.green, ...font.bold },
  rejectBtn: {
    flex: 1, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: radius.sm, paddingVertical: 7, alignItems: 'center',
  },
  rejectBtnText: { fontSize: 12, color: colors.red, ...font.bold },
  cancelBtn: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingVertical: 7, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 12, color: colors.textSecondary, ...font.semibold },

  // Form modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, paddingBottom: 40,
    maxHeight: '92%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: 17, ...font.bold, color: colors.textPrimary },
  modalClose: { fontSize: 20, color: colors.textSecondary, padding: 4 },

  fieldLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold, marginBottom: 5, marginTop: spacing.sm,
  },
  fieldInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: 14, marginBottom: spacing.sm,
  },

  addPointBtn: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  addPointBtnText: { fontSize: 11, color: colors.primary, ...font.semibold },

  budgetTable: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    overflow: 'hidden', marginBottom: 6,
  },
  budgetRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  budgetHeader: { backgroundColor: colors.bg },
  budgetHeaderText: { fontSize: 10, ...font.bold, color: colors.textSecondary, paddingHorizontal: 10, paddingVertical: 6 },
  budgetCell: { paddingHorizontal: 6, paddingVertical: 4 },
  budgetCellLabel: { flex: 2 },
  budgetCellAmt: { flex: 1 },

  clubPill: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  clubPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  clubPillText: { fontSize: 11, color: colors.textSecondary, ...font.medium },
  clubPillTextActive: { color: '#fff' },

  modePill: {
    flex: 1, paddingVertical: 6, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
    backgroundColor: colors.bg,
  },
  modePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modePillText: { fontSize: 12, color: colors.textSecondary, ...font.medium },
  modePillTextActive: { color: '#fff' },

  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.md,
  },
  submitBtnText: { fontSize: 15, color: '#fff', ...font.bold },

  // AI generate button (in NFA form)
  aiGenerateBtn: {
    borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.md, paddingVertical: 10,
    alignItems: 'center', marginBottom: spacing.md,
    backgroundColor: colors.primary + '12',
  },
  aiGenerateBtnText: { fontSize: 13, color: colors.primary, ...font.semibold },
  aiDisclaimer: { fontSize: 11, color: colors.textTertiary, lineHeight: 16, marginBottom: spacing.md, textAlign: 'center' },

  // AI modal
  aiModalBox: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, width: '100%', maxWidth: 420,
  },
  aiModeBtn: {
    flex: 1, paddingVertical: 9, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', backgroundColor: colors.bg,
  },
  aiModeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  aiModeBtnText: { fontSize: 11, color: colors.textSecondary, ...font.medium },
  aiModeBtnTextActive: { color: '#fff' },
  uploadPosterBtn: {
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary,
    borderRadius: radius.md, paddingVertical: 16,
    alignItems: 'center', backgroundColor: colors.primary + '08',
    marginBottom: spacing.sm,
  },
  uploadPosterBtnText: { fontSize: 12, color: colors.primary, ...font.medium },

  // Small modal (reject reason)
  smallModalOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', padding: spacing.lg,
  },
  smallModalBox: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, width: '100%',
  },
  smallModalTitle: { fontSize: 15, ...font.bold, color: colors.textPrimary, marginBottom: 6 },
  smallModalSub: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
});
