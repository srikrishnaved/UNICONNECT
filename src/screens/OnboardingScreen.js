import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator, Modal, Linking,
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
import { Sparkles, GraduationCap, UserCheck, CheckSquare, Square, Check, School, Mail, Lock, EyeOff, Eye, X, Layers, User, BookOpen } from 'lucide-react-native';
import { teachers as SEED_TEACHERS } from '../data/index';
import LegalScreen from './LegalScreen';
import { APP_CONFIG, isEmailDomainValid } from '../config/appConfig';

const COURSES = APP_CONFIG.courses;

const YEARS = APP_CONFIG.years;

export const INTERESTS = APP_CONFIG.interests;

const splitAppName = (appName) => {
  const match = appName.match(/^([A-Z][a-z]+)([A-Z].*)$/);
  return match ? [match[1], match[2]] : [appName, ''];
};

export default function OnboardingScreen() {
  const { signUp, signIn, sendPasswordReset, registerTeacher } = useApp();
  const [logoFirst, logoSecond] = splitAppName(APP_CONFIG.appName);

  const [step, setStep] = useState('signin');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('student');
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  const activeAccentColor = selectedRole === 'faculty'
    ? tColors.faculty.primary
    : tColors.student.primary;

  useEffect(() => {
    if (Platform.OS !== 'web' || step !== 'signin') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Resize handler
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Mouse tracking
    const handleMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Helper to resolve CSS variables like var(--color, fallback) for Canvas compatibility
    const parseCanvasColor = (col) => {
      if (typeof col !== 'string') return '#c9622e';
      if (col.startsWith('var(')) {
        const parts = col.split(',');
        if (parts.length > 1) {
          return parts[1].replace(')', '').trim();
        }
      }
      return col;
    };

    // Create blobs
    const colorsList = [
      parseCanvasColor(activeAccentColor),
      '#6366f1', // Indigo
      '#d97706', // Amber
      '#06b6d4', // Cyan
      '#8b5cf6', // Purple
    ];

    const blobs = Array.from({ length: 6 }).map((_, i) => {
      const radius = 130 + Math.random() * 120;
      return {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: 0,
        vy: 0,
        baseVx: (Math.random() - 0.5) * 0.7,
        baseVy: (Math.random() - 0.5) * 0.7,
        radius,
        color: colorsList[i % colorsList.length],
      };
    });

    // Animation Loop
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      blobs.forEach(blob => {
        // Mouse repulsion force
        if (mx > -500 && my > -500) {
          const dx = blob.x - mx;
          const dy = blob.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 320) {
            const force = (320 - dist) / 320 * 0.55;
            blob.vx += (dx / dist) * force;
            blob.vy += (dy / dist) * force;
          }
        }

        // Damping and constant movement
        blob.vx *= 0.95;
        blob.vy *= 0.95;
        blob.x += blob.vx + blob.baseVx;
        blob.y += blob.vy + blob.baseVy;

        // Boundary collision (bounce)
        if (blob.x - blob.radius < 0) {
          blob.x = blob.radius;
          blob.baseVx *= -1;
        } else if (blob.x + blob.radius > canvas.width) {
          blob.x = canvas.width - blob.radius;
          blob.baseVx *= -1;
        }

        if (blob.y - blob.radius < 0) {
          blob.y = blob.radius;
          blob.baseVy *= -1;
        } else if (blob.y + blob.radius > canvas.height) {
          blob.y = canvas.height - blob.radius;
          blob.baseVy *= -1;
        }

        // Draw radial gradient for liquid look
        const grad = ctx.createRadialGradient(
          blob.x, blob.y, 0,
          blob.x, blob.y, blob.radius
        );
        grad.addColorStop(0, blob.color);
        grad.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeAccentColor, step]);

  // 'roleSelect' | 'signup' | 'signin' | 'picker' | 'interests' | 'allset' | 'teacherSignup' | 'teacherIdentity' | 'teacherSubjects'

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

  // Forgot password
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  const [forgotError, setForgotError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleRegisterUniversityPress = () => {
    const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
    const url = isDev ? 'http://localhost:5173' : 'https://uni-registration.vercel.app';
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {
        Alert.alert('Workspace Onboarding', `Visit the university registration portal at ${url} on your desktop browser.`);
      });
    }
  };

  // University setup request fields
  const [uniName, setUniName] = useState('');
  const [uniWebsite, setUniWebsite] = useState('');
  const [uniAdminName, setUniAdminName] = useState('');
  const [uniAdminEmail, setUniAdminEmail] = useState('');
  const [uniAdminPassword, setUniAdminPassword] = useState('');
  const [showUniPassword, setShowUniPassword] = useState(false);
  const [uniRequestError, setUniRequestError] = useState('');
  const [uniRequestSuccess, setUniRequestSuccess] = useState(false);

  const handleUniRequestSubmit = async () => {
    if (!uniName.trim() || !uniWebsite.trim() || !uniAdminName.trim() || !uniAdminEmail.trim() || !uniAdminPassword.trim()) {
      setUniRequestError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setUniRequestError('');
    try {
      const { data, error } = await supabase.auth.signUp({
        email: uniAdminEmail.trim().toLowerCase(),
        password: uniAdminPassword.trim(),
      });
      if (error) throw error;
      const userId = data.user?.id;
      if (!userId) throw new Error('Account creation failed.');

      const profile = {
        id: userId,
        name: uniAdminName.trim(),
        email: uniAdminEmail.trim().toLowerCase(),
        role: 'student',
        status: 'pending_setup_approval',
        course: 'Setup',
        year: 'N/A',
        campus: 'Main',
        bio: '',
        interests: [],
        university_id: null,
      };
      const { error: profileError } = await supabase.from('profiles').insert(profile);
      if (profileError && profileError.code !== '23505') throw profileError;

      const { error: reqError } = await supabase.from('university_setup_requests').insert({
        user_id: userId,
        university_name: uniName.trim(),
        university_website: uniWebsite.trim().toLowerCase(),
        admin_name: uniAdminName.trim(),
        admin_email: uniAdminEmail.trim().toLowerCase(),
        status: 'pending',
      });
      if (reqError) throw reqError;

      setUniRequestSuccess(true);
    } catch (err) {
      setUniRequestError(err.message || 'Could not submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
    // TEMPORARY: uniconnect.test allowed for QA — revert before production
    const validDomain = isEmailDomainValid(teacherEmail);
    if (!teacherEmail.trim() || !validDomain) {
      setTeacherSignUpError('Please enter a valid email address.');
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
    // TEMPORARY: uniconnect.test allowed for QA — revert before production
    const validDomain = isEmailDomainValid(email);
    if (!email.trim() || !validDomain) {
      setSignUpError('Please enter a valid email address.');
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
            <View style={styles.logoBox}><Sparkles size={18} color="#fff" /></View>
            <Text style={styles.logoText}>{logoFirst}<Text style={{ color: colors.primary }}>{logoSecond}</Text></Text>
          </View>

          <Text style={styles.heading}>Welcome</Text>
          <Text style={styles.subheading}>Who are you? Choose your role to get started.</Text>

          <TouchableOpacity
            style={[styles.roleCard, { borderColor: colors.primary }]}
            onPress={() => setStep('signup')}
            activeOpacity={0.85}
          >
            <GraduationCap size={32} color={colors.accent} />
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
            <UserCheck size={32} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.roleCardTitle, { color: colors.amber }]}>I am a Teacher</Text>
              <Text style={styles.roleCardSub}>Register as faculty — pending admin approval</Text>
            </View>
            <Text style={{ fontSize: 18, color: colors.textTertiary }}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleCard, { borderColor: colors.green, marginTop: spacing.sm }]}
            onPress={handleRegisterUniversityPress}
            activeOpacity={0.85}
          >
            <School size={32} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.roleCardTitle, { color: colors.green }]}>Register University</Text>
              <Text style={styles.roleCardSub}>Request a new workspace for your institution</Text>
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

  // ── Step: University Registration Request ────────────────────────────────
  if (step === 'uniRequest') {
    if (uniRequestSuccess) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.allsetContainer}>
              <View style={styles.checkCircle}>
                <Check size={42} style={styles.checkIcon} />
              </View>
              <Text style={styles.allsetTitle}>Request Submitted!</Text>
              <Text style={styles.allsetSub}>
                Your workspace request for "{uniName}" has been received. Once the application is approved by the system administrators, you will be able to log in to complete your setup.
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, { width: '100%' }]}
                onPress={() => {
                  setUniRequestSuccess(false);
                  setUniName('');
                  setUniWebsite('');
                  setUniAdminName('');
                  setUniAdminEmail('');
                  setUniAdminPassword('');
                  setStep('signin');
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

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
              <View style={[styles.logoBox, { backgroundColor: colors.green }]}>
                <School size={18} color="#fff" />
              </View>
              <Text style={styles.logoText}>Workspace <Text style={{ color: colors.green }}>Setup</Text></Text>
            </View>

            <Text style={styles.heading}>Register your University</Text>
            <Text style={styles.subheading}>
              Fill in the details below to request a new isolated workspace for your institution.
            </Text>

            <Text style={styles.label}>UNIVERSITY NAME *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Oxford University"
              placeholderTextColor={colors.textTertiary}
              value={uniName}
              onChangeText={setUniName}
              autoCapitalize="words"
            />

            <Text style={styles.label}>WEBSITE SUBDOMAIN / DOMAIN *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. oxford.uniconnect.app"
              placeholderTextColor={colors.textTertiary}
              value={uniWebsite}
              onChangeText={setUniWebsite}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>ADMIN FULL NAME *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. John Doe"
              placeholderTextColor={colors.textTertiary}
              value={uniAdminName}
              onChangeText={setUniAdminName}
              autoCapitalize="words"
            />

            <Text style={styles.label}>ADMIN EMAIL ADDRESS *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. admin@oxford.edu"
              placeholderTextColor={colors.textTertiary}
              value={uniAdminEmail}
              onChangeText={setUniAdminEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />

            <Text style={styles.label}>ADMIN PASSWORD *</Text>
            <TextInput
              style={styles.input}
              placeholder="Min. 6 characters"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={!showUniPassword}
              value={uniAdminPassword}
              onChangeText={setUniAdminPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              onPress={() => setShowUniPassword(prev => !prev)}
              style={styles.showPasswordRow}
              activeOpacity={0.7}
            >
              <Text style={styles.showPasswordTick}>{showUniPassword ? '✓' : '☐'}</Text>
              <Text style={styles.showPasswordText}>Show Password</Text>
            </TouchableOpacity>

            {uniRequestError ? (
              <Text style={styles.errorText}>{uniRequestError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.green }, loading && styles.primaryBtnDisabled]}
              onPress={handleUniRequestSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Submit Request</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
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
              <View style={[styles.logoBox, { backgroundColor: colors.amber }]}><Sparkles size={18} color="#fff" /></View>
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
              placeholder="yourname@email.com"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>Please enter a valid email address.</Text>

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
              {showTeacherPassword ? <CheckSquare size={18} color={colors.accent} /> : <Square size={18} color={colors.textSecondary} />}
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
              Your account will be reviewed by the department administrator before you can access {APP_CONFIG.appName}.
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
                <Sparkles size={18} color="#fff" />
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
                  {sel && <Check size={18} color={colors.amber} />}
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
              {!selectedSeedTeacher && <Check size={18} color={colors.amber} />}
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
                <Sparkles size={18} color="#fff" />
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
                    {sel && <Check size={18} color={colors.amber} />}
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
      <View style={{ flex: 1, backgroundColor: '#06050b', position: 'relative' }}>
        {Platform.OS === 'web' && (
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              filter: 'blur(85px)',
              opacity: 0.35,
              pointerEvents: 'none',
            }}
          />
        )}
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={siStyles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo and Title */}
            <View style={siStyles.headerContainer}>
              <View style={[siStyles.logoMark, { backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: 'rgba(255, 255, 255, 0.08)', borderWidth: 1 }]}>
                <Layers size={22} color={accentColor} />
              </View>
              <Text style={siStyles.title}>UniConnect</Text>
              <Text style={siStyles.subtitle}>Sign in to your university workspace</Text>
            </View>

            {/* Role selector Segment Control */}
            <View style={siStyles.roleRow}>
              <TouchableOpacity
                style={[
                  siStyles.roleCard,
                  selectedRole === 'student' && { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.12)' }
                ]}
                onPress={() => setSelectedRole('student')}
                activeOpacity={0.8}
              >
                <User size={14} color={selectedRole === 'student' ? accentColor : 'rgba(255, 255, 255, 0.5)'} />
                <Text style={[
                  siStyles.roleName,
                  selectedRole === 'student' ? { color: '#ffffff', fontWeight: '600' } : { color: 'rgba(255, 255, 255, 0.5)' }
                ]}>Student Portal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  siStyles.roleCard,
                  selectedRole === 'faculty' && { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.12)' }
                ]}
                onPress={() => setSelectedRole('faculty')}
                activeOpacity={0.8}
              >
                <BookOpen size={14} color={selectedRole === 'faculty' ? accentColor : 'rgba(255, 255, 255, 0.5)'} />
                <Text style={[
                  siStyles.roleName,
                  selectedRole === 'faculty' ? { color: '#ffffff', fontWeight: '600' } : { color: 'rgba(255, 255, 255, 0.5)' }
                ]}>Faculty Portal</Text>
              </TouchableOpacity>
            </View>

            {/* Form container */}
            <View style={siStyles.formCard}>
              {/* Email input */}
              <View style={[
                siStyles.inputRow,
                focusedField === 'email' && { borderColor: accentColor }
              ]}>
                <Mail size={16} color={focusedField === 'email' ? accentColor : 'rgba(255, 255, 255, 0.4)'} />
                <TextInput
                  value={signInEmail}
                  onChangeText={v => { setSignInEmail(v); setSignInError(''); }}
                  placeholder="yourname@email.com"
                  placeholderTextColor="rgba(255, 255, 255, 0.35)"
                  style={siStyles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              {/* Password input */}
              <View style={[
                siStyles.inputRow,
                { marginBottom: 0 },
                focusedField === 'password' && { borderColor: accentColor }
              ]}>
                <Lock size={16} color={focusedField === 'password' ? accentColor : 'rgba(255, 255, 255, 0.4)'} />
                <TextInput
                  key={showSignInPassword ? 'si-visible' : 'si-hidden'}
                  value={signInPassword}
                  onChangeText={v => { setSignInPassword(v); setSignInError(''); }}
                  placeholder="Your password"
                  placeholderTextColor="rgba(255, 255, 255, 0.35)"
                  style={[siStyles.input, { flex: 1 }]}
                  secureTextEntry={!showSignInPassword}
                  autoCapitalize="none"
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowSignInPassword(v => !v)}
                  activeOpacity={0.7}
                  style={{ paddingHorizontal: tSpacing.xs }}
                >
                  {showSignInPassword ? <EyeOff size={16} color="rgba(255, 255, 255, 0.4)" /> : <Eye size={16} color="rgba(255, 255, 255, 0.4)" />}
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
                      Reset link sent — check your inbox and click the link to set a new password.
                    </Text>
                  ) : (
                    <>
                      <Text style={siStyles.forgotLabel}>Enter your email address and we'll send a reset link.</Text>
                      <TextInput
                        value={forgotEmail}
                        onChangeText={v => { setForgotEmail(v); setForgotError(''); }}
                        placeholder="yourname@email.com"
                        placeholderTextColor="rgba(255, 255, 255, 0.3)"
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

            {/* Subtle Divider */}
            <View style={siStyles.dividerRow}>
              <View style={siStyles.dividerLine} />
              <Text style={siStyles.dividerText}>or</Text>
              <View style={siStyles.dividerLine} />
            </View>

            {/* Switch Account options */}
            <TouchableOpacity onPress={() => setStep('roleSelect')} activeOpacity={0.7} style={styles.switchRow}>
              <Text style={[styles.switchLink, { color: 'rgba(255, 255, 255, 0.6)' }]}>Create an account</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleRegisterUniversityPress} 
              activeOpacity={0.7} 
              style={[styles.switchRow, { marginTop: 10, marginBottom: tSpacing.xl }]}
            >
              <Text style={[styles.switchLink, { color: accentColor }]}>Register a New University Workspace</Text>
            </TouchableOpacity>

            {/* Footer links */}
            <View style={siStyles.footerRow}>
              <TouchableOpacity onPress={() => setLegalModal('privacy')} activeOpacity={0.7}>
                <Text style={siStyles.footerLink}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={siStyles.footerSep}>·</Text>
              <TouchableOpacity onPress={() => setLegalModal('security')} activeOpacity={0.7}>
                <Text style={siStyles.footerLink}>Security</Text>
              </TouchableOpacity>
              <Text style={siStyles.footerSep}>·</Text>
              <TouchableOpacity onPress={() => setLegalModal('support')} activeOpacity={0.7}>
                <Text style={siStyles.footerLink}>Support</Text>
              </TouchableOpacity>
            </View>

            {/* Legal content viewer */}
            <Modal visible={!!legalModal} animationType="slide" onRequestClose={() => setLegalModal(null)}>
              <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
                  <TouchableOpacity onPress={() => setLegalModal(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <LegalScreen route={{ params: { type: legalModal } }} />
              </SafeAreaView>
            </Modal>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
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
              <View style={styles.logoBox}><Sparkles size={18} color="#fff" /></View>
              <Text style={styles.logoText}>{logoFirst}<Text style={{ color: colors.primary }}>{logoSecond}</Text></Text>
            </View>

            <Text style={styles.heading}>Let's get you set up</Text>
            <Text style={styles.subheading}>Sign up with your {APP_CONFIG.legalName || 'university'} email.</Text>

            <Text style={styles.label}>YOUR NAME</Text>
            <TextInput
              value={name}
              onChangeText={v => { setName(v); setSignUpError(''); }}
              placeholder="e.g. Aanya Sharma"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              autoCapitalize="words"
            />

            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <TextInput
              value={email}
              onChangeText={v => { setEmail(v); setSignUpError(''); }}
              placeholder="yourname@email.com"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>Please enter a valid email address.</Text>

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
              {showPassword ? <CheckSquare size={18} color={colors.accent} /> : <Square size={18} color={colors.textSecondary} />}
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
                {selected && <Check size={14} color={c.color} />}
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
    const bioValid = bioLen <= 300;
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
              <Text style={{ fontSize: 11, color: colors.primary }}>
                {bioLen > 0 ? '✓ Looks good!' : ''}
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
          <Check size={16} color={colors.success} />
        </View>

        <Text style={styles.allsetTitle}>You're all set, {name.split(' ')[0]}!</Text>
        <Text style={styles.allsetSub}>
          Welcome to {APP_CONFIG.appName} — your space to find classmates, join study groups, discover clubs, and connect with teachers.
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
              {agreedTerms ? <CheckSquare size={18} color={colors.accent} /> : <Square size={18} color={colors.textSecondary} />}
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
              {agreedAge ? <CheckSquare size={18} color={colors.accent} /> : <Square size={18} color={colors.textSecondary} />}
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
              <X size={22} color={colors.textSecondary} />
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
  errorText: { fontSize: 13, color: tColors.error, marginBottom: spacing.sm, marginTop: -spacing.xs },
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
    paddingTop: 60,
    paddingBottom: tSpacing.xxxl,
    flexGrow: 1,
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoMarkText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  title: {
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : undefined,
    fontSize: 32,
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: -0.8,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : undefined,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.45)',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  roleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 20,
  },
  roleCard: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleName: {
    fontSize: typography.sm,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  formCard: {
    backgroundColor: Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.04)' : '#121118',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 16,
    padding: tSpacing.lg,
    marginBottom: tSpacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
      }
    })
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    paddingHorizontal: tSpacing.md,
    marginBottom: tSpacing.md,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: typography.base,
    paddingVertical: 14,
    paddingLeft: 10,
  },
  standaloneInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    paddingHorizontal: tSpacing.md,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: typography.base,
    marginBottom: tSpacing.md,
  },
  forgotLink: {
    fontSize: typography.sm,
    color: 'rgba(255, 255, 255, 0.45)',
    textDecorationLine: 'underline',
  },
  forgotBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    padding: tSpacing.md,
    marginTop: tSpacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  forgotLabel: {
    fontSize: typography.sm,
    color: 'rgba(255, 255, 255, 0.55)',
    marginBottom: tSpacing.sm,
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
    textAlign: 'center',
  },
  primaryBtn: {
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tSpacing.sm,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: typography.base,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  dividerText: {
    fontSize: typography.xs,
    color: 'rgba(255, 255, 255, 0.35)',
    paddingHorizontal: 12,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: tSpacing.sm,
    marginTop: 24,
    marginBottom: tSpacing.base,
  },
  footerLink: {
    fontSize: typography.xs,
    color: 'rgba(255, 255, 255, 0.45)',
  },
  footerSep: {
    fontSize: typography.xs,
    color: 'rgba(255, 255, 255, 0.45)',
  },
  // Liquid background shapes
  bgWrapper: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
    zIndex: -1,
  },
  bgBlob: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    opacity: 0.22,
    filter: 'blur(90px)',
  },
  bgBlob1: {
    top: '10%',
    left: '5%',
  },
  bgBlob2: {
    bottom: '15%',
    right: '10%',
  },
  bgBlob3: {
    top: '40%',
    left: '40%',
  },
});
