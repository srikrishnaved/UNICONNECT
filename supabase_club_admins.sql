-- ── club_admins RLS fix ────────────────────────────────────────────────────
-- The table was created via the Supabase dashboard without a DELETE policy.
-- With RLS enabled, missing policies silently block the operation (0 rows
-- deleted, no error), so resignClubAdmin never actually removes the DB row.
-- Run this in the Supabase SQL Editor.

ALTER TABLE club_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ca_select" ON club_admins;
DROP POLICY IF EXISTS "ca_insert" ON club_admins;
DROP POLICY IF EXISTS "ca_update" ON club_admins;
DROP POLICY IF EXISTS "ca_delete" ON club_admins;

CREATE POLICY "ca_select" ON club_admins FOR SELECT USING (true);
CREATE POLICY "ca_insert" ON club_admins FOR INSERT WITH CHECK (true);
CREATE POLICY "ca_update" ON club_admins FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "ca_delete" ON club_admins FOR DELETE USING (true);
