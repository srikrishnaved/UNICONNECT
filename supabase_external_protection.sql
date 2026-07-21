-- Migration script to enable external slot protection
-- Run this in the Supabase SQL Editor.

-- 1. Add is_external column to timetable_slots if it doesn't already exist
ALTER TABLE timetable_slots ADD COLUMN IF NOT EXISTS is_external boolean DEFAULT false;

-- 2. Flag existing external / language / common course slots
UPDATE timetable_slots 
SET is_external = true 
WHERE faculty_name ILIKE 'External%' 
   OR course_name IN ('Language', 'English', 'ENG', 'ENG ', 'Foundation Kannada', 'Kannada', 'Yoga', 'MDC', 'PECF', 'CAPS', 'EVS');

-- 3. Check for any slots currently assigned to these courses and verify they are flagged
SELECT class_name, day, period_name, course_name, faculty_name, is_external 
FROM timetable_slots 
WHERE is_external = true;
