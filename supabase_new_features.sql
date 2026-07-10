-- ── New tables for attendance, NAAC docs, and university configuration ─────────
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run: uses IF NOT EXISTS for tables and drops policies before recreating.

-- ── 1. University setup / configuration ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS university_setup_progress (
  university_id       text PRIMARY KEY,
  university_name     text,
  university_address  text,
  university_website  text,
  university_phone    text,
  enabled_classes     text[] DEFAULT '{}',
  step_details_done   boolean DEFAULT false,
  step_classes_done   boolean DEFAULT false,
  is_setup_complete   boolean DEFAULT false,
  updated_at          timestamptz DEFAULT now(),
  created_at          timestamptz DEFAULT now()
);
ALTER TABLE university_setup_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usp_all" ON university_setup_progress;
CREATE POLICY "usp_all" ON university_setup_progress FOR ALL USING (true) WITH CHECK (true);

-- ── 2. Period schedule per university ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS university_periods (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id    text NOT NULL,
  label            text NOT NULL,
  start_time       text,
  end_time         text,
  is_break         boolean DEFAULT false,
  period_order     int DEFAULT 0,
  applies_to_days  text[] DEFAULT ARRAY['MON','TUE','WED','THU','FRI'],
  created_at       timestamptz DEFAULT now(),
  UNIQUE(university_id, label)
);
ALTER TABLE university_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "up_all" ON university_periods;
CREATE POLICY "up_all" ON university_periods FOR ALL USING (true) WITH CHECK (true);

-- ── 3. Subjects list per university ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS university_subjects (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id  text NOT NULL,
  class_name     text NOT NULL,
  subject_name   text NOT NULL,
  subject_code   text,
  teacher_name   text,
  is_elective    boolean DEFAULT false,
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE university_subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "us_all" ON university_subjects;
CREATE POLICY "us_all" ON university_subjects FOR ALL USING (true) WITH CHECK (true);

-- ── 4. Class student roster ───────────────────────────────────────────────────
-- Populated by the "Upload Roster" modal (Excel/CSV import).
CREATE TABLE IF NOT EXISTS class_students (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  class_name  text NOT NULL,
  name        text NOT NULL,
  identifier  text,        -- roll number / reg number
  email       text,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cs_all" ON class_students;
CREATE POLICY "cs_all" ON class_students FOR ALL USING (true) WITH CHECK (true);

-- ── 5. Attendance sessions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id    text,
  class_name    text NOT NULL,
  subject       text,
  period_label  text,
  session_date  date NOT NULL DEFAULT CURRENT_DATE,
  is_finalized  boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "atts_all" ON attendance_sessions;
CREATE POLICY "atts_all" ON attendance_sessions FOR ALL USING (true) WITH CHECK (true);

-- ── 6. Per-student attendance records ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_records (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  uuid REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id  uuid REFERENCES class_students(id)      ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'present',  -- 'present' | 'absent'
  marked_by   text,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attr_all" ON attendance_records;
CREATE POLICY "attr_all" ON attendance_records FOR ALL USING (true) WITH CHECK (true);

-- ── 7. NAAC SSR documentation submissions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS naac_submissions (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id      text NOT NULL,
  criterion          int,
  metric             text NOT NULL,
  metric_title       text,
  status             text DEFAULT 'not_started',  -- 'not_started' | 'draft' | 'complete'
  input_data         jsonb DEFAULT '{}',
  generated_content  text,
  updated_at         timestamptz DEFAULT now(),
  created_at         timestamptz DEFAULT now(),
  UNIQUE(university_id, metric)
);
ALTER TABLE naac_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ns_all" ON naac_submissions;
CREATE POLICY "ns_all" ON naac_submissions FOR ALL USING (true) WITH CHECK (true);
