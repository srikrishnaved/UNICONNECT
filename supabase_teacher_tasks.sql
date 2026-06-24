-- ── Teacher Tasks ─────────────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor.
-- teacher_id must be TEXT to match seed teacher numeric IDs ('1', '6', etc.).
-- The existing table was created with teacher_id uuid + a FK to profiles(id).
-- We drop that FK first, then convert the column to text.

-- 1. Drop the foreign key constraint that blocks the type change.
ALTER TABLE teacher_tasks
  DROP CONSTRAINT IF EXISTS teacher_tasks_teacher_id_fkey;

-- 2. Convert teacher_id from uuid to text (idempotent if already text).
ALTER TABLE teacher_tasks
  ALTER COLUMN teacher_id TYPE text USING teacher_id::text;

-- 3. Ensure the table exists with the right schema (no-op if already present).
CREATE TABLE IF NOT EXISTS teacher_tasks (
  id             uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id     text    NOT NULL,
  title          text    NOT NULL,
  deadline       text,
  duration_hours numeric,
  status         text    NOT NULL DEFAULT 'pending',
    -- 'pending' | 'in_progress' | 'done'
  created_at     timestamptz DEFAULT now()
);

-- 4. RLS
ALTER TABLE teacher_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_read"   ON teacher_tasks;
DROP POLICY IF EXISTS "tasks_insert" ON teacher_tasks;
DROP POLICY IF EXISTS "tasks_update" ON teacher_tasks;
DROP POLICY IF EXISTS "tasks_delete" ON teacher_tasks;

CREATE POLICY "tasks_read"   ON teacher_tasks FOR SELECT USING (true);
CREATE POLICY "tasks_insert" ON teacher_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "tasks_update" ON teacher_tasks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "tasks_delete" ON teacher_tasks FOR DELETE USING (true);
