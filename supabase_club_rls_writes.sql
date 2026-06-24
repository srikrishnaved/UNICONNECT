-- ── Club write-protection RLS migration ──────────────────────────────────────
-- Replaces fully-open write policies on five club-related tables.
-- READ (SELECT) stays open on all. Only INSERT/DELETE (and UPDATE where writable)
-- are gated behind an admin check.
--
-- Admin = club_admins row for that specific club
--         OR profiles.is_super_admin = true
--         OR saps_members row (SAPS core)
--
-- Tables covered: hub_events, club_social_links, club_memberships,
--                 club_notices, club_wings
--
-- Safe to re-run: every DROP uses IF EXISTS.


-- ── Helper function ───────────────────────────────────────────────────────────
-- SECURITY DEFINER so the sub-queries bypass RLS on the lookup tables
-- (club_admins, profiles, saps_members) and can never recurse.
-- Accepts club_id as text; club_admins stores it as int, so cast for comparison.

CREATE OR REPLACE FUNCTION public.is_club_admin_write(p_club_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.club_admins
      WHERE user_id  = auth.uid()::text
        AND club_id::text = p_club_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id            = auth.uid()
        AND is_super_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM public.saps_members
      WHERE profile_id = auth.uid()
    )
$$;


-- ── 1. hub_events ─────────────────────────────────────────────────────────────
-- club_id stored as text (String(rawId) in the app).
-- INSERT  → must be admin of that club.
-- DELETE  → must be admin of that club.
-- SELECT/UPDATE remain open (he_select / he_update not touched).

ALTER TABLE public.hub_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "he_insert" ON public.hub_events;
DROP POLICY IF EXISTS "he_delete" ON public.hub_events;

CREATE POLICY "he_insert" ON public.hub_events
  FOR INSERT WITH CHECK (public.is_club_admin_write(club_id::text));

CREATE POLICY "he_delete" ON public.hub_events
  FOR DELETE USING (public.is_club_admin_write(club_id::text));


-- ── 2. club_social_links ──────────────────────────────────────────────────────
-- club_id stored as text (UNIQUE text column).
-- Old policy was a single FOR ALL USING (true) — drop it and split.
-- All writes (INSERT/UPDATE/DELETE) now require admin.

ALTER TABLE public.club_social_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_club_social_links" ON public.club_social_links;
DROP POLICY IF EXISTS "csl_select"                  ON public.club_social_links;
DROP POLICY IF EXISTS "csl_insert"                  ON public.club_social_links;
DROP POLICY IF EXISTS "csl_update"                  ON public.club_social_links;
DROP POLICY IF EXISTS "csl_delete"                  ON public.club_social_links;

CREATE POLICY "csl_select" ON public.club_social_links
  FOR SELECT USING (true);

CREATE POLICY "csl_insert" ON public.club_social_links
  FOR INSERT WITH CHECK (public.is_club_admin_write(club_id::text));

CREATE POLICY "csl_update" ON public.club_social_links
  FOR UPDATE
  USING     (public.is_club_admin_write(club_id::text))
  WITH CHECK(public.is_club_admin_write(club_id::text));

CREATE POLICY "csl_delete" ON public.club_social_links
  FOR DELETE USING (public.is_club_admin_write(club_id::text));


-- ── 3. club_memberships ───────────────────────────────────────────────────────
-- club_id stored as integer.
-- INSERT stays open — any authenticated user may join a club.
-- UPDATE stays open — used for member wing/role assignment.
-- DELETE: a user may remove their own row (self-leave) OR an admin may remove anyone.

ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_club_memberships" ON public.club_memberships;
DROP POLICY IF EXISTS "club_memberships_all"        ON public.club_memberships;
DROP POLICY IF EXISTS "cm_select"                   ON public.club_memberships;
DROP POLICY IF EXISTS "cm_insert"                   ON public.club_memberships;
DROP POLICY IF EXISTS "cm_update"                   ON public.club_memberships;
DROP POLICY IF EXISTS "cm_delete"                   ON public.club_memberships;

CREATE POLICY "cm_select" ON public.club_memberships FOR SELECT USING (true);
CREATE POLICY "cm_insert" ON public.club_memberships FOR INSERT WITH CHECK (true);
CREATE POLICY "cm_update" ON public.club_memberships FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "cm_delete" ON public.club_memberships
  FOR DELETE USING (
    user_id = auth.uid()::text                    -- user leaving their own membership
    OR public.is_club_admin_write(club_id::text)  -- admin removing a member
  );


-- ── 4. club_notices ───────────────────────────────────────────────────────────
-- club_id stored as integer.
-- INSERT/DELETE require admin. SELECT open.

ALTER TABLE public.club_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_club_notices" ON public.club_notices;
DROP POLICY IF EXISTS "club_notices_all"        ON public.club_notices;
DROP POLICY IF EXISTS "cn_select"               ON public.club_notices;
DROP POLICY IF EXISTS "cn_insert"               ON public.club_notices;
DROP POLICY IF EXISTS "cn_update"               ON public.club_notices;
DROP POLICY IF EXISTS "cn_delete"               ON public.club_notices;

CREATE POLICY "cn_select" ON public.club_notices FOR SELECT USING (true);

CREATE POLICY "cn_insert" ON public.club_notices
  FOR INSERT WITH CHECK (public.is_club_admin_write(club_id::text));

CREATE POLICY "cn_delete" ON public.club_notices
  FOR DELETE USING (public.is_club_admin_write(club_id::text));


-- ── 5. club_wings ─────────────────────────────────────────────────────────────
-- club_id stored as integer.
-- INSERT/DELETE require admin. SELECT open.

ALTER TABLE public.club_wings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_club_wings" ON public.club_wings;
DROP POLICY IF EXISTS "club_wings_all"        ON public.club_wings;
DROP POLICY IF EXISTS "cw_select"             ON public.club_wings;
DROP POLICY IF EXISTS "cw_insert"             ON public.club_wings;
DROP POLICY IF EXISTS "cw_update"             ON public.club_wings;
DROP POLICY IF EXISTS "cw_delete"             ON public.club_wings;

CREATE POLICY "cw_select" ON public.club_wings FOR SELECT USING (true);

CREATE POLICY "cw_insert" ON public.club_wings
  FOR INSERT WITH CHECK (public.is_club_admin_write(club_id::text));

CREATE POLICY "cw_delete" ON public.club_wings
  FOR DELETE USING (public.is_club_admin_write(club_id::text));
