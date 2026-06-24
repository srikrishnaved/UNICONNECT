-- Run once in Supabase SQL Editor.
-- Adds seed_teacher_id to teacher_profiles so Supabase-account teachers can be
-- linked to a hardcoded seed teacher (from src/data/index.js teachers array).
-- When set, profiles.name is overwritten with the seed teacher's name on signup,
-- so timetable slot matching works automatically.

ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS seed_teacher_id integer;
