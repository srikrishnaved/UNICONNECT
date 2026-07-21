---
name: app-patterns
description: Conventions, architecture, and patterns for the ChristConnect/UniConnect React Native + Expo app. Load this whenever writing or editing any screen, component, hook, or navigation code. Covers AppContext shape, app modes, navigation structure, theme imports, Supabase query patterns inside screens, role gating, feature flags, and the dual native+web platform setup.
---

# App Patterns — ChristConnect / UniConnect

React Native (Expo SDK 54) + react-native-web, deployed as both a mobile app and a Vercel web app.

## App Modes (the single most important concept)

`App.js` renders entirely different UIs based on `mode` from AppContext:

| mode | What renders |
|---|---|
| `'loading'` | Spinner — auth check in progress |
| `'onboarding'` | `OnboardingScreen` — sign in / sign up |
| `'resetPassword'` | `ResetPasswordScreen` |
| `'teacherPending'` | `TeacherPendingView` — approval waiting screen |
| `'teacher'` | `TeacherDashboardScreen` — entirely separate experience |
| `'app'` | `AppNavigator` — the main student app |

`setMode()` is called inside AppContext after session resolution. Never call it from screens.

## AppContext — What's Available

Import with: `import { useApp } from '../context/AppContext';`

**Identity:**
```js
const { userProfile, teacherProfile, isAppAdmin, mode, sapsRole } = useApp();
// userProfile.university_id — the key for all data queries
// userProfile.role — 'student' | 'teacher' | 'admin' | 'cr'
// isAppAdmin — boolean, separate from role, for super/app admin access
// sapsRole — null or one of the 5 SAPS roles
```

**Social state (all Sets/arrays kept in sync):**
```js
const { connections, pendingOutgoing, blockedIds, joinedGroupIds,
        interestedEventIds, followingClubIds, createdGroupIds,
        approvedClubAdmins, clubMemberships, userCreatedClubs } = useApp();
// connections, pendingOutgoing, blockedIds, joinedGroupIds etc. are Sets — use .has(id)
```

**Preloaded data:**
```js
const { events, clubs, teachersList, studentGroups, teacherGroups,
        myClubRequests, clubAdminRequests, hiddenClubIds } = useApp();
// These are loaded once on sign-in. Don't re-fetch them in screens.
```

**Actions:**
```js
const { toggleConnect, sendConnectionRequest, cancelConnectionRequest,
        disconnectUser, isConnected, isBlocked, hasPendingRequest,
        createNotification, teacherSignOut } = useApp();
```

**Notifications:**
```js
const { unreadCount } = useApp(); // badge count for bell icon
```

## Screen Pattern

Every screen follows this shape:

```js
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius, font, avatarColor, initials } from '../theme';

export default function MyScreen({ route, navigation }) {
  const { userProfile, /* other context */ } = useApp();
  const universityId = userProfile?.university_id;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!universityId) return; // always gate on universityId
    supabase
      .from('my_table')
      .select('id, name, ...')
      // Do NOT filter by university_id here — RLS handles it
      .order('created_at', { ascending: false })
      .then(({ data: rows }) => {
        setData(rows || []);
        setLoading(false);
      });
  }, [universityId]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;

  return (
    <View style={styles.container}>
      {/* ... */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
```

Key rules:
- Always gate `useEffect` data fetches on `universityId` — it's null until profile loads
- Never filter `.eq('university_id', x)` in JS — RLS enforces it server-side
- Use `data || []` fallback — never assume Supabase returns non-null
- `route.params` for screen params passed via navigation

## Theme Imports

Always import from `'../theme'` (not from tokens directly):

```js
import { colors, spacing, radius, font, avatarColor, initials, courseColor } from '../theme';

// colors.bg, colors.card, colors.border
// colors.textPrimary, colors.textSecondary, colors.textTertiary
// colors.primary (accent, adapts to university branding on web)
// colors.primaryLight (dim/tint version)
// colors.green/red/amber + greenLight/redLight/amberLight
// spacing.xs/sm/md/lg/xl
// radius.sm/md/lg/xl/full

// Avatar helpers
const av = avatarColor(name);     // → { bg: '#...', text: '#...' }
const abbr = initials(name);       // → 'JD' for 'John Doe'
```

On web, `colors.primary` uses `var(--color-accent, #0071E3)` — university branding via CSS custom properties. Never hardcode the blue hex in new web-visible UI.

## Icons

```js
import { Users, Star, Search, Bell, User, ... } from 'lucide-react-native';
// Size: 16 (small), 18 (header), 20 (tab inactive), 22 (tab active)
// Color: colors.textSecondary for inactive, colors.accent for active/primary
```

## Navigation Structure

**Bottom Tab Navigator** (AppNavigator): Discover | Planner | Hub | Teachers  
Tabs are conditionally shown based on `enabledFeatures` from `useUniversityConfig()`:
- `Discover` → requires `'networking'`
- `Planner` → requires `'timetable'`
- `Hub` → requires `'clubs'`
- `Teachers` → requires `'attendance'` OR `'timetable'`

**Native Stack** (registered in App.js):
```
Profile          → 'profile/:studentId'       (route.params.studentId)
MyProfile        → 'my-profile'
GroupDetail      → 'groups/:groupId'          (route.params.groupId)
ClubDetail       → 'clubs/:clubId'
TeamDetail       → 'teams/:clubId'
TeamDashboard    → 'team-dashboard/:clubId'
ClubDashboard    → 'club-dashboard/:clubId'
AppAdmin         → 'admin'
SuperAdmin       → 'super-admin'
TeacherDashboard → 'teacher-dashboard'
DM               → 'dm/:personKey'            (route.params.personKey, personKey)
Search           → 'search'
EventDetail      → 'events'
CourseRecommendations, CourseTags, Legal, Privacy — also registered
```

Navigate with:
```js
navigation.navigate('Profile', { studentId: user.id });
navigation.navigate('GroupDetail', { groupId: group.id });
```

## Role Gating

```js
// In screens — gate UI sections, not just navigation
const { isAppAdmin, userProfile, sapsRole } = useApp();
const isTeacher = userProfile?.role === 'teacher';
const isCR = userProfile?.role === 'cr';

// Admin-only sections
{isAppAdmin && <AdminOnlySection />}

// CR-only
{isCR && <CRBadge />}
```

Role gating in UI is for UX only — server-side RLS is the actual security boundary.

## APP_CONFIG

Central config at `src/config/appConfig.js`. Never hardcode university-specific strings in screens:

```js
import { APP_CONFIG } from '../config/appConfig';

APP_CONFIG.appName          // 'UniConnect'
APP_CONFIG.universityName   // 'Christ University' (mutated at runtime by branding)
APP_CONFIG.courses          // array of { key, full, sub, color, bg }
APP_CONFIG.classes          // all class strings e.g. '1BcomIBA'
APP_CONFIG.interests        // master interests list
APP_CONFIG.allowedEmailDomains // ['christuniversity.in']
```

## Platform: Native vs Web

```js
import { Platform } from 'react-native';
const isWeb = Platform.OS === 'web';

// Web gets university branding via CSS custom props (set by applyUniversityBranding in AppContext)
// Native gets colors mutated directly on the theme object
// Always use colors.primary — never raw hex — so both platforms get the right value
```

The web build is deployed at `uniconnect-platform-gamma.vercel.app`. University is resolved from subdomain or `?uni=` query param.

## Common Components

```
src/components/
  EmptyState.js           — zero-state view, pass icon + message
  BunkmateModal.jsx       — bunkmate matching modal
  MediaMessage.js         — image/video message in group chats
  NAACScreen.jsx          — NAAC data view
  AttendanceReportScreen.jsx
  RosterUploadModal.jsx
  TakeAttendanceScreen.jsx
  UniversitySetupWizard.jsx
```

## Supabase Client

```js
import { supabase } from '../lib/supabase';
// Never re-initialize. One client, always from lib.
```

Session is managed entirely by AppContext — screens never call `supabase.auth.*` directly except through AppContext actions.
