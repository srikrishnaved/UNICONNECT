-- Compensatory Requests
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS compensatory_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_name         text NOT NULL,
  original_class_name  text NOT NULL,
  original_day         text,
  original_period_name text,
  source_change_log_id uuid REFERENCES timetable_change_log(id) ON DELETE SET NULL,
  proposed_slot_id     uuid REFERENCES timetable_slots(id) ON DELETE SET NULL,
  proposed_day         text,
  proposed_period_name text,
  proposed_course_name text,
  status               text NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected' | 'unresolved'
  reviewed_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at           timestamptz DEFAULT now()
);

ALTER TABLE compensatory_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cr_select" ON compensatory_requests FOR SELECT USING (true);
CREATE POLICY "cr_insert" ON compensatory_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "cr_update" ON compensatory_requests FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "cr_delete" ON compensatory_requests FOR DELETE USING (true);
