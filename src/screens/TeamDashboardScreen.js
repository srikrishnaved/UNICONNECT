import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hubClubs } from '../data';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius, font, avatarColor, initials } from '../theme';
import DocumentationScreen from './DocumentationScreen';
import { Target, Zap, FileText, ClipboardList, Mail, Calendar, X, Check } from 'lucide-react-native';

const STATUS_COLOR = {
  pending:  { bg: colors.amberLight,   border: colors.amber,       text: colors.amber,       label: 'Pending' },
  accepted: { bg: colors.greenLight,   border: colors.greenBorder, text: colors.green,       label: 'Confirmed' },
  declined: { bg: colors.redLight,      border: 'rgba(239,68,68,0.3)', text: colors.red,      label: 'Declined' },
};

export default function TeamDashboardScreen({ route, navigation }) {
  const { clubId } = route.params;
  const teamId = Number(clubId);
  const team = hubClubs.find(c => c.id === teamId);

  const { userProfile, teacherProfile, adminTestTeacher, isAppAdmin, isSapsCore, approvedClubAdmins, clubMemberships, createNotification } = useApp();

  const isEffectiveAdmin = approvedClubAdmins.has(teamId) || approvedClubAdmins.has(String(teamId)) || isAppAdmin || isSapsCore;
  const isMember = clubMemberships.has(teamId) || clubMemberships.has(String(teamId));

  const [events, setEvents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal: pick members to assign for a specific event
  const [assignModal, setAssignModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);

  const loadAll = useCallback(async () => {
    const { data: eventsData } = await supabase
      .from('hub_events')
      .select('id, title, time, venue, when, club_name, club_id, teams_needed')
      .contains('teams_needed', [teamId])
      .order('created_at', { ascending: false });

    const eventsList = eventsData || [];
    setEvents(eventsList);

    const eventIds = eventsList.map(e => String(e.id));

    const [assignmentsRes, memberRowsRes] = await Promise.all([
      eventIds.length
        ? supabase.from('event_member_assignments').select('*').eq('team_id', teamId).in('event_id', eventIds)
        : Promise.resolve({ data: [] }),
      supabase.from('club_memberships').select('user_id').eq('club_id', teamId),
    ]);

    const assignmentsList = assignmentsRes.data || [];
    setAssignments(assignmentsList);

    const memberIds = (memberRowsRes.data || []).map(r => r.user_id);
    const assignedIds = assignmentsList.map(a => a.user_id);
    const allIds = [...new Set([...memberIds, ...assignedIds])];

    if (allIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles').select('id, name, course, year').in('id', allIds);
      const map = {};
      (profilesData || []).forEach(p => { map[p.id] = p; });
      setProfiles(map);
      setTeamMembers(memberIds.map(id => map[id]).filter(Boolean));
    }
  }, [teamId]);

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
    if (team) navigation.setOptions({ title: `${team.name} · Dashboard` });
  }, [teamId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleAssign = async (userId, eventId) => {
    setSaving(true);
    const event = events.find(e => String(e.id) === String(eventId));
    const { data: row, error } = await supabase
      .from('event_member_assignments')
      .upsert(
        { event_id: String(eventId), team_id: teamId, user_id: String(userId), assigned_by: userProfile.id, status: 'pending' },
        { onConflict: 'event_id,team_id,user_id' },
      )
      .select()
      .single();

    if (!error && row) {
      setAssignments(prev => {
        const idx = prev.findIndex(a => String(a.event_id) === String(eventId) && a.user_id === String(userId));
        return idx >= 0 ? prev.map((a, i) => i === idx ? row : a) : [...prev, row];
      });
      createNotification(
        String(userId), 'assignment',
        `You've been assigned to "${event?.title}"`,
        `${team.name} has assigned you · ${event?.time || ''}`,
        { assignment_id: row.id, event_id: String(eventId), team_id: teamId, team_name: team.name, event_title: event?.title },
      );
    } else if (error) {
      alert('Error: ' + error.message);
    }
    setSaving(false);
  };

  const handleUnassign = async (userId, eventId) => {
    await supabase.from('event_member_assignments')
      .delete()
      .eq('event_id', String(eventId))
      .eq('team_id', teamId)
      .eq('user_id', String(userId));
    setAssignments(prev =>
      prev.filter(a => !(String(a.event_id) === String(eventId) && a.user_id === String(userId)))
    );
  };

  const myAssignments = assignments.filter(a => String(a.user_id) === String(userProfile?.id));

  const assignmentsForEvent = (eventId) =>
    assignments.filter(a => String(a.event_id) === String(eventId));

  const isAssignedToEvent = (userId, eventId) =>
    assignments.some(a => String(a.event_id) === String(eventId) && String(a.user_id) === String(userId));

  const getAssignment = (userId, eventId) =>
    assignments.find(a => String(a.event_id) === String(eventId) && String(a.user_id) === String(userId));

  const clubFor = (clubId) => hubClubs.find(c => c.id === clubId);

  if (!team) return null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: team.color }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerEmoji}>{team.emoji}</Text>
          <View>
            <Text style={styles.headerTitle}>{team.name}</Text>
            <Text style={styles.headerSub}>Team Dashboard</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* My Assignments — only shown to members */}
          {(isMember || isEffectiveAdmin) && myAssignments.length > 0 && (
            <>
              <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Target size={13} color={colors.textTertiary} /><Text style={styles.sectionLabel}>MY ASSIGNMENTS</Text></View>
              {myAssignments.map(a => {
                const event = events.find(e => String(e.id) === String(a.event_id));
                if (!event) return null;
                const club = clubFor(event.club_id);
                return (
                  <View key={a.id} style={styles.myAssignCard}>
                    <View style={[styles.myAssignStripe, { backgroundColor: club?.color || team.color }]} />
                    <View style={styles.myAssignBody}>
                      {club && <Text style={[styles.assignClubName, { color: club.color }]}>{club.emoji} {club.name}</Text>}
                      <Text style={styles.assignEventTitle}>{event.title}</Text>
                      <View style={styles.assignMeta}>
                        <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Calendar size={12} color={colors.textSecondary} /><Text style={styles.assignMetaText}>{event.time}</Text></View>
                        <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Calendar size={12} color={colors.textSecondary} /><Text style={styles.assignMetaText}>{event.venue}</Text></View>
                      </View>
                      <View style={styles.myAssignFooter}>
                        <View style={[styles.statusBadge, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                          <View style={{flexDirection:'row',alignItems:'center',gap:3}}><Check size={11} color={colors.primary} /><Text style={[styles.statusBadgeText, { color: colors.primary }]}>Assigned</Text></View>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* Admin Actions */}
          {isEffectiveAdmin && (
            <>
              <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Zap size={13} color={colors.textTertiary} /><Text style={styles.sectionLabel}>ADMIN ACTIONS</Text></View>
              <TouchableOpacity
                style={styles.adminActionBtn}
                onPress={() => setShowDocsModal(true)}
                activeOpacity={0.85}
              >
                <FileText size={20} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminActionTitle}>Documents</Text>
                  <Text style={styles.adminActionDesc}>Submit NFAs &amp; Activity Reports</Text>
                </View>
                <Text style={styles.adminActionArrow}>›</Text>
              </TouchableOpacity>
            </>
          )}

          {/* All Event Assignments */}
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}><ClipboardList size={13} color={colors.textTertiary} /><Text style={styles.sectionLabel}>EVENT ASSIGNMENTS ({events.length})</Text></View>
          {events.length === 0 ? (
            <View style={styles.emptyBox}>
              <Mail size={36} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No events assigned yet.</Text>
              <Text style={styles.emptySubText}>When a club selects {team.name} for an event, it will appear here.</Text>
            </View>
          ) : (
            events.map(event => {
              const club = clubFor(event.club_id);
              const eventAssignments = assignmentsForEvent(event.id);
              return (
                <View key={event.id} style={styles.eventCard}>
                  <View style={[styles.eventStripe, { backgroundColor: club?.color || team.color }]} />
                  <View style={styles.eventBody}>
                    {/* Club + When */}
                    <View style={styles.eventTopRow}>
                      {club && <Text style={[styles.eventClubName, { color: club.color }]}>{club.emoji} {club.name}</Text>}
                      <View style={[styles.whenBadge, event.when === 'today' && styles.whenBadgeToday]}>
                        <Text style={styles.whenBadgeText}>
                          {event.when === 'today' ? 'TODAY' : event.when === 'thisWeek' ? 'THIS WEEK' : 'UPCOMING'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <View style={styles.eventMetaRow}>
                      <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Calendar size={12} color={colors.textSecondary} /><Text style={styles.eventMeta}>{event.time}</Text></View>
                      <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Calendar size={12} color={colors.textSecondary} /><Text style={styles.eventMeta}>{event.venue}</Text></View>
                    </View>

                    {/* Assigned members */}
                    {eventAssignments.length > 0 && (
                      <View style={styles.assignedSection}>
                        <Text style={styles.assignedLabel}>ASSIGNED MEMBERS ({eventAssignments.length})</Text>
                        {eventAssignments.map(a => {
                          const p = profiles[a.user_id];
                          if (!p) return null;
                          const av = avatarColor(p.name);
                          return (
                            <View key={a.id} style={styles.assignedRow}>
                              <View style={[styles.assignedAvatar, { backgroundColor: av.bg }]}>
                                <Text style={[styles.assignedAvatarText, { color: av.text }]}>{initials(p.name)}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.assignedName}>{p.name}</Text>
                                <Text style={styles.assignedMeta}>{p.course} · {p.year}</Text>
                              </View>
                              {isEffectiveAdmin && (
                                <TouchableOpacity
                                  onPress={() => handleUnassign(a.user_id, event.id)}
                                  style={styles.removeAssignBtn}
                                  activeOpacity={0.7}
                                >
                                  <X size={16} color={colors.error} />
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Admin: assign members */}
                    {isEffectiveAdmin && (
                      <TouchableOpacity
                        style={styles.assignBtn}
                        onPress={() => setAssignModal(event)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.assignBtnText}>
                          {eventAssignments.length > 0 ? '+ Add More Members' : '+ Assign Members'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Docs Modal */}
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
              name: adminTestTeacher?.name || teacherProfile?.name || userProfile?.name,
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
          />
        </SafeAreaView>
      </Modal>

      {/* Assign Members Modal */}
      <Modal visible={!!assignModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Assign Members</Text>
                {assignModal && <Text style={styles.modalSub} numberOfLines={1}>{assignModal.title}</Text>}
              </View>
              <TouchableOpacity onPress={() => setAssignModal(null)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {teamMembers.length === 0 ? (
                <Text style={styles.noMembersText}>No team members yet. Add members from the Team page first.</Text>
              ) : (
                teamMembers.map(member => {
                  const assigned = assignModal ? isAssignedToEvent(member.id, assignModal.id) : false;
                  const a = assignModal ? getAssignment(member.id, assignModal.id) : null;
                  const av = avatarColor(member.name);
                  return (
                    <View key={member.id} style={styles.memberRow}>
                      <View style={[styles.memberAvatar, { backgroundColor: av.bg }]}>
                        <Text style={[styles.memberAvatarText, { color: av.text }]}>{initials(member.name)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{member.name}</Text>
                        <Text style={styles.memberMeta}>{member.course} · {member.year}</Text>
                      </View>
                      {assigned ? (
                        <View style={[styles.statusBadge, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                          <View style={{flexDirection:'row',alignItems:'center',gap:3}}><Check size={11} color={colors.primary} /><Text style={[styles.statusBadgeText, { color: colors.primary }]}>Assigned</Text></View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.assignMemberBtn}
                          onPress={async () => {
                            if (assignModal) await handleAssign(member.id, assignModal.id);
                          }}
                          disabled={saving}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.assignMemberBtnText}>+ Assign</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: { paddingTop: spacing.md, paddingBottom: spacing.lg, paddingHorizontal: spacing.md },
  backBtn: { marginBottom: spacing.sm },
  backBtnText: { fontSize: 28, color: 'rgba(255,255,255,0.9)', lineHeight: 28 },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerEmoji: { fontSize: 32 },
  headerTitle: { fontSize: 20, ...font.bold, color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },

  sectionLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold, marginBottom: spacing.sm, marginTop: spacing.sm,
  },

  myAssignCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, marginBottom: spacing.sm, overflow: 'hidden',
  },
  myAssignStripe: { height: 3 },
  myAssignBody: { padding: spacing.md },
  assignClubName: { fontSize: 10, ...font.bold, letterSpacing: 0.6, marginBottom: 2 },
  assignEventTitle: { fontSize: 14, ...font.bold, color: colors.textPrimary, marginBottom: 4 },
  assignMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.sm },
  assignMetaText: { fontSize: 11, color: colors.textSecondary },
  myAssignFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  respondRow: { flexDirection: 'row', gap: 8 },
  acceptBtn: { backgroundColor: colors.green, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 6 },
  acceptBtnText: { fontSize: 12, ...font.bold, color: '#fff' },
  declineBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 6 },
  declineBtnText: { fontSize: 12, ...font.bold, color: colors.textSecondary },

  eventCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, marginBottom: spacing.sm, overflow: 'hidden',
  },
  eventStripe: { height: 3 },
  eventBody: { padding: spacing.md },
  eventTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  eventClubName: { fontSize: 10, ...font.bold, letterSpacing: 0.6 },
  whenBadge: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  whenBadgeToday: { backgroundColor: colors.greenLight, borderColor: colors.greenBorder },
  whenBadgeText: { fontSize: 9, ...font.bold, color: colors.textSecondary, letterSpacing: 0.4 },
  eventTitle: { fontSize: 14, ...font.bold, color: colors.textPrimary, marginBottom: 4 },
  eventMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: spacing.sm },
  eventMeta: { fontSize: 11, color: colors.textSecondary },

  assignedSection: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm,
  },
  assignedLabel: { fontSize: 9, ...font.bold, color: colors.textTertiary, letterSpacing: 0.6, marginBottom: spacing.sm },
  assignedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  assignedAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  assignedAvatarText: { fontSize: 11, ...font.bold },
  assignedName: { fontSize: 12, ...font.semibold, color: colors.textPrimary },
  assignedMeta: { fontSize: 10, color: colors.textTertiary, marginTop: 1 },
  removeAssignBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  removeAssignBtnText: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },

  statusBadge: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 10, ...font.semibold },

  assignBtn: {
    borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.sm, paddingVertical: 8,
    alignItems: 'center', backgroundColor: colors.primaryLight,
  },
  assignBtnText: { fontSize: 12, ...font.bold, color: colors.primary },

  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 14, ...font.semibold, color: colors.textSecondary },
  emptySubText: { fontSize: 12, color: colors.textTertiary, marginTop: 4, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, maxHeight: '80%', borderWidth: 1, borderColor: colors.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  modalTitle: { fontSize: 18, ...font.bold, color: colors.textPrimary },
  modalSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  modalClose: { fontSize: 22, color: colors.textSecondary, padding: 4 },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 13, ...font.bold },
  memberName: { fontSize: 13, ...font.semibold, color: colors.textPrimary },
  memberMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  assignMemberBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6 },
  assignMemberBtnText: { fontSize: 12, ...font.bold, color: '#fff' },
  noMembersText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },

  adminActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  adminActionIcon: { fontSize: 22, width: 30, textAlign: 'center' },
  adminActionTitle: { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  adminActionDesc: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  adminActionArrow: { fontSize: 22, color: colors.textTertiary, lineHeight: 24 },
});
