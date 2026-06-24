-- ── Event Tracker Steps + Hub Events DELETE fix ───────────────────────────────
-- Run this in the Supabase SQL editor.

-- 1. event_tracker_steps table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_tracker_steps (
  id         uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id   text    NOT NULL,   -- hub event id (UUID string or legacy numeric)
  club_id    text    NOT NULL,
  label      text    NOT NULL,
  done       boolean NOT NULL DEFAULT false,
  sort_order int     NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE event_tracker_steps ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies so running this twice is safe
DROP POLICY IF EXISTS "ets_read"   ON event_tracker_steps;
DROP POLICY IF EXISTS "ets_insert" ON event_tracker_steps;
DROP POLICY IF EXISTS "ets_update" ON event_tracker_steps;
DROP POLICY IF EXISTS "ets_delete" ON event_tracker_steps;

CREATE POLICY "ets_read"   ON event_tracker_steps FOR SELECT USING (true);
CREATE POLICY "ets_insert" ON event_tracker_steps FOR INSERT WITH CHECK (true);
CREATE POLICY "ets_update" ON event_tracker_steps FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "ets_delete" ON event_tracker_steps FOR DELETE USING (true);

-- 2. hub_events DELETE policy ──────────────────────────────────────────────────
-- Only needed if hub_events has RLS enabled. Run this block if hub event
-- deletion shows "permission denied" or silently fails.
ALTER TABLE hub_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "he_select" ON hub_events;
DROP POLICY IF EXISTS "he_insert" ON hub_events;
DROP POLICY IF EXISTS "he_update" ON hub_events;
DROP POLICY IF EXISTS "he_delete" ON hub_events;
CREATE POLICY "he_select" ON hub_events FOR SELECT USING (true);
CREATE POLICY "he_insert" ON hub_events FOR INSERT WITH CHECK (true);
CREATE POLICY "he_update" ON hub_events FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "he_delete" ON hub_events FOR DELETE USING (true);
