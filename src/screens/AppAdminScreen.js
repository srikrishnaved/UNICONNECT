import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, ActivityIndicator, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { colors, spacing, radius, font } from '../theme';
import { ShieldCheck, Check, X, Pin, Trash2, Info, Landmark, Gift, ClipboardList, School } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { hubClubs } from '../data';

const ROOM_EMOJIS = ['📚', '✏️', '🧮', '📊', '💡', '🔬', '📖', '🎯'];

export default function AppAdminScreen() {
  const { clubAdminRequests, resolveClubAdminRequest, loadClubAdminRequests, userCreatedClubs, hiddenClubIds, deleteClub } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [crRequests, setCrRequests] = useState([]);
  const [resolvingCR, setResolvingCR] = useState(null);
  const [clubCreationRequests, setClubCreationRequests] = useState([]);
  const [resolvingClub, setResolvingClub] = useState(null);
  const [uniRequests, setUniRequests] = useState([]);
  const [resolvingUni, setResolvingUni] = useState(null);

  const { resolveClubCreationRequest } = useApp();

  const loadUniRequests = async () => {
    const { data } = await supabase.from('university_setup_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (data) setUniRequests(data);
  };

  const loadClubCreationRequests = async () => {
    const { data } = await supabase.from('club_creation_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (data) setClubCreationRequests(data);
  };

  const handleResolveClubCreation = async (req, action) => {
    setResolvingClub(req.id);
    try {
      await resolveClubCreationRequest(req, action);
      setClubCreationRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (e) {
      alert('Error: ' + (e.message || 'Could not process request.'));
    } finally {
      setResolvingClub(null);
    }
  };

  const loadCrRequests = async () => {
    const { data } = await supabase.from('cr_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (data) setCrRequests(data);
  };

  const resolveCrRequest = async (req, action) => {
    setResolvingCR(req.id);
    if (action === 'approved') {
      const { data: existing } = await supabase
        .from('cr_requests')
        .select('id')
        .eq('course', req.course)
        .eq('year', req.year)
        .eq('campus', req.campus)
        .eq('status', 'approved');
      if (existing && existing.length >= 2) {
        alert(`Cannot approve — ${req.course} · ${req.year} already has 2 approved CRs.`);
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
    setResolvingCR(null);
  };

  const handleResolveUniRequest = async (req, action) => {
    setResolvingUni(req.id);
    try {
      if (action === 'approved') {
        // Step 1: Initialize temporary client to avoid logging out the current App Admin session
        const tempSupabase = createClient('https://qoseoqvdwiaqdkmivrxk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvc2VvcXZkd2lhcWRrbWl2cnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTE0NzcsImV4cCI6MjA5NjMyNzQ3N30.2ykDB6h_VYClR6yxHuqK0N3UTpztBYcTTK7wvO5tGoY', {
          auth: { persistSession: false }
        });

        // Step 2: Create Auth account
        const { data: signUpData, error: signUpErr } = await tempSupabase.auth.signUp({
          email: req.admin_email,
          password: req.admin_password_hash,
        });
        if (signUpErr) throw signUpErr;
        const newUserId = signUpData.user?.id;
        if (!newUserId) throw new Error('Auth account creation failed.');

        // Step 3: Insert user profile as Active Super Admin
        const { error: profileErr } = await supabase
          .from('profiles')
          .insert({
            id: newUserId,
            name: req.admin_name,
            email: req.admin_email,
            role: 'student',
            status: 'active',
            course: 'Setup',
            year: 'N/A',
            campus: 'Main',
            is_super_admin: true,
            university_id: newUserId,
          });
        if (profileErr) throw profileErr;

        // Step 4: Insert university setup progress
        const classesArray = req.classes_list ? req.classes_list.split(',').map(c => c.trim()).filter(Boolean) : [];
        const { error: progressErr } = await supabase
          .from('university_setup_progress')
          .insert({
            university_id: newUserId,
            university_name: req.university_name,
            university_website: req.university_website,
            enabled_classes: classesArray,
            enabled_features: req.enabled_features || ['timetable', 'attendance', 'naac', 'clubs', 'networking'],
            step_details_done: true,
            step_classes_done: true,
            is_setup_complete: true,
          });
        if (progressErr && progressErr.code !== '23505') throw progressErr;

        // Step 5: Seed customized university periods
        const periodCount = req.periods_count || 6;
        const periodsToUpsert = Array.from({ length: periodCount }, (_, i) => {
          let label = `P${i + 1}`;
          let start = '09:00:00';
          let end = '10:00:00';

          if (i === 0) { label = 'M1'; start = '09:00:00'; end = '10:00:00'; }
          else if (i === 1) { label = 'M2'; start = '10:00:00'; end = '11:00:00'; }
          else if (i === 2) { label = 'P1'; start = '11:15:00'; end = '12:15:00'; }
          else if (i === 3) { label = 'P2'; start = '12:15:00'; end = '13:15:00'; }
          else if (i === 4) { label = 'P3'; start = '14:00:00'; end = '15:00:00'; }
          else if (i === 5) { label = 'P4'; start = '15:00:00'; end = '16:00:00'; }
          else {
            const hour = i + 9;
            start = `${hour}:00:00`;
            end = `${hour + 1}:00:00`;
          }
          
          return {
            university_id: newUserId,
            label: label,
            start_time: start,
            end_time: end,
            is_break: false,
            period_order: i,
            applies_to_days: ['MON', 'TUE', 'WED', 'THU', 'FRI']
          };
        });

        await supabase.from('university_periods').delete().eq('university_id', newUserId);
        const { error: perErr } = await supabase.from('university_periods').insert(periodsToUpsert);
        if (perErr) throw perErr;

        // Step 6: Update registration request with the approved user ID
        await supabase
          .from('university_setup_requests')
          .update({ 
            status: action,
            approved_user_id: newUserId
          })
          .eq('id', req.id);

        // Step 7: Push welcome notification
        await supabase.from('notifications').insert({
          user_id: newUserId,
          type: 'info',
          title: 'Workspace Request Approved!',
          body: `Your request for "${req.university_name}" has been approved. Log in to start configuring your campus.`,
          read: false,
        });

      } else {
        await supabase
          .from('university_setup_requests')
          .update({ status: action })
          .eq('id', req.id);
      }

      setUniRequests(prev => prev.filter(r => r.id !== req.id));
      alert(`Request ${action} successfully!`);
    } catch (e) {
      alert('Error: ' + (e.message || 'Could not process request.'));
    } finally {
      setResolvingUni(null);
    }
  };
  const [permRooms, setPermRooms] = useState([]);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomSubject, setRoomSubject] = useState('');
  const [roomEmoji, setRoomEmoji] = useState('📚');
  const [roomCreating, setRoomCreating] = useState(false);

  const loadPermRooms = () => {
    supabase
      .from('study_rooms')
      .select('*')
      .eq('is_permanent', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPermRooms(data || []));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadClubAdminRequests(),
      loadUniRequests(),
      loadCrRequests(),
      loadClubCreationRequests(),
    ]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadPermRooms();
    loadClubAdminRequests();
    loadCrRequests();
    loadClubCreationRequests();
    loadUniRequests();
  }, []);

  const handleResolve = async (req, action) => {
    try {
      await resolveClubAdminRequest(req.id, action);
    } catch (err) {
      alert('Error: ' + (err.message || 'Could not process request. Check Supabase RLS policies.'));
    }
  };

  const createPermRoom = async () => {
    if (!roomName.trim()) return;
    setRoomCreating(true);
    const { error } = await supabase.from('study_rooms').insert({
      name: roomName.trim(),
      subject: roomSubject.trim() || null,
      emoji: roomEmoji,
      creator_id: null,
      creator_name: 'Admin',
      is_permanent: true,
    });
    setRoomCreating(false);
    if (!error) {
      setShowRoomModal(false);
      setRoomName('');
      setRoomSubject('');
      setRoomEmoji('📚');
      loadPermRooms();
    }
  };

  const deletePermRoom = (id) => {
    Alert.alert('Delete Room', 'Remove this featured room for everyone?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('study_rooms').delete().eq('id', id);
        setPermRooms(prev => prev.filter(r => r.id !== id));
      }},
    ]);
  };

  const handleApprove = (item) => {
    Alert.alert(
      'Approve Application',
      `Approve "${item.name}"? ${item.applicant} will become the admin and can post events.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: () => {
            setPending(prev => prev.filter(p => p.id !== item.id));
            setApproved(prev => prev + 1);
          },
        },
      ]
    );
  };

  const handleReject = (item) => {
    Alert.alert(
      'Reject Application',
      `Reject "${item.name}"? The applicant will be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => {
            setPending(prev => prev.filter(p => p.id !== item.id));
            setRejected(prev => prev + 1);
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header banner */}
      <View style={styles.banner}>
        <View style={styles.bannerRow}>
          <ShieldCheck size={20} color={colors.textPrimary} />
          <Text style={styles.bannerEyebrow}>APP ADMIN PANEL</Text>
        </View>
        <Text style={styles.bannerTitle}>Admin Panel</Text>
        <Text style={styles.bannerSub}>
          Review club admin and CR applications, and manage permanent study rooms.
        </Text>
      </View>

      {/* University Setup Requests */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <School size={13} color={colors.textTertiary} />
            <Text style={styles.sectionLabel}>UNIVERSITY SETUP REQUESTS ({uniRequests.length})</Text>
          </View>
        </View>

        {uniRequests.length === 0 ? (
          <View style={styles.emptyBox}>
            <School size={36} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No pending setup requests</Text>
            <Text style={styles.emptyDesc}>All university workspace requests have been reviewed.</Text>
          </View>
        ) : (
          uniRequests.map(req => (
            <View key={req.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>{req.university_name}</Text>
                    <View style={[styles.typePill, { backgroundColor: colors.greenLight }]}>
                      <Text style={[styles.typePillText, { color: colors.green }]}>SETUP REQUEST</Text>
                    </View>
                  </View>
                  <Text style={styles.cardApplicant}>
                    Requested by <Text style={styles.cardApplicantBold}>{req.admin_name}</Text> ({req.admin_email})
                  </Text>
                  <Text style={styles.cardMeta}>Website: {req.university_website} · {new Date(req.created_at).toLocaleDateString()}</Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => handleResolveUniRequest(req, 'approved')}
                  style={[styles.actionBtn, styles.approveBtn]}
                  disabled={resolvingUni === req.id}
                  activeOpacity={0.85}
                >
                  {resolvingUni === req.id ? (
                    <ActivityIndicator size="small" color={colors.textPrimary} />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Check size={13} color={colors.success} />
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleResolveUniRequest(req, 'rejected')}
                  style={[styles.actionBtn, styles.rejectBtn]}
                  disabled={resolvingUni === req.id}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <X size={13} color={colors.error} />
                    <Text style={styles.rejectBtnText}>Reject</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Club Admin Requests */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}><ShieldCheck size={13} color={colors.textTertiary} /><Text style={styles.sectionLabel}>PENDING REQUESTS ({clubAdminRequests.length})</Text></View>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn} activeOpacity={0.7} disabled={refreshing}>
            {refreshing
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={styles.refreshBtnText}>↻ Refresh</Text>
            }
          </TouchableOpacity>
        </View>

        {clubAdminRequests.length === 0 ? (
          <View style={styles.emptyBox}>
            <ShieldCheck size={36} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No pending requests</Text>
            <Text style={styles.emptyDesc}>Students haven't requested club admin access yet.</Text>
          </View>
        ) : (
          clubAdminRequests.map(req => (
            <View key={req.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>{req.clubName}</Text>
                    <View style={[styles.typePill, { backgroundColor: colors.amberLight }]}>
                      <Text style={[styles.typePillText, { color: colors.amber }]}>ADMIN REQUEST</Text>
                    </View>
                  </View>
                  <Text style={styles.cardApplicant}>
                    Requested by <Text style={styles.cardApplicantBold}>{req.studentName}</Text>
                  </Text>
                  <Text style={styles.cardMeta}>{req.course} · {req.year} · {req.submitted}</Text>
                </View>
              </View>

              <Text style={[styles.cardDesc, { fontStyle: 'italic' }]}>"{req.reason}"</Text>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => handleResolve(req, 'approve')}
                  style={[styles.actionBtn, styles.approveBtn]}
                  activeOpacity={0.85}
                >
                  <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Check size={13} color={colors.success} /><Text style={styles.approveBtnText}>Approve</Text></View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleResolve(req, 'reject')}
                  style={[styles.actionBtn, styles.rejectBtn]}
                  activeOpacity={0.85}
                >
                  <View style={{flexDirection:'row',alignItems:'center',gap:4}}><X size={13} color={colors.error} /><Text style={styles.rejectBtnText}>Reject</Text></View>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Featured Study Rooms */}
      <View style={styles.section}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Pin size={13} color={colors.textTertiary} /><Text style={styles.sectionLabel}>FEATURED STUDY ROOMS ({permRooms.length})</Text></View>

        {permRooms.map(room => (
          <View key={room.id} style={[styles.card, { flexDirection: 'row', alignItems: 'center' }]}>
            <Text style={{ fontSize: 24, marginRight: spacing.sm }}>{room.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{room.name}</Text>
              {room.subject ? <Text style={styles.cardMeta}>{room.subject}</Text> : null}
            </View>
            <TouchableOpacity
              onPress={() => deletePermRoom(room.id)}
              style={styles.roomDeleteBtn}
              activeOpacity={0.8}
            >
              <Trash2 size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={styles.addRoomBtn}
          onPress={() => setShowRoomModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.addRoomBtnText}>+ Add Featured Room</Text>
        </TouchableOpacity>
      </View>

      {/* Create Room Modal */}
      <Modal visible={showRoomModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => setShowRoomModal(false)}
            activeOpacity={1}
          />
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Pin size={16} color={colors.textPrimary} /><Text style={styles.modalTitle}>New Featured Room</Text></View>
              <TouchableOpacity onPress={() => setShowRoomModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>ROOM NAME *</Text>
            <TextInput
              value={roomName}
              onChangeText={setRoomName}
              placeholder="e.g. Open Study Hall"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
              autoCapitalize="words"
              maxLength={50}
            />

            <Text style={styles.modalLabel}>SUBJECT (optional)</Text>
            <TextInput
              value={roomSubject}
              onChangeText={setRoomSubject}
              placeholder="e.g. General · All Years"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
              maxLength={60}
            />

            <Text style={styles.modalLabel}>EMOJI</Text>
            <View style={styles.emojiRow}>
              {ROOM_EMOJIS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiBtn, roomEmoji === e && styles.emojiBtnActive]}
                  onPress={() => setRoomEmoji(e)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.createConfirmBtn, (!roomName.trim() || roomCreating) && { opacity: 0.45 }]}
              onPress={createPermRoom}
              disabled={!roomName.trim() || roomCreating}
              activeOpacity={0.85}
            >
              <Text style={styles.createConfirmBtnText}>
                {roomCreating ? 'Creating…' : 'Create Featured Room'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.tipBox}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Info size={13} color={colors.textTertiary} /><Text style={styles.tipText}>Once approved, the applicant becomes the club admin and can freely post events without further approval.</Text></View>
      </View>

      {/* Club Creation Requests */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Landmark size={13} color={colors.textTertiary} /><Text style={styles.sectionLabel}>CLUB CREATION REQUESTS ({clubCreationRequests.length})</Text></View>
          <TouchableOpacity onPress={loadClubCreationRequests} style={styles.refreshBtn} activeOpacity={0.7}>
            <Text style={styles.refreshBtnText}>↻ Refresh</Text>
          </TouchableOpacity>
        </View>

        {clubCreationRequests.length === 0 ? (
          <View style={styles.emptyBox}>
            <Gift size={36} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Pending Requests</Text>
            <Text style={styles.emptyDesc}>All club creation requests have been reviewed.</Text>
          </View>
        ) : clubCreationRequests.map(req => (
          <View key={req.id} style={styles.card}>
            <View style={[styles.cardHeader, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
              <View style={[styles.crAvatar, { backgroundColor: req.color + '33' }]}>
                <Text style={{ fontSize: 22 }}>{req.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{req.name}</Text>
                <Text style={styles.cardMeta}>{req.type} · by {req.creator_name}</Text>
              </View>
              <View style={styles.crPendingPill}>
                <Text style={styles.crPendingPillText}>Pending</Text>
              </View>
            </View>
            {req.description ? (
              <Text style={[styles.cardDesc, { fontStyle: 'italic' }]}>"{req.description}"</Text>
            ) : null}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => handleResolveClubCreation(req, 'approved')}
                disabled={resolvingClub === req.id}
                activeOpacity={0.7}
              >
                {resolvingClub === req.id
                  ? <ActivityIndicator size="small" color={colors.textPrimary} />
                  : <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Check size={13} color={colors.success} /><Text style={styles.approveBtnText}>Approve</Text></View>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleResolveClubCreation(req, 'rejected')}
                disabled={resolvingClub === req.id}
                activeOpacity={0.7}
              >
                <View style={{flexDirection:'row',alignItems:'center',gap:4}}><X size={13} color={colors.error} /><Text style={styles.rejectBtnText}>Reject</Text></View>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* CR Requests */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}><ClipboardList size={13} color={colors.textTertiary} /><Text style={styles.sectionLabel}>CR APPLICATIONS ({crRequests.length})</Text></View>
          <TouchableOpacity onPress={loadCrRequests} style={styles.refreshBtn} activeOpacity={0.7}>
            <Text style={styles.refreshBtnText}>↻ Refresh</Text>
          </TouchableOpacity>
        </View>

        {crRequests.length === 0 ? (
          <View style={styles.emptyBox}>
            <Gift size={36} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Pending Applications</Text>
            <Text style={styles.emptyDesc}>All CR applications have been reviewed.</Text>
          </View>
        ) : crRequests.map(req => (
          <View key={req.id} style={styles.card}>
            <View style={[styles.cardHeader, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
              <View style={styles.crAvatar}>
                <Text style={styles.crAvatarText}>{(req.user_name || '?')[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{req.user_name}</Text>
                <Text style={styles.cardMeta}>{req.course} · {req.year} · {req.campus}</Text>
              </View>
              <View style={styles.crPendingPill}>
                <Text style={styles.crPendingPillText}>Pending</Text>
              </View>
            </View>

            {req.reason ? (
              <Text style={[styles.cardDesc, { fontStyle: 'italic' }]}>"{req.reason}"</Text>
            ) : null}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => resolveCrRequest(req, 'approved')}
                disabled={resolvingCR === req.id}
                activeOpacity={0.7}
              >
                {resolvingCR === req.id
                  ? <ActivityIndicator size="small" color={colors.textPrimary} />
                  : <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Check size={13} color={colors.success} /><Text style={styles.approveBtnText}>Approve</Text></View>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => resolveCrRequest(req, 'rejected')}
                disabled={resolvingCR === req.id}
                activeOpacity={0.7}
              >
                <View style={{flexDirection:'row',alignItems:'center',gap:4}}><X size={13} color={colors.error} /><Text style={styles.rejectBtnText}>Reject</Text></View>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.tipBox}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Info size={13} color={colors.textTertiary} /><Text style={styles.tipText}>Approved CRs can access the CR Dashboard from their profile to manage attendance and class announcements.</Text></View>
      </View>

      {/* Manage Clubs & Teams */}
      <View style={styles.section}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Landmark size={13} color={colors.textTertiary} /><Text style={styles.sectionLabel}>MANAGE CLUBS & TEAMS</Text></View>
        {[...hubClubs, ...(userCreatedClubs || [])].map(club => {
          const isHidden = hiddenClubIds?.has(String(club.id));
          return (
            <View key={club.id} style={[styles.card, { flexDirection: 'row', alignItems: 'center', opacity: isHidden ? 0.45 : 1 }]}>
              <View style={[styles.crAvatar, { backgroundColor: (club.color || '#6366F1') + '33', marginRight: spacing.sm }]}>
                <Text style={{ fontSize: 20 }}>{club.emoji || '🏛️'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{club.name}</Text>
                <Text style={styles.cardMeta}>{club.type || 'Club'}{isHidden ? ' · Hidden' : ''}</Text>
              </View>
              {isHidden ? (
                <View style={[styles.typePill, { backgroundColor: colors.amberLight }]}>
                  <Text style={[styles.typePillText, { color: colors.amber }]}>HIDDEN</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.roomDeleteBtn}
                  onPress={() => Alert.alert(
                    'Delete Club',
                    `Remove "${club.name}" from the Hub? This cannot be undone.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteClub(club.id) },
                    ]
                  )}
                  activeOpacity={0.8}
                >
                  <Trash2 size={16} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  banner: {
    backgroundColor: colors.amberLight,
    borderBottomWidth: 1, borderBottomColor: colors.amber,
    padding: spacing.lg,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  bannerIcon: { fontSize: 14 },
  bannerEyebrow: { fontSize: 10, ...font.bold, color: colors.amber, letterSpacing: 0.8 },
  bannerTitle: { fontSize: 20, ...font.bold, color: colors.textPrimary, marginBottom: 4 },
  bannerSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  section: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionLabel: {
    fontSize: 11, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold,
  },
  refreshBtn: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 4, minWidth: 72, alignItems: 'center',
  },
  refreshBtnText: { fontSize: 12, color: colors.primary, ...font.semibold },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { marginBottom: spacing.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  cardTitle: { fontSize: 16, ...font.bold, color: colors.textPrimary },
  typePill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: radius.full,
  },
  typePillText: { fontSize: 9, ...font.bold, color: colors.primary, letterSpacing: 0.6 },
  cardApplicant: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cardApplicantBold: { ...font.semibold, color: colors.textPrimary },
  cardMeta: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
  cardDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginBottom: spacing.md },

  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    flex: 1, borderRadius: radius.md,
    paddingVertical: 11, alignItems: 'center',
  },
  approveBtn: { backgroundColor: colors.green },
  approveBtnText: { fontSize: 13, ...font.bold, color: colors.textPrimary },
  rejectBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: colors.red,
  },
  rejectBtnText: { fontSize: 13, ...font.bold, color: colors.red },

  emptyBox: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { fontSize: 15, ...font.bold, color: colors.textPrimary, marginBottom: 4 },
  emptyDesc: { fontSize: 12, color: colors.textSecondary },

  tipBox: {
    marginHorizontal: spacing.md, marginTop: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  tipText: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },

  roomDeleteBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.redLight, borderWidth: 1, borderColor: colors.red,
    alignItems: 'center', justifyContent: 'center',
  },

  addRoomBtn: {
    borderWidth: 1, borderColor: colors.amber, borderRadius: radius.md,
    paddingVertical: 11, alignItems: 'center', marginTop: spacing.sm,
  },
  addRoomBtnText: { fontSize: 13, color: colors.amber, ...font.bold },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  modal: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: { fontSize: 17, ...font.bold, color: colors.textPrimary },
  modalClose: { fontSize: 20, color: colors.textSecondary, padding: 4 },
  modalLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold,
    marginBottom: 6, marginTop: spacing.sm,
  },
  modalInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, fontSize: 14,
  },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  emojiBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiBtnActive: { borderColor: colors.amber, backgroundColor: colors.amberLight },
  createConfirmBtn: {
    backgroundColor: colors.amber, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg,
  },
  createConfirmBtnText: { fontSize: 15, color: colors.textPrimary, ...font.bold },

  crAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  crAvatarText: { fontSize: 16, ...font.bold, color: colors.primary },
  crPendingPill: {
    backgroundColor: colors.amberLight, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  crPendingPillText: { fontSize: 10, ...font.bold, color: colors.amber },
});