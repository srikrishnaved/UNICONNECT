-- ── Documentation Tables ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nfa_requests (
  id                  uuid primary key default gen_random_uuid(),
  created_by          uuid references profiles(id) on delete set null,
  creator_name        text,
  creator_role        text, -- 'club_admin' | 'faculty_coordinator'
  club_id             text,
  club_name           text,
  abstract            text,
  objectives          text, -- newline-separated bullets
  expected_outcomes   text, -- newline-separated bullets
  title_of_session    text,
  resource_person     text,
  target_audience     text,
  stakeholders_count  text,
  event_date          text,
  event_time          text,
  mode                text,
  link                text,
  venue               text,
  organised_by        text,
  key_takeaways       text, -- newline-separated bullets
  budget_items        jsonb, -- array of {particular, amount}
  status              text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  rejection_reason    text,
  reviewed_by         text,
  created_at          timestamptz default now()
);

CREATE TABLE IF NOT EXISTS activity_reports (
  id                            uuid primary key default gen_random_uuid(),
  created_by                    uuid references profiles(id) on delete set null,
  creator_name                  text,
  club_id                       text,
  club_name                     text,
  type_of_activity              text,
  title_of_activity             text,
  activity_date                 text,
  activity_time                 text,
  venue                         text,
  speaker_names                 text,
  speaker_titles                text,
  speaker_org                   text,
  presentation_title            text,
  participant_type              text,
  participant_count             text,
  highlights                    text,
  key_takeaways                 text,
  summary                       text,
  organiser_name                text,
  organiser_designation         text,
  atr                           text,
  coordinator_status            text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  coordinator_rejection_reason  text,
  saps_status                   text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  saps_rejection_reason         text,
  created_at                    timestamptz default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE nfa_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfa_select"  ON nfa_requests    FOR SELECT USING (true);
CREATE POLICY "nfa_insert"  ON nfa_requests    FOR INSERT WITH CHECK (true);
CREATE POLICY "nfa_update"  ON nfa_requests    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "ar_select"   ON activity_reports FOR SELECT USING (true);
CREATE POLICY "ar_insert"   ON activity_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "ar_update"   ON activity_reports FOR UPDATE USING (true) WITH CHECK (true);

-- ── Migrations ────────────────────────────────────────────────────────────────

-- Links an NFA to the hub_event or club_event it was created from (optional).
alter table nfa_requests add column if not exists linked_event_id text;
