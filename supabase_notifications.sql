-- ── notifications RLS fix ──────────────────────────────────────────────────
-- The table was created via the Supabase dashboard without a DELETE policy.
-- With RLS enabled, a missing DELETE policy silently blocks all deletes
-- (0 rows deleted, no error), so clearAll / clearOne never actually remove
-- rows — they only clear local state, so notifications reappear on reload.
-- Run this in the Supabase SQL Editor.

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select" ON notifications;
DROP POLICY IF EXISTS "notif_insert" ON notifications;
DROP POLICY IF EXISTS "notif_update" ON notifications;
DROP POLICY IF EXISTS "notif_delete" ON notifications;

CREATE POLICY "notif_select" ON notifications FOR SELECT USING (true);
CREATE POLICY "notif_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notif_update" ON notifications FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "notif_delete" ON notifications FOR DELETE USING (true);
