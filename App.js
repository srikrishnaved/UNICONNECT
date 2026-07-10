import React, { useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Sparkles, Clock } from 'lucide-react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import AppNavigator from './src/navigation/AppNavigator';
import ProfileScreen from './src/screens/ProfileScreen';
import MyProfileScreen from './src/screens/MyProfileScreen';
import GroupDetailScreen from './src/screens/GroupDetailScreen';
import ClubDetailScreen from './src/screens/ClubDetailScreen';
import TeamDetailScreen from './src/screens/TeamDetailScreen';
import TeamDashboardScreen from './src/screens/TeamDashboardScreen';
import ClubDashboardScreen from './src/screens/ClubDashboardScreen';
import AppAdminScreen from './src/screens/AppAdminScreen';
import SuperAdminScreen from './src/screens/SuperAdminScreen';
import DMScreen from './src/screens/DMScreen';
import SearchScreen from './src/screens/SearchScreen';
import LegalScreen from './src/screens/LegalScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from './src/screens/TermsOfServiceScreen';
import EventDetailScreen from './src/screens/EventDetailScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider, useApp } from './src/context/AppContext';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import TeacherDashboardScreen from './src/screens/TeacherDashboardScreen';
import { colors } from './src/theme';
import { colors as tColors } from './src/theme/tokens';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.card,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.primary,
  },
};

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: ['https://christconnect.expo.app', 'christconnect://'],
  config: {
    screens: {
      Main: {
        path: '',
        screens: {
          Discover:  '',
          Planner:   'planner',
          Hub:       'hub',
          Groups:    'groups',
          Mentors:   'mentors',
          Teachers:  'teachers',
        },
      },
      Profile:          'profile/:studentId',
      MyProfile:        'my-profile',
      GroupDetail:      'groups/:groupId',
      ClubDetail:       'clubs/:clubId',
      TeamDetail:       'teams/:clubId',
      TeamDashboard:    'team-dashboard/:clubId',
      ClubDashboard:    'club-dashboard/:clubId',
      AppAdmin:         'admin',
      SuperAdmin:       'super-admin',
      TeacherDashboard: 'teacher-dashboard',
      DM:               'dm/:personKey',
      Search:           'search',
      EventDetail:      'events',
      Legal:            'legal/:type',
      Privacy:          'privacy',
      Terms:            'terms',
    },
  },
};

function TeacherPendingView() {
  const { teacherSignOut, userProfile, checkTeacherApproval } = useApp();
  const [checking, setChecking] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  const handleCheck = async () => {
    setChecking(true);
    setMsg('');
    try {
      const status = await checkTeacherApproval();
      if (status === 'pending') setMsg('Still pending — please check back later.');
      if (status === 'rejected') setMsg('Your application was not approved.');
    } catch {
      setMsg('Could not check status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <StatusBar style="light" />
      <View style={{
        width: 88, height: 88, borderRadius: 44,
        backgroundColor: colors.amberLight,
        borderWidth: 2, borderColor: colors.amber,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 24,
      }}>
        <Clock size={38} color={colors.amber} />
      </View>
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 12 }}>
        Account Pending Approval
      </Text>
      {userProfile?.name ? (
        <Text style={{ fontSize: 14, color: colors.amber, fontWeight: '600', marginBottom: 8 }}>
          {userProfile.name}
        </Text>
      ) : null}
      <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32, maxWidth: 320 }}>
        Your teacher account registration has been received. The department administrator will review and approve your account.
      </Text>
      <TouchableOpacity
        onPress={handleCheck}
        disabled={checking}
        style={{
          backgroundColor: colors.primary,
          borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32,
          marginBottom: 12, opacity: checking ? 0.6 : 1,
        }}
        activeOpacity={0.8}
      >
        {checking
          ? <ActivityIndicator color="#fff" />
          : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Check Approval Status</Text>
        }
      </TouchableOpacity>
      {msg ? <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16, textAlign: 'center' }}>{msg}</Text> : null}
      <TouchableOpacity
        onPress={teacherSignOut}
        style={{
          backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
          borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32,
        }}
        activeOpacity={0.8}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '500' }}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function AppShell() {
  const { mode, setMode, teacherSignOut, requiresBio, saveBio } = useApp();
  const [bioDraft, setBioDraft] = useState('');
  const [bioSaving, setBioSaving] = useState(false);
  const [bioError, setBioError] = useState('');

  const handleSaveBio = async () => {
    const trimmed = bioDraft.trim();
    if (trimmed.length < 20) return;
    setBioSaving(true);
    setBioError('');
    try {
      await saveBio(trimmed);
    } catch (e) {
      setBioError(e.message || 'Could not save. Please try again.');
    } finally {
      setBioSaving(false);
    }
  };

  // Restore nav position after a theme-change reload
  const [initialNavState] = useState(() => {
    try {
      if (localStorage.getItem('cc_theme_reload') === '1') {
        localStorage.removeItem('cc_theme_reload');
        const saved = localStorage.getItem('cc_nav_state');
        if (saved) return JSON.parse(saved);
      }
    } catch {}
    return undefined;
  });

  const handleNavStateChange = (state) => {
    try {
      if (state) localStorage.setItem('cc_nav_state', JSON.stringify(state));
    } catch {}
  };

  if (mode === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <View style={{
          width: 52, height: 52, borderRadius: 16,
          backgroundColor: colors.primary,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={22} color="#fff" />
        </View>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      {mode === 'onboarding' && (
        <OnboardingScreen />
      )}
      {mode === 'resetPassword' && <ResetPasswordScreen />}
      {mode === 'teacherPending' && <TeacherPendingView />}
      {mode === 'teacher' && (
        <TeacherDashboardScreen onSignOut={teacherSignOut} />
      )}
      {mode === 'app' && (
        <NavigationContainer theme={navTheme} linking={linking} initialState={initialNavState} onStateChange={handleNavStateChange}>
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: colors.card },
              headerTintColor: colors.textPrimary,
              headerTitleStyle: { fontWeight: '600', fontSize: 15 },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="Main" component={AppNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
            <Stack.Screen name="MyProfile" component={MyProfileScreen} options={{ title: 'My Profile' }} />
            <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: 'Group' }} />
            <Stack.Screen name="ClubDetail" component={ClubDetailScreen} options={{ title: 'Club' }} />
            <Stack.Screen name="TeamDetail" component={TeamDetailScreen} options={{ title: 'Team' }} />
            <Stack.Screen name="TeamDashboard" component={TeamDashboardScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ClubDashboard" component={ClubDashboardScreen} options={{ title: 'Club Dashboard', headerShown: false }} />
            <Stack.Screen name="AppAdmin" component={AppAdminScreen} options={{ title: 'App Admin' }} />
            <Stack.Screen name="SuperAdmin" component={SuperAdminScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="TeacherDashboard"
              options={{ headerShown: false }}
            >
              {({ navigation }) => (
                <TeacherDashboardScreen onClose={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')} />
              )}
            </Stack.Screen>
            <Stack.Screen name="DM" component={DMScreen} options={{ title: '' }} />
            <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
            <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
            <Stack.Screen name="Legal" component={LegalScreen} options={({ route }) => ({
              title: route.params?.type === 'terms' ? 'Terms of Service' : 'Privacy Policy',
            })} />
            <Stack.Screen name="Privacy" component={PrivacyPolicyScreen} options={{ title: 'Privacy Policy' }} />
            <Stack.Screen name="Terms" component={TermsOfServiceScreen} options={{ title: 'Terms of Service' }} />
          </Stack.Navigator>
        </NavigationContainer>
      )}

      <Modal
        visible={mode === 'app' && !!requiresBio}
        transparent={false}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.bg }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 20,
              backgroundColor: colors.primary,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 20, alignSelf: 'center',
            }}>
              <Sparkles size={26} color="#fff" />
            </View>
            <Text style={{
              fontSize: 24, fontWeight: '700',
              color: colors.textPrimary,
              textAlign: 'center', marginBottom: 8,
            }}>
              Complete Your Profile
            </Text>
            <Text style={{
              fontSize: 14, color: colors.textSecondary,
              textAlign: 'center', lineHeight: 20,
              marginBottom: 28,
            }}>
              A short bio helps other students find and connect with you on ChristConnect.
            </Text>

            <Text style={{
              fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
              fontWeight: '700', marginBottom: 8,
            }}>
              ABOUT YOU
            </Text>
            <TextInput
              value={bioDraft}
              onChangeText={t => { setBioDraft(t); setBioError(''); }}
              placeholder="e.g. 3rd year IAF student, interested in finance and technology"
              placeholderTextColor={colors.textTertiary}
              style={{
                backgroundColor: colors.card,
                borderWidth: 1, borderColor: colors.border,
                borderRadius: 12,
                padding: 14,
                color: colors.textPrimary, fontSize: 15,
                height: 110, textAlignVertical: 'top',
                marginBottom: 8,
              }}
              multiline
              maxLength={300}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ fontSize: 11, color: bioDraft.trim().length >= 20 ? colors.primary : colors.textTertiary }}>
                {bioDraft.trim().length >= 20
                  ? '✓ Looks good!'
                  : `${20 - bioDraft.trim().length} more character${20 - bioDraft.trim().length === 1 ? '' : 's'} needed`}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary }}>{bioDraft.trim().length}/300</Text>
            </View>

            {bioError ? (
              <Text style={{ fontSize: 13, color: tColors.error, textAlign: 'center', marginBottom: 12 }}>
                {bioError}
              </Text>
            ) : null}

            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                borderRadius: 12, paddingVertical: 15,
                alignItems: 'center',
                opacity: (bioSaving || bioDraft.trim().length < 20) ? 0.45 : 1,
              }}
              onPress={handleSaveBio}
              disabled={bioSaving || bioDraft.trim().length < 20}
              activeOpacity={0.85}
            >
              {bioSaving
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Save & Continue →</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'Fraunces': Fraunces_700Bold,
    'Fraunces-SemiBold': Fraunces_600SemiBold,
    'IBMPlexMono': IBMPlexMono_400Regular,
    'IBMPlexMono-Medium': IBMPlexMono_500Medium,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#14120f' }} />;
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </SafeAreaProvider>
  );
}
