-- ─── Timetable Planner Tables ────────────────────────────────────────────────
-- Run this FIRST in the Supabase SQL editor.
-- Then run supabase_timetable_slots_seed.sql.

-- 1. Period definitions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable_periods (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,          -- 'M1', 'M2', 'P1' … 'P4'
  start_time  text NOT NULL,          -- '7:30'
  end_time    text NOT NULL,          -- '8:30'
  sort_order  int  NOT NULL,
  is_saturday boolean DEFAULT false   -- reserved for Saturday-only variants
);

-- 2. Classroom / room assignments per class ────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable_classrooms (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  class_name  text NOT NULL UNIQUE,
  room_number text,                   -- fill in via Supabase dashboard
  max_time    text                    -- optional: latest period allowed e.g. '14:00'
);

-- 3. Faculty availability constraints ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable_faculty_constraints (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  faculty_name       text NOT NULL,
  available_days     text[] DEFAULT '{}', -- e.g. '{MON,TUE,WED,THU,FRI}'; empty = all days
  time_window_start  text,               -- e.g. '09:30' — earliest period start allowed
  time_window_end    text                -- e.g. '14:00' — latest period start allowed (exclusive)
);

-- 4. Elective / paired session groups ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable_paired_sessions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  class_name   text NOT NULL,
  day          text NOT NULL,
  period_name  text NOT NULL,
  course_code_a  text,
  course_name_a  text,
  faculty_a      text,
  course_code_b  text,
  course_name_b  text,
  faculty_b      text
);

-- 5. Timetable slots (main data table) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable_slots (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  class_name    text NOT NULL,
  day           text NOT NULL,        -- 'MON' … 'SAT'
  period_name   text NOT NULL,        -- 'M1', 'M2', 'P1' … 'P4'
  course_code   text,
  course_name   text,
  faculty_name  text,
  batch_details text,
  is_elective   boolean DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (class_name, day, period_name)
);

-- 6. Change log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable_change_log (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  changed_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  class_name   text NOT NULL,
  day          text NOT NULL,
  period_name  text NOT NULL,
  old_faculty  text,
  new_faculty  text,
  reason       text,
  change_type  text NOT NULL DEFAULT 'edit',  -- 'edit' | 'substitute' | 'cancel'
  created_at   timestamptz DEFAULT now()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE timetable_periods          ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_classrooms       ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_faculty_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_paired_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots            ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_change_log       ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read everything
CREATE POLICY "tp_read"   ON timetable_periods          FOR SELECT USING (true);
CREATE POLICY "tc_read"   ON timetable_classrooms       FOR SELECT USING (true);
CREATE POLICY "tfc_read"  ON timetable_faculty_constraints FOR SELECT USING (true);
CREATE POLICY "tps_read"  ON timetable_paired_sessions  FOR SELECT USING (true);
CREATE POLICY "ts_read"   ON timetable_slots            FOR SELECT USING (true);
CREATE POLICY "tcl_read"  ON timetable_change_log       FOR SELECT USING (true);

-- Slots: timetable team can insert / update
CREATE POLICY "ts_insert" ON timetable_slots FOR INSERT WITH CHECK (true);
CREATE POLICY "ts_update" ON timetable_slots FOR UPDATE USING (true) WITH CHECK (true);

-- Change log: anyone can insert (the app writes on behalf of the editor)
CREATE POLICY "tcl_insert" ON timetable_change_log FOR INSERT WITH CHECK (true);

-- ─── Seed: Periods ────────────────────────────────────────────────────────────

INSERT INTO timetable_periods (name, start_time, end_time, sort_order, is_saturday)
VALUES
  ('M1', '7:30',  '8:30',  1, false),
  ('M2', '8:30',  '9:30',  2, false),
  ('P1', '10:00', '11:00', 3, false),
  ('P2', '11:00', '12:00', 4, false),
  ('P3', '12:00', '13:00', 5, false),
  ('P4', '13:00', '14:00', 6, false)
ON CONFLICT DO NOTHING;

-- ─── Seed: Classrooms (room numbers — fill these in via Supabase dashboard) ───

INSERT INTO timetable_classrooms (class_name, room_number, max_time)
VALUES
  ('1BcomIBA',    NULL, NULL),
  ('1BcomF&A',    NULL, NULL),
  ('1BcomIAF',    NULL, NULL),
  ('3BcomIBA',    NULL, NULL),
  ('3BcomF&A(A)', NULL, NULL),
  ('3BcomF&A(B)', NULL, NULL),
  ('3BcomIAF',    NULL, NULL),
  ('5BcomF&A(A)', NULL, NULL),
  ('5BcomF&A(B)', NULL, NULL),
  ('5BcomIAF',    NULL, NULL),
  ('7BcomF&A',    NULL, NULL)
ON CONFLICT (class_name) DO NOTHING;

-- ─── Seed: Faculty constraints ────────────────────────────────────────────────

INSERT INTO timetable_faculty_constraints (faculty_name, no_saturdays, monday_only_before)
VALUES
  ('Dr. Hridhya',   true,  NULL),
  ('Dr. Diliphan',  true,  NULL),
  ('Dr. Thirupathi', false, '10:00')
ON CONFLICT DO NOTHING;
