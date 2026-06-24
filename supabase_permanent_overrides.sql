-- timetable_permanent_overrides
-- Slots that survive a timetable reset.
-- After calling reset_timetable_slots(), the app re-applies these on top.
-- Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS timetable_permanent_overrides (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  class_name      text NOT NULL,
  day             text NOT NULL,
  period_name     text NOT NULL,
  course_code     text,
  course_name     text,
  faculty_name    text,
  batch_details   text,
  is_elective     boolean DEFAULT false,
  reason          text,
  changed_by_name text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (class_name, day, period_name)
);

ALTER TABLE timetable_permanent_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_select" ON timetable_permanent_overrides FOR SELECT USING (true);
CREATE POLICY "po_insert" ON timetable_permanent_overrides FOR INSERT WITH CHECK (true);
CREATE POLICY "po_update" ON timetable_permanent_overrides FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "po_delete" ON timetable_permanent_overrides FOR DELETE USING (true);
