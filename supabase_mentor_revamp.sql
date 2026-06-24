-- Mentor revamp: add academic progress + session scheduling to teacher_mentees.
-- Run once in Supabase SQL Editor.

ALTER TABLE teacher_mentees
  ADD COLUMN IF NOT EXISTS cgpa             numeric(3,2),
  ADD COLUMN IF NOT EXISTS attendance_pct   integer,
  ADD COLUMN IF NOT EXISTS progress_note    text,
  ADD COLUMN IF NOT EXISTS progress_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_session_date   text,
  ADD COLUMN IF NOT EXISTS next_session_note   text;
