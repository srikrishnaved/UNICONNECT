-- ── Club Contribution Hours ────────────────────────────────────────────────
-- Run this in the Supabase SQL editor.
-- Tables already exist (created via dashboard).  This script adds:
--   1. UNIQUE constraint on club_member_hours(user_id, club_id)  → enables upsert
--   2. RLS on both tables (open policy: all USING/WITH CHECK true)

-- ── 1. club_member_hours ───────────────────────────────────────────────────

ALTER TABLE club_member_hours ENABLE ROW LEVEL SECURITY;

-- UNIQUE constraint for upsert(onConflict:'user_id,club_id')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'club_member_hours_user_club_unique'
  ) THEN
    ALTER TABLE club_member_hours
      ADD CONSTRAINT club_member_hours_user_club_unique UNIQUE (user_id, club_id);
  END IF;
END $$;

DROP POLICY IF EXISTS "cmh_select" ON club_member_hours;
DROP POLICY IF EXISTS "cmh_insert" ON club_member_hours;
DROP POLICY IF EXISTS "cmh_update" ON club_member_hours;
DROP POLICY IF EXISTS "cmh_delete" ON club_member_hours;

CREATE POLICY "cmh_select" ON club_member_hours FOR SELECT USING (true);
CREATE POLICY "cmh_insert" ON club_member_hours FOR INSERT WITH CHECK (true);
CREATE POLICY "cmh_update" ON club_member_hours FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "cmh_delete" ON club_member_hours FOR DELETE USING (true);

-- ── 2. hour_adjustments ───────────────────────────────────────────────────

ALTER TABLE hour_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ha_select" ON hour_adjustments;
DROP POLICY IF EXISTS "ha_insert" ON hour_adjustments;
DROP POLICY IF EXISTS "ha_update" ON hour_adjustments;
DROP POLICY IF EXISTS "ha_delete" ON hour_adjustments;

CREATE POLICY "ha_select" ON hour_adjustments FOR SELECT USING (true);
CREATE POLICY "ha_insert" ON hour_adjustments FOR INSERT WITH CHECK (true);
CREATE POLICY "ha_update" ON hour_adjustments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "ha_delete" ON hour_adjustments FOR DELETE USING (true);
