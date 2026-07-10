import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, Modal, TextInput, ActivityIndicator, Image, Linking, Platform } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { hubClubs } from '../data';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, font } from '../theme';
import {
  colors as tColors,
  typography,
  spacing as tSpacing,
  radius as tRadius,
  shadows,
  presets,
} from '../theme/tokens';
import { EmptyState } from '../components/EmptyState';
import BunkmateModal from '../components/BunkmateModal';
import { Star, ShieldCheck, X, Mail, Flame, Users, CircleDot, Calendar, CalendarDays, Landmark, Clock, MapPin } from 'lucide-react-native';

const EMOJIS = ['🏛️','💼','📊','🎯','🎉','🎭','🔬','⚽','🤝','🎨','🎤','📝','💡','🚀','🌏','📚','🎵','📸'];
const COLORS = ['#5A5FB8','#4A78C0','#3D9A72','#8050B4','#C05080','#C09030','#B04040','#3D9490','#7050C0','#B02048'];

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
  const [cColor, setCColor] = useState(tColors.accent);
  const [cType, setCType] = useState('Club');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [submitted, setSubmitted] = useState(false);
  const [showBunkmate, setShowBunkmate] = useState(false);

  const eggHandler = (setter) => (val) => {
    const low = val.toLowerCase();
    if (low.includes('bubbles')) {
      setter('');
      setShowCreate(false);
      setShowBunkmate(true);
    } else if (low.includes('maximus')) {
      setter('');
      Linking.openURL('https://www.google.com/search?q=snorlax');
    } else if (low.includes('i love krrish')) {
      setter('');
      const fallback = 'https://www.google.com/search?q=sharjah';
      const chrome = Platform.OS === 'ios'
        ? 'googlechromes://www.google.com/search?q=sharjah'
        : 'intent://www.google.com/search?q=sharjah#Intent;scheme=https;package=com.android.chrome;end';
      Linking.canOpenURL(chrome).then((ok) => Linking.openURL(ok ? chrome : fallback));
    } else {
      setter(val);
    }
  };

  const handleCreate = async () => {
    if (!cName.trim()) { setCreateError('Club name is required.'); return; }
    setCreating(true);
    setCreateError('');
    try {
      await submitClubCreationRequest({ name: cName.trim(), fullName: cFullName.trim() || cName.trim(), description: cDesc.trim(), emoji: cEmoji, color: cColor, type: cType });
      setCName(''); setCFullName(''); setCDesc(''); setCEmoji('🏛️'); setCColor(tColors.accent); setCType('Club');
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
            <ShieldCheck size={16} color={colors.textPrimary} />
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
              <TouchableOpacity onPress={() => { setShowCreate(false); setSubmitted(false); }}><X size={20} color={colors.textSecondary} /></TouchableOpacity>
            </View>

            {submitted ? (
              <View style={styles.submittedBox}>
                <Mail size={28} color={colors.success} />
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: tSpacing.md }}>
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
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: tSpacing.md }}>
              {COLORS.map(col => (
                <TouchableOpacity key={col} style={[styles.colorSwatch, { backgroundColor: col }, cColor === col && styles.colorSwatchActive]} onPress={() => setCColor(col)} activeOpacity={0.8} />
              ))}
            </View>

            {/* Type */}
            <Text style={styles.modalLabel}>TYPE</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: tSpacing.md }}>
              {['Club', 'Team'].map(t => (
                <TouchableOpacity key={t} style={[styles.typePill, cType === t && styles.typePillActive]} onPress={() => setCType(t)} activeOpacity={0.8}>
                  <Text style={[styles.typePillText, cType === t && styles.typePillTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>NAME *</Text>
            <TextInput value={cName} onChangeText={eggHandler(setCName)} placeholder="e.g. Photography Club" placeholderTextColor={colors.textTertiary} style={styles.modalInput} />

            <Text style={styles.modalLabel}>FULL NAME (optional)</Text>
            <TextInput value={cFullName} onChangeText={eggHandler(setCFullName)} placeholder="e.g. Christ Photography Club" placeholderTextColor={colors.textTertiary} style={styles.modalInput} />

            <Text style={styles.modalLabel}>DESCRIPTION</Text>
            <TextInput value={cDesc} onChangeText={eggHandler(setCDesc)} placeholder="What does your club do?" placeholderTextColor={colors.textTertiary} style={[styles.modalInput, { height: 72, textAlignVertical: 'top' }]} multiline />

            {createError ? <Text style={styles.createErrText}>{createError}</Text> : null}

            <TouchableOpacity style={[styles.createConfirmBtn, { backgroundColor: cColor }]} onPress={handleCreate} disabled={creating} activeOpacity={0.85}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createConfirmBtnText}>Submit Request</Text>}
            </TouchableOpacity>
            </>
            )}
          </View>
        </View>
      </Modal>

      <BunkmateModal visible={showBunkmate} onClose={() => setShowBunkmate(false)} />

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
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Flame size={13} color={colors.accent} /><Text style={styles.featuredLabel}>FEATURED TODAY</Text></View>
                <Text style={styles.featuredTitle}>{featuredEvent.title}</Text>
                <Text style={styles.featuredMeta}>
                  {featuredClub.name} · {featuredEvent.time} · {featuredEvent.venue}
                </Text>
                <View style={styles.featuredPill}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Users size={12} color={colors.textSecondary} /><Text style={styles.featuredPillText}>{featuredEvent.interested} interested</Text></View>
                </View>
              </TouchableOpacity>
            )}

            {/* Today */}
            {today.length > 0 && (
              <>
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}><CircleDot size={10} color={tColors.success} /><Text style={[styles.sectionLabel, { color: tColors.success }]}>TODAY</Text></View>
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
            <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Calendar size={13} color={colors.textTertiary} /><Text style={styles.sectionLabel}>THIS WEEK</Text></View>
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
            <View style={{flexDirection:'row',alignItems:'center',gap:6}}><CalendarDays size={13} color={colors.textTertiary} /><Text style={styles.sectionLabel}>UPCOMING</Text></View>
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
            <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Landmark size={13} color={colors.textTertiary} /><Text style={[styles.sectionLabel, { marginTop: tSpacing.base }]}>CLUBS · TEAMS</Text></View>

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
                  <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Clock size={12} color={colors.textTertiary} /><Text style={styles.pendingReqSub}>Awaiting department approval</Text></View>
                </View>
              </View>
            ))}

            {myClubs.length > 0 && (
              <>
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Star size={12} color={colors.textTertiary} /><Text style={styles.subSectionLabel}>YOUR CLUBS & TEAMS</Text></View>
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
                {otherClubs.length > 0 && <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Landmark size={12} color={colors.textTertiary} /><Text style={styles.subSectionLabel}>ALL CLUBS & TEAMS</Text></View>}
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
              <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Calendar size={12} color={colors.textSecondary} /><Text style={styles.eventMeta}>{event.time}</Text></View>
              <View style={{flexDirection:'row',alignItems:'center',gap:4}}><MapPin size={12} color={colors.textSecondary} /><Text style={styles.eventMeta}>{event.venue}</Text></View>
            </View>
          </View>
        </View>
        <View style={styles.eventFooter}>
          <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Users size={12} color={colors.textSecondary} /><Text style={styles.interestedCount}>{event.interested + (isInterested ? 1 : 0)} interested</Text></View>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onToggle(); }}
            style={[styles.interestBtn, isInterested && styles.interestBtnActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.interestBtnText, isInterested && styles.interestBtnTextActive]}>
              {isInterested ? 'Interested' : '+ Interested'}
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
          <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Users size={12} color={colors.textSecondary} /><Text style={styles.clubMembers}>{club.members}</Text></View>
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
          {isClubAdmin ? 'Manage' : isMember ? 'View' : showDashboard ? 'Dashboard' : isFollowing ? 'Following' : '+ Follow'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tColors.bg, paddingHorizontal: tSpacing.md, paddingTop: tSpacing.sm },

  topActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginBottom: tSpacing.sm,
  },
  createBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: tColors.student.primaryDim,
    borderWidth: 1, borderColor: tColors.student.primary,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: tRadius.full,
  },
  createBtnText: { fontSize: 12, color: tColors.student.primary, fontWeight: typography.bold },
  adminBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: tColors.warningDim,
    borderWidth: 1, borderColor: tColors.warning,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: tRadius.full,
    position: 'relative',
  },
  adminBtnIcon: { fontSize: 12 },
  adminBtnText: { fontSize: 11, color: tColors.warning, fontWeight: typography.bold },
  adminBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: tColors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  adminBadgeText: { fontSize: 9, color: '#fff', fontWeight: typography.bold },

  featured: {
    borderRadius: tRadius.lg,
    padding: tSpacing.base,
    marginBottom: tSpacing.md,
  },
  featuredLabel: { fontSize: 10, fontWeight: typography.bold, letterSpacing: 1, color: 'rgba(255,255,255,0.9)', marginBottom: 6 },
  featuredTitle: { fontSize: 17, fontWeight: typography.bold, color: '#fff', marginBottom: 6 },
  featuredMeta: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  featuredPill: {
    alignSelf: 'flex-start', marginTop: tSpacing.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: tRadius.full,
  },
  featuredPillText: { fontSize: 10, fontWeight: typography.semibold, color: '#fff' },

  sectionLabel: {
    fontSize: typography.lg, color: tColors.textPrimary, letterSpacing: 0.8,
    fontWeight: typography.bold, marginBottom: tSpacing.sm, marginTop: tSpacing.md,
  },

  eventCard: {
    backgroundColor: tColors.card,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.lg,
    marginBottom: tSpacing.sm,
    overflow: 'hidden',
    ...shadows.card,
  },
  eventStripe: { height: 3, width: '100%' },
  eventBody: { padding: tSpacing.md },
  eventTop: { flexDirection: 'row', gap: tSpacing.sm, marginBottom: tSpacing.sm },
  eventEmoji: {
    width: 44, height: 44, borderRadius: tRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  eventEmojiText: { fontSize: 22 },
  eventClubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  eventClubName: { fontSize: 10, fontWeight: typography.bold, letterSpacing: 0.8 },
  mineBadge: {
    backgroundColor: tColors.student.primaryDim,
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: tRadius.full,
  },
  mineBadgeText: { fontSize: 9, fontWeight: typography.bold, color: tColors.student.primary },
  eventTitle: { fontSize: 14, fontWeight: typography.bold, color: tColors.textPrimary, marginBottom: 4 },
  eventMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  eventMeta: { fontSize: 10, color: tColors.textSecondary },
  eventFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: tSpacing.sm, borderTopWidth: 1, borderTopColor: tColors.border,
  },
  interestedCount: { fontSize: 10, color: tColors.textTertiary },
  interestBtn: {
    backgroundColor: tColors.student.primary,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: tRadius.sm,
  },
  interestBtnActive: {
    backgroundColor: tColors.successDim,
    borderWidth: 1, borderColor: tColors.success,
  },
  interestBtnText: { fontSize: 11, color: '#fff', fontWeight: typography.semibold },
  interestBtnTextActive: { color: tColors.success },

  filterRow: {
    flexDirection: 'row', gap: 6,
    marginBottom: tSpacing.sm,
  },
  pill: {
    borderWidth: 1, borderColor: tColors.border, borderRadius: tRadius.full,
    paddingHorizontal: 14, height: 32,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: tColors.card,
  },
  pillActive: { backgroundColor: tColors.student.primaryDim, borderColor: tColors.student.primary },
  pillText: { fontSize: 12, color: tColors.textSecondary, fontWeight: typography.medium },
  pillTextActive: { color: '#fff', fontWeight: typography.semibold },

  subSectionLabel: {
    fontSize: 10, color: tColors.textSecondary, letterSpacing: 0.8,
    fontWeight: typography.bold, marginBottom: tSpacing.sm, marginTop: tSpacing.sm,
  },
  clubCard: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    backgroundColor: tColors.card,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.lg,
    padding: tSpacing.md,
    marginBottom: tSpacing.sm,
  },
  clubCardHighlight: {
    borderColor: tColors.student.primary,
    backgroundColor: tColors.student.primaryDim,
  },
  clubEmoji: {
    width: 44, height: 44, borderRadius: tRadius.md,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  clubEmojiText: { fontSize: 20 },
  clubLogoImg: { width: 44, height: 44, borderRadius: tRadius.md },
  eventLogoImg: { width: 38, height: 38, borderRadius: tRadius.sm },
  clubName: { fontSize: 13, fontWeight: typography.bold, color: tColors.textPrimary, marginBottom: 4 },
  clubMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: tRadius.full },
  typeBadgeText: { fontSize: 9, fontWeight: typography.bold, letterSpacing: 0.4 },
  clubMembers: { fontSize: 10, color: tColors.textSecondary },
  adminPill: {
    backgroundColor: tColors.warningDim,
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: tRadius.full,
  },
  adminPillText: { fontSize: 9, fontWeight: typography.bold, color: tColors.warning, letterSpacing: 0.4 },
  memberPill: {
    backgroundColor: tColors.student.primaryDim,
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: tRadius.full,
  },
  memberPillText: { fontSize: 9, fontWeight: typography.bold, color: tColors.student.primary, letterSpacing: 0.4 },

  followBtn: {
    backgroundColor: tColors.card,
    borderWidth: 1, borderColor: tColors.border,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: tRadius.sm,
  },
  followBtnActive: {
    backgroundColor: tColors.successDim,
    borderColor: tColors.success,
  },
  manageBtn: {
    backgroundColor: tColors.student.primaryDim,
    borderColor: tColors.student.primary,
  },
  followBtnText: { fontSize: 11, color: tColors.textSecondary, fontWeight: typography.semibold },
  followBtnTextActive: { color: tColors.success },
  manageBtnText: { color: tColors.student.primary },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet: {
    backgroundColor: tColors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: tColors.border,
    padding: tSpacing.base, paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tSpacing.md },
  modalTitle: { fontSize: 17, fontWeight: typography.bold, color: tColors.textPrimary },
  modalClose: { fontSize: 20, color: tColors.textSecondary, padding: 4 },
  modalLabel: { fontSize: 10, color: tColors.textSecondary, letterSpacing: 0.8, fontWeight: typography.bold, marginBottom: 6, marginTop: tSpacing.sm },
  modalInput: {
    backgroundColor: tColors.bg, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md,
    color: tColors.textPrimary, fontSize: 14, marginBottom: tSpacing.sm,
  },
  emojiBtn: {
    width: 44, height: 44, borderRadius: tRadius.md,
    backgroundColor: tColors.bg, borderWidth: 1, borderColor: tColors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiBtnActive: { borderColor: tColors.student.primary, backgroundColor: tColors.student.primaryDim },
  colorSwatch: { width: 28, height: 28, borderRadius: 14 },
  colorSwatchActive: { borderWidth: 3, borderColor: '#fff', opacity: 1, transform: [{ scale: 1.2 }] },
  typePill: {
    borderWidth: 1, borderColor: tColors.border, borderRadius: tRadius.full,
    paddingHorizontal: 18, paddingVertical: 7, backgroundColor: tColors.bg,
  },
  typePillActive: { backgroundColor: tColors.student.primary, borderColor: tColors.student.primary },
  typePillText: { fontSize: 13, color: tColors.textSecondary, fontWeight: typography.medium },
  typePillTextActive: { color: '#fff', fontWeight: typography.semibold },
  submittedBox: { alignItems: 'center', paddingVertical: tSpacing.lg },
  submittedIcon: { fontSize: 48, marginBottom: tSpacing.md },
  submittedTitle: { fontSize: 18, fontWeight: typography.bold, color: tColors.textPrimary, marginBottom: 8 },
  submittedSub: { fontSize: 13, color: tColors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: tSpacing.base, paddingHorizontal: tSpacing.md },
  submittedBtn: { backgroundColor: tColors.student.primary, borderRadius: tRadius.md, paddingHorizontal: 32, paddingVertical: 12 },
  submittedBtnText: { fontSize: 14, fontWeight: typography.bold, color: '#fff' },

  pendingReqCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: tColors.warningDim,
    borderWidth: 1, borderColor: tColors.warning,
    borderRadius: tRadius.md, padding: tSpacing.md,
    marginBottom: tSpacing.sm,
  },
  pendingReqEmoji: { fontSize: 24 },
  pendingReqName: { fontSize: 13, fontWeight: typography.bold, color: tColors.textPrimary },
  pendingReqSub: { fontSize: 11, color: tColors.warning, marginTop: 2 },

  createErrText: { fontSize: 12, color: tColors.error, marginBottom: tSpacing.sm },
  createConfirmBtn: { borderRadius: tRadius.md, paddingVertical: 14, alignItems: 'center', marginTop: tSpacing.sm },
  createConfirmBtnText: { fontSize: 15, color: '#fff', fontWeight: typography.bold },
});