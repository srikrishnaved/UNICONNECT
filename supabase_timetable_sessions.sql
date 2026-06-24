-- Temporary session storage for Timetable Assistant parsed results.
-- The Edge Function stores slots here when state=ready and returns only a session_id.
-- The client fetches slots on Apply, then deletes the session.
-- Sessions are auto-cleaned after 24 hours by the Edge Function.

create table if not exists timetable_assistant_sessions (
  session_id  uuid        primary key default gen_random_uuid(),
  slots       jsonb       not null,
  class_names text[]      not null default '{}',
  slot_count  int         not null default 0,
  created_at  timestamptz not null default now()
);

-- Service role key bypasses RLS; no user-facing policies needed.
alter table timetable_assistant_sessions enable row level security;
