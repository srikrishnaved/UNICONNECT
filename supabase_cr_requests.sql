-- ── CR (Class Representative) Requests ───────────────────────────────────────
-- Run this in the Supabase SQL editor if the cr_requests table does not exist.
-- This table is queried on every user login; a missing table causes a 404 in
-- the network tab (query: ...cr_requests?...&order=created_at.desc&limit=1).

CREATE TABLE IF NOT EXISTS cr_requests (
  id         uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid    REFERENCES profiles(id) ON DELETE CASCADE,
  user_name  text    NOT NULL,
  course     text,
  year       text,
  campus     text,
  reason     text,
  status     text    NOT NULL DEFAULT 'pending',
    -- 'pending' | 'approved' | 'rejected' | 'resigned'
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cr_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cr_read"   ON cr_requests;
DROP POLICY IF EXISTS "cr_insert" ON cr_requests;
DROP POLICY IF EXISTS "cr_update" ON cr_requests;

CREATE POLICY "cr_read"   ON cr_requests FOR SELECT USING (true);
CREATE POLICY "cr_insert" ON cr_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "cr_update" ON cr_requests FOR UPDATE USING (true) WITH CHECK (true);
