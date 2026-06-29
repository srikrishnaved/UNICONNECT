import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { myProfile, students, hubClubs } from '../data';
import { INTERESTS } from './OnboardingScreen';
import { useApp } from '../context/AppContext';
import { THEMES, activeThemeKey, setTheme } from '../theme';
import { supabase } from '../lib/supabase';
import { computeClass } from '../lib/classUtils';
import { courseColor, avatarColor, initials } from '../theme';
import {
  colors as tColors,
  typography,
  spacing as tSpacing,
  radius as tRadius,
  shadows,
  presets,
} from '../theme/tokens';
import CRDashboardScreen from './CRDashboardScreen';

const COURSES = ['BCom IAF', 'BCom IBA', 'BCom F&A'];
const YEARS   = ['1st Year', '2nd Year', '3rd Year'];

const PROVIDERS = [
  { name: 'Instagram', abbr: 'ig', color: '#E1306C', bg: 'rgba(225,48,108,0.18)' },
  { name: 'LinkedIn',  abbr: 'in', color: '#0A66C2', bg: 'rgba(10,102,194,0.18)'  },
  { name: 'Twitter',   abbr: '𝕏',  color: '#6B7280', bg: 'rgba(107,114,128,0.22)' },
  { name: 'GitHub',    abbr: 'gh', color: '#8B5CF6', bg: 'rgba(139,92,246,0.18)'  },
  { name: 'YouTube',   abbr: 'yt', color: '#EF4444', bg: 'rgba(239,68,68,0.18)'   },
];

function providerUrl(providerName, handle) {
  return {
    Instagram: `https://instagram.com/${handle}`,
    LinkedIn:  `https://linkedin.com/in/${handle}`,
    Twitter:   `https://x.com/${handle}`,
    GitHub:    `https://github.com/${handle}`,
    YouTube:   `https://youtube.com/@${handle}`,
  }[providerName] || handle;
}

export default function MyProfileScreen() {
  const navigation = useNavigation();
  const { userProfile, setUserProfile, updateProfile, signOut, deleteAccount, connections, joinedGroupIds, blockedIds, unblockUser, clubMemberships, crStatus, submitCrRequest } = useApp();

  const myClubs = hubClubs.filter(c => clubMemberships && clubMemberships.has(c.id));

  const name   = userProfile?.name   || myProfile.name;
  const course = userProfile?.course || myProfile.course;
  const year   = userProfile?.year   || myProfile.year;
  const bio    = userProfile?.bio    || '';

  const cc   = courseColor(course);
  const av   = avatarColor(name);
  const abbr = initials(name);


  // Edit profile modal
  const [showEdit, setShowEdit]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [draftName, setDraftName]       = useState('');
  const [draftCourse, setDraftCourse]   = useState('');
  const [draftYear, setDraftYear]       = useState('');
  const [draftSection, setDraftSection] = useState('');
  const [draftBio, setDraftBio]         = useState('');

  // Social links — initialised from the saved profile
  const [socialLinks, setSocialLinks]         = useState(userProfile?.social_links || []);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [draftLinks, setDraftLinks]           = useState([]);
  const [draftProvider, setDraftProvider]     = useState(null);
  const [draftHandle, setDraftHandle]         = useState('');
  const [showProviderPicker, setShowProviderPicker] = useState(false);

  // Interests edit modal
  const [showInterestsModal, setShowInterestsModal] = useState(false);
  const [draftInterests, setDraftInterests] = useState([]);

  const openInterestsEdit = () => {
    setDraftInterests(userProfile?.interests || []);
    setShowInterestsModal(true);
  };

  const saveInterests = async () => {
    await updateProfile({ interests: draftInterests });
    setShowInterestsModal(false);
  };

  const [showBlocked, setShowBlocked] = useState(false);

  // ── SAPS Core Team ──────────────────────────────────────────────────────────
  const SAPS_ROLES = ['President', 'Vice President', 'Member Secretary', 'Secretary', 'Vice Secretary'];
  const [sapsMyRole, setSapsMyRole] = useState(null);
  const [sapsAppStatus, setSapsAppStatus] = useState(null);
  const [sapsFilledRoles, setSapsFilledRoles] = useState([]);
  const [showSapsApply, setShowSapsApply] = useState(false);
  const [sapsSelectedRole, setSapsSelectedRole] = useState(null);
  const [sapsApplying, setSapsApplying] = useState(false);
  const [sapsApplyError, setSapsApplyError] = useState('');

  // Close Edit Profile modal on back press instead of navigating away.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!showEdit) return;
      e.preventDefault();
      setShowEdit(false);
    });
    return unsubscribe;
  }, [navigation, showEdit]);

  useEffect(() => {
    if (!userProfile?.id) return;
    Promise.all([
      supabase.from('saps_applications').select('status').eq('applicant_id', userProfile.id).order('created_at', { ascending: false }).limit(1),
      supabase.from('saps_members').select('role').eq('profile_id', userProfile.id).maybeSingle(),
      supabase.from('saps_members').select('role'),
    ]).then(([appRes, myRes, allRes]) => {
      if (appRes.data?.[0]) setSapsAppStatus(appRes.data[0].status);
      setSapsMyRole(myRes.data?.role || null);
      setSapsFilledRoles((allRes.data || []).map(r => r.role));
    });
  }, [userProfile?.id]);

  const availableSapsRoles = SAPS_ROLES.filter(r => !sapsFilledRoles.includes(r));

  const handleSapsApply = async () => {
    if (!sapsSelectedRole) { setSapsApplyError('Please select a role.'); return; }
    setSapsApplying(true);
    setSapsApplyError('');
    try {
      const { error } = await supabase.from('saps_applications').insert({
        applicant_id: userProfile.id,
        applicant_name: name,
        role: sapsSelectedRole,
        status: 'pending',
      });
      if (error) throw error;
      const { data: admins } = await supabase.from('profiles').select('id').eq('is_super_admin', true);
      for (const admin of (admins || [])) {
        await supabase.from('notifications').insert({
          user_id: admin.id, type: 'info',
          title: 'New SAPS Application',
          body: `${name} applied for ${sapsSelectedRole} in SAPS Core Team.`,
          read: false,
        });
      }
      setSapsAppStatus('pending');
      setShowSapsApply(false);
    } catch (e) {
      setSapsApplyError(e.message || 'Failed to submit. Please try again.');
    } finally {
      setSapsApplying(false);
    }
  };

  // ── CR application ──────────────────────────────────────────────────────────
  const [showCRApply, setShowCRApply] = useState(false);
  const [showCRDashboard, setShowCRDashboard] = useState(false);
  const [crReason, setCrReason] = useState('');
  const [crApplying, setCrApplying] = useState(false);
  const [crApplyError, setCrApplyError] = useState('');

  const handleCRApply = async () => {
    if (!crReason.trim()) { setCrApplyError('Please explain why you want to be CR.'); return; }
    setCrApplying(true);
    setCrApplyError('');
    try {
      await submitCrRequest({
        userId: userProfile.id,
        userName: name,
        course,
        year,
        campus: userProfile?.campus || '',
        reason: crReason.trim(),
      });
      setShowCRApply(false);
      setCrReason('');
    } catch (e) {
      setCrApplyError(e.message || 'Failed to submit. Please try again.');
    } finally {
      setCrApplying(false);
    }
  };
  const [blockedProfiles, setBlockedProfiles] = useState([]);

  const openBlocked = async () => {
    const ids = [...blockedIds];
    if (ids.length === 0) { setBlockedProfiles([]); setShowBlocked(true); return; }

    // Separate seed IDs (numeric) from real UUIDs
    const seedEntries = ids
      .filter(id => /^\d+$/.test(id))
      .map(id => {
        const s = students.find(st => String(st.id) === id);
        return s ? { id, name: s.name, course: s.course } : { id, name: 'Unknown user', course: '' };
      });

    const realIds = ids.filter(id => !/^\d+$/.test(id));
    let realEntries = [];
    if (realIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id, name, course').in('id', realIds);
      realEntries = (data || []).map(p => ({ id: p.id, name: p.name, course: p.course }));
      // Include any IDs that weren't found in DB
      realIds.forEach(rid => {
        if (!realEntries.find(e => e.id === rid)) {
          realEntries.push({ id: rid, name: 'Deleted account', course: '' });
        }
      });
    }

    setBlockedProfiles([...seedEntries, ...realEntries]);
    setShowBlocked(true);
  };

  const openEdit = () => {
    setDraftName(name);
    setDraftCourse(course);
    setDraftYear(year);
    setDraftSection(userProfile?.section || '');
    setDraftBio(bio);
    setShowEdit(true);
  };

  const handleSave = () => {
    if (!draftName.trim()) return;
    const needsSection = draftCourse === 'BCom F&A' && (draftYear === '2nd Year' || draftYear === '3rd Year');
    const updates = {
      name: draftName.trim(),
      course: draftCourse,
      year: draftYear,
      class: computeClass(draftCourse, draftYear),
      bio: draftBio.trim(),
      section: needsSection ? (draftSection || null) : null,
    };
    setUserProfile({ ...(userProfile || {}), ...updates });
    updateProfile(updates);
    setShowEdit(false);
  };

  const openSocialModal = () => {
    setDraftLinks(socialLinks.map(l => ({ ...l })));
    setDraftProvider(null);
    setDraftHandle('');
    setShowSocialModal(true);
  };

  const addSocialLink = () => {
    if (!draftProvider || !draftHandle.trim()) return;
    const handle = draftHandle.trim();
    setDraftLinks(prev => [...prev, {
      id: Date.now(),
      provider: draftProvider,
      url: providerUrl(draftProvider.name, handle),
    }]);
    setDraftProvider(null);
    setDraftHandle('');
  };

  const removeSocialLink = (id) => {
    setDraftLinks(prev => prev.filter(l => l.id !== id));
  };

  const saveSocialLinks = () => {
    setSocialLinks(draftLinks);
    updateProfile({ social_links: draftLinks });
    setShowSocialModal(false);
  };

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Cover + avatar */}
        <View style={[styles.cover, { backgroundColor: cc.bg }]}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: av.bg }]}>
              <Text style={styles.avatarText}>{abbr}</Text>
            </View>
          </View>
        </View>

        {/* Name + meta */}
        <View style={styles.nameBlock}>
          <Text style={styles.name}>{name}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.courseBadge, { backgroundColor: cc.bg }]}>
              <Text style={[styles.courseText, { color: cc.text }]}>{userProfile?.class || computeClass(course, year) || course}</Text>
            </View>
            <Text style={styles.meta}> · {userProfile?.campus}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { val: connections.size,    label: 'Connections' },
            { val: joinedGroupIds.size, label: 'Groups' },
          ].map(s => (
            <View key={s.label} style={styles.stat}>
              <Text style={styles.statVal}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>


        {/* Edit profile button */}
        <TouchableOpacity style={styles.editBtn} onPress={openEdit} activeOpacity={0.8}>
          <Text style={styles.editBtnText}>✎ Edit profile</Text>
        </TouchableOpacity>

        {/* About */}
        <Section label="ABOUT">
          <Text style={[styles.bodyText, !bio && { color: tColors.textTertiary, fontStyle: 'italic' }]}>
            {bio || 'No bio yet — tap Edit Profile to add one'}
          </Text>
        </Section>

        {/* Social Links */}
        <Section label="SOCIAL LINKS">
          {socialLinks.map(link => (
            <View key={link.id} style={styles.socialRow}>
              <View style={[styles.providerBadge, { backgroundColor: link.provider.bg }]}>
                <Text style={[styles.providerAbbr, { color: link.provider.color }]}>{link.provider.abbr}</Text>
              </View>
              <Text style={styles.socialUrl} numberOfLines={1}>{link.url}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.editSocialBtn} onPress={openSocialModal} activeOpacity={0.8}>
            <Text style={styles.editSocialBtnText}>
              {socialLinks.length > 0 ? '✎ Edit Social Links' : '+ Add Social Links'}
            </Text>
          </TouchableOpacity>
        </Section>


        {/* Clubs */}
        {myClubs.length > 0 && (
          <Section label="🏛 CLUBS">
            <View style={styles.clubsRow}>
              {myClubs.map(club => (
                <View key={club.id} style={[styles.clubChip, { borderColor: club.color, backgroundColor: `${club.color}18` }]}>
                  <Text style={styles.clubChipEmoji}>{club.emoji}</Text>
                  <Text style={[styles.clubChipName, { color: club.color }]}>{club.name}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* Interests */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>INTERESTS</Text>
            <TouchableOpacity onPress={openInterestsEdit} activeOpacity={0.7}>
              <Text style={styles.sectionEditLink}>Edit</Text>
            </TouchableOpacity>
          </View>
          {(userProfile?.interests || []).length > 0 ? (
            <View style={styles.pillsRow}>
              {(userProfile?.interests || []).map(i => (
                <View key={i} style={styles.interestPill}>
                  <Text style={styles.interestText}>{i}</Text>
                </View>
              ))}
            </View>
          ) : (
            <TouchableOpacity onPress={openInterestsEdit} activeOpacity={0.8} style={styles.emptyInterestsTap}>
              <Text style={styles.emptyInterestsText}>Tap Edit to add your interests</Text>
            </TouchableOpacity>
          )}
        </View>


        {/* Blocked profiles */}
        <TouchableOpacity style={styles.blockedBtn} onPress={openBlocked} activeOpacity={0.8}>
          <Text style={styles.blockedBtnText}>🚫 Blocked Profiles</Text>
          {blockedIds.size > 0 && (
            <View style={styles.blockedCount}>
              <Text style={styles.blockedCountText}>{blockedIds.size}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>APPEARANCE</Text>
          <View style={styles.themeGrid}>
            {THEMES.map(t => {
              const active = activeThemeKey === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.themeCard, active && styles.themeCardActive, !t.ready && styles.themeCardDimmed]}
                  onPress={() => t.ready && !active && setTheme(t.key)}
                  activeOpacity={t.ready && !active ? 0.75 : 1}
                >
                  {/* Swatch strip */}
                  <View style={styles.swatchRow}>
                    {t.swatch.map((c, i) => (
                      <View key={i} style={[styles.swatchDot, { backgroundColor: c }]} />
                    ))}
                  </View>
                  <Text style={[styles.themeLabel, active && styles.themeLabelActive]}>{t.label}</Text>
                  <Text style={styles.themeDesc}>{active ? '✓ Active' : t.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Legal links */}
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => navigation.navigate('Legal', { type: 'privacy' })} activeOpacity={0.7}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Legal', { type: 'terms' })} activeOpacity={0.7}>
            <Text style={styles.legalLink}>Terms of Service</Text>
          </TouchableOpacity>
        </View>

        {/* ── Class Representative ─────────────────────────────────────── */}
        {crStatus === 'approved' ? (
          <TouchableOpacity
            style={styles.crDashBtn}
            onPress={() => setShowCRDashboard(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.crDashBtnEmoji}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.crDashBtnTitle}>CR Dashboard</Text>
              <Text style={styles.crDashBtnSub}>Open your Class Representative tools</Text>
            </View>
            <Text style={{ fontSize: 18, color: tColors.textTertiary }}>›</Text>
          </TouchableOpacity>
        ) : crStatus === 'pending' ? (
          <View style={styles.crPendingCard}>
            <Text style={styles.crPendingEmoji}>⏳</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.crPendingTitle}>CR Application Pending</Text>
              <Text style={styles.crPendingSub}>Awaiting admin approval</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.crApplyBtn}
            onPress={() => { setShowCRApply(true); setCrApplyError(''); setCrReason(''); }}
            activeOpacity={0.85}
          >
            <Text style={styles.crApplyBtnEmoji}>🏅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.crApplyBtnTitle}>Apply as Class Representative</Text>
              <Text style={styles.crApplyBtnSub}>Submit an application for admin approval</Text>
            </View>
            <Text style={{ fontSize: 18, color: tColors.textTertiary }}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── SAPS Core Team ──────────────────────────────────────────── */}
        {sapsMyRole !== null ? (
          <View style={styles.crDashBtn}>
            <Text style={styles.crDashBtnEmoji}>⭐</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.crDashBtnTitle}>SAPS Core Team</Text>
              <Text style={styles.crDashBtnSub}>{sapsMyRole}</Text>
            </View>
          </View>
        ) : availableSapsRoles.length === 0 ? (
          <View style={styles.crPendingCard}>
            <Text style={styles.crPendingEmoji}>✓</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.crPendingTitle}>SAPS Core Team is complete</Text>
              <Text style={styles.crPendingSub}>All 5 positions have been filled</Text>
            </View>
          </View>
        ) : sapsAppStatus === 'pending' ? (
          <View style={styles.crPendingCard}>
            <Text style={styles.crPendingEmoji}>⏳</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.crPendingTitle}>SAPS Application Pending</Text>
              <Text style={styles.crPendingSub}>Awaiting admin approval</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.crApplyBtn}
            onPress={() => { setSapsApplyError(''); setSapsSelectedRole(null); setShowSapsApply(true); }}
            activeOpacity={0.85}
          >
            <Text style={styles.crApplyBtnEmoji}>⭐</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.crApplyBtnTitle}>Apply for SAPS Core Team</Text>
              <Text style={styles.crApplyBtnSub}>Choose a role and submit for admin approval</Text>
            </View>
            <Text style={{ fontSize: 18, color: tColors.textTertiary }}>›</Text>
          </TouchableOpacity>
        )}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut()} activeOpacity={0.8}>
          <Text style={styles.signOutBtnText}>Sign out</Text>
        </TouchableOpacity>

        {/* Delete account */}
        {!confirmDelete ? (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => setConfirmDelete(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteBtnText}>Delete account</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.deleteConfirmBox}>
            <Text style={styles.deleteConfirmText}>
              This permanently deletes your account and all your data. This cannot be undone.
            </Text>
            <View style={styles.deleteConfirmRow}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => setConfirmDelete(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, deleteLoading && { opacity: 0.6 }]}
                onPress={async () => {
                  setDeleteLoading(true);
                  try { await deleteAccount(); } finally { setDeleteLoading(false); }
                }}
                disabled={deleteLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteConfirmBtnText}>
                  {deleteLoading ? 'Deleting…' : 'Yes, delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: tSpacing.xxxl }} />
      </ScrollView>

      {/* ── Edit Profile modal ── */}
      <Modal visible={showEdit} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✎ Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEdit(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>NAME</Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Your name"
              placeholderTextColor={tColors.textTertiary}
              style={styles.modalInput}
              autoCapitalize="words"
            />

            <Text style={styles.modalLabel}>COURSE</Text>
            <View style={styles.pillGroupRow}>
              {COURSES.map(c => {
                const active = draftCourse === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.optionPill, active && styles.optionPillActive]}
                    onPress={() => { setDraftCourse(c); setDraftSection(''); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionPillText, active && styles.optionPillTextActive]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.modalLabel}>YEAR</Text>
            <View style={styles.pillGroupRow}>
              {YEARS.map(y => {
                const active = draftYear === y;
                return (
                  <TouchableOpacity
                    key={y}
                    style={[styles.optionPill, active && styles.optionPillActive]}
                    onPress={() => { setDraftYear(y); setDraftSection(''); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionPillText, active && styles.optionPillTextActive]}>{y}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Section picker — BCom F&A 2nd/3rd year only */}
            {draftCourse === 'BCom F&A' && (draftYear === '2nd Year' || draftYear === '3rd Year') && (
              <>
                <Text style={styles.modalLabel}>SECTION</Text>
                <View style={styles.pillGroupRow}>
                  {[
                    { key: 'A', label: 'Section A' },
                    { key: 'B', label: draftYear === '3rd Year' ? 'Section B · CPA Course' : 'Section B' },
                  ].map(s => {
                    const active = draftSection === s.key;
                    return (
                      <TouchableOpacity
                        key={s.key}
                        style={[styles.optionPill, active && styles.optionPillActive]}
                        onPress={() => setDraftSection(s.key)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.optionPillText, active && styles.optionPillTextActive]}>{s.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={styles.modalLabel}>BIO</Text>
            <TextInput
              value={draftBio}
              onChangeText={setDraftBio}
              placeholder="Tell people a bit about yourself..."
              placeholderTextColor={tColors.textTertiary}
              style={[styles.modalInput, { height: 90, textAlignVertical: 'top' }]}
              multiline
            />

            <TouchableOpacity
              style={[styles.saveBtn, !draftName.trim() && { opacity: 0.45 }]}
              onPress={handleSave}
              disabled={!draftName.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Social Links modal ── */}
      <Modal visible={showSocialModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.socialModal}>
            {/* Header */}
            <View style={styles.socialModalHeader}>
              <Text style={styles.socialModalTitle}>Social Links</Text>
              <TouchableOpacity onPress={() => setShowSocialModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <View style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Existing links (scrollable) */}
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
              {draftLinks.map(link => (
                <View key={link.id} style={styles.socialEditRow}>
                  <View style={[styles.providerBadgeLg, { backgroundColor: link.provider.bg }]}>
                    <Text style={[styles.providerAbbrLg, { color: link.provider.color }]}>{link.provider.abbr}</Text>
                  </View>
                  <View style={styles.socialUrlBox}>
                    <Text style={styles.socialEditUrl} numberOfLines={1}>{link.url}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeSocialLink(link.id)}
                    style={styles.trashBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.trashIcon}>🗑</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add new link row */}
              <View style={styles.addLinkRow}>
                <TouchableOpacity
                  style={styles.providerDropdown}
                  onPress={() => setShowProviderPicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={draftProvider ? styles.providerSelected : styles.providerPlaceholder} numberOfLines={1}>
                    {draftProvider ? draftProvider.name : 'Provider'}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.handleInput}
                  value={draftHandle}
                  onChangeText={setDraftHandle}
                  placeholder="Handle"
                  placeholderTextColor={tColors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.addLinkBtn, (!draftProvider || !draftHandle.trim()) && { opacity: 0.35 }]}
                  onPress={addSocialLink}
                  disabled={!draftProvider || !draftHandle.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addLinkBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Privacy note */}
              <Text style={styles.privacyNote}>
                Note: Sharing certain social handles may result in you receiving unwanted DMs from strangers.
              </Text>
            </ScrollView>

            {/* Footer */}
            <View style={styles.socialModalDivider} />
            <View style={styles.socialModalFooter}>
              <TouchableOpacity onPress={() => setShowSocialModal(false)} activeOpacity={0.7}>
                <Text style={styles.discardText}>Discard Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialSaveBtn} onPress={saveSocialLinks} activeOpacity={0.85}>
                <Text style={styles.socialSaveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Blocked Profiles modal ── */}
      <Modal visible={showBlocked} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: 40 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🚫 Blocked Profiles</Text>
              <TouchableOpacity onPress={() => setShowBlocked(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {blockedProfiles.length === 0 ? (
              <View style={styles.blockedEmpty}>
                <Text style={styles.blockedEmptyIcon}>✅</Text>
                <Text style={styles.blockedEmptyText}>You haven't blocked anyone.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {blockedProfiles.map(p => (
                  <View key={p.id} style={styles.blockedRow}>
                    <View style={styles.blockedAvatar}>
                      <Text style={styles.blockedAvatarText}>
                        {p.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.blockedName}>{p.name}</Text>
                      {p.course ? <Text style={styles.blockedCourse}>{p.course}</Text> : null}
                    </View>
                    <TouchableOpacity
                      style={styles.unblockBtn}
                      onPress={() => {
                        unblockUser(p.id);
                        setBlockedProfiles(prev => prev.filter(x => x.id !== p.id));
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.unblockBtnText}>Unblock</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Provider picker ── */}
      <Modal visible={showProviderPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowProviderPicker(false)}
        >
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Choose Provider</Text>
            {PROVIDERS.map(p => (
              <TouchableOpacity
                key={p.name}
                style={styles.pickerRow}
                onPress={() => { setDraftProvider(p); setShowProviderPicker(false); }}
                activeOpacity={0.7}
              >
                <View style={[styles.providerBadgeLg, { backgroundColor: p.bg }]}>
                  <Text style={[styles.providerAbbrLg, { color: p.color }]}>{p.abbr}</Text>
                </View>
                <Text style={styles.pickerProviderName}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Interests edit modal ── */}
      <Modal visible={showInterestsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Interests</Text>
              <TouchableOpacity onPress={() => setShowInterestsModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: typography.xs, color: tColors.textTertiary, marginBottom: tSpacing.md }}>
              {draftInterests.length} selected
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.interestEditGrid}>
                {INTERESTS.map(interest => {
                  const sel = draftInterests.includes(interest);
                  return (
                    <TouchableOpacity
                      key={interest}
                      style={[styles.interestEditChip, sel && styles.interestEditChipActive]}
                      onPress={() => setDraftInterests(prev =>
                        prev.includes(interest) ? prev.filter(x => x !== interest) : [...prev, interest]
                      )}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.interestEditChipText, sel && styles.interestEditChipTextActive]}>
                        {interest}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.saveInterestsBtn} onPress={saveInterests} activeOpacity={0.85}>
              <Text style={styles.saveInterestsBtnText}>Save Interests</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── CR Apply Modal ─────────────────────────────────────────────── */}
      <Modal visible={showCRApply} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{ backgroundColor: tColors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: tSpacing.lg, borderWidth: 1, borderColor: tColors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tSpacing.lg }}>
                <Text style={{ fontSize: typography.md, fontWeight: typography.bold, color: tColors.textPrimary }}>🏅 Apply as CR</Text>
                <TouchableOpacity onPress={() => setShowCRApply(false)}>
                  <Text style={{ fontSize: 22, color: tColors.textSecondary }}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: typography.xs, color: tColors.textSecondary, letterSpacing: 0.8, fontWeight: typography.bold, marginBottom: 6 }}>YOUR DETAILS</Text>
              <View style={{ backgroundColor: tColors.bg, borderRadius: tRadius.md, padding: tSpacing.md, marginBottom: tSpacing.md, borderWidth: 1, borderColor: tColors.border }}>
                <Text style={{ fontSize: typography.sm, color: tColors.textPrimary, fontWeight: typography.semibold }}>{name}</Text>
                <Text style={{ fontSize: typography.xs, color: tColors.textSecondary, marginTop: 3 }}>{userProfile?.class || computeClass(course, year) || course}</Text>
              </View>
              <Text style={{ fontSize: typography.xs, color: tColors.textSecondary, letterSpacing: 0.8, fontWeight: typography.bold, marginBottom: 6 }}>WHY DO YOU WANT TO BE CR?</Text>
              <TextInput
                value={crReason}
                onChangeText={t => { setCrReason(t); setCrApplyError(''); }}
                placeholder="Tell the admin why you'd make a good Class Representative…"
                placeholderTextColor={tColors.textTertiary}
                multiline
                style={{ backgroundColor: tColors.bg, borderWidth: 1, borderColor: tColors.border, borderRadius: tRadius.md, padding: tSpacing.md, fontSize: typography.sm, color: tColors.textPrimary, minHeight: 90, textAlignVertical: 'top', marginBottom: tSpacing.sm }}
              />
              {crApplyError ? <Text style={{ fontSize: typography.xs, color: tColors.error, marginBottom: tSpacing.sm }}>{crApplyError}</Text> : null}
              <TouchableOpacity
                style={[{ backgroundColor: tColors.student.primary, borderRadius: tRadius.md, paddingVertical: 14, alignItems: 'center', marginTop: tSpacing.sm }, (crApplying || !crReason.trim()) && { opacity: 0.45 }]}
                onPress={handleCRApply}
                disabled={crApplying || !crReason.trim()}
                activeOpacity={0.85}
              >
                {crApplying
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ fontSize: typography.base, fontWeight: typography.bold, color: '#fff' }}>Submit Application</Text>}
              </TouchableOpacity>
              <Text style={{ fontSize: typography.xs, color: tColors.textTertiary, textAlign: 'center', marginTop: tSpacing.sm }}>
                Your application will be reviewed by the app admin.
              </Text>
              <View style={{ height: 8 }} />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── SAPS Apply Modal ───────────────────────────────────────────── */}
      <Modal visible={showSapsApply} animationType="slide" transparent onRequestClose={() => setShowSapsApply(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tColors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: tSpacing.lg, borderWidth: 1, borderColor: tColors.border, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tSpacing.lg }}>
              <Text style={{ fontSize: typography.md, fontWeight: typography.bold, color: tColors.textPrimary }}>⭐ Apply for SAPS Core Team</Text>
              <TouchableOpacity onPress={() => setShowSapsApply(false)}>
                <Text style={{ fontSize: 22, color: tColors.textSecondary }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: typography.xs, color: tColors.textSecondary, letterSpacing: 0.8, fontWeight: typography.bold, marginBottom: tSpacing.sm }}>SELECT A ROLE</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: tSpacing.md }}>
              {availableSapsRoles.map(role => {
                const sel = sapsSelectedRole === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      backgroundColor: sel ? tColors.student.primaryDim : tColors.bg,
                      borderWidth: 1, borderColor: sel ? tColors.student.primary : tColors.border,
                      borderRadius: tRadius.md, padding: tSpacing.md, marginBottom: tSpacing.sm,
                    }}
                    onPress={() => { setSapsSelectedRole(role); setSapsApplyError(''); }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: typography.base, color: sel ? tColors.student.primary : tColors.textPrimary, fontWeight: typography.semibold }}>{role}</Text>
                    {sel && <Text style={{ color: tColors.student.primary, fontSize: 16 }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {sapsApplyError ? <Text style={{ fontSize: typography.xs, color: tColors.error, marginBottom: tSpacing.sm }}>{sapsApplyError}</Text> : null}
            <TouchableOpacity
              style={[{ backgroundColor: tColors.student.primary, borderRadius: tRadius.md, paddingVertical: 14, alignItems: 'center' }, (sapsApplying || !sapsSelectedRole) && { opacity: 0.45 }]}
              onPress={handleSapsApply}
              disabled={sapsApplying || !sapsSelectedRole}
              activeOpacity={0.85}
            >
              {sapsApplying
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ fontSize: typography.base, fontWeight: typography.bold, color: '#fff' }}>Submit Application</Text>}
            </TouchableOpacity>
            <Text style={{ fontSize: typography.xs, color: tColors.textTertiary, textAlign: 'center', marginTop: tSpacing.sm }}>
              Your application will be reviewed by the app admin.
            </Text>
            <View style={{ height: 8 }} />
          </View>
        </View>
      </Modal>

      {/* ── CR Dashboard Modal ─────────────────────────────────────────── */}
      <Modal visible={showCRDashboard} animationType="slide" onRequestClose={() => setShowCRDashboard(false)}>
        <CRDashboardScreen onClose={() => setShowCRDashboard(false)} />
      </Modal>
    </>
  );
}

function Section({ label, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tColors.bg },
  cover: { height: 110, position: 'relative' },
  avatarWrap: { position: 'absolute', bottom: -46, left: 0, right: 0, alignItems: 'center' },
  avatar: {
    width: 92, height: 92, borderRadius: 46,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: tColors.student.primary,
  },
  avatarText: { fontSize: 28, color: '#fff', fontWeight: typography.bold },
  nameBlock: { alignItems: 'center', marginTop: 56, paddingHorizontal: tSpacing.base },
  name: { fontSize: typography.xxl, fontWeight: typography.bold, color: '#fff', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  courseBadge: { borderRadius: tRadius.full, paddingHorizontal: 10, paddingVertical: 3 },
  courseText: { fontSize: typography.sm, fontWeight: typography.semibold },
  meta: { fontSize: typography.sm, color: tColors.textSecondary },

  statsRow: { flexDirection: 'row', gap: tSpacing.sm, paddingHorizontal: tSpacing.base, marginTop: tSpacing.base },
  stat: {
    flex: 1, alignItems: 'center',
    ...presets.card,
    ...shadows.card,
  },
  statVal: { fontSize: typography.xl, fontWeight: typography.bold, color: '#fff' },
  statLabel: { fontSize: typography.xs, color: tColors.textSecondary, marginTop: 2 },

  editBtn: {
    marginHorizontal: tSpacing.base, marginTop: tSpacing.md,
    backgroundColor: tColors.student.primary,
    borderRadius: tRadius.md, paddingVertical: 14, alignItems: 'center',
  },
  editBtnText: { fontSize: typography.sm, fontWeight: typography.bold, color: '#fff' },

  section: { paddingHorizontal: tSpacing.base, marginTop: tSpacing.base },
  sectionLabel: {
    fontSize: typography.lg, color: tColors.textPrimary, letterSpacing: 0.8,
    fontWeight: typography.bold, marginBottom: tSpacing.sm,
  },
  bodyText: { fontSize: typography.sm, color: tColors.textSecondary, lineHeight: 20 },

  socialRow: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    marginBottom: tSpacing.sm,
  },
  providerBadge: {
    width: 32, height: 32, borderRadius: tRadius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  providerAbbr: { fontSize: typography.xs, fontWeight: typography.bold },
  socialUrl: { fontSize: typography.sm, color: tColors.textSecondary, flex: 1 },

  editSocialBtn: {
    marginTop: tSpacing.xs,
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, paddingVertical: 12, alignItems: 'center',
  },
  editSocialBtnText: { fontSize: typography.sm, fontWeight: typography.semibold, color: tColors.student.primary },

  leadershipCard: {
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md,
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
  },
  leadIcon: {
    width: 44, height: 44, borderRadius: tRadius.sm,
    backgroundColor: tColors.student.primaryDim,
    alignItems: 'center', justifyContent: 'center',
  },
  leadRole: { fontSize: typography.sm, fontWeight: typography.bold, color: tColors.textPrimary },
  leadDetail: { fontSize: typography.xs, color: tColors.textSecondary, marginTop: 2 },

  clubsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clubChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: tRadius.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  clubChipEmoji: { fontSize: typography.sm },
  clubChipName: { fontSize: typography.xs, fontWeight: typography.semibold },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tSpacing.sm },
  sectionEditLink: { fontSize: typography.xs, color: tColors.student.primary, fontWeight: typography.semibold },
  emptyInterestsTap: { paddingVertical: tSpacing.sm },
  emptyInterestsText: { fontSize: typography.sm, color: tColors.textTertiary, fontStyle: 'italic' },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  interestPill: {
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.full, paddingHorizontal: 12, paddingVertical: 5,
  },
  interestText: { fontSize: typography.xs, color: tColors.textSecondary },

  interestEditGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: tSpacing.md },
  interestEditChip: {
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.full, paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: tColors.bg,
  },
  interestEditChipActive: { backgroundColor: tColors.student.primaryDim, borderColor: tColors.student.primary },
  interestEditChipText: { fontSize: typography.sm, color: tColors.textSecondary, fontWeight: typography.medium },
  interestEditChipTextActive: { color: tColors.student.primary, fontWeight: typography.semibold },
  saveInterestsBtn: {
    backgroundColor: tColors.student.primary, borderRadius: tRadius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: tSpacing.md,
  },
  saveInterestsBtnText: { color: '#fff', fontSize: typography.base, fontWeight: typography.bold },

  blockedBtn: {
    marginHorizontal: tSpacing.base, marginTop: tSpacing.base,
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, paddingVertical: 14, paddingHorizontal: tSpacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  blockedBtnText: { fontSize: typography.sm, fontWeight: typography.semibold, color: tColors.textSecondary },
  blockedCount: {
    backgroundColor: tColors.errorDim, borderWidth: 1, borderColor: tColors.error,
    borderRadius: tRadius.full, paddingHorizontal: 8, paddingVertical: 2,
  },
  blockedCountText: { fontSize: typography.xs, color: tColors.error, fontWeight: typography.bold },

  blockedEmpty: { alignItems: 'center', paddingVertical: tSpacing.lg, gap: tSpacing.sm },
  blockedEmptyIcon: { fontSize: 36 },
  blockedEmptyText: { fontSize: typography.sm, color: tColors.textSecondary },

  blockedRow: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm,
    paddingVertical: tSpacing.sm,
    borderBottomWidth: 1, borderBottomColor: tColors.border,
  },
  blockedAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: tColors.cardAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  blockedAvatarText: { fontSize: typography.sm, fontWeight: typography.bold, color: tColors.textSecondary },
  blockedName: { fontSize: typography.sm, fontWeight: typography.semibold, color: tColors.textPrimary },
  blockedCourse: { fontSize: typography.xs, color: tColors.textTertiary, marginTop: 1 },
  unblockBtn: {
    borderWidth: 1, borderColor: tColors.student.primary,
    borderRadius: tRadius.sm, paddingHorizontal: 12, paddingVertical: 5,
  },
  unblockBtnText: { fontSize: typography.xs, color: tColors.student.primary, fontWeight: typography.semibold },

  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tSpacing.sm },
  themeCard: {
    width: '30%', flexGrow: 1,
    backgroundColor: tColors.card,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.lg, padding: tSpacing.sm, gap: 5,
  },
  themeCardActive: { borderColor: tColors.student.primary, borderWidth: 2 },
  themeCardDimmed: { opacity: 0.45 },
  swatchRow: { flexDirection: 'row', gap: 3, marginBottom: 2 },
  swatchDot: { width: 14, height: 14, borderRadius: 7 },
  themeLabel: { fontSize: typography.xs, fontWeight: typography.semibold, color: tColors.textPrimary },
  themeLabelActive: { color: tColors.student.primary },
  themeDesc: { fontSize: typography.xs, color: tColors.textTertiary },

  legalRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: tSpacing.sm, marginTop: tSpacing.base,
  },
  legalLink: { fontSize: typography.xs, color: tColors.textTertiary, fontWeight: typography.medium },
  legalDot: { fontSize: typography.xs, color: tColors.textTertiary },

  signOutBtn: {
    marginHorizontal: tSpacing.base, marginTop: tSpacing.base,
    backgroundColor: tColors.errorDim,
    borderWidth: 1, borderColor: tColors.error,
    borderRadius: tRadius.md, paddingVertical: 14, alignItems: 'center',
  },
  signOutBtnText: { fontSize: typography.sm, fontWeight: typography.semibold, color: tColors.error },

  crDashBtn: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.md,
    backgroundColor: tColors.student.primaryDim, borderWidth: 1, borderColor: tColors.student.primary,
    borderRadius: tRadius.lg, padding: tSpacing.md, marginBottom: tSpacing.sm,
  },
  crDashBtnEmoji: { fontSize: 22 },
  crDashBtnTitle: { fontSize: typography.sm, fontWeight: typography.bold, color: tColors.student.primary },
  crDashBtnSub: { fontSize: typography.xs, color: tColors.student.primary, opacity: 0.8, marginTop: 2 },

  crPendingCard: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.md,
    backgroundColor: tColors.warningDim, borderWidth: 1, borderColor: tColors.warning,
    borderRadius: tRadius.lg, padding: tSpacing.md, marginBottom: tSpacing.sm,
  },
  crPendingEmoji: { fontSize: 22 },
  crPendingTitle: { fontSize: typography.sm, fontWeight: typography.semibold, color: tColors.warning },
  crPendingSub: { fontSize: typography.xs, color: tColors.warning, opacity: 0.8, marginTop: 2 },

  crApplyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: tSpacing.md,
    backgroundColor: tColors.card, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.lg, padding: tSpacing.md, marginBottom: tSpacing.sm,
  },
  crApplyBtnEmoji: { fontSize: 22 },
  crApplyBtnTitle: { fontSize: typography.sm, fontWeight: typography.semibold, color: tColors.textPrimary },
  crApplyBtnSub: { fontSize: typography.xs, color: tColors.textSecondary, marginTop: 2 },

  deleteBtn: {
    marginHorizontal: tSpacing.base, marginTop: tSpacing.sm,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, paddingVertical: 14, alignItems: 'center',
  },
  deleteBtnText: { fontSize: typography.sm, fontWeight: typography.medium, color: tColors.textTertiary },
  deleteConfirmBox: {
    marginHorizontal: tSpacing.base, marginTop: tSpacing.sm,
    backgroundColor: tColors.errorDim,
    borderWidth: 1, borderColor: tColors.error,
    borderRadius: tRadius.md, padding: tSpacing.md,
  },
  deleteConfirmText: { fontSize: typography.sm, color: tColors.textSecondary, lineHeight: 18, marginBottom: tSpacing.md },
  deleteConfirmRow: { flexDirection: 'row', gap: tSpacing.sm },
  deleteCancelBtn: {
    flex: 1, borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, paddingVertical: 10, alignItems: 'center',
    backgroundColor: tColors.card,
  },
  deleteCancelText: { fontSize: typography.sm, color: tColors.textSecondary, fontWeight: typography.semibold },
  deleteConfirmBtn: {
    flex: 1, backgroundColor: tColors.error,
    borderRadius: tRadius.md, paddingVertical: 10, alignItems: 'center',
  },
  deleteConfirmBtnText: { fontSize: typography.sm, color: '#fff', fontWeight: typography.bold },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: tColors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: tSpacing.base,
    maxHeight: '92%',
    borderWidth: 1, borderColor: tColors.border,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: tSpacing.base,
  },
  modalTitle: { fontSize: typography.md, fontWeight: typography.bold, color: tColors.textPrimary },
  modalClose: { fontSize: 22, color: tColors.textSecondary, padding: 4 },
  modalLabel: {
    fontSize: typography.xs, color: tColors.textSecondary, letterSpacing: 0.8,
    fontWeight: typography.bold, marginBottom: 6, marginTop: tSpacing.sm,
  },
  modalInput: {
    backgroundColor: tColors.bg,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, padding: tSpacing.md,
    color: tColors.textPrimary, fontSize: typography.sm,
  },
  pillGroupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionPill: {
    borderWidth: 1, borderColor: tColors.border, borderRadius: tRadius.full,
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: tColors.bg,
  },
  optionPillActive: { backgroundColor: tColors.student.primary, borderColor: tColors.student.primary },
  optionPillText: { fontSize: typography.xs, color: tColors.textSecondary, fontWeight: typography.medium },
  optionPillTextActive: { color: '#fff', fontWeight: typography.semibold },
  saveBtn: {
    backgroundColor: tColors.student.primary,
    borderRadius: tRadius.md, paddingVertical: 14,
    marginTop: tSpacing.base, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: typography.base, fontWeight: typography.bold },

  socialModal: {
    backgroundColor: tColors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: tSpacing.base,
    borderWidth: 1, borderColor: tColors.border,
    maxHeight: '85%',
  },
  socialModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: tSpacing.base, marginBottom: tSpacing.base,
  },
  socialModalTitle: { fontSize: typography.md, fontWeight: typography.bold, color: tColors.textPrimary },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: tColors.cardAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: typography.sm, color: tColors.textSecondary, fontWeight: typography.semibold },

  socialEditRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: tSpacing.sm, paddingHorizontal: tSpacing.base, marginBottom: tSpacing.sm,
  },
  providerBadgeLg: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  providerAbbrLg: { fontSize: typography.sm, fontWeight: typography.bold },
  socialUrlBox: {
    flex: 1,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: tColors.bg,
  },
  socialEditUrl: { fontSize: typography.sm, color: tColors.textSecondary },
  trashBtn: {
    width: 36, height: 36, borderRadius: tRadius.sm,
    backgroundColor: tColors.cardAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  trashIcon: { fontSize: typography.base },

  addLinkRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: tSpacing.sm, paddingHorizontal: tSpacing.lg,
    marginTop: tSpacing.xs, marginBottom: tSpacing.sm,
  },
  providerDropdown: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: tColors.bg, minWidth: 110, maxWidth: 130, gap: 4,
  },
  providerPlaceholder: { fontSize: typography.sm, color: tColors.textTertiary, flex: 1 },
  providerSelected: { fontSize: typography.sm, color: tColors.textPrimary, flex: 1, fontWeight: typography.medium },
  chevron: { fontSize: typography.sm, color: tColors.textTertiary, transform: [{ rotate: '90deg' }] },
  handleInput: {
    flex: 1,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.md, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: tColors.bg, color: tColors.textPrimary, fontSize: typography.sm,
  },
  addLinkBtn: {
    width: 36, height: 36, borderRadius: tRadius.sm,
    backgroundColor: tColors.cardAlt,
    borderWidth: 1, borderColor: tColors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  addLinkBtnText: { fontSize: typography.xl, color: tColors.textPrimary, lineHeight: 24 },

  privacyNote: {
    fontSize: typography.xs, color: tColors.textTertiary, lineHeight: 17,
    paddingHorizontal: tSpacing.lg, marginTop: tSpacing.xs, marginBottom: tSpacing.md,
  },

  socialModalDivider: { height: 1, backgroundColor: tColors.border },
  socialModalFooter: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    gap: tSpacing.md, paddingHorizontal: tSpacing.lg, paddingVertical: tSpacing.md,
  },
  discardText: { fontSize: typography.sm, color: tColors.textSecondary, fontWeight: typography.medium },
  socialSaveBtn: {
    backgroundColor: tColors.student.primary,
    borderRadius: tRadius.full, paddingHorizontal: 28, paddingVertical: 10,
  },
  socialSaveBtnText: { fontSize: typography.sm, color: '#fff', fontWeight: typography.bold },

  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: tSpacing.xl,
  },
  pickerCard: {
    backgroundColor: tColors.card,
    borderWidth: 1, borderColor: tColors.border,
    borderRadius: tRadius.lg, padding: tSpacing.lg,
    width: '100%', maxWidth: 320,
  },
  pickerTitle: {
    fontSize: typography.base, fontWeight: typography.bold, color: tColors.textPrimary,
    marginBottom: tSpacing.md,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: tSpacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: tColors.border,
  },
  pickerProviderName: { fontSize: typography.sm, color: tColors.textPrimary, fontWeight: typography.medium },
});
