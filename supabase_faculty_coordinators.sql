-- Run once in Supabase SQL Editor.
-- Stores approved faculty-club coordinator relationships.
-- Inserted automatically when AdminDashboard approves a faculty_club_request.

CREATE TABLE IF NOT EXISTS faculty_coordinators (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_name text NOT NULL,
  teacher_id   text,
  club_id      text NOT NULL,
  club_name    text,
  assigned_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (teacher_name, club_id)
);

ALTER TABLE faculty_coordinators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fc_select" ON faculty_coordinators FOR SELECT USING (true);
CREATE POLICY "fc_insert" ON faculty_coordinators FOR INSERT WITH CHECK (true);
CREATE POLICY "fc_delete" ON faculty_coordinators FOR DELETE USING (true);
