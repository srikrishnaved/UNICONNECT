# ChristConnect — Project Context Reference

Generated: 2026-06-23. Overwrite this file by running the regeneration prompt in CLAUDE.md.

---

## 1. Full Schema Dump

All public tables with columns, types, foreign keys, and constraints (reconstructed from SQL migration files + live backup).

### profiles
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK, auth.uid() |
| name | text | YES | display name |
| email | text | YES | |
| course | text | YES | e.g. 'BCom IAF' |
| year | text | YES | '1st Year' / '2nd Year' / '3rd Year' |
| campus | text | YES | 'Yeshwanthpur' |
| bio | text | YES | |
| created_at | timestamptz | YES | default now() |
| social_links | jsonb | YES | |
| is_super_admin | boolean | YES | app-level Super Admin flag |
| interests | text[] | YES | |
| is_teacher | boolean | YES | legacy flag |
| role | text | YES | 'student' \| 'teacher' |
| status | text | YES | 'pending' \| 'approved' |
| class | text | YES | e.g. '3BcomIAF' |
| section | text | YES | e.g. 'A' — null for non-F&A; added via migration |
| display_name | text | YES | timetable-facing name override |

### teacher_profiles
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK, FK → profiles(id) |
| subjects | text[] | YES | self-declared subject list |
| faculty_type | text | YES | 'full_time' \| 'adjunct' etc. |
| available_days | text[] | YES | |
| department | text | YES | |
| created_at | timestamptz | YES | default now() |
| seed_teacher_id | integer | YES | links to hardcoded teachers[] in src/data/index.js |

### subjects
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| name | text | NOT NULL | |
| code | text | NOT NULL | |
| class | text | NOT NULL | e.g. '3BcomIAF' |
| programme | text | NOT NULL | |
| semester | text | NOT NULL | |
| status | text | NOT NULL | default 'active' |
| created_by | uuid | YES | FK → profiles(id) |
| created_at | timestamptz | YES | |

### subject_requests
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| subject_name | text | NOT NULL | |
| subject_code | text | NOT NULL | |
| class | text | NOT NULL | |
| programme | text | NOT NULL | |
| semester | text | NOT NULL | |
| requested_by | uuid | YES | FK → profiles(id) |
| requester_name | text | NOT NULL | |
| status | text | NOT NULL | default 'pending' |
| reviewed_by | uuid | YES | FK → profiles(id) |
| created_at | timestamptz | YES | |

### teacher_subjects
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| teacher_id | uuid | NOT NULL | FK → profiles(id) ON DELETE CASCADE |
| subject_id | uuid | NOT NULL | FK → subjects(id) ON DELETE CASCADE |
| created_at | timestamptz | YES | |
| UNIQUE(teacher_id, subject_id) | | | |

### teacher_tasks
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| teacher_id | text | NOT NULL | text (not uuid) — matches seed teacher numeric IDs |
| title | text | NOT NULL | |
| deadline | text | YES | |
| duration_hours | numeric | YES | |
| status | text | NOT NULL | 'pending' \| 'in_progress' \| 'done' |
| created_at | timestamptz | YES | |

### teacher_announcements
Created via Supabase dashboard; columns unknown (0 rows). Stores teacher broadcast messages.

### timetable_periods
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| name | text | NOT NULL | 'M1' \| 'M2' \| 'P1' \| 'P2' \| 'P3' \| 'P4' |
| start_time | text | NOT NULL | e.g. '7:30' |
| end_time | text | NOT NULL | e.g. '8:30' |
| sort_order | int | NOT NULL | 1–6 |
| is_saturday | boolean | YES | default false; reserved for Sat variants |

**Seeded data:** M1 07:30–08:30, M2 08:30–09:30, P1 10:00–11:00, P2 11:00–12:00, P3 12:00–13:00, P4 13:00–14:00. Note: 09:30–10:00 is a break (no period).

### timetable_classrooms
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| class_name | text | NOT NULL | UNIQUE |
| room_number | text | YES | |
| max_time | text | YES | latest period start allowed |

**Seeded classes:** 1BcomIBA, 1BcomF&A, 1BcomIAF, 3BcomIBA, 3BcomF&A(A), 3BcomF&A(B), 3BcomIAF, 5BcomF&A(A), 5BcomF&A(B), 5BcomIAF, 7BcomF&A.

### timetable_faculty_constraints
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| faculty_name | text | NOT NULL | |
| no_saturdays | boolean | YES | true = cannot teach on Saturday |
| monday_only_before | text | YES | e.g. '10:00' — Monday constraint |
| available_days | text[] | YES | '{MON,TUE,...}' — null = all days |
| time_window_start | text | YES | earliest allowed period start |
| time_window_end | text | YES | latest allowed period start |

### timetable_paired_sessions
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| class_name | text | NOT NULL | |
| day | text | NOT NULL | |
| period_name | text | NOT NULL | |
| course_code_a / course_name_a / faculty_a | text | YES | first paired option |
| course_code_b / course_name_b / faculty_b | text | YES | second paired option |

### timetable_slots
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| class_name | text | NOT NULL | e.g. '3BcomIAF' |
| day | text | NOT NULL | 'MON' \| 'TUE' \| 'WED' \| 'THU' \| 'FRI' \| 'SAT' |
| period_name | text | NOT NULL | 'M1'–'P4' |
| course_code | text | YES | |
| course_name | text | YES | |
| faculty_name | text | YES | slash-separated for shared slots, e.g. 'Dr. A / Dr. B' |
| batch_details | text | YES | e.g. 'Batch A' |
| is_elective | boolean | YES | default false |
| created_at | timestamptz | YES | |
| updated_at | timestamptz | YES | |
| overridden_by_event | jsonb | YES | {original_course_name, original_faculty_name, event_id, event_name} — set when a club event overrides this slot |
| UNIQUE(class_name, day, period_name) | | | |

### timetable_change_log
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| changed_by | uuid | YES | FK → profiles(id) ON DELETE SET NULL |
| class_name | text | NOT NULL | |
| day | text | NOT NULL | |
| period_name | text | NOT NULL | |
| old_faculty | text | YES | |
| new_faculty | text | YES | |
| reason | text | YES | |
| change_type | text | NOT NULL | 'edit' \| 'substitute' \| 'cancel'; default 'edit' |
| created_at | timestamptz | YES | |

### timetable_permanent_overrides
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| class_name | text | NOT NULL | |
| day | text | NOT NULL | |
| period_name | text | NOT NULL | |
| course_code / course_name / faculty_name / batch_details | text | YES | |
| is_elective | boolean | YES | default false |
| reason | text | YES | |
| changed_by_name | text | YES | |
| created_at | timestamptz | YES | |
| UNIQUE(class_name, day, period_name) | | | |

Slots here survive `reset_timetable_slots()` and are re-applied on top after a timetable reset.

### timetable_assistant_sessions
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| session_id | uuid | NOT NULL | PK |
| slots | jsonb | NOT NULL | full parsed slot array from parse-timetable Edge Fn |
| class_names | text[] | NOT NULL | sorted unique class names in this session |
| slot_count | int | NOT NULL | default 0 |
| created_at | timestamptz | NOT NULL | default now() |

Temporary — cleaned up 24 h after creation by the Edge Function on next invocation.

### substitute_requests
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| slot_id | uuid | YES | FK → timetable_slots(id) ON DELETE SET NULL |
| requesting_teacher_id | uuid | YES | FK → profiles(id) ON DELETE SET NULL |
| requesting_teacher_name | text | NOT NULL | |
| reason | text | NOT NULL | |
| preferred_substitute | text | YES | name string |
| status | text | NOT NULL | 'pending' \| 'approved' \| 'rejected'; default 'pending' |
| created_at | timestamptz | YES | |
| class_name | text | YES | denormalized for display |
| day | text | YES | |
| period_name | text | YES | |

### compensatory_requests
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| teacher_name | text | NOT NULL | |
| original_class_name | text | NOT NULL | |
| original_day | text | YES | |
| original_period_name | text | YES | |
| source_change_log_id | uuid | YES | FK → timetable_change_log(id) |
| proposed_slot_id | uuid | YES | FK → timetable_slots(id) |
| proposed_day | text | YES | |
| proposed_period_name | text | YES | |
| proposed_course_name | text | YES | |
| status | text | NOT NULL | 'pending' \| 'approved' \| 'rejected' \| 'unresolved'; default 'pending' |
| reviewed_by | uuid | YES | FK → profiles(id) |
| created_at | timestamptz | YES | |

### faculty_availability
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| faculty_name | text | NOT NULL | UNIQUE |
| available_days | text[] | YES | null = all days |
| window_end | text | YES | e.g. '09:30' — period start must be before this time |
| sat_window_end | text | YES | Saturday-specific override |
| updated_at | timestamptz | YES | |

Rows here take priority over hardcoded ADJUNCT_CONSTRAINTS in the app.

### club_events
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| club_id | text | NOT NULL | |
| created_by | uuid | YES | FK → profiles(id) |
| creator_role | text | NOT NULL | 'club_admin' \| 'faculty_coordinator' \| 'saps_coordinator' \| 'hod' |
| event_name | text | NOT NULL | |
| description | text | YES | |
| event_date | date | NOT NULL | |
| start_time / end_time | text | NOT NULL | e.g. '10:00' / '13:00' |
| status | text | NOT NULL | 'pending_faculty_coordinator' \| 'pending_saps' \| 'pending_hod' \| 'approved' \| 'rejected' |
| affected_slots | jsonb | YES | array of {class_name, day, period_name, course_name} |
| created_at / updated_at | timestamptz | YES | |

### hub_events
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| club_id | text | NOT NULL | stringified numeric club ID |
| club_name | text | YES | |
| title | text | YES | |
| time | text | YES | display time string |
| venue | text | YES | |
| when | text | YES | human-readable date |
| description | text | YES | |
| interested | int | YES | interest count |
| is_recruitment | boolean | YES | |
| image_uri | text | YES | |
| posted_by | text | YES | poster name |
| created_at | timestamptz | YES | |
| teams_needed | text[] | YES | |
| event_date | date | YES | |
| duration_hours | numeric | YES | |
| status | text | YES | |

### event_tracker_steps
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| event_id | text | NOT NULL | hub_event id (uuid string or legacy numeric) |
| club_id | text | NOT NULL | |
| label | text | NOT NULL | step description |
| done | boolean | NOT NULL | default false |
| sort_order | int | NOT NULL | default 0 |
| created_at | timestamptz | YES | |

### club_memberships
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| user_id | text | NOT NULL | stringified uuid |
| club_id | int | NOT NULL | numeric club ID |
| club_name | text | YES | |
| joined_at | timestamptz | YES | |
| role | text | YES | e.g. 'Member' \| 'Admin' |
| wing | text | YES | wing name for this member |

### club_join_requests
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| user_id | text | NOT NULL | |
| student_name | text | NOT NULL | |
| club_id | int \| text | NOT NULL | |
| club_name | text | YES | |
| course | text | YES | |
| year | text | YES | |
| message | text | YES | |
| status | text | NOT NULL | 'pending' \| 'approved' \| 'rejected' |
| created_at | timestamptz | YES | |

### club_admins
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| user_id | text | NOT NULL | stringified uuid |
| club_id | int | NOT NULL | |
| club_name | text | YES | |
| created_at | timestamptz | YES | |

### club_admin_requests
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| user_id | text | NOT NULL | |
| student_name | text | NOT NULL | |
| club_id | int \| text | NOT NULL | |
| club_name | text | YES | |
| course | text | YES | |
| year | text | YES | |
| reason | text | YES | |
| status | text | NOT NULL | 'pending' \| 'approved' \| 'rejected' |
| created_at | timestamptz | YES | |

### club_invites
Created via Supabase dashboard; 0 rows. Stores direct club membership invitations.

### club_notices
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| club_id | int | NOT NULL | |
| title | text | NOT NULL | |
| body | text | YES | |
| posted_by_name | text | YES | |
| created_at | timestamptz | YES | |

### club_resource_persons
Created via Supabase dashboard; 0 rows. Stores external resource persons linked to clubs.

### club_wings
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| club_id | int | NOT NULL | |
| wing_name | text | NOT NULL | |
| responsibilities | text | YES | |
| sort_order | int | YES | |
| created_at | timestamptz | YES | |

### club_member_hours
UNIQUE(user_id, club_id). 0 rows in backup. Stores cumulative contribution hours per member per club. Exact column schema set via Supabase dashboard; migration adds only the UNIQUE constraint and RLS.

### club_following
0 rows. Tracks which users follow which clubs without being members.

### club_social_links
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| club_id | text | NOT NULL | UNIQUE |
| platform | text | NOT NULL | |
| url | text | NOT NULL | |
| updated_at | timestamptz | YES | |

### faculty_coordinators
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| teacher_name | text | NOT NULL | |
| teacher_id | text | YES | |
| club_id | text | NOT NULL | |
| club_name | text | YES | |
| assigned_by | uuid | YES | FK → profiles(id) |
| created_at | timestamptz | YES | |
| UNIQUE(teacher_name, club_id) | | | |

### faculty_club_requests
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| teacher_id | uuid | NOT NULL | |
| teacher_name | text | NOT NULL | |
| club_id | text | NOT NULL | |
| club_name | text | YES | |
| reason | text | YES | |
| status | text | NOT NULL | 'pending' \| 'approved' \| 'rejected' |
| created_at | timestamptz | YES | |

### nfa_requests
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| created_by | uuid | YES | FK → profiles(id) |
| creator_name / creator_role / club_id / club_name | text | YES | |
| abstract / objectives / expected_outcomes / title_of_session | text | YES | |
| resource_person / target_audience / stakeholders_count | text | YES | |
| event_date / event_time / mode / link / venue / organised_by | text | YES | |
| key_takeaways | text | YES | newline-separated bullets |
| budget_items | jsonb | YES | array of {particular, amount} |
| status | text | NOT NULL | 'pending' \| 'approved' \| 'rejected'; default 'pending' |
| rejection_reason / reviewed_by | text | YES | |
| created_at | timestamptz | YES | |

### activity_reports
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| created_by | uuid | YES | FK → profiles(id) |
| creator_name / club_id / club_name | text | YES | |
| type_of_activity / title_of_activity / activity_date / activity_time / venue | text | YES | |
| speaker_names / speaker_titles / speaker_org / presentation_title | text | YES | |
| participant_type / participant_count / highlights / key_takeaways / summary | text | YES | |
| organiser_name / organiser_designation / atr | text | YES | |
| coordinator_status | text | NOT NULL | 'pending' \| 'approved' \| 'rejected' |
| coordinator_rejection_reason | text | YES | |
| saps_status | text | NOT NULL | 'pending' \| 'approved' \| 'rejected' |
| saps_rejection_reason | text | YES | |
| created_at | timestamptz | YES | |

### notifications
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| user_id | uuid | NOT NULL | |
| type | text | YES | e.g. 'join_approved', 'substitute_approved' |
| title | text | YES | |
| body | text | YES | |
| read | boolean | YES | default false |
| created_at | timestamptz | YES | |
| meta | jsonb | YES | extra context (club_id, event_id, etc.) |

### direct_messages
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| sender_id | uuid | NOT NULL | |
| recipient_id | uuid | YES | |
| conversation_key | text | YES | sorted uuid pair, e.g. 'uuid1_uuid2' |
| text | text | YES | |
| media_url | text | YES | |
| read | boolean | YES | |
| created_at | timestamptz | YES | |

### group_messages / group_memberships / created_groups / student_groups
All 0 rows. Group chat tables created via Supabase dashboard; exact schemas unknown from repo files.

### mentor_visits
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| teacher_id | uuid | NOT NULL | |
| student_id | uuid | NOT NULL | |
| note | text | YES | |
| created_at | timestamptz | YES | |

### user_connections / blocked_users / reports / event_interests
All 0 rows. Created via Supabase dashboard for social graph, blocking, reporting, and event interest.

### connection_requests
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| from_user_id | uuid | NOT NULL | |
| to_user_id | uuid | NOT NULL | |
| status | text | NOT NULL | 'pending' \| 'accepted' \| 'declined' |
| created_at | timestamptz | YES | |

### cr_requests
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| user_id | uuid | YES | FK → profiles(id) ON DELETE CASCADE |
| user_name | text | NOT NULL | |
| course / year / campus / reason | text | YES | |
| status | text | NOT NULL | 'pending' \| 'approved' \| 'rejected' \| 'resigned' |
| created_at | timestamptz | YES | |

### cr_class_rolls
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| class_name | text | NOT NULL | |
| roll_number | int | NOT NULL | |
| created_at | timestamptz | YES | |
| UNIQUE(class_name, roll_number) | | | |

Seeded: 1BcomF&A (80), 1BcomIAF (79), 1BcomIBA (21), 3BcomF&A A (rolls 1–46), 3BcomF&A B (rolls 47–96), 3BcomIAF (73), 3BcomIBA (29), 5BcomF&A A (82), 5BcomF&A B (32), 5BcomIAF (73).

### saps_applications
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| applicant_id | uuid | YES | FK → profiles(id) ON DELETE CASCADE |
| applicant_name | text | NOT NULL | |
| role | text | NOT NULL | CHECK: President \| Vice President \| Member Secretary \| Secretary \| Vice Secretary |
| status | text | NOT NULL | 'pending' \| 'approved' \| 'rejected' |
| reviewed_by | uuid | YES | FK → profiles(id) |
| created_at | timestamptz | YES | |

### saps_members
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| profile_id | uuid | YES | FK → profiles(id) ON DELETE CASCADE |
| role | text | NOT NULL | CHECK same values; UNIQUE per role (one person per position) |
| assigned_by | uuid | YES | FK → profiles(id) |
| created_at | timestamptz | YES | |

### study_exams
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| user_id | uuid | YES | FK → profiles(id) ON DELETE CASCADE |
| subject_name | text | NOT NULL | |
| exam_date | date | NOT NULL | |
| syllabus_text | text | YES | pasted syllabus |
| syllabus_file_url | text | YES | uploaded PDF URL |
| created_at | timestamptz | YES | |

### study_topics
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| exam_id | uuid | YES | FK → study_exams(id) ON DELETE CASCADE |
| user_id | uuid | YES | FK → profiles(id) ON DELETE CASCADE |
| topic_name | text | NOT NULL | |
| estimated_weight | text | YES | 'light' \| 'medium' \| 'heavy' |
| scheduled_date | date | YES | |
| status | text | NOT NULL | 'pending' \| 'done'; default 'pending' |
| sort_order | int | YES | default 0 |
| created_at | timestamptz | YES | |

### study_availability
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| user_id | uuid | YES | FK → profiles(id) ON DELETE CASCADE |
| day_of_week | text | NOT NULL | 'MON'–'SUN' |
| hours_available | numeric | YES | default 2 |
| UNIQUE(user_id, day_of_week) | | | |

### study_sessions
0 rows. Created via Supabase dashboard (exact schema unknown; likely stores AI-generated study plans per user).

---

## 2. All RLS Policies

All tables have Row Level Security enabled. The dominant pattern is **open policies** (`USING (true)` / `WITH CHECK (true)`) — authorization is enforced at the application layer, not the database layer, except for the five club write-protected tables.

### Open-policy tables (SELECT + all writes open to any authenticated user)
`profiles`, `teacher_profiles`, `subjects`, `subject_requests`, `teacher_subjects`, `teacher_tasks`, `timetable_periods`, `timetable_classrooms`, `timetable_faculty_constraints`, `timetable_paired_sessions`, `timetable_slots` (read + insert + update), `timetable_change_log` (read + insert), `timetable_permanent_overrides`, `substitute_requests`, `compensatory_requests`, `faculty_availability`, `faculty_coordinators` (select + insert + delete), `club_events`, `club_admins`, `club_member_hours`, `hour_adjustments`, `event_tracker_steps`, `cr_requests`, `cr_class_rolls`, `nfa_requests`, `activity_reports`, `notifications`, `saps_applications`, `saps_members`, `study_exams`, `study_topics`, `study_availability`.

### Club write-protection (via `is_club_admin_write()` helper function)

`public.is_club_admin_write(p_club_id text)` — SECURITY DEFINER function that returns true if the caller:
- has a row in `club_admins` for that club, OR
- has `profiles.is_super_admin = true`, OR
- has any row in `saps_members`

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| hub_events | open | admin of club | open | admin of club |
| club_social_links | open | admin of club | admin of club | admin of club |
| club_memberships | open | open (anyone may join) | open | self-leave OR admin of club |
| club_notices | open | admin of club | — | admin of club |
| club_wings | open | admin of club | — | admin of club |

### timetable_assistant_sessions
RLS enabled, no user-facing policies. Accessed only via Service Role Key from the Edge Function.

---

## 3. Repo File/Folder Structure

```
src/
├── components/
│   ├── EmptyState.js          # reusable empty-state card (icon, title, subtext)
│   └── MediaMessage.js        # renders image/video messages in DM thread
├── context/
│   └── AppContext.js          # global state: auth, profile, clubs, connections, notifications
├── data/
│   └── index.js               # hardcoded seed: students[], hubClubs[], teachers[], studyGroups[], tutors[]
├── lib/
│   ├── classUtils.js          # helpers: getClassForYear(), section mapping
│   ├── compensatoryUtils.js   # auto-search logic for compensatory slot candidates
│   ├── jaasJwt.js             # JaaS JWT generation for Jitsi video calls
│   ├── studyStats.js          # aggregation helpers for Study Planner progress
│   ├── subjectUtils.js        # subject name normalisation / matching
│   ├── supabase.js            # Supabase client singleton
│   └── uploadMedia.js         # Supabase Storage upload helper
├── navigation/
│   └── AppNavigator.js        # root navigator: auth stack + main bottom tabs + modal stack
├── screens/
│   ├── AdminDashboardScreen.js      # club join/admin requests queue (app-level Admin)
│   ├── AppAdminScreen.js            # new club/team approval queue
│   ├── CRDashboardScreen.js         # Class Representative attendance & roll management
│   ├── ClubDashboardScreen.js       # club admin panel (notices, wings, events, tracker, hours, docs, social)
│   ├── ClubDetailScreen.js          # public club profile (members, events, join/request)
│   ├── DMScreen.js                  # 1-on-1 direct message thread
│   ├── DiscoverScreen.js            # student/faculty discovery with filters
│   ├── DocumentationScreen.js       # NFA and Activity Report creation + approval
│   ├── EventDetailScreen.js         # hub event detail view
│   ├── GroupDetailScreen.js         # study group chat thread
│   ├── GroupsScreen.js              # study groups list and join
│   ├── HubScreen.js                 # department hub: clubs, teams, events feed
│   ├── LegalScreen.js               # terms & privacy
│   ├── MentorsScreen.js             # mentor assignment viewer (student) + visit log (teacher)
│   ├── MyProfileScreen.js           # own profile edit
│   ├── NotificationsPanel.js        # notification inbox
│   ├── OnboardingScreen.js          # signup / login / pending approval
│   ├── ProfileScreen.js             # another user's profile view
│   ├── ResetPasswordScreen.js       # password reset
│   ├── SearchScreen.js              # global search (students, clubs, events)
│   ├── StudyPlannerScreen.js        # AI study plan generator (exam input → topic calendar)
│   ├── SuperAdminScreen.js          # Super Admin: stats dashboard, teacher management, timetable team
│   ├── TeacherDashboardScreen.js    # teacher timetable, sub/comp requests, club coordinator requests
│   ├── TeachersScreen.js            # student-facing teacher directory
│   ├── TeamDashboardScreen.js       # team (internal) dashboard variant
│   ├── TeamDetailScreen.js          # public team profile
│   ├── TimetablePlannerScreen.js    # timetable grid, slot editing, faculty constraints, AI (coming soon)
│   └── TutorsScreen.js             # peer tutor listings
└── theme/
    └── index.js               # color palette, typography, spacing, radius tokens

supabase/
└── functions/
    ├── generate-docx/index.ts       # Edge Fn: renders NFA / Activity Report to .docx via docx npm
    ├── generate-study-plan/index.ts # Edge Fn: calls Claude Haiku to generate topic study plan JSON
    └── parse-timetable/index.ts     # Edge Fn: parses Excel/text via Claude Sonnet, stores session
```

---

## 4. Core Concepts Glossary

**club** — A student-led extracurricular organisation (e.g. FLC, ACE, SAPS). Has admins, members, wings, and a faculty coordinator. Stored by numeric `id` in `hubClubs[]`; that same integer is used as `club_id` in most database tables (sometimes cast to text).

**team** — Same data structure as a club but categorised as `type: 'Team'` in `hubClubs[]`. Teams are internal support groups (Tech Team, Audi Team, Documentation, Creative, Junoon, Mehfil, PR & Emcee). They appear under a separate "Teams" tab in the Hub but share all the same code paths and tables as clubs.

**wing** — A sub-group within a club or team (e.g. "Photo/Video Wing", "Design Wing"). Stored in `club_wings`. Members can be assigned to a wing via `club_memberships.wing`.

**event** — Generic term. In the app there are two distinct event types: `hub_event` (public announcement) and `club_event` (timetable override request).

**hub_event** — A publicly-visible department event posted by a club/team admin. Stored in `hub_events`. Has an associated `event_tracker_steps` checklist for logistics. Visible to all students in the Hub feed.

**club_event** — A formal timetable-override request (stored in `club_events`). Created when a club wants to use class time for an event. Goes through a multi-step approval chain before timetable slots are overridden.

**timetable_slot** — One cell in the timetable grid: `(class_name, day, period_name)` uniquely identifies it. Holds `course_name`, `faculty_name`, `course_code`, and optional `batch_details`. When overridden by a club event, `overridden_by_event` jsonb is set. UNIQUE constraint prevents double-booking.

**timetable_change_log** — Audit trail of every edit to `timetable_slots`. `change_type` distinguishes edits from substitutions from cancellations. Substitute approvals write here; compensatory requests reference rows here via `source_change_log_id`.

**substitute_request** — A teacher requests another faculty member cover one of their slots. When approved by the timetable team, `timetable_slots.faculty_name` is updated and a `compensatory_request` is auto-created for the displaced teacher.

**compensatory_request** — When teacher A's slot is given to teacher B (substitute), teacher A is owed a make-up class. The system auto-searches for a free slot where A is available. If found, `status = 'pending'` with a proposed slot; if not found, `status = 'unresolved'` for manual scheduling.

**faculty_coordinator** — A teacher officially assigned to coordinate a specific club. Stored in `faculty_coordinators`. Assigned by Super Admin after approving a `faculty_club_request`. Coordinators are the first approver in the club event chain and can submit documentation on behalf of a club.

**approval_chain** — The sequential sign-off path for `club_events`: club_admin → faculty_coordinator → SAPS → HOD. The `status` column encodes the current stage: `pending_faculty_coordinator` → `pending_saps` → `pending_hod` → `approved` / `rejected`.

**CR** — Class Representative. A student who holds the CR role for their class (approved via `cr_requests`). The CR Dashboard lets them manage their class roll (`cr_class_rolls`) and track attendance.

**SAPS** — Society of Accounting & Professional Studies. Club ID 17. Also the name for the student body with platform-level write authority — SAPS members can write to club-protected tables via `is_club_admin_write()`. Roles: President, VP, Member Secretary, Secretary, Vice Secretary — each UNIQUE in `saps_members`. The SAPS Coordinator (CS Monika Agarwal) is the second approver in the club event chain.

**HED** — Higher Education Department. A special slot type that appears on Tuesday Period 2 for 1st and 3rd semester classes only (1BcomIBA, 1BcomF&A, 1BcomIAF, 3BcomIBA, 3BcomF&A(A), 3BcomF&A(B), 3BcomIAF). Represents a fixed government-mandated class. The timetable planner renders it with a special HED badge and blocks editing. Logic is hardcoded in `TimetablePlannerScreen.js`.

**External Department slot** — A timetable slot where the faculty comes from outside the Commerce department (e.g. a Languages teacher). Currently present in `timetable_slots` but has no protection logic — can be accidentally overwritten. See Open Items.

**NFA** — Notice for Approval. A formal pre-event document request (`nfa_requests`) submitted by a club admin or faculty coordinator before running an external event. Requires coordinator approval. When approved, the `generate-docx` Edge Function renders it to a `.docx` file.

**activity_report** — A post-event documentation form (`activity_reports`) submitted by the Documentation team. Requires coordinator approval, then SAPS approval, before a `.docx` can be generated.

**study_exam** — One exam entry in the Study Planner (`study_exams`). Has a subject name, exam date, and optional syllabus (pasted text or uploaded PDF). The AI generates `study_topics` for it.

**study_topic** — One revision topic generated by the AI for a `study_exam` (`study_topics`). Has an estimated weight (light/medium/heavy), a scheduled date, and a done/pending status. Together these form the AI-generated study calendar for that exam.

---

## 5. Major Working Flows

### 5.1 Club Event → Timetable Override Approval Chain
A club admin creates a `club_events` row (`status = 'pending_faculty_coordinator'`) with an `affected_slots` array listing which timetable slots the event will consume. The faculty coordinator advances status to `pending_saps`; the SAPS coordinator advances to `pending_hod`; the HOD approves (`status = 'approved'`). On approval the app sets `timetable_slots.overridden_by_event` on each affected slot and writes to `timetable_change_log`. Rejection at any stage stops the chain.
**Tables:** `club_events`, `timetable_slots` (overridden_by_event), `timetable_change_log`, `notifications`.

### 5.2 Substitute Request Flow
A teacher selects one of their slots in `TeacherDashboardScreen` and submits a `substitute_requests` row with a reason and optional preferred substitute. The timetable team approves: `timetable_slots.faculty_name` is updated to the substitute's name, a `timetable_change_log` row is written (`change_type = 'substitute'`), and a `compensatory_requests` row is auto-created for the original teacher via `compensatoryUtils.js` which searches for a free slot.
**Tables:** `substitute_requests`, `timetable_slots`, `timetable_change_log`, `compensatory_requests`, `notifications`.

### 5.3 Compensatory Class Flow
A `compensatory_request` is created with `status = 'pending'` (free slot found) or `status = 'unresolved'` (none found). For pending ones the timetable team reviews the proposed slot, approves, and the slot is updated in `timetable_slots`. For unresolved ones the team manually schedules a make-up by editing the timetable directly, then marks the request resolved.
**Tables:** `compensatory_requests`, `timetable_slots`, `timetable_change_log`, `notifications`.

### 5.4 Faculty Coordinator Request Flow
A teacher opens their dashboard and requests to coordinate a club, creating a `faculty_club_requests` row. The Super Admin reviews the queue in `SuperAdminScreen`, approves it, which inserts a `faculty_coordinators` row (teacher_name + club_id + assigned_by) and sets the request to `approved`. The teacher then sees coordinator-level options in club flows.
**Tables:** `faculty_club_requests`, `faculty_coordinators`, `notifications`.

### 5.5 Club Contribution Hours Flow
A club member self-requests hours from the Club Dashboard, creating or incrementing a `club_member_hours` row. The club admin reviews and approves the adjustment via an `hour_adjustments` intermediate record. On approval the main `club_member_hours` total is updated. The UNIQUE(user_id, club_id) constraint enables upsert.
**Tables:** `club_member_hours`, `hour_adjustments`, `notifications`.

### 5.6 CR Dashboard and Attendance Flow
A student applies for CR via `cr_requests` (`status = 'pending'`). Super Admin approves. The approved CR's dashboard loads `cr_class_rolls` (the roll number roster for their class) and renders a present/absent checklist. Checklist state is managed locally per session — no `attendance_records` table exists yet.
**Tables:** `cr_requests`, `cr_class_rolls`.

### 5.7 Documentation Flow
**NFA:** Club admin or faculty coordinator fills the NFA form, creating an `nfa_requests` row. Faculty coordinator approves. On approval the user can invoke `generate-docx` to download a `.docx`.
**Activity Report:** Documentation team submits an `activity_reports` row. Coordinator approves (`coordinator_status = 'approved'`), then SAPS approves (`saps_status = 'approved'`). Both must pass before `.docx` generation.
**Tables:** `nfa_requests`, `activity_reports`, `notifications`.

### 5.8 Study Planner Flow
A student adds an exam (`study_exams`), pastes or uploads a syllabus, then calls `generate-study-plan` (Claude Haiku). The Edge Function returns a JSON array of topics with weights, inserted as `study_topics` rows. The student's `study_availability` (hours per day-of-week) informs date scheduling. Topics are spread between today and the exam date, viewable as a calendar. The student marks topics done.
**Tables:** `study_exams`, `study_topics`, `study_availability`.

### 5.9 Teacher Onboarding Flow
A teacher signs up via Supabase Auth (`profiles.role = 'teacher'`, `status = 'pending'`). Super Admin sees them in `SuperAdminScreen` Teachers tab, approves (`status = 'approved'`), and links them to a seed teacher by setting `teacher_profiles.seed_teacher_id`. On linking, `profiles.name` is overwritten with the seed teacher's canonical name so that `timetable_slots.faculty_name` matching works automatically.
**Tables:** `profiles`, `teacher_profiles`.

### 5.10 Timetable Reset Flow
The timetable team invokes `reset_timetable_slots()` (Supabase SQL function). This truncates `timetable_slots` and re-seeds from the canonical slot seed. After reset, the app re-applies all rows in `timetable_permanent_overrides` on top. `timetable_change_log` is not cleared — audit history is preserved.
**Tables:** `timetable_slots`, `timetable_permanent_overrides`.

---

## 6. Key People / Roles in the System

### Dr. Hridhya P K
Seed teacher ID 1. `position: 'Department Coordinator'`. Final approver (HOD) in the club event timetable override chain — the `pending_hod` stage. Has `no_saturdays = true` in `timetable_faculty_constraints`. `coordinatorClubIds` in seed data includes every club — she has visibility over all clubs. Does not hold `is_super_admin` in `profiles` but holds the highest institutional approval authority.

### CS Monika Agarwal
Seed teacher ID 6. `position: 'SAPS Coordinator'`. Second approver in the club event chain (`pending_saps` stage). Has `faculty_coordinators` rows for all 17 active clubs (inserted via `supabase_monika_all_clubs.sql`) — she can act as coordinator for any club. Her presence in `saps_members` (or `is_super_admin`) grants write access to club-protected tables via `is_club_admin_write()`.

### ACCA Bhoomika Urs
Seed teacher ID 7. `position: 'Industry Connect Coordinator'`. Faculty coordinator for Club 8 (Industry Connect). No special platform-level permissions beyond being a faculty coordinator for club 8.

### Super Admin (app role)
Any user with `profiles.is_super_admin = true`. Accesses `SuperAdminScreen` with: stats dashboard (10-metric grid), teacher management (approve + link to seed), timetable team assignment, and CR approval. The flag is set manually in the Supabase dashboard.

### Timetable Team
Users assigned the timetable team role in the app (checked via AppContext; stored as a role/tag in `profiles` or `teacher_profiles` — not a dedicated column). Can edit slots, approve substitute requests, manage compensatory classes, and will use the Timetable AI when it is enabled.

### SAPS Members
Rows in `saps_members` (President, VP, Member Secretary, Secretary, Vice Secretary). They get write access to club-protected tables via `is_club_admin_write()` and are the second approver in the club event chain.

---

## 7. Open Constraints and Rules

### HED Block
Tuesday Period 2 is reserved for HED (Higher Education Department) for 1st and 3rd semester classes: `1BcomIBA`, `1BcomF&A`, `1BcomIAF`, `3BcomIBA`, `3BcomF&A(A)`, `3BcomF&A(B)`, `3BcomIAF`. The timetable planner renders this slot with a special HED badge and blocks editing. 5th semester classes (`5Bcom*`) are not subject to this block. Logic is hardcoded in `TimetablePlannerScreen.js`.

### External Department Slots
Some `timetable_slots` rows have a faculty name from outside the Commerce department (e.g. Language teachers). These are present in the grid but have **no protection logic** — they can be accidentally overwritten by any timetable team member. Planned fix: add `is_external boolean DEFAULT false` to `timetable_slots` and render those cells as read-only.

### Period Structure
| Period | Start | End | Notes |
|--------|-------|-----|-------|
| M1 | 07:30 | 08:30 | Morning 1 |
| M2 | 08:30 | 09:30 | Morning 2 |
| — | 09:30 | 10:00 | Break (no period) |
| P1 | 10:00 | 11:00 | Post-break 1 |
| P2 | 11:00 | 12:00 | Post-break 2 (HED on TUE for sem 1/3) |
| P3 | 12:00 | 13:00 | Post-break 3 |
| P4 | 13:00 | 14:00 | Post-break 4 |

6 teaching periods per day. The 09:30–10:00 gap is a break with no period slot. Saturday uses the same period names; many faculty have `no_saturdays = true`.

### Class Naming Convention
- Leading digit = semester: `1` = 1st sem (1st year), `3` = 3rd sem (2nd year), `5` = 5th sem (3rd year), `7` = 7th sem (4th year).
- Programme suffix: `BcomIBA` (International Business Accounting), `BcomF&A` (Finance & Accounts), `BcomIAF` (International Accounting & Finance).
- Sections: F&A splits at 3rd sem — `3BcomF&A(A)` and `3BcomF&A(B)`. In `profiles.class` the section may appear without parentheses (`3BcomF&A A`).
- `7BcomF&A` has a different period structure (likely evening batch) — partially seeded, not fully verified.

### Faculty Name Matching
`timetable_slots.faculty_name` must exactly match the seed teacher's `name` in `src/data/index.js` for the teacher dashboard to identify "your" slots. `teacher_profiles.seed_teacher_id` is the authoritative link; `profiles.name` is overwritten on Super Admin approval to match the canonical seed name. Slash-separated names (`'Dr. A / Dr. B'`) denote shared/split slots; the app splits on ` / ` when checking slot ownership.

---

## 8. Current Open Items / Known Gaps

1. **External Department slot protection** — No `is_external` flag exists. Timetable team can accidentally edit language/common-department slots. Plan: add `is_external boolean DEFAULT false` to `timetable_slots`, render read-only for non-super-admins.

2. **7BcomF&A timetable** — Different period structure (likely evening batch). Partially seeded but the period-time mapping doesn't match the standard structure. Needs verification with the actual schedule.

3. **White-label config layer** — Department name, campus, class names, and club list are hardcoded in `src/data/index.js` and SQL seeds. A config layer would allow another department to deploy without code changes. Not yet started.

4. **NFA event-linking** — `nfa_requests` has no FK to `hub_events` or `club_events`. Plan: add `event_id` column to link an NFA to a specific scheduled event for cross-referencing.

5. **Timetable AI (Coming Soon)** — The `parse-timetable` Edge Function and all client-side assistant code in `TimetablePlannerScreen.js` are fully implemented. Entry point is hidden behind a "Coming Soon" button pending real timetable file testing.

6. **`timetable_assistant_sessions` table** — Must be manually created in Supabase SQL editor by running `supabase_timetable_sessions.sql`. Not yet confirmed as created.

7. **Attendance persistence** — CR attendance checklist manages state locally per session. No `attendance_records` table exists; marks reset on reload.

8. **`hour_adjustments` table** — Referenced in `supabase_club_contribution_hours.sql` but has no CREATE TABLE migration file — created via Supabase dashboard. Exact column schema unknown from repo files.

9. **`teacher_mentees` table** — Referenced in `supabase_mentor_revamp.sql` (adds `cgpa`, `attendance_pct`, `progress_note`, etc.) but no CREATE TABLE migration exists. Created via dashboard.

10. **Connection request DM gate** — `connection_requests` has 41 rows but `user_connections` is empty. The DM screen uses `hasPendingRequest()` for the empty-state message; the full accept/decline flow may not be fully wired end-to-end.
