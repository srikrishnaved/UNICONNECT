-- ── substitute_requests table ────────────────────────────────────────────────
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS substitute_requests (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id                  uuid REFERENCES timetable_slots(id) ON DELETE SET NULL,
  requesting_teacher_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  requesting_teacher_name  text NOT NULL,
  reason                   text NOT NULL,
  preferred_substitute     text,
  status                   text NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  created_at               timestamptz DEFAULT now()
);

ALTER TABLE substitute_requests ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (teacher sees their own; team sees all via app logic)
CREATE POLICY "sr_read"   ON substitute_requests FOR SELECT USING (true);
-- Any authenticated user can insert (the requesting teacher)
CREATE POLICY "sr_insert" ON substitute_requests FOR INSERT WITH CHECK (true);
-- Team members can update status (approved / rejected)
CREATE POLICY "sr_update" ON substitute_requests FOR UPDATE USING (true) WITH CHECK (true);
