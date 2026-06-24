-- Run once in Supabase SQL Editor.
-- Creates the club_social_links table for storing club social media links.
-- Used in ClubDetailScreen and ClubDashboardScreen.

CREATE TABLE IF NOT EXISTS club_social_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    text NOT NULL UNIQUE,
  platform   text NOT NULL,
  url        text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Open RLS (same pattern as other club tables)
ALTER TABLE club_social_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_club_social_links" ON club_social_links
  FOR ALL USING (true) WITH CHECK (true);
