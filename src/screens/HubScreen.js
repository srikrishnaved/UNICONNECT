import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { hubClubs } from '../data';
import { useApp } from '../context/AppContext';
import {
  colors as tColors,
  typography,
  spacing as tSpacing,
  radius as tRadius,
  shadows,
} from '../theme/tokens';
import { EmptyState } from '../components/EmptyState';
import BunkmateModal from '../components/BunkmateModal';
import {
  Star,
  ShieldCheck,
  X,
  Mail,
  Flame,
  Users,
  CircleDot,
  Calendar,
  Landmark,
  Clock,
  MapPin,
  ChevronRight,
  Plus,
  Check,
  Sliders,
  Sparkles,
  ArrowRight,
  Info,
  // Mapped Lucide icons for clubs
  Briefcase,
  BarChart3,
  Globe,
  PartyPopper,
  Drama,
  FlaskConical,
  Trophy,
  Handshake,
  ClipboardList,
  Clapperboard,
  Cpu,
  Mic,
  FileText,
  Palette,
  Music,
  Megaphone,
  Target,
  Lightbulb,
  Rocket,
  BookOpen,
  Camera,
} from 'lucide-react-native';

const EMOJIS = ['🏛️', '💼', '📊', '🎯', '🎉', '🎭', '🔬', '⚽', '🤝', '🎨', '🎤', '📝', '💡', '🚀', '🌏', '📚', '🎵', '📸'];
const COLORS = ['#5A5FB8', '#4A78C0', '#3D9A72', '#8050B4', '#C05080', '#C09030', '#B04040', '#3D9490', '#7050C0', '#B02048'];

const TYPES = ['All Showroom', 'Clubs', 'Teams'];

// Maps the stored emoji code/character to a clean, premium Lucide icon component
const EMOJI_TO_LUCIDE = {
  '💼': Briefcase,
  '📊': BarChart3,
  '🌏': Globe,
  '🎉': PartyPopper,
  '🎭': Drama,
  '🔬': FlaskConical,
  '⚽': Trophy,
  '🤝': Handshake,
  '📋': ClipboardList,
  '🎬': Clapperboard,
  '✦': Cpu,
  '🎤': Mic,
  '📝': FileText,
  '🎨': Palette,
  '💃': Sparkles,
  '🎶': Music,
  '📣': Megaphone,
  '🏛️': Landmark,
  '🎯': Target,
  '💡': Lightbulb,
  '🚀': Rocket,
  '📚': BookOpen,
  '🎵': Music,
  '📸': Camera,
};

export function ClubLucideIcon({ emoji, size = 18, color = tColors.textPrimary }) {
  const IconComp = EMOJI_TO_LUCIDE[emoji] || Landmark;
  return <IconComp size={size} color={color} />;}

export default function HubScreen() {
  const navigation = useNavigation();
  const {
    events: hubEvents,
    clubAdminRequests,
    loadClubAdminRequests,
    isAppAdmin,
    isSapsCore,
    interestedEventIds,
    toggleEventInterest,
    followingClubIds,
    toggleClubFollow,
    clubMemberships,
    approvedClubAdmins,
    userCreatedClubs,
    myClubRequests,
    submitClubCreationRequest,
    hiddenClubIds,
  } = useApp();

  const [filter, setFilter] = useState('All Showroom');

  useFocusEffect(
    useCallback(() => {
      if (isAppAdmin) loadClubAdminRequests();
    }, [isAppAdmin, loadClubAdminRequests])
  );

  // Configurator / Creation states
  const [showCreate, setShowCreate] = useState(false);
  const [configStep, setConfigStep] = useState(1); // Steps: 1 (Type), 2 (Emblem), 3 (Color), 4 (Specs)
  
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
    if (!cName.trim()) {
      setCreateError('Model designation name is required.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await submitClubCreationRequest({
        name: cName.trim(),
        fullName: cFullName.trim() || cName.trim(),
        description: cDesc.trim(),
        emoji: cEmoji,
        color: cColor,
        type: cType,
      });
      setCName('');
      setCFullName('');
      setCDesc('');
      setCEmoji('🏛️');
      setCColor(tColors.accent);
      setCType('Club');
      setConfigStep(1);
      setSubmitted(true);
    } catch (e) {
      setCreateError(e.message || 'Could not submit request.');
    } finally {
      setCreating(false);
    }
  };

  const allClubs = useMemo(
    () => [...hubClubs, ...(userCreatedClubs || [])].filter((c) => !hiddenClubIds?.has(String(c.id))),
    [userCreatedClubs, hiddenClubIds]
  );

  const { myClubs, otherClubs } = useMemo(() => {
    const base =
      filter === 'All Showroom'
        ? allClubs
        : allClubs.filter((c) => (filter === 'Clubs' ? c.type === 'Club' : c.type === 'Team'));
    const isMine = (c) => {
      const n = Number(c.id);
      return (
        clubMemberships?.has(n) ||
        clubMemberships?.has(String(c.id)) ||
        approvedClubAdmins?.has(n) ||
        approvedClubAdmins?.has(String(c.id))
      );
    };
    const mine = base.filter(isMine);
    const others = base.filter((c) => !isMine(c));
    return { myClubs: mine, otherClubs: others };
  }, [filter, allClubs, clubMemberships, approvedClubAdmins]);

  const { today, thisWeek, upcoming } = useMemo(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const d7 = new Date(d);
    d7.setDate(d7.getDate() + 7);
    const weekStr = `${d7.getFullYear()}-${pad(d7.getMonth() + 1)}-${pad(d7.getDate())}`;

    const t = [],
      w = [],
      u = [];
    for (const e of hubEvents) {
      const date = e.event_date;
      if (date) {
        if (date < todayStr) continue; // past
        if (date === todayStr) t.push(e);
        else if (date <= weekStr) w.push(e);
        else u.push(e);
      } else {
        if (e.when === 'today') t.push(e);
        else if (e.when === 'thisWeek') w.push(e);
        else u.push(e);
      }
    }
    return { today: t, thisWeek: w, upcoming: u };
  }, [hubEvents]);

  // Featured Event or Fallback Featured Club
  const featuredEvent = today[0] || thisWeek[0];
  const featuredClub = allClubs.find((c) => c.id === featuredEvent?.clubId);

  // Fallback showcase (like FLC or Junoon) when no active event
  const fallbackShowcaseClub = useMemo(() => {
    if (featuredClub) return null;
    return allClubs.find((c) => c.name === 'FLC') || allClubs[0];
  }, [featuredClub, allClubs]);

  const openConfigurator = () => {
    setSubmitted(false);
    setConfigStep(1);
    setShowCreate(true);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Apple/VW Styled Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.headerTitle}>The Hub</Text>
              <Text style={styles.headerTagline}>Discover the lineup. Configure. Connect.</Text>
            </View>
            
            {/* Top Config & Admin Buttons */}
            <View style={styles.topUtilityRow}>
              {isAppAdmin && (
                <TouchableOpacity
                  style={styles.adminUtilityBtn}
                  onPress={() => navigation.navigate('AppAdmin')}
                  activeOpacity={0.8}
                >
                  <ShieldCheck size={16} color={tColors.warning} />
                  {clubAdminRequests.length > 0 && (
                    <View style={styles.adminUtilityBadge}>
                      <Text style={styles.adminUtilityBadgeText}>{clubAdminRequests.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              
              <TouchableOpacity style={styles.configureMainBtn} onPress={openConfigurator} activeOpacity={0.85}>
                <Sliders size={14} color={tColors.textPrimary} />
                <Text style={styles.configureMainBtnText}>Configure</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Billboard Hero Section (Apple Marquee / VW Main Stage) */}
        {featuredEvent && featuredClub ? (
          <TouchableOpacity
            style={[styles.billboard, { borderColor: `${featuredClub.color}66` }]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('EventDetail', { event: featuredEvent })}
          >
            <View style={[styles.billboardGradientOverlay, { backgroundColor: `${featuredClub.color}0D` }]} />
            <View style={styles.billboardContent}>
              <View style={styles.billboardBadgeContainer}>
                <Flame size={12} color={tColors.accent} />
                <Text style={styles.billboardBadgeText}>TODAY'S SPOTLIGHT</Text>
              </View>
              
              <Text style={styles.billboardTitle} numberOfLines={2}>
                {featuredEvent.title}
              </Text>
              
              <Text style={styles.billboardSub}>
                Presented by <Text style={{ color: featuredClub.color, fontWeight: typography.bold }}>{featuredClub.fullName}</Text>
              </Text>

              {/* Specs Panel */}
              <View style={styles.billboardSpecs}>
                <View style={styles.billboardSpecItem}>
                  <Text style={styles.billboardSpecLabel}>VENUE</Text>
                  <Text style={styles.billboardSpecValue} numberOfLines={1}>{featuredEvent.venue}</Text>
                </View>
                <View style={styles.billboardSpecItem}>
                  <Text style={styles.billboardSpecLabel}>TIME</Text>
                  <Text style={styles.billboardSpecValue} numberOfLines={1}>{featuredEvent.time}</Text>
                </View>
                <View style={styles.billboardSpecItem}>
                  <Text style={styles.billboardSpecLabel}>INTEREST</Text>
                  <Text style={styles.billboardSpecValue} numberOfLines={1}>{featuredEvent.interested} Attending</Text>
                </View>
              </View>

              {/* CTAs */}
              <View style={styles.billboardActions}>
                <TouchableOpacity
                  style={[styles.billboardPrimaryBtn, { backgroundColor: featuredClub.color }]}
                  onPress={() => navigation.navigate('EventDetail', { event: featuredEvent })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.billboardPrimaryText}>Explore Model Details</Text>
                  <ChevronRight size={14} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.billboardSecondaryBtn,
                    interestedEventIds.has(String(featuredEvent.id)) && styles.billboardSecondaryBtnActive,
                  ]}
                  onPress={() => toggleEventInterest(featuredEvent.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.billboardSecondaryText,
                      interestedEventIds.has(String(featuredEvent.id)) && styles.billboardSecondaryTextActive,
                    ]}
                  >
                    {interestedEventIds.has(String(featuredEvent.id)) ? 'Interested ✓' : '+ Add Interest'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ) : fallbackShowcaseClub ? (
          /* Fallback Showcase Card if no featured event */
          <TouchableOpacity
            style={[styles.billboard, { borderColor: `${fallbackShowcaseClub.color}66` }]}
            activeOpacity={0.9}
            onPress={() =>
              navigation.navigate(
                fallbackShowcaseClub.type === 'Team' ? 'TeamDetail' : 'ClubDetail',
                { clubId: fallbackShowcaseClub.id }
              )
            }
          >
            <View style={[styles.billboardGradientOverlay, { backgroundColor: `${fallbackShowcaseClub.color}0D` }]} />
            <View style={styles.billboardContent}>
              <View style={styles.billboardBadgeContainer}>
                <Sparkles size={12} color={tColors.accent} />
                <Text style={styles.billboardBadgeText}>FEATURED CELL</Text>
              </View>
              
              <Text style={styles.billboardTitle} numberOfLines={2}>
                {fallbackShowcaseClub.fullName}
              </Text>
              
              <Text style={styles.billboardSub} numberOfLines={2}>
                {fallbackShowcaseClub.desc}
              </Text>

              {/* Specs Panel */}
              <View style={styles.billboardSpecs}>
                <View style={styles.billboardSpecItem}>
                  <Text style={styles.billboardSpecLabel}>CHASSIS</Text>
                  <Text style={[styles.billboardSpecValue, { color: fallbackShowcaseClub.color }]}>
                    {fallbackShowcaseClub.type.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.billboardSpecItem}>
                  <Text style={styles.billboardSpecLabel}>COORDINATOR</Text>
                  <Text style={styles.billboardSpecValue} numberOfLines={1}>
                    {fallbackShowcaseClub.coordinator || 'Faculty Lead'}
                  </Text>
                </View>
                <View style={styles.billboardSpecItem}>
                  <Text style={styles.billboardSpecLabel}>CREW</Text>
                  <Text style={styles.billboardSpecValue} numberOfLines={1}>
                    {fallbackShowcaseClub.members} Members
                  </Text>
                </View>
              </View>

              {/* CTAs */}
              <View style={styles.billboardActions}>
                <TouchableOpacity
                  style={[styles.billboardPrimaryBtn, { backgroundColor: fallbackShowcaseClub.color }]}
                  onPress={() =>
                    navigation.navigate(
                      fallbackShowcaseClub.type === 'Team' ? 'TeamDetail' : 'ClubDetail',
                      { clubId: fallbackShowcaseClub.id }
                    )
                  }
                  activeOpacity={0.8}
                >
                  <Text style={styles.billboardPrimaryText}>Explore Showroom</Text>
                  <ChevronRight size={14} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.billboardSecondaryBtn,
                    followingClubIds.has(String(fallbackShowcaseClub.id)) && styles.billboardSecondaryBtnActive,
                  ]}
                  onPress={() => toggleClubFollow(fallbackShowcaseClub.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.billboardSecondaryText,
                      followingClubIds.has(String(fallbackShowcaseClub.id)) && styles.billboardSecondaryBtnActive,
                    ]}
                  >
                    {followingClubIds.has(String(fallbackShowcaseClub.id)) ? 'Following ✓' : '+ Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Apple Segmented Showroom Menu (Filters) */}
        <View style={styles.filterMenuContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterMenu}>
            {TYPES.map((t) => {
              const active = filter === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.filterMenuItem, active && styles.filterMenuItemActive]}
                  onPress={() => setFilter(t)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterMenuItemText, active && styles.filterMenuItemTextActive]}>
                    {t.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Awaiting Approvals shelf (If any) */}
        {(myClubRequests || []).filter((r) => r.status === 'pending').length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeadingRow}>
              <Clock size={14} color={tColors.warning} />
              <Text style={[styles.sectionHeading, { color: tColors.warning }]}>PENDING CONFIGURATIONS</Text>
            </View>
            {(myClubRequests || [])
              .filter((r) => r.status === 'pending')
              .map((r) => (
                <View key={r.id} style={styles.pendingCard}>
                  <View style={[styles.pendingEmojiContainer, { backgroundColor: `${r.color || tColors.accent}22` }]}>
                    <ClubLucideIcon emoji={r.emoji} size={20} color={r.color || tColors.accent} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.pendingName}>{r.name}</Text>
                    <Text style={styles.pendingStatusText}>Awaiting department blueprint verification</Text>
                  </View>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>UNDER REVIEW</Text>
                  </View>
                </View>
              ))}
          </View>
        )}

        {/* Live Timeline / Event Lineup Section (Apple TV+ Horizontal Slider) */}
        {(today.length > 0 || thisWeek.length > 0 || upcoming.length > 0) && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeadingRow}>
              <CircleDot size={14} color={tColors.accent} />
              <Text style={styles.sectionHeading}>UPCOMING SESSIONS & EVENTS</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.eventsCarousel}
            >
              {today.map((e) => (
                <EventProductCard
                  key={e.id}
                  event={e}
                  club={allClubs.find((c) => c.id === e.clubId)}
                  isInterested={interestedEventIds.has(String(e.id))}
                  onToggle={() => toggleEventInterest(e.id)}
                  onPress={() => navigation.navigate('EventDetail', { event: e })}
                  tag="TODAY"
                />
              ))}
              {thisWeek.map((e) => (
                <EventProductCard
                  key={e.id}
                  event={e}
                  club={allClubs.find((c) => c.id === e.clubId)}
                  isInterested={interestedEventIds.has(String(e.id))}
                  onToggle={() => toggleEventInterest(e.id)}
                  onPress={() => navigation.navigate('EventDetail', { event: e })}
                  tag="THIS WEEK"
                />
              ))}
              {upcoming.map((e) => (
                <EventProductCard
                  key={e.id}
                  event={e}
                  club={allClubs.find((c) => c.id === e.clubId)}
                  isInterested={interestedEventIds.has(String(e.id))}
                  onToggle={() => toggleEventInterest(e.id)}
                  onPress={() => navigation.navigate('EventDetail', { event: e })}
                  tag="UPCOMING"
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Your Garage / Memberships (Subscribed Models) */}
        {myClubs.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeadingRow}>
              <Star size={14} color={tColors.accent} />
              <Text style={styles.sectionHeading}>YOUR ACTIVE VEHICLES</Text>
            </View>
            <View style={styles.showroomGrid}>
              {myClubs.map((c) => {
                const isAdmin = approvedClubAdmins?.has(c.id) || approvedClubAdmins?.has(String(c.id));
                return (
                  <ShowroomClubCard
                    key={c.id}
                    club={c}
                    isFollowing={followingClubIds.has(String(c.id))}
                    isMember={clubMemberships?.has(c.id) || clubMemberships?.has(String(c.id))}
                    isClubAdmin={isAdmin}
                    onToggle={() => toggleClubFollow(c.id)}
                    onPress={() =>
                      isAdmin
                        ? navigation.navigate('ClubDashboard', { clubId: c.id })
                        : navigation.navigate(c.type === 'Team' ? 'TeamDetail' : 'ClubDetail', { clubId: c.id })
                    }
                    onSapsDashboard={
                      isSapsCore && !isAdmin
                        ? () =>
                            navigation.navigate(c.type === 'Team' ? 'TeamDashboard' : 'ClubDashboard', {
                              clubId: c.id,
                            })
                        : undefined
                    }
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* All Showcase Models (All Clubs/Teams directory) */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeadingRow}>
            <Landmark size={14} color={tColors.textSecondary} />
            <Text style={styles.sectionHeading}>EXPLORE ALL SHOWROOM MODELS</Text>
          </View>

          {otherClubs.length > 0 ? (
            <View style={styles.showroomGrid}>
              {otherClubs.map((c) => (
                <ShowroomClubCard
                  key={c.id}
                  club={c}
                  isFollowing={followingClubIds.has(String(c.id))}
                  isMember={false}
                  isClubAdmin={false}
                  onToggle={() => toggleClubFollow(c.id)}
                  onPress={() =>
                    navigation.navigate(c.type === 'Team' ? 'TeamDetail' : 'ClubDetail', { clubId: c.id })
                  }
                  onSapsDashboard={
                    isSapsCore
                      ? () =>
                          navigation.navigate(c.type === 'Team' ? 'TeamDashboard' : 'ClubDashboard', {
                            clubId: c.id,
                          })
                      : undefined
                  }
                />
              ))}
            </View>
          ) : myClubs.length === 0 ? (
            <EmptyState
              icon={Star}
              heading="Showroom empty"
              subtext="Be the first to configure and register a cell for your department."
            />
          ) : (
            <Text style={styles.allManagedText}>You are currently participating in all active configurations.</Text>
          )}
        </View>
      </ScrollView>

      {/* Easter Egg Bunkmate Modal */}
      <BunkmateModal visible={showBunkmate} onClose={() => setShowBunkmate(false)} />

      {/* Volkswagen Configurator Modal ("Create Club/Team") */}
      <Modal
        visible={showCreate}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowCreate(false);
          setSubmitted(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCreate(false)}
          />
          <View style={styles.modalSheet}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Sliders size={18} color={tColors.accent} />
                <Text style={styles.modalTitle}>Club Configurator</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowCreate(false);
                  setSubmitted(false);
                }}
              >
                <X size={20} color={tColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {submitted ? (
              /* Success Panel */
              <View style={styles.submittedBox}>
                <View style={styles.submittedBadge}>
                  <Check size={28} color={tColors.success} />
                </View>
                <Text style={styles.submittedTitle}>Configuration Locked!</Text>
                <Text style={styles.submittedSub}>
                  The blueprint for <Text style={{ fontWeight: typography.bold, color: tColors.textPrimary }}>{cName}</Text> has been submitted for review. HOD verification pending.
                </Text>
                <TouchableOpacity
                  style={styles.submittedBtn}
                  onPress={() => {
                    setShowCreate(false);
                    setSubmitted(false);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.submittedBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Configurator Multi-Step Flow */
              <>
                {/* Step indicator */}
                <View style={styles.stepIndicatorRow}>
                  {[1, 2, 3, 4].map((stepNum) => (
                    <View
                      key={stepNum}
                      style={[
                        styles.stepIndicatorLine,
                        configStep >= stepNum && styles.stepIndicatorLineActive,
                        configStep === stepNum && { backgroundColor: tColors.accent },
                      ]}
                    />
                  ))}
                </View>

                {configStep === 1 && (
                  /* Step 1: Chassis type */
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Step 1: Choose Chassis Platform</Text>
                    <Text style={styles.stepSub}>Define the foundational architecture of your cell.</Text>
                    
                    <View style={styles.chassisContainer}>
                      <TouchableOpacity
                        style={[styles.chassisCard, cType === 'Club' && styles.chassisCardActive]}
                        onPress={() => setCType('Club')}
                        activeOpacity={0.85}
                      >
                        <Landmark size={28} color={cType === 'Club' ? tColors.accent : tColors.textSecondary} />
                        <Text style={[styles.chassisTitle, cType === 'Club' && styles.chassisTitleActive]}>Club / Cell</Text>
                        <Text style={styles.chassisDesc}>For academic forums, professional chapters, and open interest cells.</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.chassisCard, cType === 'Team' && styles.chassisCardActive]}
                        onPress={() => setCType('Team')}
                        activeOpacity={0.85}
                      >
                        <Users size={28} color={cType === 'Team' ? tColors.accent : tColors.textSecondary} />
                        <Text style={[styles.chassisTitle, cType === 'Team' && styles.chassisTitleActive]}>Operational Team</Text>
                        <Text style={styles.chassisDesc}>For dedicated wings: logistics, design, AV setups, or cultural groups.</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {configStep === 2 && (
                  /* Step 2: Emblem Icon */
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Step 2: Assign Emblem Symbol</Text>
                    <Text style={styles.stepSub}>Select the signature badge to be displayed on directories.</Text>
                    
                    <View style={styles.emblemPreview}>
                      <View style={[styles.emblemBubble, { borderColor: cColor, justifyContent: 'center', alignItems: 'center' }]}>
                        <ClubLucideIcon emoji={cEmoji} size={32} color={cColor} />
                      </View>
                      <Text style={styles.emblemPreviewLabel}>ACTIVE BLUEPRINT BADGE</Text>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.emojisScroll}
                    >
                      <View style={styles.emojisGrid}>
                        {EMOJIS.map((e) => {
                          const active = cEmoji === e;
                          return (
                            <TouchableOpacity
                              key={e}
                              style={[styles.emojiBtn, active && styles.emojiBtnActive]}
                              onPress={() => setCEmoji(e)}
                              activeOpacity={0.7}
                            >
                              <ClubLucideIcon emoji={e} size={20} color={active ? tColors.accent : tColors.textSecondary} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                )}

                {configStep === 3 && (
                  /* Step 3: Livery / Color */
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Step 3: Signature Brand Livery</Text>
                    <Text style={styles.stepSub}>Apply the primary color code that defines your brand styling.</Text>

                    {/* Mini live preview card */}
                    <View style={styles.liveCardPreviewContainer}>
                      <Text style={styles.previewLabel}>LIVE BRAND PREVIEW</Text>
                      <View style={[styles.livePreviewCard, { borderColor: `${cColor}55` }]}>
                        <View style={[styles.livePreviewEmoji, { backgroundColor: `${cColor}22`, justifyContent: 'center', alignItems: 'center' }]}>
                          <ClubLucideIcon emoji={cEmoji} size={18} color={cColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.livePreviewName, { color: cColor }]}>
                            {cName.trim() || 'Configuration Name'}
                          </Text>
                          <Text style={styles.livePreviewType}>{cType.toUpperCase()}</Text>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.modalLabel}>SELECT COLOR SYSTEM</Text>
                    <View style={styles.colorSwatchRow}>
                      {COLORS.map((col) => (
                        <TouchableOpacity
                          key={col}
                          style={[
                            styles.colorSwatch,
                            { backgroundColor: col },
                            cColor === col && styles.colorSwatchActive,
                          ]}
                          onPress={() => setCColor(col)}
                          activeOpacity={0.8}
                        />
                      ))}
                    </View>
                  </View>
                )}

                {configStep === 4 && (
                  /* Step 4: Technical specifications */
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Step 4: Technical Specifications</Text>
                    <Text style={styles.stepSub}>Input the official designation, full name, and mission details.</Text>

                    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
                      <Text style={styles.modalLabel}>DESIGNATION NAME *</Text>
                      <TextInput
                        value={cName}
                        onChangeText={eggHandler(setCName)}
                        placeholder="e.g. FLC or Tech Team"
                        placeholderTextColor={tColors.textTertiary}
                        style={styles.modalInput}
                      />

                      <Text style={styles.modalLabel}>FULL CELL TITLE</Text>
                      <TextInput
                        value={cFullName}
                        onChangeText={eggHandler(setCFullName)}
                        placeholder="e.g. Finance & Leadership Cell"
                        placeholderTextColor={tColors.textTertiary}
                        style={styles.modalInput}
                      />

                      <Text style={styles.modalLabel}>MISSION STATEMENT / DESCRIPTION</Text>
                      <TextInput
                        value={cDesc}
                        onChangeText={eggHandler(setCDesc)}
                        placeholder="Summarize the core activities and value proposition..."
                        placeholderTextColor={tColors.textTertiary}
                        style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
                        multiline
                      />
                    </ScrollView>

                    {createError ? <Text style={styles.createErrText}>{createError}</Text> : null}
                  </View>
                )}

                {/* Footer Navigation Buttons */}
                <View style={styles.configuratorNavigation}>
                  {configStep > 1 ? (
                    <TouchableOpacity
                      style={styles.configBackBtn}
                      onPress={() => setConfigStep((prev) => prev - 1)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.configBackText}>Back</Text>
                    </TouchableOpacity>
                  ) : (
                    <View />
                  )}

                  {configStep < 4 ? (
                    <TouchableOpacity
                      style={styles.configNextBtn}
                      onPress={() => {
                        if (configStep === 1 && !cType) return;
                        setConfigStep((prev) => prev + 1);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.configNextText}>Next Step</Text>
                      <ArrowRight size={14} color="#fff" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.configSubmitBtn, { backgroundColor: cColor }]}
                      onPress={handleCreate}
                      disabled={creating}
                      activeOpacity={0.85}
                    >
                      {creating ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Text style={styles.configSubmitText}>Submit Spec Blueprint</Text>
                          <Check size={14} color="#fff" />
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* Sub-component: Event Product Card (Apple TV / VW spec list style) */
function EventProductCard({ event, club, isInterested, onToggle, onPress, tag }) {
  if (!club) return null;
  return (
    <TouchableOpacity style={styles.eventProductCard} activeOpacity={0.85} onPress={onPress}>
      <View style={[styles.eventTagBadge, { backgroundColor: `${club.color}22` }]}>
        <Text style={[styles.eventTagText, { color: club.color }]}>{tag}</Text>
      </View>

      <Text style={styles.eventProductTitle} numberOfLines={2}>
        {event.title}
      </Text>

      <View style={styles.eventProductClubRow}>
        <View style={[styles.eventProductClubDot, { backgroundColor: club.color }]} />
        <Text style={styles.eventProductClubName}>{club.name}</Text>
        {event.isMine && (
          <View style={styles.eventMineBadge}>
            <Text style={styles.eventMineBadgeText}>YOUR WING</Text>
          </View>
        )}
      </View>

      {/* Specifications list */}
      <View style={styles.eventProductSpecs}>
        <View style={styles.eventProductSpecRow}>
          <Clock size={11} color={tColors.textTertiary} />
          <Text style={styles.eventProductSpecText} numberOfLines={1}>
            {event.time}
          </Text>
        </View>
        <View style={styles.eventProductSpecRow}>
          <MapPin size={11} color={tColors.textTertiary} />
          <Text style={styles.eventProductSpecText} numberOfLines={1}>
            {event.venue}
          </Text>
        </View>
      </View>

      <View style={styles.eventProductFooter}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Users size={11} color={tColors.textSecondary} />
          <Text style={styles.eventProductCount}>
            {event.interested + (isInterested ? 1 : 0)} attending
          </Text>
        </View>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation?.();
            onToggle();
          }}
          style={[styles.eventInterestBtn, isInterested && styles.eventInterestBtnActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.eventInterestBtnText, isInterested && styles.eventInterestBtnTextActive]}>
            {isInterested ? 'Attending ✓' : '+ Join'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

/* Sub-component: Showroom Club Card (VW specification sheet style) */
function ShowroomClubCard({
  club,
  isFollowing,
  isMember,
  isClubAdmin,
  onToggle,
  onPress,
  onSapsDashboard,
}) {
  const showDashboard = !!onSapsDashboard && !isClubAdmin;
  return (
    <TouchableOpacity
      style={[
        styles.showroomClubCard,
        (isMember || isClubAdmin) && styles.showroomClubCardHighlight,
      ]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      {/* Top Banner Stripe */}
      <View style={[styles.showroomCardStripe, { backgroundColor: club.color }]} />

      <View style={styles.showroomCardBody}>
        {/* Emblem & Title Row */}
        <View style={styles.showroomCardTop}>
          <View style={[styles.showroomCardLogo, { backgroundColor: `${club.color}15` }]}>
            {club.logo_url ? (
              <Image source={{ uri: club.logo_url }} style={styles.showroomCardLogoImg} />
            ) : (
              <ClubLucideIcon emoji={club.emoji} size={20} color={club.color} />
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={styles.showroomNameRow}>
              <Text style={styles.showroomCardName} numberOfLines={1}>
                {club.name}
              </Text>
              <View style={[styles.showroomTypeTag, { borderColor: `${club.color}44` }]}>
                <Text style={[styles.showroomTypeTagText, { color: club.color }]}>
                  {club.type.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.showroomCardFullName} numberOfLines={1}>
              {club.fullName}
            </Text>
          </View>
        </View>

        {/* Short Description */}
        <Text style={styles.showroomCardDesc} numberOfLines={2}>
          {club.desc}
        </Text>

        {/* Detailed Specs list (VW-style) */}
        <View style={styles.showroomCardSpecs}>
          <View style={styles.showroomCardSpecItem}>
            <Text style={styles.showroomCardSpecLabel}>MEMBER BASE</Text>
            <Text style={styles.showroomCardSpecValue}>{club.members} students</Text>
          </View>
          <View style={styles.showroomCardSpecItem}>
            <Text style={styles.showroomCardSpecLabel}>COORDINATOR</Text>
            <Text style={styles.showroomCardSpecValue} numberOfLines={1}>
              {club.coordinator || 'Student-run'}
            </Text>
          </View>
        </View>

        {/* Footer Actions */}
        <View style={styles.showroomCardFooter}>
          {isClubAdmin ? (
            <View style={styles.statusBadgeAdmin}>
              <Text style={styles.statusBadgeTextAdmin}>ADMIN MODE</Text>
            </View>
          ) : isMember ? (
            <View style={styles.statusBadgeMember}>
              <Text style={styles.statusBadgeTextMember}>MEMBER</Text>
            </View>
          ) : (
            <View />
          )}

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation?.();
              if (isClubAdmin || isMember) onPress();
              else if (showDashboard) onSapsDashboard();
              else onToggle();
            }}
            style={[
              styles.showroomCardBtn,
              (isClubAdmin || isMember || showDashboard) && styles.showroomCardBtnManage,
              isFollowing &&
                !isClubAdmin &&
                !isMember &&
                !showDashboard &&
                styles.showroomCardBtnFollowing,
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.showroomCardBtnText,
                (isClubAdmin || isMember || showDashboard) && styles.showroomCardBtnManageText,
                isFollowing &&
                  !isClubAdmin &&
                  !isMember &&
                  !showDashboard &&
                  styles.showroomCardBtnFollowingText,
              ]}
            >
              {isClubAdmin
                ? 'Manage'
                : isMember
                ? 'Enter Room'
                : showDashboard
                ? 'Dashboard'
                : isFollowing
                ? 'Following ✓'
                : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tColors.bg,
    paddingHorizontal: tSpacing.base,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
  },

  /* Header Styles */
  headerSection: {
    marginBottom: tSpacing.base,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: typography.xxxl,
    fontFamily: typography.fontHeading,
    fontWeight: typography.bold,
    color: tColors.textPrimary,
    letterSpacing: -0.5,
  },
  headerTagline: {
    fontSize: typography.xs,
    fontFamily: typography.fontMono,
    color: tColors.textSecondary,
    marginTop: 4,
  },
  topUtilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  configureMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tColors.card,
    borderWidth: 1,
    borderColor: tColors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: tRadius.md,
  },
  configureMainBtnText: {
    fontSize: typography.xs,
    color: tColors.textPrimary,
    fontWeight: typography.bold,
  },
  adminUtilityBtn: {
    width: 32,
    height: 32,
    borderRadius: tRadius.md,
    backgroundColor: tColors.card,
    borderWidth: 1,
    borderColor: tColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  adminUtilityBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: tColors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminUtilityBadgeText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: typography.bold,
  },

  /* Billboard (Hero Banner) */
  billboard: {
    backgroundColor: tColors.card,
    borderWidth: 1,
    borderRadius: tRadius.lg,
    overflow: 'hidden',
    marginBottom: tSpacing.base,
    position: 'relative',
    ...shadows.card,
  },
  billboardGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  billboardContent: {
    padding: tSpacing.base,
  },
  billboardBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: tSpacing.xs,
  },
  billboardBadgeText: {
    fontSize: 9,
    fontFamily: typography.fontMono,
    fontWeight: typography.bold,
    color: tColors.accent,
    letterSpacing: 1,
  },
  billboardTitle: {
    fontSize: typography.xl,
    fontFamily: typography.fontHeading,
    color: tColors.textPrimary,
    marginBottom: 6,
    lineHeight: 28,
  },
  billboardSub: {
    fontSize: typography.sm,
    color: tColors.textSecondary,
    marginBottom: tSpacing.md,
  },
  billboardSpecs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: tColors.cardAlt,
    borderWidth: 1,
    borderColor: tColors.borderSubtle,
    borderRadius: tRadius.md,
    padding: tSpacing.sm,
    marginBottom: tSpacing.base,
  },
  billboardSpecItem: {
    flex: 1,
    paddingHorizontal: 4,
  },
  billboardSpecLabel: {
    fontSize: 8,
    fontFamily: typography.fontMono,
    color: tColors.textTertiary,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  billboardSpecValue: {
    fontSize: typography.sm,
    color: tColors.textPrimary,
    fontWeight: typography.semibold,
  },
  billboardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  billboardPrimaryBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: tRadius.md,
    paddingVertical: 10,
  },
  billboardPrimaryText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    color: '#fff',
  },
  billboardSecondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: tColors.border,
    borderRadius: tRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: tColors.cardAlt,
  },
  billboardSecondaryBtnActive: {
    borderColor: tColors.success,
    backgroundColor: tColors.successDim,
  },
  billboardSecondaryText: {
    fontSize: typography.xs,
    color: tColors.textSecondary,
    fontWeight: typography.semibold,
  },
  billboardSecondaryTextActive: {
    color: tColors.success,
  },

  /* Showroom Segmented Filters */
  filterMenuContainer: {
    marginBottom: tSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tColors.borderSubtle,
    paddingBottom: 2,
  },
  filterMenu: {
    flexDirection: 'row',
    gap: 16,
  },
  filterMenuItem: {
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterMenuItemActive: {
    borderBottomColor: tColors.accent,
  },
  filterMenuItemText: {
    fontSize: 10,
    fontFamily: typography.fontMono,
    color: tColors.textTertiary,
    fontWeight: typography.bold,
    letterSpacing: 0.8,
  },
  filterMenuItemTextActive: {
    color: tColors.accent,
  },

  /* Sections */
  sectionContainer: {
    marginBottom: tSpacing.lg,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: tSpacing.sm,
  },
  sectionHeading: {
    fontSize: typography.xs,
    fontFamily: typography.fontMono,
    fontWeight: typography.bold,
    color: tColors.textSecondary,
    letterSpacing: 1,
  },

  /* Horizontal Carousel for Events */
  eventsCarousel: {
    paddingRight: tSpacing.base,
    gap: 10,
  },
  eventProductCard: {
    width: 260,
    backgroundColor: tColors.card,
    borderWidth: 1,
    borderColor: tColors.border,
    borderRadius: tRadius.lg,
    padding: tSpacing.md,
    ...shadows.card,
  },
  eventTagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tRadius.full,
    marginBottom: 10,
  },
  eventTagText: {
    fontSize: 8,
    fontFamily: typography.fontMono,
    fontWeight: typography.bold,
  },
  eventProductTitle: {
    fontSize: typography.base,
    fontFamily: typography.fontHeading,
    color: tColors.textPrimary,
    fontWeight: typography.bold,
    marginBottom: 6,
    minHeight: 40,
  },
  eventProductClubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  eventProductClubDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eventProductClubName: {
    fontSize: 10,
    color: tColors.textSecondary,
    fontWeight: typography.semibold,
  },
  eventMineBadge: {
    backgroundColor: tColors.student.primaryDim,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: tRadius.full,
  },
  eventMineBadgeText: {
    fontSize: 8,
    color: tColors.student.primary,
    fontWeight: typography.bold,
  },
  eventProductSpecs: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: tColors.borderSubtle,
    paddingVertical: 8,
    marginBottom: 8,
  },
  eventProductSpecRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventProductSpecText: {
    fontSize: 10,
    color: tColors.textSecondary,
    flex: 1,
  },
  eventProductFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventProductCount: {
    fontSize: 9,
    color: tColors.textTertiary,
  },
  eventInterestBtn: {
    backgroundColor: tColors.accent,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: tRadius.md,
  },
  eventInterestBtnActive: {
    backgroundColor: tColors.successDim,
    borderWidth: 1,
    borderColor: tColors.success,
  },
  eventInterestBtnText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: typography.bold,
  },
  eventInterestBtnTextActive: {
    color: tColors.success,
  },

  /* Showroom Grid (VW-style) */
  showroomGrid: {
    gap: 10,
  },
  showroomClubCard: {
    backgroundColor: tColors.card,
    borderWidth: 1,
    borderColor: tColors.border,
    borderRadius: tRadius.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  showroomClubCardHighlight: {
    borderColor: tColors.accent,
  },
  showroomCardStripe: {
    height: 4,
  },
  showroomCardBody: {
    padding: tSpacing.md,
  },
  showroomCardTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: tSpacing.xs,
  },
  showroomCardLogo: {
    width: 42,
    height: 42,
    borderRadius: tRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  showroomCardLogoImg: {
    width: 42,
    height: 42,
    borderRadius: tRadius.md,
  },
  showroomCardEmojiText: {
    fontSize: 20,
  },
  showroomNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  showroomCardName: {
    fontSize: typography.md,
    fontFamily: typography.fontHeading,
    color: tColors.textPrimary,
    fontWeight: typography.bold,
  },
  showroomTypeTag: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: tRadius.full,
  },
  showroomTypeTagText: {
    fontSize: 8,
    fontFamily: typography.fontMono,
    fontWeight: typography.bold,
  },
  showroomCardFullName: {
    fontSize: typography.xs,
    color: tColors.textSecondary,
    marginTop: 1,
  },
  showroomCardDesc: {
    fontSize: typography.xs,
    color: tColors.textSecondary,
    lineHeight: 18,
    marginBottom: tSpacing.sm,
  },
  showroomCardSpecs: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: tColors.borderSubtle,
    paddingVertical: tSpacing.sm,
    marginBottom: tSpacing.sm,
  },
  showroomCardSpecItem: {
    flex: 1,
  },
  showroomCardSpecLabel: {
    fontSize: 8,
    fontFamily: typography.fontMono,
    color: tColors.textTertiary,
    marginBottom: 2,
  },
  showroomCardSpecValue: {
    fontSize: 11,
    color: tColors.textPrimary,
    fontWeight: typography.semibold,
  },
  showroomCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadgeAdmin: {
    backgroundColor: tColors.warningDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tRadius.full,
  },
  statusBadgeTextAdmin: {
    fontSize: 8,
    fontFamily: typography.fontMono,
    color: tColors.warning,
    fontWeight: typography.bold,
  },
  statusBadgeMember: {
    backgroundColor: tColors.student.primaryDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tRadius.full,
  },
  statusBadgeTextMember: {
    fontSize: 8,
    fontFamily: typography.fontMono,
    color: tColors.student.primary,
    fontWeight: typography.bold,
  },
  showroomCardBtn: {
    backgroundColor: tColors.cardAlt,
    borderWidth: 1,
    borderColor: tColors.border,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: tRadius.md,
  },
  showroomCardBtnFollowing: {
    backgroundColor: tColors.successDim,
    borderColor: tColors.success,
  },
  showroomCardBtnManage: {
    backgroundColor: tColors.student.primaryDim,
    borderColor: tColors.student.primary,
  },
  showroomCardBtnText: {
    fontSize: 10,
    color: tColors.textSecondary,
    fontWeight: typography.bold,
  },
  showroomCardBtnFollowingText: {
    color: tColors.success,
  },
  showroomCardBtnManageText: {
    color: tColors.student.primary,
  },
  allManagedText: {
    fontSize: typography.xs,
    color: tColors.textTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },

  /* Pending Configurations Card */
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tColors.card,
    borderWidth: 1,
    borderColor: tColors.warning,
    borderRadius: tRadius.lg,
    padding: tSpacing.md,
    marginBottom: tSpacing.sm,
    ...shadows.card,
  },
  pendingEmojiContainer: {
    width: 42,
    height: 42,
    borderRadius: tRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingEmoji: {
    fontSize: 24,
  },
  pendingName: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: tColors.textPrimary,
  },
  pendingStatusText: {
    fontSize: 10,
    color: tColors.warning,
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: tColors.warningDim,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tRadius.full,
  },
  pendingBadgeText: {
    fontSize: 8,
    fontFamily: typography.fontMono,
    color: tColors.warning,
    fontWeight: typography.bold,
  },

  /* Configurator Modal */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  modalSheet: {
    backgroundColor: tColors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: tColors.border,
    padding: tSpacing.base,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tSpacing.md,
  },
  modalTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: tColors.textPrimary,
  },
  modalLabel: {
    fontSize: 8,
    fontFamily: typography.fontMono,
    color: tColors.textTertiary,
    fontWeight: typography.bold,
    marginBottom: 6,
    marginTop: tSpacing.base,
    letterSpacing: 0.8,
  },
  modalInput: {
    backgroundColor: tColors.bg,
    borderWidth: 1,
    borderColor: tColors.border,
    borderRadius: tRadius.md,
    padding: tSpacing.sm,
    color: tColors.textPrimary,
    fontSize: 13,
    marginBottom: tSpacing.sm,
  },

  /* Step Indicator Progress Bar */
  stepIndicatorRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: tSpacing.base,
  },
  stepIndicatorLine: {
    flex: 1,
    height: 3,
    backgroundColor: tColors.border,
    borderRadius: 1.5,
  },
  stepIndicatorLineActive: {
    backgroundColor: tColors.textSecondary,
  },

  stepContent: {
    paddingVertical: tSpacing.xs,
  },
  stepTitle: {
    fontSize: typography.md,
    fontFamily: typography.fontHeading,
    color: tColors.textPrimary,
    fontWeight: typography.bold,
  },
  stepSub: {
    fontSize: typography.xs,
    color: tColors.textSecondary,
    marginBottom: tSpacing.base,
  },

  /* Configurator Step 1: Chassis Selection */
  chassisContainer: {
    gap: 12,
    marginBottom: tSpacing.sm,
  },
  chassisCard: {
    backgroundColor: tColors.cardAlt,
    borderWidth: 1,
    borderColor: tColors.border,
    borderRadius: tRadius.lg,
    padding: tSpacing.base,
    gap: 6,
  },
  chassisCardActive: {
    borderColor: tColors.accent,
    backgroundColor: tColors.accentDim,
  },
  chassisTitle: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    color: tColors.textSecondary,
  },
  chassisTitleActive: {
    color: tColors.textPrimary,
  },
  chassisDesc: {
    fontSize: typography.xs,
    color: tColors.textTertiary,
    lineHeight: 16,
  },

  /* Configurator Step 2: Emblem Icon */
  emblemPreview: {
    alignItems: 'center',
    marginVertical: tSpacing.base,
  },
  emblemBubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tColors.cardAlt,
    marginBottom: tSpacing.sm,
  },
  emblemBubbleText: {
    fontSize: 36,
  },
  emblemPreviewLabel: {
    fontSize: 8,
    fontFamily: typography.fontMono,
    color: tColors.textSecondary,
  },
  emojisScroll: {
    paddingVertical: 4,
  },
  emojisGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: 320,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: tRadius.md,
    backgroundColor: tColors.bg,
    borderWidth: 1,
    borderColor: tColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnActive: {
    borderColor: tColors.accent,
    backgroundColor: tColors.accentDim,
  },

  /* Configurator Step 3: Color system & Live preview card */
  liveCardPreviewContainer: {
    backgroundColor: tColors.cardAlt,
    borderWidth: 1,
    borderColor: tColors.borderSubtle,
    borderRadius: tRadius.lg,
    padding: tSpacing.md,
    marginBottom: tSpacing.sm,
  },
  previewLabel: {
    fontSize: 8,
    fontFamily: typography.fontMono,
    color: tColors.textTertiary,
    marginBottom: tSpacing.sm,
    letterSpacing: 0.5,
  },
  livePreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: tColors.card,
    borderWidth: 1,
    borderRadius: tRadius.md,
    padding: tSpacing.sm,
  },
  livePreviewEmoji: {
    width: 36,
    height: 36,
    borderRadius: tRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePreviewName: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  livePreviewType: {
    fontSize: 8,
    fontFamily: typography.fontMono,
    color: tColors.textTertiary,
    marginTop: 2,
  },
  colorSwatchRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: tSpacing.sm,
  },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  colorSwatchActive: {
    borderWidth: 3,
    borderColor: '#fff',
    transform: [{ scale: 1.15 }],
  },

  /* Configurator Navigation buttons */
  configuratorNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tSpacing.base,
    borderTopWidth: 1,
    borderTopColor: tColors.borderSubtle,
    paddingTop: tSpacing.base,
  },
  configBackBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: tRadius.md,
    borderWidth: 1,
    borderColor: tColors.border,
  },
  configBackText: {
    fontSize: typography.xs,
    color: tColors.textSecondary,
    fontWeight: typography.semibold,
  },
  configNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tColors.accent,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: tRadius.md,
  },
  configNextText: {
    fontSize: typography.xs,
    color: '#fff',
    fontWeight: typography.bold,
  },
  configSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: tRadius.md,
  },
  configSubmitText: {
    fontSize: typography.xs,
    color: '#fff',
    fontWeight: typography.bold,
  },
  createErrText: {
    fontSize: typography.xs,
    color: tColors.error,
    marginTop: tSpacing.sm,
  },

  /* Submitted Panel */
  submittedBox: {
    alignItems: 'center',
    paddingVertical: tSpacing.xl,
  },
  submittedBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: tColors.successDim,
    borderWidth: 1,
    borderColor: tColors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tSpacing.base,
  },
  submittedTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: tColors.textPrimary,
    marginBottom: 8,
  },
  submittedSub: {
    fontSize: typography.xs,
    color: tColors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: tSpacing.xl,
    paddingHorizontal: tSpacing.base,
  },
  submittedBtn: {
    backgroundColor: tColors.accent,
    borderRadius: tRadius.md,
    paddingHorizontal: 36,
    paddingVertical: 12,
  },
  submittedBtnText: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: '#fff',
  },
});