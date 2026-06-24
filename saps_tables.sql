-- Run this in the Supabase SQL editor

-- SAPS Applications
CREATE TABLE IF NOT EXISTS saps_applications (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  applicant_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('President','Vice President','Member Secretary','Secretary','Vice Secretary')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE saps_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saps_apps_select" ON saps_applications FOR SELECT USING (true);
CREATE POLICY "saps_apps_insert" ON saps_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "saps_apps_update" ON saps_applications FOR UPDATE USING (true) WITH CHECK (true);

-- SAPS Members  (UNIQUE on role — only one person per position)
CREATE TABLE IF NOT EXISTS saps_members (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('President','Vice President','Member Secretary','Secretary','Vice Secretary')),
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (role)
);

ALTER TABLE saps_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saps_members_select" ON saps_members FOR SELECT USING (true);
CREATE POLICY "saps_members_insert" ON saps_members FOR INSERT WITH CHECK (true);
CREATE POLICY "saps_members_update" ON saps_members FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "saps_members_delete" ON saps_members FOR DELETE USING (true);
