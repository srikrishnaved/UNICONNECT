-- ── Club Events + Timetable Override ─────────────────────────────────────────
-- Run this in the Supabase SQL editor.

-- 1. Club events table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_events (
  id             uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id        text    NOT NULL,
  created_by     uuid    REFERENCES profiles(id) ON DELETE SET NULL,
  creator_role   text    NOT NULL DEFAULT 'club_admin',
    -- 'club_admin' | 'faculty_coordinator' | 'saps_coordinator' | 'hod'
  event_name     text    NOT NULL,
  description    text,
  event_date     date    NOT NULL,
  start_time     text    NOT NULL,   -- e.g. '10:00'
  end_time       text    NOT NULL,   -- e.g. '13:00'
  status         text    NOT NULL DEFAULT 'pending_faculty_coordinator',
    -- 'pending_faculty_coordinator' | 'pending_saps' | 'pending_hod'
    -- | 'approved' | 'rejected'
  affected_slots jsonb   DEFAULT '[]',
    -- array of {class_name, day, period_name, course_name}
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE club_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce_read"   ON club_events FOR SELECT USING (true);
CREATE POLICY "ce_insert" ON club_events FOR INSERT WITH CHECK (true);
CREATE POLICY "ce_update" ON club_events FOR UPDATE USING (true) WITH CHECK (true);

-- 2. Add override column to timetable_slots ────────────────────────────────────
-- Stores {original_course_name, original_faculty_name, event_id, event_name}
-- when a slot is overridden by a club event. NULL otherwise.
ALTER TABLE timetable_slots
  ADD COLUMN IF NOT EXISTS overridden_by_event jsonb;
