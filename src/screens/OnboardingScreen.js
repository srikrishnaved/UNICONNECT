import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '../theme';
import {
  colors as tColors,
  typography,
  spacing as tSpacing,
  radius as tRadius,
  shadows,
  presets,
} from '../theme/tokens';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { teachers as SEED_TEACHERS } from '../data/index';
import LegalScreen from './LegalScreen';

const COURSES = [
  {
    key: 'BCom IAF',
    full: 'BCom International Accounting & Finance',
    sub: 'Integrated with ACCA',
    color: '#3B82F6',
    bg: 'rgba(59, 130, 246, 0.12)',
  },
  {
    key: 'BCom IBA',
    full: 'BCom International Business & Accounting',
    sub: 'Integrated with CPA Australia',
    color: '#A855F7',
    bg: 'rgba(168, 85, 247, 0.12)',
  },
  {
    key: 'BCom F&A',
    full: 'BCom Finance & Accountancy',
    sub: null,
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.12)',
  },
];

const YEARS = ['1st Year', '2nd Year', '3rd Year'];

export const INTERESTS = [
  'Finance', 'Accounting', 'Taxation', 'Auditing', 'Economics',
  'Marketing', 'Entrepreneurship', 'Management', 'Banking & Investment',
  'Business Law', 'International Business', 'Strategy',
  'Photography', 'Videography', 'Graphic Design', 'Content Creation',
  'Social Media', 'Public Speaking', 'Leadership', 'Volunteering',
  'Event Management', 'Music', 'Dance', 'Theatre & Drama',
  'Sports & Fitness', 'Research & Writing', 'Technology', 'AI & Data',
];

export default function OnboardingScreen() {
  const { signUp, signIn, sendPasswordReset, registerTeacher } = useApp();

  // 'roleSelect' | 'signup' | 'signin' | 'picker' | 'interests' | 'allset' | 'teacherSignup' | 'teacherIdentity' | 'teacherSubjects'
  const [step, setStep] = useState('signin');
  const [loading, setLoading] = useState(false);

  // Sign up fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Sign in fields
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Course / year / section
  const [course, setCourse] = useState(null);
  const [year, setYear] = useState(null);
  const [section, setSection] = useState(null); // 'A' | 'B' | null
  const campus = 'Yeshwanthpur';

  // Interests
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [bio, setBio] = useState('');

  const [signInError, setSignInError] = useState('');
  const [signUpError, setSignUpError] = useState('');

  // Teacher registration fields
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [teacherFacultyType, setTeacherFacultyType] = useState(null);
  const [teacherAvailableDays, setTeacherAvailableDays] = useState([]);
  const [teacherSignUpError, setTeacherSignUpError] = useState('');

  // Teacher identity selection (seed teacher link)
  const [selectedSeedTeacher, setSelectedSeedTeacher] = useState(null);
  const [identitySearch, setIdentitySearch] = useState('');
  const [timetableFaculty, setTimetableFaculty] = useState([]); // names fetched from timetable_slots

  // Teacher subject selection
  const [teacherSelectedSubjectIds, setTeacherSelectedSubjectIds] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);

  // Compliance checkboxes (allset step)
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedAge, setAgreedAge] = useState(false);
  const [legalModal, setLegalModal] = useState(null); // null | 'privacy' | 'terms'

  // Role selector (visual only — affects button accent colour on signin step)
  const [selectedRole, setSelectedRole] = useState('student');

  // Forgot password
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const isValidPassword = (pwd) =>
    pwd.length >= 6 && /[0-9]/.test(pwd) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(pwd);

  const handleForgotPassword = async () => {
    setForgotError('');
    if (!forgotEmail.trim()) { setForgotError('Please enter your email.'); return; }
    setForgotLoading(true);
    try {
      await sendPasswordReset(forgotEmail);
      setForgotSent(true);
    } catch (err) {
      setForgotError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  // ── Teacher Registration ───────────────────────────────────────────────────
  const handleTeacherContinue = async () => {
    setTeacherSignUpError('');
    if (!teacherName.trim()) { setTeacherSignUpError('Please enter your full name.'); return; }
    const emailDomain = teacherEmail.trim().toLowerCase().split('@')[1] ?? '';
    const validDomain = emailDomain === 'christuniversity.in' || emailDomain.endsWith('.christuniversity.in');
    if (!teacherEmail.trim() || !validDomain) {
      setTeacherSignUpError('Only christuniversity.in emails are accepted.');
      return;
    }
    if (!isValidPassword(teacherPassword)) {
      setTeacherSignUpError('Password must be at least 6 characters with a number and a special character.');
      return;
    }
    if (!teacherFacultyType) { setTeacherSignUpError('Please select your faculty type.'); return; }
    if (teacherAvailableDays.length === 0) { setTeacherSignUpError('Please select at least one available day.'); return; }

    setSelectedSeedTeacher(null);
    setIdentitySearch('');
    // Fetch distinct faculty names from timetable_slots alongside navigating
    supabase
      .from('timetable_slots')
      .select('faculty_name')
      .not('faculty_name', 'is', null)
      .neq('faculty_name', '')
      .then(({ data }) => {
        if (data) {
          // Split compound elective entries like "CA Sarthak / CS Monika Agarwal"
          // into individual names, then deduplicate
          const names = [...new Set(
            data.flatMap(r => r.faculty_name ? r.faculty_name.split(' / ').map(n => n.trim()) : []).filter(Boolean)
          )];
          setTimetableFaculty(names);
        }
      });
    setStep('teacherIdentity');
  };

  const handleIdentityContinue = async () => {
    if (selectedSeedTeacher) {
      setLoading(true);
      try {
        await registerTeacher({
          name: selectedSeedTeacher.name,
          email: teacherEmail,
          password: teacherPassword,
          subjects: selectedSeedTeacher.subjects.join(', '),
          facultyType: teacherFacultyType,
          availableDays: teacherAvailableDays,
          subjectIds: [],
          seedTeacherId: selectedSeedTeacher.id,
        });
      } catch (err) {
        setTeacherSignUpError(err.message || 'Something went wrong. Please try again.');
        setStep('teacherSignup');
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('subjects')
          .select('id, name, code, class')
          .eq('status', 'active')
          .order('name', { ascending: true });
        setAvailableSubjects(data || []);
      } catch (_) {
        setAvailableSubjects([]);
      } finally {
        setLoading(false);
      }
      setTeacherSelectedSubjectIds([]);
      setStep('teacherSubjects');
    }
  };

  const handleFinalTeacherSubmit = async (subjectIds) => {
    const ids = subjectIds !== undefined ? subjectIds : teacherSelectedSubjectIds;
    setLoading(true);
    try {
      await registerTeacher({
        name: teacherName,
        email: teacherEmail,
        password: teacherPassword,
        facultyType: teacherFacultyType,
        availableDays: teacherAvailableDays,
        subjectIds: ids,
      });
    } catch (err) {
      setTeacherSignUpError(err.message || 'Something went wrong. Please try again.');
      setStep('teacherSignup');
    } finally {
      setLoading(false);
    }
  };

  // ── Sign In ────────────────────────────────────────────────────────────────
  const handleSignIn = async () => {
    setSignInError('');
    if (!signInEmail.trim() || !signInPassword) {
      setSignInError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn({ email: signInEmail.trim(), password: signInPassword });
    } catch (err) {
      setSignInError(err.message || 'Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  // ── Sign Up step 1 ─────────────────────────────────────────────────────────
  const handleSignupNext = () => {
    setSignUpError('');
    if (!name.trim()) {
      setSignUpError('Please enter your name.');
      return;
    }
    const emailDomain = email.trim().toLowerCase().split('@')[1] ?? '';
    const validDomain = emailDomain === 'christuniversity.in' || emailDomain.endsWith('.christuniversity.in');
    if (!email.trim() || !validDomain) {
      setSignUpError('Only christuniversity.in emails are accepted.');
      return;
    }
    if (!isValidPassword(password)) {
      setSignUpError('Password must be at least 6 characters and include a number and a special character (e.g. !, @, #, $).');
      return;
    }
    setStep('picker');
  };

  // ── Sign Up step 2 ─────────────────────────────────────────────────────────
  const handlePickerNext = () => {
    if (!course)  { Alert.alert('Select your course',  'Please choose your course to continue.');  return; }
    if (!year)    { Alert.alert('Select your year',    'Please choose your year to continue.');    return; }
    const needsSection = course === 'BCom F&A' && (year === '2nd Year' || year === '3rd Year');
    if (needsSection && !section) {
      Alert.alert('Select your section', 'Please choose Section A or B to continue.');
      return;
    }
    setStep('interests');
  };

  // ── Sign Up step 3 — interests ─────────────────────────────────────────────
  const handleInterestsNext = () => {
    setStep('bio');
  };

  // ── Sign Up step 4 — bio ───────────────────────────────────────────────────
  const handleBioNext = () => {
    if (bio.trim().length < 20) return;
    setStep('allset');
  };

  // ── Sign Up step 5 — create account ───────────────────────────────────────
  const handleCreateAccount = async () => {
    setSignUpError('');
    setLoading(true);
    try {
      await signUp({ email: email.trim(), password, name, course, year, campus, interests: selectedInterests, bio, section });
    } catch (err) {
      console.error('[handleCreateAccount] signup failed:', err);
      setSignUpError(err.message || 'Something went wrong. Please try again.');
      // stay on allset step so user can see the error clearly
    } finally {
      setLoading(false);
    }
  };

  // ── Step: Role Select ─────────────────────────────────────────────────────
  if (step === 'roleSelect') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.logoRow}>
            <View style={styles.logoBox}><Text style={styles.logoIcon}>✦</Text></View>
            <Text style={styles.logoText}>Christ<Text style={{ color: colors.primary }}>Connect</Text></Text>
          </View>

          <Text style={styles.heading}>Welcome</Text>
          <Text style={styles.subheading}>Who are you? Choose your role to get started.</Text>

          <TouchableOpacity
            style={[styles.roleCard, { borderColor: colors.primary }]}
            onPress={() => setStep('signup')}
            activeOpacity={0.85}
          >
            <Text style={styles.roleCardEmoji}>🎓</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.roleCardTitle}>I am a Student</Text>
              <Text style={styles.roleCardSub}>Sign up with your university email</Text>
            </View>
            <Text style={{ fontSize: 18, color: colors.textTertiary }}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleCard, { borderColor: colors.amber, marginTop: spacing.sm }]}
            onPress={() => setStep('teacherSignup')}
            activeOpacity={0.85}
          >
            <Text style={styles.roleCardEmoji}>👩‍🏫</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.roleCardTitle, { color: colors.amber }]}>I am a Teacher</Text>
              <Text style={styles.roleCardSub}>Register as faculty — pending admin approval</Text>
            </View>
            <Text style={{ fontSize: 18, color: colors.textTertiary }}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setStep('signin')} activeOpacity={0.7} style={styles.switchRow}>
            <Text style={styles.switchText}>
              Already have an account? <Text style={styles.switchLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step: Teacher Sign Up ─────────────────────────────────────────────────
  if (step === 'teacherSignup') {
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const FACULTY_TYPES = [
      { key: 'full-time', label: 'Full-Time' },
      { key: 'adjunct', label: 'Adjunct' },
      { key: 'visiting', label: 'Visiting' },
    ];
    const toggleDay = (d) =>
      setTeacherAvailableDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.stepHeader}>
              <TouchableOpacity onPress={() => setStep('roleSelect')} activeOpacity={0.7}>
                <Text style={styles.backBtn}>← Back</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.logoRow}>
              <View style={[styles.logoBox, { backgroundColor: colors.amber }]}><Text style={styles.logoIcon}>✦</Text></View>
              <Text style={styles.logoText}>Teacher <Text style={{ color: colors.amber }}>Registration</Text></Text>
            </View>

            <Text style={styles.heading}>Faculty Sign-Up</Text>
            <Text style={styles.subheading}>Submit your details for admin review. You'll be notified once your account is approved.</Text>

            <Text style={styles.label}>FULL NAME</Text>
            <TextInput
              value={teacherName}
              onChangeText={v => { setTeacherName(v); setTeacherSignUpError(''); }}
              placeholder="e.g. Dr. Ravi Kumar"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              autoCapitalize="words"
            />

            <Text style={styles.label}>INSTITUTIONAL EMAIL</Text>
            <TextInput
              value={teacherEmail}
              onChangeText={v => { setTeacherEmail(v); setTeacherSignUpError(''); }}
              placeholder="yourname@christuniversity.in"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>Only christuniversity.in emails are accepted.</Text>

            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              key={showTeacherPassword ? 'tp-visible' : 'tp-hidden'}
              value={teacherPassword}
              onChangeText={v => { setTeacherPassword(v); setTeacherSignUpError(''); }}
              placeholder="Create a password"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { marginBottom: 6 }]}
              secureTextEntry={!showTeacherPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowTeacherPassword(v => !v)} style={styles.showPasswordRow} activeOpacity={0.7}>
              <Text style={styles.showPasswordTick}>{showTeacherPassword ? '☑' : '☐'}</Text>
              <Text style={styles.showPasswordText}>{showTeacherPassword ? 'Hide password' : 'Show password'}</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>Min 6 characters · at least one number · at least one special character</Text>

            <Text style={styles.label}>FACULTY TYPE</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              {FACULTY_TYPES.map(ft => {
                const sel = teacherFacultyType === ft.key;
                return (
                  <TouchableOpacity
                    key={ft.key}
                    style={[styles.yearPill, sel && { backgroundColor: colors.amber, borderColor: colors.amber }]}
                    onPress={() => { setTeacherFacultyType(ft.key); setTeacherSignUpError(''); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.yearPillText, sel && { color: '#fff', ...font.semibold }]}>{ft.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>AVAILABLE DAYS</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              {DAYS.map(d => {
                const sel = teacherAvailableDays.includes(d);
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.yearPill, sel && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    onPress={() => { toggleDay(d); setTeacherSignUpError(''); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.yearPillText, sel && styles.yearPillTextActive]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {teacherSignUpError ? <Text style={styles.errorText}>{teacherSignUpError}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.amber }, loading && { opacity: 0.6 }]}
              onPress={handleTeacherContinue}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Continue →</Text>
              }
            </TouchableOpacity>

            <Text style={styles.consentNote}>
              Your account will be reviewed by the department administrator before you can access ChristConnect.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Step: Teacher Identity Selection ─────────────────────────────────────
  if (step === 'teacherIdentity') {
    // Use timetable_slots as the sole source of names.
    // Enrich with seed teacher data (position, subjects, id) only when names match exactly.
    const mergedList = timetableFaculty.map(name => {
      const seed = SEED_TEACHERS.find(t => t.name.toLowerCase() === name.toLowerCase());
      return seed
        ? { name: seed.name, subjects: seed.subjects, id: seed.id }
        : { name, subjects: [], id: null };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const q = identitySearch.trim().toLowerCase();
    const filtered = q ? mergedList.filter(t => t.name.toLowerCase().includes(q)) : mergedList;
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.stepHeader}>
              <TouchableOpacity onPress={() => setStep('teacherSignup')} activeOpacity={0.7}>
                <Text style={styles.backBtn}>← Back</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.logoRow}>
              <View style={[styles.logoBox, { backgroundColor: colors.amber }]}>
                <Text style={styles.logoIcon}>✦</Text>
              </View>
              <Text style={styles.logoText}>Who are <Text style={{ color: colors.amber }}>you?</Text></Text>
            </View>

            <Text style={styles.heading}>Find yourself on the list</Text>
            <Text style={styles.subheading}>
              Select your name if you're an existing faculty member. Your subjects will be linked automatically.
            </Text>

            <TextInput
              style={[styles.input, { marginBottom: spacing.sm }]}
              placeholder="Search by name..."
              placeholderTextColor={colors.textTertiary}
              value={identitySearch}
              onChangeText={setIdentitySearch}
              autoCorrect={false}
            />

            {filtered.map(t => {
              const sel = selectedSeedTeacher?.name === t.name;
              return (
                <TouchableOpacity
                  key={t.name}
                  style={[styles.subjectRow, sel && styles.subjectRowActive, { marginBottom: spacing.xs }]}
                  onPress={() => setSelectedSeedTeacher(sel ? null : t)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.subjectName, sel && { color: colors.amber }]}>{t.name}</Text>
                    <Text style={styles.subjectMeta}>Faculty</Text>
                  </View>
                  {sel && <Text style={{ color: colors.amber, fontSize: 18, ...font.bold }}>✓</Text>}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[
                styles.subjectRow,
                !selectedSeedTeacher && { borderColor: colors.amber, backgroundColor: colors.amberLight },
                { marginTop: spacing.sm, marginBottom: spacing.md },
              ]}
              onPress={() => setSelectedSeedTeacher(null)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.subjectName, !selectedSeedTeacher && { color: colors.amber }]}>
                  I'm not on this list / Create new profile
                </Text>
                <Text style={styles.subjectMeta}>You'll select your subjects manually in the next step</Text>
              </View>
              {!selectedSeedTeacher && <Text style={{ color: colors.amber, fontSize: 18, ...font.bold }}>✓</Text>}
            </TouchableOpacity>

            {teacherSignUpError ? <Text style={styles.errorText}>{teacherSignUpError}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.amber }, loading && { opacity: 0.6 }]}
              onPress={handleIdentityContinue}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>
                    {selectedSeedTeacher ? 'Link & Submit for Approval →' : 'Continue →'}
                  </Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Step: Teacher Subject Selection ───────────────────────────────────────
  if (step === 'teacherSubjects') {
    const toggleSubject = (id) =>
      setTeacherSelectedSubjectIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );

    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.stepHeader}>
              <TouchableOpacity onPress={() => setStep('teacherIdentity')} activeOpacity={0.7}>
                <Text style={styles.backBtn}>← Back</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.logoRow}>
              <View style={[styles.logoBox, { backgroundColor: colors.amber }]}>
                <Text style={styles.logoIcon}>✦</Text>
              </View>
              <Text style={styles.logoText}>Select <Text style={{ color: colors.amber }}>Subjects</Text></Text>
            </View>

            <Text style={styles.heading}>What do you teach?</Text>
            <Text style={styles.subheading}>
              Select the subjects you teach. This step is optional — you can update your subjects anytime from the dashboard.
            </Text>

            {loading ? (
              <ActivityIndicator color={colors.amber} style={{ marginVertical: spacing.xl }} />
            ) : availableSubjects.length === 0 ? (
              <View style={styles.subjectEmptyBox}>
                <Text style={styles.hint}>No subjects available yet. You can add them from your dashboard once your account is approved.</Text>
              </View>
            ) : (
              availableSubjects.map(subject => {
                const sel = teacherSelectedSubjectIds.includes(subject.id);
                return (
                  <TouchableOpacity
                    key={subject.id}
                    style={[styles.subjectRow, sel && styles.subjectRowActive]}
                    onPress={() => toggleSubject(subject.id)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.subjectName, sel && { color: colors.amber }]}>{subject.name}</Text>
                      <Text style={styles.subjectMeta}>{subject.code}{subject.class ? ` · ${subject.class}` : ''}</Text>
                    </View>
                    {sel && <Text style={{ color: colors.amber, fontSize: 18, ...font.bold }}>✓</Text>}
                  </TouchableOpacity>
                );
              })
            )}

            <Text style={[styles.hint, { marginTop: spacing.md }]}>
              {teacherSelectedSubjectIds.length > 0
                ? `${teacherSelectedSubjectIds.length} selected`
                : 'None selected — tap any subject to select it'}
            </Text>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.amber }, loading && { opacity: 0.6 }]}
              onPress={() => handleFinalTeacherSubmit()}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Submit for Approval →</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleFinalTeacherSubmit([])}
              activeOpacity={0.7}
              disabled={loading}
              style={styles.switchRow}
            >
              <Text style={styles.switchText}>Skip for now</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Step: Sign In ──────────────────────────────────────────────────────────
  if (step === 'signin') {
    const accentColor = selectedRole === 'faculty'
      ? tColors.faculty.primary
      : tColors.student.primary;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tColors.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={siStyles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <Text style={siStyles.title}>UniConnect</Text>
            <Text style={siStyles.subtitle}>Your campus, connected.</Text>

            {/* Role selector */}
            <View style={siStyles.roleRow}>
              <TouchableOpacity
                style={[siStyles.roleCard, { borderColor: selectedRole === 'student' ? tColors.student.primary : tColors.border }]}
                onPress={() => setSelectedRole('student')}
                activeOpacity={0.85}
              >
                <Text style={siStyles.roleIcon}>🎓</Text>
                <Text style={siStyles.roleAccessLabel}>ACCESS</Text>
                <Text style={siStyles.roleName}>Student</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[siStyles.roleCard, { borderColor: selectedRole === 'faculty' ? tColors.faculty.primary : tColors.border }]}
                onPress={() => setSelectedRole('faculty')}
                activeOpacity={0.85}
              >
                <Text style={siStyles.roleIcon}>🏫</Text>
                <Text style={siStyles.roleAccessLabel}>PORTAL</Text>
                <Text style={siStyles.roleName}>Faculty</Text>
              </TouchableOpacity>
            </View>

            {/* Form container */}
            <View style={siStyles.formCard}>
              {/* Email input */}
              <View style={siStyles.inputRow}>
                <Text style={siStyles.inputIcon}>✉</Text>
                <TextInput
                  value={signInEmail}
                  onChangeText={v => { setSignInEmail(v); setSignInError(''); }}
                  placeholder="yourname@christuniversity.in"
                  placeholderTextColor={tColors.textSecondary}
                  style={siStyles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Password input */}
              <View style={[siStyles.inputRow, { marginBottom: 0 }]}>
                <Text style={siStyles.inputIcon}>🔒</Text>
                <TextInput
                  key={showSignInPassword ? 'si-visible' : 'si-hidden'}
                  value={signInPassword}
                  onChangeText={v => { setSignInPassword(v); setSignInError(''); }}
                  placeholder="Your password"
                  placeholderTextColor={tColors.textSecondary}
                  style={[siStyles.input, { flex: 1 }]}
                  secureTextEntry={!showSignInPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowSignInPassword(v => !v)}
                  activeOpacity={0.7}
                  style={{ paddingHorizontal: tSpacing.xs }}
                >
                  <Text style={{ fontSize: 15, color: tColors.textSecondary }}>
                    {showSignInPassword ? '🙈' : '👁'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => { setShowForgot(v => !v); setForgotSent(false); setForgotError(''); setForgotEmail(''); }}
                activeOpacity={0.7}
                style={{ alignSelf: 'flex-end', marginTop: tSpacing.sm }}
              >
                <Text style={siStyles.forgotLink}>Forgot password?</Text>
              </TouchableOpacity>

              {showForgot && (
                <View style={siStyles.forgotBox}>
                  {forgotSent ? (
                    <Text style={siStyles.forgotSuccess}>
                      ✓ Reset link sent — check your inbox and click the link to set a new password.
                    </Text>
                  ) : (
                    <>
                      <Text style={siStyles.forgotLabel}>Enter your university email and we'll send a reset link.</Text>
                      <TextInput
                        value={forgotEmail}
                        onChangeText={v => { setForgotEmail(v); setForgotError(''); }}
                        placeholder="yourname@christuniversity.in"
                        placeholderTextColor={tColors.textSecondary}
                        style={siStyles.standaloneInput}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {forgotError ? <Text style={siStyles.errorText}>{forgotError}</Text> : null}
                      <TouchableOpacity
                        style={[siStyles.primaryBtn, { backgroundColor: accentColor }, forgotLoading && { opacity: 0.6 }]}
                        onPress={handleForgotPassword}
                        disabled={forgotLoading}
                        activeOpacity={0.85}
                      >
                        {forgotLoading
                          ? <ActivityIndicator color="#fff" />
                          : <Text style={siStyles.primaryBtnText}>Send Reset Link</Text>
                        }
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>

            {signInError ? <Text style={siStyles.errorText}>{signInError}</Text> : null}

            {/* Primary CTA */}
            <TouchableOpacity
              style={[siStyles.primaryBtn, { backgroundColor: accentColor }, loading && { opacity: 0.6 }]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={siStyles.primaryBtnText}>Verify & Sign In →</Text>
              }
            </TouchableOpacity>

            {/* OR divider */}
            <View style={siStyles.dividerRow}>
              <View style={siStyles.dividerLine} />
              <Text style={siStyles.dividerText}>OR CONTINUE WITH</Text>
              <View style={siStyles.dividerLine} />
            </View>

            {/* Google button — visual only */}
            <TouchableOpacity style={siStyles.googleBtn} activeOpacity={0.85}>
              <Text style={siStyles.googleBtnIcon}>G</Text>
              <Text style={siStyles.googleBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Footer links */}
            <View style={siStyles.footerRow}>
              <Text style={siStyles.footerLink}>Privacy Policy</Text>
              <Text style={siStyles.footerSep}>·</Text>
              <Text style={siStyles.footerLink}>Security</Text>
              <Text style={siStyles.footerSep}>·</Text>
              <Text style={siStyles.footerLink}>Support</Text>
            </View>

            <TouchableOpacity onPress={() => setStep('roleSelect')} activeOpacity={0.7} style={styles.switchRow}>
              <Text style={styles.switchLink}>Create an account</Text>
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Step: Sign Up (details) ────────────────────────────────────────────────
  if (step === 'signup') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.stepHeader}>
              <TouchableOpacity onPress={() => setStep('roleSelect')} activeOpacity={0.7}>
                <Text style={styles.backBtn}>← Back</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.logoRow}>
              <View style={styles.logoBox}><Text style={styles.logoIcon}>✦</Text></View>
              <Text style={styles.logoText}>Christ<Text style={{ color: colors.primary }}>Connect</Text></Text>
            </View>

            <Text style={styles.heading}>Let's get you set up</Text>
            <Text style={styles.subheading}>Sign up with your Christ University email.</Text>

            <Text style={styles.label}>YOUR NAME</Text>
            <TextInput
              value={name}
              onChangeText={v => { setName(v); setSignUpError(''); }}
              placeholder="e.g. Aanya Sharma"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              autoCapitalize="words"
            />

            <Text style={styles.label}>UNIVERSITY EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={v => { setEmail(v); setSignUpError(''); }}
              placeholder="yourname@christuniversity.in"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>Only christuniversity.in emails are accepted.</Text>

            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              key={showPassword ? 'su-visible' : 'su-hidden'}
              value={password}
              onChangeText={v => { setPassword(v); setSignUpError(''); }}
              placeholder="Create a password"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { marginBottom: 6 }]}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.showPasswordRow} activeOpacity={0.7}>
              <Text style={styles.showPasswordTick}>{showPassword ? '☑' : '☐'}</Text>
              <Text style={styles.showPasswordText}>{showPassword ? 'Hide password' : 'Show password'}</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>Min 6 characters · at least one number · at least one special character</Text>

            {signUpError ? <Text style={styles.errorText}>{signUpError}</Text> : null}

            <TouchableOpacity style={styles.primaryBtn} onPress={handleSignupNext} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Continue →</Text>
            </TouchableOpacity>

            <Text style={styles.consentNote}>
              By signing up you agree to our Terms of Use and Privacy Policy. Available in the My Profile screen after sign-in.
            </Text>

            <TouchableOpacity onPress={() => setStep('signin')} activeOpacity={0.7} style={styles.switchRow}>
              <Text style={styles.switchText}>
                Already have an account? <Text style={styles.switchLink}>Sign In</Text>
              </Text>
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Step: Course & Year ────────────────────────────────────────────────────
  if (step === 'picker') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.stepHeader}>
            <TouchableOpacity onPress={() => setStep('signup')} activeOpacity={0.7}>
              <Text style={styles.backBtn}>← Back</Text>
            </TouchableOpacity>
            <View style={styles.stepDots}>
              <View style={[styles.dot, styles.dotDone]} />
              <View style={[styles.dot, styles.dotActive]} />
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </View>

          <Text style={styles.heading}>What are you studying?</Text>
          <Text style={styles.subheading}>Select your course and year.</Text>

          <Text style={styles.label}>COURSE</Text>
          {COURSES.map(c => {
            const selected = course === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.courseCard, selected && { borderColor: c.color, backgroundColor: c.bg }]}
                onPress={() => { setCourse(c.key); setSection(null); if (c.key === 'BCom IBA' && year === '3rd Year') setYear(null); }}
                activeOpacity={0.85}
              >
                <View style={[styles.courseStripe, { backgroundColor: c.color }]} />
                <View style={styles.courseBody}>
                  <Text style={[styles.courseKey, selected && { color: c.color }]}>{c.key}</Text>
                  <Text style={styles.courseFull}>{c.full}</Text>
                  {c.sub ? <Text style={styles.courseSub}>{c.sub}</Text> : null}
                </View>
                {selected && <Text style={[styles.courseCheck, { color: c.color }]}>✓</Text>}
              </TouchableOpacity>
            );
          })}

          <Text style={[styles.label, { marginTop: spacing.lg }]}>YEAR</Text>
          <View style={styles.yearRow}>
            {YEARS.filter(y => !(course === 'BCom IBA' && y === '3rd Year')).map(y => {
              const selected = year === y;
              return (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearPill, selected && styles.yearPillActive]}
                  onPress={() => { setYear(y); setSection(null); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.yearPillText, selected && styles.yearPillTextActive]}>{y}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Section picker — BCom F&A 2nd/3rd year only */}
          {course === 'BCom F&A' && (year === '2nd Year' || year === '3rd Year') && (
            <>
              <Text style={[styles.label, { marginTop: spacing.lg }]}>SECTION</Text>
              <View style={styles.yearRow}>
                {[
                  { key: 'A', label: 'Section A' },
                  { key: 'B', label: year === '3rd Year' ? 'Section B · CPA Course' : 'Section B' },
                ].map(s => {
                  const selected = section === s.key;
                  return (
                    <TouchableOpacity
                      key={s.key}
                      style={[styles.yearPill, selected && styles.yearPillActive]}
                      onPress={() => setSection(s.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.yearPillText, selected && styles.yearPillTextActive]}>{s.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, (!course || !year) && styles.primaryBtnDisabled]}
            onPress={handlePickerNext}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Continue →</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step: Interests ────────────────────────────────────────────────────────
  if (step === 'interests') {
    const toggleInterest = (i) =>
      setSelectedInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.stepHeader}>
            <TouchableOpacity onPress={() => setStep('picker')} activeOpacity={0.7}>
              <Text style={styles.backBtn}>← Back</Text>
            </TouchableOpacity>
            <View style={styles.stepDots}>
              <View style={[styles.dot, styles.dotDone]} />
              <View style={[styles.dot, styles.dotDone]} />
              <View style={[styles.dot, styles.dotActive]} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </View>

          <Text style={styles.heading}>What are you into?</Text>
          <Text style={styles.subheading}>
            Pick your interests so others can find and connect with you. You can always edit these later.
          </Text>

          <View style={styles.interestGrid}>
            {INTERESTS.map(interest => {
              const sel = selectedInterests.includes(interest);
              return (
                <TouchableOpacity
                  key={interest}
                  style={[styles.interestChip, sel && styles.interestChipActive]}
                  onPress={() => toggleInterest(interest)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.interestChipText, sel && styles.interestChipTextActive]}>{interest}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.hint}>
            {selectedInterests.length > 0 ? `${selectedInterests.length} selected` : 'Skip if you prefer — add them anytime from your profile'}
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleInterestsNext} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Continue →</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step: Bio ─────────────────────────────────────────────────────────────
  if (step === 'bio') {
    const bioLen = bio.trim().length;
    const bioValid = bioLen >= 20;
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.stepHeader}>
              <TouchableOpacity onPress={() => setStep('interests')} activeOpacity={0.7}>
                <Text style={styles.backBtn}>← Back</Text>
              </TouchableOpacity>
              <View style={styles.stepDots}>
                <View style={[styles.dot, styles.dotDone]} />
                <View style={[styles.dot, styles.dotDone]} />
                <View style={[styles.dot, styles.dotDone]} />
                <View style={[styles.dot, styles.dotActive]} />
                <View style={styles.dot} />
              </View>
            </View>

            <Text style={styles.heading}>Tell us about yourself</Text>
            <Text style={styles.subheading}>
              A short bio helps other students find and connect with you. You can always edit it later.
            </Text>

            <Text style={styles.label}>ABOUT YOU</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="e.g. 3rd year IAF student, interested in finance and technology"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: spacing.sm }]}
              multiline
              maxLength={300}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -spacing.sm, marginBottom: spacing.xl }}>
              <Text style={{ fontSize: 11, color: bioValid ? colors.primary : colors.textTertiary }}>
                {bioValid ? '✓ Looks good!' : `${20 - bioLen} more character${20 - bioLen === 1 ? '' : 's'} needed`}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary }}>{bioLen}/300</Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, !bioValid && styles.primaryBtnDisabled]}
              onPress={handleBioNext}
              disabled={!bioValid}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Continue →</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Step: All Set ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.allsetContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkIcon}>✓</Text>
        </View>

        <Text style={styles.allsetTitle}>You're all set, {name.split(' ')[0]}!</Text>
        <Text style={styles.allsetSub}>
          Welcome to ChristConnect — your space to find classmates, join study groups, discover clubs, and connect with teachers.
        </Text>

        <View style={styles.detailsCard}>
          {[
            { label: 'Course', value: course },
            { label: 'Year', value: year },
            { label: 'Campus', value: 'Yeshwanthpur' },
          ].map((row, i, arr) => (
            <View key={row.label} style={[styles.detailRow, i < arr.length - 1 && styles.detailRowBorder]}>
              <Text style={styles.detailLabel}>{row.label}</Text>
              <Text style={styles.detailValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Compliance checkboxes */}
        <View style={styles.consentChecks}>
          <View style={styles.consentCheck}>
            <TouchableOpacity onPress={() => setAgreedTerms(v => !v)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.consentCheckTick}>{agreedTerms ? '☑' : '☐'}</Text>
            </TouchableOpacity>
            <Text style={styles.consentCheckText}>
              I agree to the{' '}
              <Text style={styles.consentCheckLink} onPress={() => setLegalModal('terms')}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.consentCheckLink} onPress={() => setLegalModal('privacy')}>Privacy Policy</Text>
            </Text>
          </View>

          <View style={[styles.consentCheck, { marginTop: spacing.sm }]}>
            <TouchableOpacity onPress={() => setAgreedAge(v => !v)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.consentCheckTick}>{agreedAge ? '☑' : '☐'}</Text>
            </TouchableOpacity>
            <Text style={styles.consentCheckText}>
              I confirm I am 18 years of age or older, or have obtained parental consent.
            </Text>
          </View>
        </View>

        {signUpError ? (
          <Text style={[styles.errorText, { textAlign: 'center', marginBottom: 12 }]}>{signUpError}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, { width: '100%' }, (loading || !agreedTerms || !agreedAge) && { opacity: 0.45 }]}
          onPress={handleCreateAccount}
          disabled={loading || !agreedTerms || !agreedAge}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>Create Account →</Text>
          }
        </TouchableOpacity>
      </ScrollView>

      {/* Legal content viewer */}
      <Modal visible={!!legalModal} animationType="slide" onRequestClose={() => setLegalModal(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <TouchableOpacity onPress={() => setLegalModal(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 22, color: colors.textSecondary }}>✕</Text>
            </TouchableOpacity>
          </View>
          <LegalScreen route={{ params: { type: legalModal } }} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );

}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },

  container: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    flexGrow: 1,
  },

  logoRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  logoBox: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  logoIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
  logoText: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },

  heading: { fontSize: 26, ...font.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  subheading: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.xl },

  label: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold, marginBottom: spacing.sm,
  },

  input: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary, fontSize: 15,
    marginBottom: spacing.md,
  },
  showPasswordRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: spacing.md,
  },
  showPasswordTick: { fontSize: 15, color: colors.primary, marginRight: 6 },
  showPasswordText: { fontSize: 13, color: colors.primary },

  hint: { fontSize: 11, color: colors.textTertiary, marginBottom: spacing.xl, marginTop: -spacing.xs },
  consentNote: {
    fontSize: 11, color: colors.textTertiary, lineHeight: 16,
    textAlign: 'center', marginTop: spacing.sm,
  },
  errorText: { fontSize: 13, color: '#EF4444', marginBottom: spacing.sm, marginTop: -spacing.xs },
  forgotLink: { fontSize: 13, color: colors.primary, ...font.medium },
  forgotBox: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  forgotLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 18 },
  forgotSuccess: { fontSize: 13, color: colors.green, lineHeight: 18 },

  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: '#fff', fontSize: 16, ...font.bold },

  switchRow: { marginTop: spacing.lg, alignItems: 'center' },
  switchText: { fontSize: 13, color: colors.textSecondary },
  switchLink: { color: colors.primary, ...font.semibold },

  stepHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.xl,
  },
  backBtn: { fontSize: 14, color: colors.textSecondary, ...font.medium },
  stepDots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotDone: { backgroundColor: colors.green },
  dotActive: { backgroundColor: colors.primary, width: 20, borderRadius: 4 },

  courseCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  courseStripe: { width: 4, alignSelf: 'stretch' },
  courseBody: { flex: 1, padding: spacing.md },
  courseKey: { fontSize: 15, ...font.bold, color: colors.textPrimary, marginBottom: 2 },
  courseFull: { fontSize: 12, color: colors.textSecondary },
  courseSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  courseCheck: { fontSize: 20, ...font.bold, marginRight: spacing.md },

  yearRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  yearPill: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 18, paddingVertical: 10,
    backgroundColor: colors.card,
  },
  yearPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  yearPillText: { fontSize: 13, color: colors.textSecondary, ...font.medium },
  yearPillTextActive: { color: '#fff', ...font.semibold },

  campusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  campusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, backgroundColor: colors.card,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    minWidth: '47%', flexGrow: 1,
  },
  campusPillActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  campusPillIcon: { fontSize: 14 },
  campusPillText: { fontSize: 13, color: colors.textSecondary, ...font.medium, flex: 1 },
  campusPillTextActive: { color: colors.primary, ...font.semibold },
  campusCheck: { fontSize: 12, color: colors.primary, ...font.bold },

  allsetContainer: { flexGrow: 1, padding: spacing.xl, paddingTop: spacing.xxl, justifyContent: 'center', alignItems: 'center' },

  consentChecks: { width: '100%', marginBottom: spacing.md, marginTop: spacing.sm },
  consentCheck: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  consentCheckTick: { fontSize: 18, color: colors.primary, lineHeight: 22 },
  consentCheckText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  consentCheckLink: { color: colors.primary, fontWeight: '600' },
  checkCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: colors.greenLight,
    borderWidth: 2, borderColor: colors.green,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  checkIcon: { fontSize: 42, color: colors.green },
  allsetTitle: { fontSize: 24, ...font.bold, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  allsetSub: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, textAlign: 'center', marginBottom: spacing.xl },

  detailsCard: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: '100%', marginBottom: spacing.lg,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { fontSize: 13, color: colors.textSecondary },
  detailValue: { fontSize: 13, ...font.semibold, color: colors.textPrimary },

  rememberRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  rememberLabel: { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  rememberSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  altLoginRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.xl, gap: spacing.md,
  },
  altLoginBtn: { paddingVertical: spacing.sm },
  altLoginText: { fontSize: 12, color: colors.textTertiary, ...font.medium },
  altLoginDivider: { width: 1, height: 16, backgroundColor: colors.border },

  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.sm },
  interestChip: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: colors.card,
  },
  interestChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  interestChipText: { fontSize: 13, color: colors.textSecondary, ...font.medium },
  interestChipTextActive: { color: colors.primary, ...font.semibold },

  roleCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  roleCardEmoji: { fontSize: 28 },
  roleCardTitle: { fontSize: 16, ...font.bold, color: colors.textPrimary, marginBottom: 2 },
  roleCardSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: spacing.xxl,
    borderWidth: 1, borderColor: colors.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: 18, ...font.bold, color: colors.textPrimary },
  modalClose: { fontSize: 22, color: colors.textSecondary, padding: 4 },

  subjectRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  subjectRowActive: { borderColor: colors.amber, backgroundColor: colors.amberLight },
  subjectName: { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  subjectMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  subjectEmptyBox: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.lg,
    marginBottom: spacing.md,
  },
});

// ── Sign-in step styles (uses tokens from src/theme/tokens.js) ────────────────
const siStyles = StyleSheet.create({
  container: {
    paddingHorizontal: tSpacing.base,
    paddingTop: tSpacing.xxxl,
    paddingBottom: tSpacing.xxxl,
    flexGrow: 1,
  },
  title: {
    fontSize: typography.xxxl,
    fontWeight: typography.bold,
    color: tColors.student.primary,
    marginBottom: tSpacing.xs,
  },
  subtitle: {
    fontSize: typography.base,
    color: tColors.textSecondary,
    marginBottom: tSpacing.xl,
  },
  roleRow: {
    flexDirection: 'row',
    gap: tSpacing.md,
    marginBottom: tSpacing.xl,
  },
  roleCard: {
    flex: 1,
    backgroundColor: tColors.card,
    borderWidth: 1.5,
    borderColor: tColors.border,
    borderRadius: tRadius.lg,
    padding: tSpacing.base,
    alignItems: 'center',
    ...shadows.card,
  },
  roleIcon: { fontSize: 28, marginBottom: tSpacing.xs },
  roleAccessLabel: {
    fontSize: typography.xs,
    color: tColors.textSecondary,
    fontWeight: typography.semibold,
    letterSpacing: 1,
    marginBottom: 2,
  },
  roleName: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    color: tColors.textPrimary,
  },
  formCard: {
    ...presets.card,
    padding: tSpacing.base,
    marginBottom: tSpacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tColors.cardAlt,
    borderWidth: 1,
    borderColor: tColors.border,
    borderRadius: tRadius.md,
    paddingHorizontal: tSpacing.md,
    marginBottom: tSpacing.md,
  },
  inputIcon: {
    fontSize: 15,
    color: tColors.textSecondary,
    marginRight: tSpacing.sm,
  },
  input: {
    flex: 1,
    color: tColors.textPrimary,
    fontSize: typography.base,
    paddingVertical: tSpacing.md,
  },
  standaloneInput: {
    backgroundColor: tColors.cardAlt,
    borderWidth: 1,
    borderColor: tColors.border,
    borderRadius: tRadius.md,
    paddingHorizontal: tSpacing.md,
    paddingVertical: tSpacing.md,
    color: tColors.textPrimary,
    fontSize: typography.base,
    marginBottom: tSpacing.md,
  },
  forgotLink: {
    fontSize: typography.sm,
    color: tColors.textSecondary,
    fontWeight: typography.medium,
  },
  forgotBox: {
    marginTop: tSpacing.md,
    padding: tSpacing.md,
    backgroundColor: tColors.bg,
    borderWidth: 1,
    borderColor: tColors.border,
    borderRadius: tRadius.md,
  },
  forgotLabel: {
    fontSize: typography.sm,
    color: tColors.textSecondary,
    marginBottom: tSpacing.md,
    lineHeight: 18,
  },
  forgotSuccess: {
    fontSize: typography.sm,
    color: tColors.success,
    lineHeight: 18,
  },
  errorText: {
    fontSize: typography.sm,
    color: tColors.error,
    marginBottom: tSpacing.sm,
    marginTop: tSpacing.xs,
  },
  primaryBtn: {
    borderRadius: tRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: tSpacing.base,
    width: '100%',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: tSpacing.xl,
    marginBottom: tSpacing.base,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: tColors.border,
  },
  dividerText: {
    fontSize: typography.xs,
    color: tColors.textTertiary,
    marginHorizontal: tSpacing.md,
    fontWeight: typography.medium,
    letterSpacing: 0.5,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tColors.border,
    borderRadius: tRadius.md,
    paddingVertical: 14,
    gap: tSpacing.sm,
    marginBottom: tSpacing.xl,
  },
  googleBtnIcon: {
    fontSize: 16,
    fontWeight: typography.bold,
    color: tColors.textPrimary,
  },
  googleBtnText: {
    fontSize: typography.base,
    color: tColors.textPrimary,
    fontWeight: typography.medium,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: tSpacing.sm,
    marginBottom: tSpacing.base,
  },
  footerLink: {
    fontSize: typography.xs,
    color: tColors.textTertiary,
  },
  footerSep: {
    fontSize: typography.xs,
    color: tColors.textTertiary,
  },
});
