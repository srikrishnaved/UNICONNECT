-- Run once in Supabase SQL Editor.
-- Adds display_name to profiles so teachers can change what name is shown
-- without affecting timetable slot matching (which uses the original `name` column).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name text;
