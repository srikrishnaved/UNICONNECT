-- Run once in Supabase SQL Editor.
-- Stores timetable-team overrides for faculty availability constraints.
-- Rows here take priority over the hardcoded ADJUNCT_CONSTRAINTS in the app.
-- Deleting a row restores the hardcoded default for that faculty member.

CREATE TABLE IF NOT EXISTS faculty_availability (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  faculty_name  text NOT NULL UNIQUE,
  available_days text[],       -- e.g. '{MON,TUE,THU}' — NULL means all days
  window_end    text,          -- e.g. '09:30' — period start must be before this time
  sat_window_end text,         -- optional Saturday override, e.g. '10:30'
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE faculty_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fa_select" ON faculty_availability FOR SELECT USING (true);
CREATE POLICY "fa_insert" ON faculty_availability FOR INSERT WITH CHECK (true);
CREATE POLICY "fa_update" ON faculty_availability FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "fa_delete" ON faculty_availability FOR DELETE USING (true);
