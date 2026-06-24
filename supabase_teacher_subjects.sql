-- Run this in the Supabase SQL editor to create the teacher_subjects table

CREATE TABLE IF NOT EXISTS teacher_subjects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(teacher_id, subject_id)
);

ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_subjects_select" ON teacher_subjects FOR SELECT USING (true);
CREATE POLICY "teacher_subjects_insert" ON teacher_subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "teacher_subjects_delete" ON teacher_subjects FOR DELETE USING (true);
