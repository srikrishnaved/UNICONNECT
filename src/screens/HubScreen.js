import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, Modal, TextInput, ActivityIndicator, Image } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { hubClubs } from '../data';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, font } from '../theme';
import { EmptyState } from '../components/EmptyState';
import { Star } from 'lucide-react-native';

const EMOJIS = ['🏛️','💼','📊','🎯','🎉','🎭','🔬','⚽','🤝','🎨','🎤','📝','💡','🚀','🌏','📚','🎵','📸'];
const COLORS = ['#6366F1','#3B82F6','#10B981','#A855F7','#EC4899','#F59E0B','#EF4444','#14B8A6','#8B5CF6','#E11D48'];

const TYPES = ['All', 'Clubs', 'Teams'];

export default function HubScreen() {
  const navigation = useNavigation();
  const { events: hubEvents, clubAdminRequests, loadClubAdminRequests, isAppAdmin, isSapsCore, interestedEventIds, toggleEventInterest, followingClubIds, toggleClubFollow, clubMemberships, approvedClubAdmins, userCreatedClubs, myClubRequests, submitClubCreationRequest, hiddenClubIds } = useApp();
  const [filter, setFilter] = useState('All');

  useFocusEffect(useCallback(() => {
    if (isAppAdmin) loadClubAdminRequests();
  }, [isAppAdmin, loadClubAdminRequests]));

  // Create club modal state
  const [showCreate, setShowCreate] = useState(false);
  const [cName, setCName] = useState('');
  const [cFullName, setCFullName] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cEmoji, setCEmoji] = useState('🏛️');
  const [cColor, setCColor] = useState('#6366F1');
  const [cType, setCType] = useState('Club');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [submitted, setSubmitted] = useState(false);

  const handleCreate = async () => {
    if (!cName.trim()) { setCreateError('Club name is required.'); return; }
    setCreating(true);
    setCreateError('');
    try {
      await submitClubCreationRequest({ name: cName.trim(), fullName: cFullName.trim() || cName.trim(), description: cDesc.trim(), emoji: cEmoji, color: cColor, type: cType });
      setCName(''); setCFullName(''); setCDesc(''); setCEmoji('🏛️'); setCColor('#6366F1'); setCType('Club');
      setSubmitted(true);
    } catch (e) {
      setCreateError(e.message || 'Could not submit request.');
    } finally {
      setCreating(false);
    }
  };

  const allClubs = useMemo(() =>
    [...hubClubs, ...(userCreatedClubs || [])].filter(c => !hiddenClubIds?.has(String(c.id))),
    [userCreatedClubs, hiddenClubIds],
  );

  const { myClubs, otherClubs } = useMemo(() => {
    const base = filter === 'All' ? allClubs : allClubs.filter(c => filter === 'Clubs' ? c.type === 'Club' : c.type === 'Team');
    const isMine = (c) => {
      const n = Number(c.id);
      return (clubMemberships?.has(n) || clubMemberships?.has(String(c.id))) ||
             (approvedClubAdmins?.has(n) || approvedClubAdmins?.has(String(c.id)));
    };
    const mine = base.filter(isMine);
    const others = base.filter(c => !isMine(c));
    return { myClubs: mine, otherClubs: others };
  }, [filter, clubMemberships, approvedClubAdmins]);

  const { today, thisWeek, upcoming } = useMemo(() => {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const d7 = new Date(d);
    d7.setDate(d7.getDate() + 7);
    const weekStr = `${d7.getFullYear()}-${pad(d7.getMonth() + 1)}-${pad(d7.getDate())}`;

    const t = [], w = [], u = [];
    for (const e of hubEvents) {
      const date = e.event_date;
      if (date) {
        if (date < todayStr) continue;          // past — exclude
        if (date === todayStr) t.push(e);
        else if (date <= weekStr) w.push(e);
        else u.push(e);
      } else {
        // No event_date: fall back to static when field
        if (e.when === 'today') t.push(e);
        else if (e.when === 'thisWeek') w.push(e);
        else u.push(e);
      }
    }
    return { today: t, thisWeek: w, upcoming: u };
  }, [hubEvents]);

  const featuredEvent = today[0] || thisWeek[0];
  const featuredClub = allClubs.find(c => c.id === featuredEvent?.clubId);

  return (
    <View style={styles.container}>
      {/* Top action bar */}
      <View style={styles.topActions}>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
          <Text style={styles.createBtnText}>＋ Create Club</Text>
        </TouchableOpacity>
        {isAppAdmin && (
          <TouchableOpacity
            style={styles.adminBtn}
            onPress={() => navigation.navigate('AppAdmin')}
            activeOpacity={0.85}
          >
            <Text style={styles.adminBtnIcon}>🛡️</Text>
            <Text style={styles.adminBtnText}>App Admin</Text>
            {clubAdminRequests.length > 0 && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>{clubAdminRequests.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Create Club Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => { setShowCreate(false); setSubmitted(false); }}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowCreate(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create a Club or Team</Text>
              <TouchableOpacity onPress={() => { setShowCreate(false); setSubmitted(false); }}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>

            {submitted ? (
              <View style={styles.submittedBox}>
                <Text style={styles.submittedIcon}>📬</Text>
                <Text style={styles.submittedTitle}>Request Submitted!</Text>
                <Text style={styles.submittedSub}>Your club creation request has been sent to the department for approval. You'll be notified once it's reviewed.</Text>
                <TouchableOpacity style={styles.submittedBtn} onPress={() => { setShowCreate(false); setSubmitted(false); }} activeOpacity={0.85}>
                  <Text style={styles.submittedBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
            {/* Emoji picker */}
            <Text style={styles.modalLabel}>PICK AN EMOJI</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {EMOJIS.map(e => (
                  <TouchableOpacity key={e} style={[styles.emojiBtn, cEmoji === e && styles.emojiBtnActive]} onPress={() => setCEmoji(e)} activeOpacity={0.7}>
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Color picker */}
            <Text style={styles.modalLabel}>COLOUR</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: spacing.md }}>
              {COLORS.map(col => (
                <TouchableOpacity key={col} style={[styles.colorSwatch, { backgroundColor: col }, cColor === col && styles.colorSwatchActive]} onPress={() => setCColor(col)} activeOpacity={0.8} />
              ))}
            </View>

            {/* Type */}
            <Text style={styles.modalLabel}>TYPE</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
              {['Club', 'Team'].map(t => (
                <TouchableOpacity key={t} style={[styles.typePill, cType === t && styles.typePillActive]} onPress={() => setCType(t)} activeOpacity={0.8}>
                  <Text style={[styles.typePillText, cType === t && styles.typePillTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>NAME *</Text>
            <TextInput value={cName} onChangeText={setCName} placeholder="e.g. Photography Club" placeholderTextColor={colors.textTertiary} style={styles.modalInput} />

            <Text style={styles.modalLabel}>FULL NAME (optional)</Text>
            <TextInput value={cFullName} onChangeText={setCFullName} placeholder="e.g. Christ Photography Club" placeholderTextColor={colors.textTertiary} style={styles.modalInput} />

            <Text style={styles.modalLabel}>DESCRIPTION</Text>
            <TextInput value={cDesc} onChangeText={setCDesc} placeholder="What does your club do?" placeholderTextColor={colors.textTertiary} style={[styles.modalInput, { height: 72, textAlignVertical: 'top' }]} multiline />

            {createError ? <Text style={styles.createErrText}>{createError}</Text> : null}

            <TouchableOpacity style={[styles.createConfirmBtn, { backgroundColor: cColor }]} onPress={handleCreate} disabled={creating} activeOpacity={0.85}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createConfirmBtnText}>Submit Request</Text>}
            </TouchableOpacity>
            </>
            )}
          </View>
        </View>
      </Modal>

      <FlatList
        data={[]}
        keyExtractor={() => 'x'}
        renderItem={null}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
        ListHeaderComponent={
          <>
            {/* Featured banner */}
            {featuredEvent && featuredClub && (
              <TouchableOpacity
                style={[styles.featured, { backgroundColor: featuredClub.color }]}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('EventDetail', { event: featuredEvent })}
              >
                <Text style={styles.featuredLabel}>🔥 FEATURED TODAY</Text>
                <Text style={styles.featuredTitle}>{featuredEvent.title}</Text>
                <Text style={styles.featuredMeta}>
                  {featuredClub.name} · {featuredEvent.time} · {featuredEvent.venue}
                </Text>
                <View style={styles.featuredPill}>
                  <Text style={styles.featuredPillText}>👥 {featuredEvent.interested} interested</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Today */}
            {today.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.green }]}>🟢 TODAY</Text>
                {today.map(e => (
                  <EventCard
                    key={e.id}
                    event={e}
                    club={allClubs.find(c => c.id === e.clubId)}
                    isInterested={interestedEventIds.has(String(e.id))}
                    onToggle={() => toggleEventInterest(e.id)}
                    onPress={() => navigation.navigate('EventDetail', { event: e })}
                  />
                ))}
              </>
            )}

            {/* This Week */}
            <Text style={styles.sectionLabel}>📅 THIS WEEK</Text>
            {thisWeek.map(e => (
              <EventCard
                key={e.id}
                event={e}
                club={allClubs.find(c => c.id === e.clubId)}
                isInterested={interestedEventIds.has(String(e.id))}
                onToggle={() => toggleEventInterest(e.id)}
                onPress={() => navigation.navigate('EventDetail', { event: e })}
              />
            ))}

            {/* Upcoming */}
            <Text style={styles.sectionLabel}>🗓️ UPCOMING</Text>
            {upcoming.map(e => (
              <EventCard
                key={e.id}
                event={e}
                club={allClubs.find(c => c.id === e.clubId)}
                isInterested={interestedEventIds.has(String(e.id))}
                onToggle={() => toggleEventInterest(e.id)}
                onPress={() => navigation.navigate('EventDetail', { event: e })}
              />
            ))}

            {/* Clubs/Teams Directory */}
            <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>🏛️ CLUBS · TEAMS</Text>

            <View style={styles.filterRow}>
              {TYPES.map(t => {
                const active = filter === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setFilter(t)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Pending club creation requests */}
            {(myClubRequests || []).filter(r => r.status === 'pending').map(r => (
              <View key={r.id} style={styles.pendingReqCard}>
                <Text style={styles.pendingReqEmoji}>{r.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingReqName}>{r.name}</Text>
                  <Text style={styles.pendingReqSub}>⏳ Awaiting department approval</Text>
                </View>
              </View>
            ))}

            {myClubs.length > 0 && (
              <>
                <Text style={styles.subSectionLabel}>⭐ YOUR CLUBS & TEAMS</Text>
                {myClubs.map(c => {
                  const isAdmin = approvedClubAdmins?.has(c.id) || approvedClubAdmins?.has(String(c.id));
                  return (
                    <ClubCard
                      key={c.id}
                      club={c}
                      isFollowing={followingClubIds.has(String(c.id))}
                      isMember={clubMemberships?.has(c.id) || clubMemberships?.has(String(c.id))}
                      isClubAdmin={isAdmin}
                      onToggle={() => toggleClubFollow(c.id)}
                      onPress={() => isAdmin
                        ? navigation.navigate('ClubDashboard', { clubId: c.id })
                        : navigation.navigate(c.type === 'Team' ? 'TeamDetail' : 'ClubDetail', { clubId: c.id })
                      }
                      onSapsDashboard={isSapsCore && !isAdmin
                        ? () => navigation.navigate(c.type === 'Team' ? 'TeamDashboard' : 'ClubDashboard', { clubId: c.id })
                        : undefined}
                    />
                  );
                })}
                {otherClubs.length > 0 && <Text style={styles.subSectionLabel}>🏛️ ALL CLUBS & TEAMS</Text>}
              </>
            )}
            {otherClubs.map(c => (
              <ClubCard
                key={c.id}
                club={c}
                isFollowing={followingClubIds.has(String(c.id))}
                isMember={false}
                isClubAdmin={false}
                onToggle={() => toggleClubFollow(c.id)}
                onPress={() => navigation.navigate(c.type === 'Team' ? 'TeamDetail' : 'ClubDetail', { clubId: c.id })}
                onSapsDashboard={isSapsCore
                  ? () => navigation.navigate(c.type === 'Team' ? 'TeamDashboard' : 'ClubDashboard', { clubId: c.id })
                  : undefined}
              />
            ))}
            {allClubs.length === 0 && (
              <EmptyState
                icon={Star}
                heading="No clubs yet"
                subtext="Be the first to create a club for your department"
              />
            )}
          </>
        }
      />
    </View>
  );
}

function EventCard({ event, club, isInterested, onToggle, onPress }) {
  if (!club) return null;
  return (
    <TouchableOpacity style={styles.eventCard} activeOpacity={0.85} onPress={onPress}>
      <View style={[styles.eventStripe, { backgroundColor: club.color }]} />
      <View style={styles.eventBody}>
        <View style={styles.eventTop}>
          <View style={[styles.eventEmoji, { backgroundColor: `${club.color}33` }]}>
            {club.logo_url
              ? <Image source={{ uri: club.logo_url }} style={styles.eventLogoImg} />
              : <Text style={styles.eventEmojiText}>{club.emoji}</Text>
            }
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.eventClubRow}>
              <Text style={[styles.eventClubName, { color: club.color }]}>{club.name}</Text>
              {event.isMine && (
                <View style={styles.mineBadge}>
                  <Text style={styles.mineBadgeText}>YOUR TEAM</Text>
                </View>
              )}
            </View>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <View style={styles.eventMetaRow}>
              <Text style={styles.eventMeta}>📅 {event.time}</Text>
              <Text style={styles.eventMeta}>📍 {event.venue}</Text>
            </View>
          </View>
        </View>
        <View style={styles.eventFooter}>
          <Text style={styles.interestedCount}>
            👥 {event.interested + (isInterested ? 1 : 0)} interested
          </Text>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onToggle(); }}
            style={[styles.interestBtn, isInterested && styles.interestBtnActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.interestBtnText, isInterested && styles.interestBtnTextActive]}>
              {isInterested ? '✓ Interested' : '+ Interested'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ClubCard({ club, isFollowing, isMember, isClubAdmin, onToggle, onPress, onSapsDashboard }) {
  const showDashboard = !!onSapsDashboard && !isClubAdmin;
  return (
    <TouchableOpacity style={[styles.clubCard, (isMember || isClubAdmin) && styles.clubCardHighlight]} activeOpacity={0.85} onPress={onPress}>
      <View style={[styles.clubEmoji, { backgroundColor: `${club.color}33` }]}>
        {club.logo_url
          ? <Image source={{ uri: club.logo_url }} style={styles.clubLogoImg} />
          : <Text style={styles.clubEmojiText}>{club.emoji}</Text>
        }
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.clubName} numberOfLines={1}>{club.name}</Text>
        <View style={styles.clubMetaRow}>
          <View style={[styles.typeBadge, { backgroundColor: `${club.color}33` }]}>
            <Text style={[styles.typeBadgeText, { color: club.color }]}>{club.type}</Text>
          </View>
          <Text style={styles.clubMembers}>👥 {club.members}</Text>
          {isClubAdmin && (
            <View style={styles.adminPill}>
              <Text style={styles.adminPillText}>ADMIN</Text>
            </View>
          )}
          {isMember && !isClubAdmin && (
            <View style={styles.memberPill}>
              <Text style={styles.memberPillText}>MEMBER</Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation?.();
          if (isClubAdmin || isMember) onPress();
          else if (showDashboard) onSapsDashboard();
          else onToggle();
        }}
        style={[
          styles.followBtn,
          (isClubAdmin || isMember || showDashboard) && styles.manageBtn,
          isFollowing && !isClubAdmin && !isMember && !showDashboard && styles.followBtnActive,
        ]}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.followBtnText,
          (isClubAdmin || isMember || showDashboard) && styles.manageBtnText,
          isFollowing && !isClubAdmin && !isMember && !showDashboard && styles.followBtnTextActive,
        ]}>
          {isClubAdmin ? 'Manage' : isMember ? 'View' : showDashboard ? 'Dashboard' : isFollowing ? '✓ Following' : '+ Follow'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md, paddingTop: spacing.sm },

  topActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  createBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: colors.primary,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.full,
  },
  createBtnText: { fontSize: 12, color: colors.primary, ...font.bold },
  adminBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.amberLight,
    borderWidth: 1, borderColor: colors.amber,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.full,
    position: 'relative',
  },
  adminBtnIcon: { fontSize: 12 },
  adminBtnText: { fontSize: 11, color: colors.amber, ...font.bold },
  adminBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.red,
    alignItems: 'center', justifyContent: 'center',
  },
  adminBadgeText: { fontSize: 9, color: '#fff', ...font.bold },

  featured: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  featuredLabel: { fontSize: 10, ...font.bold, letterSpacing: 1, color: 'rgba(255,255,255,0.9)', marginBottom: 6 },
  featuredTitle: { fontSize: 17, ...font.bold, color: '#fff', marginBottom: 6 },
  featuredMeta: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  featuredPill: {
    alignSelf: 'flex-start', marginTop: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
  },
  featuredPillText: { fontSize: 10, ...font.semibold, color: '#fff' },

  sectionLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold, marginBottom: spacing.sm, marginTop: spacing.md,
  },

  eventCard: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  eventStripe: { height: 3, width: '100%' },
  eventBody: { padding: spacing.md },
  eventTop: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  eventEmoji: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  eventEmojiText: { fontSize: 22 },
  eventClubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  eventClubName: { fontSize: 10, ...font.bold, letterSpacing: 0.8 },
  mineBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: radius.full,
  },
  mineBadgeText: { fontSize: 9, ...font.bold, color: colors.primary },
  eventTitle: { fontSize: 14, ...font.bold, color: colors.textPrimary, marginBottom: 4 },
  eventMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  eventMeta: { fontSize: 10, color: colors.textSecondary },
  eventFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
  },
  interestedCount: { fontSize: 10, color: colors.textTertiary },
  interestBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: radius.sm,
  },
  interestBtnActive: {
    backgroundColor: colors.greenLight,
    borderWidth: 1, borderColor: colors.greenBorder,
  },
  interestBtnText: { fontSize: 11, color: '#fff', ...font.semibold },
  interestBtnTextActive: { color: colors.green },

  filterRow: {
    flexDirection: 'row', gap: 6,
    marginBottom: spacing.sm,
  },
  pill: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: 14, height: 32,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.card,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 12, color: colors.textSecondary, ...font.medium },
  pillTextActive: { color: '#fff', ...font.semibold },

  subSectionLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold, marginBottom: spacing.sm, marginTop: spacing.sm,
  },
  clubCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  clubCardHighlight: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  clubEmoji: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  clubEmojiText: { fontSize: 20 },
  clubLogoImg: { width: 44, height: 44, borderRadius: radius.md },
  eventLogoImg: { width: 38, height: 38, borderRadius: radius.sm },
  clubName: { fontSize: 13, ...font.bold, color: colors.textPrimary, marginBottom: 4 },
  clubMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full },
  typeBadgeText: { fontSize: 9, ...font.bold, letterSpacing: 0.4 },
  clubMembers: { fontSize: 10, color: colors.textSecondary },
  adminPill: {
    backgroundColor: colors.amberLight,
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full,
  },
  adminPillText: { fontSize: 9, ...font.bold, color: colors.amber, letterSpacing: 0.4 },
  memberPill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full,
  },
  memberPillText: { fontSize: 9, ...font.bold, color: colors.primary, letterSpacing: 0.4 },

  followBtn: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: radius.sm,
  },
  followBtnActive: {
    backgroundColor: colors.greenLight,
    borderColor: colors.greenBorder,
  },
  manageBtn: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  followBtnText: { fontSize: 11, color: colors.textSecondary, ...font.semibold },
  followBtnTextActive: { color: colors.green },
  manageBtnText: { color: colors.primary },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: 17, ...font.bold, color: colors.textPrimary },
  modalClose: { fontSize: 20, color: colors.textSecondary, padding: 4 },
  modalLabel: { fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold, marginBottom: 6, marginTop: spacing.sm },
  modalInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: 14, marginBottom: spacing.sm,
  },
  emojiBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  colorSwatch: { width: 28, height: 28, borderRadius: 14 },
  colorSwatchActive: { borderWidth: 3, borderColor: '#fff', opacity: 1, transform: [{ scale: 1.2 }] },
  typePill: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: 18, paddingVertical: 7, backgroundColor: colors.bg,
  },
  typePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typePillText: { fontSize: 13, color: colors.textSecondary, ...font.medium },
  typePillTextActive: { color: '#fff', ...font.semibold },
  submittedBox: { alignItems: 'center', paddingVertical: spacing.xl },
  submittedIcon: { fontSize: 48, marginBottom: spacing.md },
  submittedTitle: { fontSize: 18, ...font.bold, color: colors.textPrimary, marginBottom: 8 },
  submittedSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg, paddingHorizontal: spacing.md },
  submittedBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 32, paddingVertical: 12 },
  submittedBtnText: { fontSize: 14, ...font.bold, color: '#fff' },

  pendingReqCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.amberLight,
    borderWidth: 1, borderColor: colors.amber,
    borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pendingReqEmoji: { fontSize: 24 },
  pendingReqName: { fontSize: 13, ...font.bold, color: colors.textPrimary },
  pendingReqSub: { fontSize: 11, color: colors.amber, marginTop: 2 },

  createErrText: { fontSize: 12, color: colors.red, marginBottom: spacing.sm },
  createConfirmBtn: { borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm },
  createConfirmBtnText: { fontSize: 15, color: '#fff', ...font.bold },
});