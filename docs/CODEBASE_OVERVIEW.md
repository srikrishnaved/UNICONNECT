# ChristConnect — Codebase Overview

> Last updated: 2026-07-12  
> App name: **UniConnect** (brand), slug: `christconnect`  
> Live URL: https://christconnect.expo.app  
> Supabase: `https://qoseoqvdwiaqdkmivrxk.supabase.co`  
> EAS Project ID: `852ae428-9da1-4236-a306-9fc859994347`

---

## Tech Stack

| Layer | Tool / Version |
|---|---|
| Framework | Expo ~54.0.34 (React Native 0.81.5) |
| Language | JavaScript (React 19.1) |
| Web render | react-native-web ^0.21.0 |
| Navigation | @react-navigation/native ^7 + bottom-tabs + native-stack |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Fonts | Fraunces (headings), IBM Plex Mono (mono) |
| Icons | lucide-react-native ^1.17.0 |
| Local storage | @react-native-async-storage/async-storage ^3 |
| File handling | expo-document-picker, expo-file-system, expo-image-picker |
| Spreadsheet | xlsx ^0.18.5 |
| Edge Functions | Deno (Supabase Functions) |

---

## Deploy Commands

SSL workaround is always required on the dev machine:

```bash
NODE_OPTIONS=--use-system-ca npx expo export --platform web
NODE_OPTIONS=--use-system-ca npx eas deploy --prod
```

---

## Auth Modes

The app uses a `mode` state in `AppContext.js` to switch between views:

| Mode | Trigger | Description |
|---|---|---|
| `loading` | App start | Spinner shown while Supabase session is resolved |
| `onboarding` | No session | Email/password sign-up or sign-in for students/teachers |
| `resetPassword` | Deep-link | Password reset flow |
| `teacher` | Hardcoded PIN or Supabase teacher with `status='active'` | Teacher dashboard |
| `teacherPending` | Supabase teacher with `status='pending'` | Waiting-for-approval screen |
| `app` | Student session active | Full tab navigator |

### Student Auth
Supabase email/password. Profile stored in `profiles` table (`role='student'`).  
Email domain restricted to `christuniversity.in` (or `uniconnect.test` for testing).

### Teacher Auth (hardcoded PINs)
Legacy path — 8 teachers identified by PIN codes, stored in `AsyncStorage` as `teacherProfile`.  
IDs: `'teacher-1'` through `'teacher-8'`.

| Teacher | PIN |
|---|---|
| Dr. Hridya PK (Dept Coordinator) | 12 |
| Dr. Kantharaju NP (SDG Club) | 34 |
| Dr. Ravi (ACE Club) | 56 |
| Dr. Bhagyalakshmi | 78 |
| Dr. Shruti K | 90 |
| CS Monica Agarwal (SAPS Club) | 25 |
| ACCA Bhoomika Urs (Industry Connect) | 47 |
| Dr. Murthy HN (FLC Club) | 63 |

### Teacher Auth (Supabase)
New path via `registerTeacher()` — creates a real Supabase auth account with `role='teacher'` and `status='pending'` in `profiles`. Super Admin approves via `SuperAdminScreen`.

### App Admin Auth
Hardcoded code stored in `AsyncStorage` as `adminSession`. Grants `isAppAdmin=true` in context. Super Admin screen and Teacher Dashboard are accessible via the avatar menu when this is active.

---

## Navigation Structure

```
AppShell (mode-gated)
├── OnboardingScreen           (mode='onboarding')
├── ResetPasswordScreen        (mode='resetPassword')
├── TeacherPendingView         (mode='teacherPending')
├── TeacherDashboardScreen     (mode='teacher')
└── NavigationContainer        (mode='app')
    ├── Stack.Screen: Main → AppNavigator (Bottom Tabs)
    │   ├── Discover    (DiscoverScreen)
    │   ├── Planner     (StudyPlannerScreen)
    │   ├── Hub         (HubScreen)
    │   ├── Mentors     (MentorsScreen)
    │   └── Teachers    (TeachersScreen)
    ├── Stack.Screen: Profile
    ├── Stack.Screen: MyProfile
    ├── Stack.Screen: GroupDetail
    ├── Stack.Screen: ClubDetail
    ├── Stack.Screen: TeamDetail
    ├── Stack.Screen: TeamDashboard
    ├── Stack.Screen: ClubDashboard
    ├── Stack.Screen: AppAdmin
    ├── Stack.Screen: SuperAdmin
    ├── Stack.Screen: TeacherDashboard
    ├── Stack.Screen: DM
    ├── Stack.Screen: Search
    ├── Stack.Screen: EventDetail
    ├── Stack.Screen: Legal / Privacy / Terms
    └── Modal: Bio prompt (first login)
```

Deep-link prefixes: `christconnect://`, `uniconnect://`, `https://christconnect.expo.app`

---

## Screens

### Bottom Tab Screens

| Screen | File | Purpose |
|---|---|---|
| Discover | `src/screens/DiscoverScreen.js` | Student directory with filters (course, year, interests); real cards with connect flow |
| Planner | `src/screens/StudyPlannerScreen.js` | Study Planner — add exams, set weekly availability, AI plan generation via edge function |
| Hub | `src/screens/HubScreen.js` | Club listing and event board |
| Mentors | `src/screens/MentorsScreen.js` | Mentors/tutors directory with teacher link |
| Teachers | `src/screens/TeachersScreen.js` | Faculty directory from Supabase `profiles` (role='teacher') |

### Stack Screens

| Screen | File | Purpose |
|---|---|---|
| OnboardingScreen | `src/screens/OnboardingScreen.js` | Multi-step auth flow: `signin` → `roleSelect` → `signup` / `teacherSignup` → `picker` → `interests` → `allset` |
| ProfileScreen | `src/screens/ProfileScreen.js` | Other student's public profile |
| MyProfileScreen | `src/screens/MyProfileScreen.js` | Logged-in user's own profile — edit bio, interests, leadership badges |
| GroupDetailScreen | `src/screens/GroupDetailScreen.js` | Study group details and messaging |
| ClubDetailScreen | `src/screens/ClubDetailScreen.js` | Club info + join request + dashboard button |
| TeamDetailScreen | `src/screens/TeamDetailScreen.js` | Team/club detail for specific associations |
| TeamDashboardScreen | `src/screens/TeamDashboardScreen.js` | SAPS event assignment management |
| ClubDashboardScreen | `src/screens/ClubDashboardScreen.js` | Full club management (notices, wings, resource persons, members with roles). Write access for Coordinator/Admin only |
| AppAdminScreen | `src/screens/AppAdminScreen.js` | App-level admin: club admin approvals, club creation, pinned notices, university setup |
| SuperAdminScreen | `src/screens/SuperAdminScreen.js` | Super-admin only: teacher approval/rejection, active teachers list |
| TeacherDashboardScreen | `src/screens/TeacherDashboardScreen.js` | Teacher portal: timetable view, substitute requests, event overrides, NAAC, attendance |
| TimetablePlannerScreen | `src/screens/TimetablePlannerScreen.js` | Timetable team portal (student accounts): Today's classes, sub requests, compensatory requests |
| CRDashboardScreen | `src/screens/CRDashboardScreen.js` | Class Representative dashboard: attendance rolls, CR tasks |
| AdminDashboardScreen | `src/screens/AdminDashboardScreen.js` | Legacy admin screen (seed-data management) |
| DMScreen | `src/screens/DMScreen.js` | Direct messaging (real-time via Supabase channel) |
| SearchScreen | `src/screens/SearchScreen.js` | Global search across students, clubs, groups |
| StudyPlannerScreen | `src/screens/StudyPlannerScreen.js` | (also used as Planner tab) |
| NotificationsPanel | `src/screens/NotificationsPanel.js` | Slide-in notification tray with accept/decline for club invites |
| ResetPasswordScreen | `src/screens/ResetPasswordScreen.js` | Deep-link password reset |
| DocumentationScreen | `src/screens/DocumentationScreen.js` | In-app documentation |
| EventDetailScreen | `src/screens/EventDetailScreen.js` | Hub event detail view |
| HubScreen | `src/screens/HubScreen.js` | (also used as Hub tab) |
| LegalScreen | `src/screens/LegalScreen.js` | Combined legal (Terms / Privacy) |
| PrivacyPolicyScreen | `src/screens/PrivacyPolicyScreen.js` | Standalone privacy policy |
| TermsOfServiceScreen | `src/screens/TermsOfServiceScreen.js` | Standalone terms |
| MentorsScreen | `src/screens/MentorsScreen.js` | (also used as Mentors tab) |
| TutorsScreen | `src/screens/TutorsScreen.js` | Peer tutors listing |
| TeachersScreen | `src/screens/TeachersScreen.js` | (also used as Teachers tab) |
| GroupsScreen | `src/screens/GroupsScreen.js` | Study groups listing |

### Components (src/components/)

| Component | Purpose |
|---|---|
| `AttendanceReportScreen.jsx` | Modal — teacher attendance reports |
| `BunkmateModal.jsx` | Modal — bunkmate/attendance tracking for CRs |
| `EmptyState.js` | Generic empty-state UI |
| `MediaMessage.js` | Chat media message bubble |
| `NAACScreen.jsx` | Modal — AI-assisted NAAC documentation generation |
| `RosterUploadModal.jsx` | Modal — upload class roster via Excel |
| `TakeAttendanceScreen.jsx` | Modal — take live attendance for a class |
| `UniversitySetupWizard.jsx` | Modal — multi-step university onboarding wizard |

---

## Context & State (src/context/AppContext.js)

Single `AppContext` provides all global state and DB operations:

| State | Type | Description |
|---|---|---|
| `mode` | string | Current app view mode (see Auth Modes) |
| `isAppAdmin` | bool | Whether current session is the app admin |
| `userProfile` | object | Logged-in student's Supabase profile |
| `teacherProfile` | object | Active teacher session (hardcoded or Supabase) |
| `events` | array | Hub events (seeded + DB) |
| `clubMemberships` | Set | Club IDs the user has joined |
| `approvedClubAdmins` | Set | Club IDs where user is admin |
| `unreadCount` | number | Unread notification count |
| `joinedGroupIds` | Set | Joined study group IDs |
| `interestedEventIds` | Set | Events marked interested |
| `followingClubIds` | Set | Clubs the user follows |

Key functions exposed via context: `signUp`, `signIn`, `signOut`, `sendPasswordReset`, `registerTeacher`, `approveTeacher`, `rejectTeacher`, `teacherSignOut`, `checkTeacherApproval`, `saveBio`, `submitClubAdminRequest`, `resolveClubAdminRequest`, `createNotification`, `loadUnreadCount`.

---

## Supabase Tables

| Table | Key Columns | Notes |
|---|---|---|
| `profiles` | `id` (uuid), `name`, `course`, `year`, `campus`, `bio`, `role` (student/teacher), `status` (active/pending/rejected), `is_super_admin` | Main user table |
| `teacher_profiles` | `id` → profiles.id, `subjects[]`, `faculty_type`, `available_days[]`, `department` | Created by `registerTeacher()` |
| `direct_messages` | `sender_id` (TEXT), `recipient_id` (text), `conversation_key`, `text`, `media_url`, `read` | sender_id is TEXT (not UUID) to support `teacher-N` IDs |
| `notifications` | `user_id` (TEXT), `type`, `title`, `body`, `read`, `meta` (jsonb) | user_id is TEXT for same reason |
| `club_memberships` | `user_id`, `club_id`, `club_name`, `role` | `role` column added via migration |
| `club_join_requests` | `user_id`, `student_name`, `club_id`, `club_name`, `course`, `year`, `message`, `status` | |
| `club_admins` | `user_id`, `club_id` | |
| `club_admin_requests` | `user_id`, `club_id`, `status` | |
| `club_invites` | `id`, `club_id`, `club_name`, `invited_user_id`, `invited_by`, `status` | |
| `club_notices` | `id`, `club_id`, `title`, `body`, `posted_by_name`, `created_at` | |
| `club_resource_persons` | `id`, `club_id`, `name`, `designation`, `contact`, `event_name` | |
| `club_wings` | `id`, `club_id`, `wing_name`, `responsibilities`, `sort_order` | |
| `hub_events` | `id`, `club_id`, `title`, `time`, `venue`, `when`, `description`, `is_recruitment`, `image_uri` | |
| `teacher_announcements` | `teacher_id`, `teacher_name`, `title`, `body` | |
| `faculty_club_requests` | `teacher_id`, `teacher_name`, `club_id`, `club_name`, `reason`, `status` | |
| `teacher_subjects` | `id`, `teacher_id` → profiles.id, `subject_id` → subjects.id | UNIQUE(teacher_id, subject_id) |
| `compensatory_requests` | `id`, `teacher_name`, `original_class_name`, `original_day`, `original_period_name`, `source_change_log_id`, `proposed_slot_id`, `status` (pending/approved/rejected/unresolved) | |
| `study_exams` | `id`, `user_id`, `subject_name`, `exam_date`, `syllabus_file_url` | Study Planner |
| `study_topics` | `id`, `exam_id`, `user_id`, `topic_name`, `scheduled_date`, `estimated_weight` | Study Planner |
| `study_availability` | `user_id`, `day_of_week`, `hours_per_day` | Study Planner |
| `mentor_visits` | `teacher_id`, `student_id`, `note` | |
| `event_interests` | `user_id`, `event_id` | |
| `club_following` | `user_id`, `club_id` | |
| `group_memberships` | `user_id`, `group_id` | |
| `user_connections` | `user_id`, `connected_to` | |
| `blocked_users` | `user_id`, `blocked_id` | |
| `reports` | user reports | |
| `connection_requests` | `id`, `from_user_id`, `to_user_id`, `status` | **NOT YET CREATED** — needed for connect flow |

### RLS Notes
- `direct_messages` SELECT: allows `sender_id LIKE 'teacher-%'` or `recipient_id LIKE 'teacher-%'`
- `notifications` SELECT: allows `user_id LIKE 'teacher-%'`
- Most club tables use open RLS (`USING (true)`)
- Real-time enabled on `direct_messages` via: `ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;`

### Storage Buckets
- `chat-media` (public) — JPG, PNG, PDF, XLS, XLSX
- `study-syllabus` (public) — syllabus PDFs for Study Planner

---

## Supabase Edge Functions (supabase/functions/)

| Function | Purpose |
|---|---|
| `generate-study-plan` | Accepts `{user_id}`, fetches exams/topics/availability, optionally reads syllabus PDFs, calls Claude claude-sonnet-4-6 (Anthropic API), upserts `study_topics` with `scheduled_date` + `estimated_weight` |
| `generate-naac-content` | AI-assisted NAAC documentation generation |
| `generate-docx` | Generates DOCX output |
| `parse-timetable` | Parses timetable data |
| `ai-nfa` | AI NFA (Natural Frequency Analysis or similar) |
| `_shared` | Shared utilities across functions |

**Env secret required:** `ANTHROPIC_API_KEY` in Supabase Dashboard → Edge Functions → Secrets

---

## Utility Libraries (src/lib/)

| File | Purpose |
|---|---|
| `supabase.js` | Supabase client init |
| `classUtils.js` | `computeClass()` — derives class label from semester/programme |
| `compensatoryUtils.js` | `createCompensatoryRequest()` — finds free timetable slots and creates compensatory class records |
| `subjectUtils.js` | Subject lookups and metadata |
| `jaasJwt.js` | JWT generation for Jitsi-as-a-Service (video rooms) |
| `studyStats.js` | Study session statistics (legacy — usage removed from profile screens) |
| `uploadMedia.js` | Helper for uploading media to Supabase storage |

---

## Configuration (src/config/appConfig.js)

Central config for the Christ University deployment:

- `appName`: `'UniConnect'`
- `universityName`: `'Christ University'`, `campusName`: `'Yeshwanthpur'`
- `allowedEmailDomains`: `['christuniversity.in']`
- `testEmailDomains`: `['uniconnect.test']`
- `years`: `['1st Year', '2nd Year', '3rd Year']`
- `courses`: BCom IAF, BCom IBA, BCom F&A
- `classes`: `1BcomIBA`, `1BcomF&A`, `1BcomIAF`, `3Bcom*`, `5Bcom*`, `7BcomF&A`
- `workingDays`: MON–SAT
- `constraints`: TUE P2 reserved for HED (1st + 3rd semester classes)
- `classRegBases`: Register number bases per class (for CR rolls)

---

## Data Layer (src/data/index.js)

Seed data arrays used as fallback or initial state when DB is empty:
- `students` — mock student profiles
- `hubClubs` — club list
- `hubEvents` (exported as `seedEvents`) — initial events
- `studyGroups` (exported as `seedGroups`) — initial groups
- `teachers` — hardcoded teacher list (legacy, mirrors timetable faculty)
- `tutors`, `myProfile`, `mentors`
- `naacMasterTemplate.js` — NAAC indicator template data

---

## Theme (src/theme/)

- `src/theme/index.js` — `colors`, `font`, `spacing`, `radius`, `avatarColor()`, `initials()`
- `src/theme/tokens.js` — design tokens (`tColors`, `typography`, `shadows`, `presets`)

Colors follow a dark theme. `colors.primary` is the brand accent (purple/indigo family).

---

## SQL Migration Files

All `.sql` files in the project root are run manually in Supabase SQL Editor:

| File | Purpose |
|---|---|
| `supabase_study_planner.sql` | `study_exams`, `study_topics`, `study_availability` tables + RLS |
| `supabase_compensatory_requests.sql` | `compensatory_requests` table + RLS |
| `supabase_club_admins.sql` | Club admin tables and policies |
| `supabase_club_events.sql` | Club events table |
| `supabase_club_contribution_hours.sql` | Club contribution hours |
| `supabase_timetable_tables.sql` | Timetable core tables |
| `supabase_timetable_slots_seed.sql` | Seed timetable data |
| `supabase_substitute_requests.sql` | Substitute request table |
| `supabase_notifications.sql` | Notifications table + RLS |
| `supabase_new_features.sql` | Miscellaneous new feature tables |
| `supabase_profiles_section.sql` | Profile table extensions |
| `supabase_teacher_subjects.sql` | `teacher_subjects` junction table |
| `supabase_documentation_tables.sql` | Documentation feature tables |
| `rebuild_timetable_2026_FIXED.sql` | Full timetable rebuild for 2026 |
| `supabase_external_protection.sql` | External access protection policies |

---

## Known Outstanding Items

1. **`connection_requests` feature is half-built** — `pendingOutgoing` state, `hasPendingRequest`, `sendConnectionRequest`, `acceptConnectionRequest` are in `AppContext.js` but not exported to context value. UI in `DiscoverScreen`, `ProfileScreen`, and `NotificationsPanel` not yet wired up. Table not yet created in Supabase.

2. **`TutorsScreen.js:160`** — Edit/delete own tutor posting shows "coming soon" alert (not implemented).

3. **`chat-media` INSERT policy** — May not be applied in Supabase Storage. Verify under Storage → Policies tab.

4. **`connection_requests` SQL** needs to be run before the connect feature ships:
   ```sql
   CREATE TABLE IF NOT EXISTS connection_requests (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     from_user_id text NOT NULL,
     to_user_id text NOT NULL,
     status text NOT NULL DEFAULT 'pending',
     created_at timestamptz DEFAULT now()
   );
   ALTER TABLE connection_requests ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "users can manage their own requests" ON connection_requests
     FOR ALL USING (from_user_id = auth.uid()::text OR to_user_id = auth.uid()::text);
   ```
