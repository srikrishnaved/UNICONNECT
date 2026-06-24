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
import { colors, spacing, radius, font, courseColor, avatarColor, initials } from '../theme';
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
          <Text style={[styles.bodyText, !bio && { color: colors.textTertiary, fontStyle: 'italic' }]}>
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
            <Text style={{ fontSize: 18, color: colors.textTertiary }}>›</Text>
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
            <Text style={{ fontSize: 18, color: colors.textTertiary }}>›</Text>
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
            <Text style={{ fontSize: 18, color: colors.textTertiary }}>›</Text>
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

        <View style={{ height: 40 }} />
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
              placeholderTextColor={colors.textTertiary}
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
              placeholderTextColor={colors.textTertiary}
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
                  placeholderTextColor={colors.textTertiary}
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
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: spacing.md }}>
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
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
                <Text style={{ fontSize: 18, ...font.bold, color: colors.textPrimary }}>🏅 Apply as CR</Text>
                <TouchableOpacity onPress={() => setShowCRApply(false)}>
                  <Text style={{ fontSize: 22, color: colors.textSecondary }}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold, marginBottom: 6 }}>YOUR DETAILS</Text>
              <View style={{ backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 14, color: colors.textPrimary, ...font.semibold }}>{name}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>{userProfile?.class || computeClass(course, year) || course}</Text>
              </View>
              <Text style={{ fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold, marginBottom: 6 }}>WHY DO YOU WANT TO BE CR?</Text>
              <TextInput
                value={crReason}
                onChangeText={t => { setCrReason(t); setCrApplyError(''); }}
                placeholder="Tell the admin why you'd make a good Class Representative…"
                placeholderTextColor={colors.textTertiary}
                multiline
                style={{ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 14, color: colors.textPrimary, minHeight: 90, textAlignVertical: 'top', marginBottom: spacing.sm }}
              />
              {crApplyError ? <Text style={{ fontSize: 12, color: colors.red, marginBottom: spacing.sm }}>{crApplyError}</Text> : null}
              <TouchableOpacity
                style={[{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm }, (crApplying || !crReason.trim()) && { opacity: 0.45 }]}
                onPress={handleCRApply}
                disabled={crApplying || !crReason.trim()}
                activeOpacity={0.85}
              >
                {crApplying
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ fontSize: 15, ...font.bold, color: '#fff' }}>Submit Application</Text>}
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm }}>
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
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
              <Text style={{ fontSize: 18, ...font.bold, color: colors.textPrimary }}>⭐ Apply for SAPS Core Team</Text>
              <TouchableOpacity onPress={() => setShowSapsApply(false)}>
                <Text style={{ fontSize: 22, color: colors.textSecondary }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold, marginBottom: spacing.sm }}>SELECT A ROLE</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {availableSapsRoles.map(role => {
                const sel = sapsSelectedRole === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      backgroundColor: sel ? colors.primaryLight : colors.bg,
                      borderWidth: 1, borderColor: sel ? colors.primary : colors.border,
                      borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
                    }}
                    onPress={() => { setSapsSelectedRole(role); setSapsApplyError(''); }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 15, color: sel ? colors.primary : colors.textPrimary, ...font.semibold }}>{role}</Text>
                    {sel && <Text style={{ color: colors.primary, fontSize: 16 }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {sapsApplyError ? <Text style={{ fontSize: 12, color: '#EF4444', marginBottom: spacing.sm }}>{sapsApplyError}</Text> : null}
            <TouchableOpacity
              style={[{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' }, (sapsApplying || !sapsSelectedRole) && { opacity: 0.45 }]}
              onPress={handleSapsApply}
              disabled={sapsApplying || !sapsSelectedRole}
              activeOpacity={0.85}
            >
              {sapsApplying
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ fontSize: 15, ...font.bold, color: '#fff' }}>Submit Application</Text>}
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm }}>
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
  container: { flex: 1, backgroundColor: colors.bg },
  cover: { height: 110, position: 'relative' },
  avatarWrap: { position: 'absolute', bottom: -46, left: 0, right: 0, alignItems: 'center' },
  avatar: {
    width: 92, height: 92, borderRadius: 46,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: colors.bg,
  },
  avatarText: { fontSize: 28, color: '#fff', ...font.bold },
  nameBlock: { alignItems: 'center', marginTop: 56, paddingHorizontal: spacing.lg },
  name: { fontSize: 20, ...font.bold, color: colors.textPrimary, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  courseBadge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  courseText: { fontSize: 12, ...font.semibold },
  meta: { fontSize: 13, color: colors.textSecondary },

  statsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  stat: {
    flex: 1, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, alignItems: 'center',
  },
  statVal: { fontSize: 20, ...font.bold, color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  editBtn: {
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
  },
  editBtnText: { fontSize: 14, ...font.semibold, color: colors.textPrimary },

  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionLabel: {
    fontSize: 11, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.semibold, marginBottom: spacing.sm,
  },
  bodyText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

  // Social links display (profile view)
  socialRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  providerBadge: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  providerAbbr: { fontSize: 11, ...font.bold },
  socialUrl: { fontSize: 13, color: colors.textSecondary, flex: 1 },

  editSocialBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: 12, alignItems: 'center',
  },
  editSocialBtnText: { fontSize: 13, ...font.semibold, color: colors.primary },

  leadershipCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  leadIcon: {
    width: 44, height: 44, borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  leadRole: { fontSize: 14, ...font.bold, color: colors.textPrimary },
  leadDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  clubsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clubChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  clubChipEmoji: { fontSize: 14 },
  clubChipName: { fontSize: 12, ...font.semibold },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionEditLink: { fontSize: 12, color: colors.primary, ...font.semibold },
  emptyInterestsTap: { paddingVertical: spacing.sm },
  emptyInterestsText: { fontSize: 13, color: colors.textTertiary, fontStyle: 'italic' },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  interestPill: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5,
  },
  interestText: { fontSize: 12, color: colors.textSecondary },

  interestEditGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: spacing.md },
  interestEditChip: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: colors.bg,
  },
  interestEditChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  interestEditChipText: { fontSize: 13, color: colors.textSecondary, ...font.medium },
  interestEditChipTextActive: { color: colors.primary, ...font.semibold },
  saveInterestsBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.md,
  },
  saveInterestsBtnText: { color: '#fff', fontSize: 15, ...font.bold },


  blockedBtn: {
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  blockedBtnText: { fontSize: 14, ...font.semibold, color: colors.textSecondary },
  blockedCount: {
    backgroundColor: colors.redLight, borderWidth: 1, borderColor: colors.red,
    borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2,
  },
  blockedCountText: { fontSize: 11, color: colors.red, ...font.bold },

  blockedEmpty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  blockedEmptyIcon: { fontSize: 36 },
  blockedEmptyText: { fontSize: 14, color: colors.textSecondary },

  blockedRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  blockedAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.cardElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  blockedAvatarText: { fontSize: 13, ...font.bold, color: colors.textSecondary },
  blockedName: { fontSize: 13, ...font.semibold, color: colors.textPrimary },
  blockedCourse: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  unblockBtn: {
    borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 5,
  },
  unblockBtnText: { fontSize: 12, color: colors.primary, ...font.semibold },

  themeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  themeCard: {
    width: '30%', flexGrow: 1,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: 5,
  },
  themeCardActive: {
    borderColor: colors.primary, borderWidth: 2,
  },
  themeCardDimmed: { opacity: 0.45 },
  swatchRow: { flexDirection: 'row', gap: 3, marginBottom: 2 },
  swatchDot: { width: 14, height: 14, borderRadius: 7 },
  themeLabel: { fontSize: 11, ...font.semibold, color: colors.textPrimary },
  themeLabelActive: { color: colors.primary },
  themeDesc: { fontSize: 10, color: colors.textTertiary },

  legalRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: spacing.sm, marginTop: spacing.lg,
  },
  legalLink: { fontSize: 12, color: colors.textTertiary, ...font.medium },
  legalDot: { fontSize: 12, color: colors.textTertiary },

  signOutBtn: {
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
    backgroundColor: colors.redLight,
    borderWidth: 1, borderColor: colors.red,
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
  },
  signOutBtnText: { fontSize: 14, ...font.semibold, color: colors.red },

  crDashBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  crDashBtnEmoji: { fontSize: 22 },
  crDashBtnTitle: { fontSize: 14, ...font.bold, color: colors.primary },
  crDashBtnSub: { fontSize: 11, color: colors.primary, opacity: 0.8, marginTop: 2 },

  crPendingCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.amberLight, borderWidth: 1, borderColor: colors.amber,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  crPendingEmoji: { fontSize: 22 },
  crPendingTitle: { fontSize: 14, ...font.semibold, color: colors.amber },
  crPendingSub: { fontSize: 11, color: colors.amber, opacity: 0.8, marginTop: 2 },

  crApplyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  crApplyBtnEmoji: { fontSize: 22 },
  crApplyBtnTitle: { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  crApplyBtnSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  deleteBtn: {
    marginHorizontal: spacing.lg, marginTop: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
  },
  deleteBtnText: { fontSize: 14, ...font.medium, color: colors.textTertiary },
  deleteConfirmBox: {
    marginHorizontal: spacing.lg, marginTop: spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1, borderColor: '#EF4444',
    borderRadius: radius.md, padding: spacing.md,
  },
  deleteConfirmText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.md },
  deleteConfirmRow: { flexDirection: 'row', gap: spacing.sm },
  deleteCancelBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: 10, alignItems: 'center',
    backgroundColor: colors.card,
  },
  deleteCancelText: { fontSize: 13, color: colors.textSecondary, ...font.semibold },
  deleteConfirmBtn: {
    flex: 1, backgroundColor: '#EF4444',
    borderRadius: radius.md, paddingVertical: 10, alignItems: 'center',
  },
  deleteConfirmBtnText: { fontSize: 13, color: '#fff', ...font.bold },

  // Shared modal base
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: '92%',
    borderWidth: 1, borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: { fontSize: 18, ...font.bold, color: colors.textPrimary },
  modalClose: { fontSize: 22, color: colors.textSecondary, padding: 4 },
  modalLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold, marginBottom: 6, marginTop: spacing.sm,
  },
  modalInput: {
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary, fontSize: 14,
  },
  pillGroupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionPill: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: colors.bg,
  },
  optionPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionPillText: { fontSize: 12, color: colors.textSecondary, ...font.medium },
  optionPillTextActive: { color: '#fff', ...font.semibold },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, ...font.bold },

  // ── Social links modal ──
  socialModal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
    maxHeight: '85%',
  },
  socialModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  socialModalTitle: { fontSize: 18, ...font.bold, color: colors.textPrimary },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.cardElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 13, color: colors.textSecondary, ...font.semibold },

  socialEditRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  providerBadgeLg: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  providerAbbrLg: { fontSize: 13, ...font.bold },
  socialUrlBox: {
    flex: 1,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.bg,
  },
  socialEditUrl: { fontSize: 13, color: colors.textSecondary },
  trashBtn: {
    width: 36, height: 36,
    borderRadius: 8,
    backgroundColor: colors.cardElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  trashIcon: { fontSize: 15 },

  addLinkRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  providerDropdown: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: colors.bg,
    minWidth: 110, maxWidth: 130,
    gap: 4,
  },
  providerPlaceholder: { fontSize: 13, color: colors.textTertiary, flex: 1 },
  providerSelected: { fontSize: 13, color: colors.textPrimary, flex: 1, ...font.medium },
  chevron: { fontSize: 14, color: colors.textTertiary, transform: [{ rotate: '90deg' }] },
  handleInput: {
    flex: 1,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.bg,
    color: colors.textPrimary, fontSize: 13,
  },
  addLinkBtn: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: colors.cardElevated,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  addLinkBtnText: { fontSize: 20, color: colors.textPrimary, lineHeight: 24 },

  privacyNote: {
    fontSize: 12, color: colors.textTertiary, lineHeight: 17,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },

  socialModalDivider: { height: 1, backgroundColor: colors.border },
  socialModalFooter: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  discardText: { fontSize: 14, color: colors.textSecondary, ...font.medium },
  socialSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 28, paddingVertical: 10,
  },
  socialSaveBtnText: { fontSize: 14, color: '#fff', ...font.bold },

  // ── Provider picker ──
  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
    padding: spacing.xl,
  },
  pickerCard: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 320,
  },
  pickerTitle: {
    fontSize: 15, ...font.bold, color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerProviderName: { fontSize: 14, color: colors.textPrimary, ...font.medium },
});
