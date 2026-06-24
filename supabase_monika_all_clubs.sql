-- Give CS Monika Agarwal coordinator access to all clubs and teams.
-- Run once in Supabase SQL Editor.
-- She already has club 17 (SAPS); ON CONFLICT DO NOTHING skips duplicates.

INSERT INTO faculty_coordinators (teacher_name, club_id, club_name)
VALUES
  ('CS Monika Agarwal', '1',  'FLC'),
  ('CS Monika Agarwal', '2',  'ACE'),
  ('CS Monika Agarwal', '3',  'CACOPS'),
  ('CS Monika Agarwal', '4',  'Festing Club'),
  ('CS Monika Agarwal', '5',  'Ranbhoomi Club'),
  ('CS Monika Agarwal', '6',  'Research Club'),
  ('CS Monika Agarwal', '7',  'Sports Club'),
  ('CS Monika Agarwal', '8',  'Industry Connect'),
  ('CS Monika Agarwal', '9',  'Tech Team'),
  ('CS Monika Agarwal', '10', 'Audi Team'),
  ('CS Monika Agarwal', '11', 'Documentation'),
  ('CS Monika Agarwal', '12', 'Creative Team'),
  ('CS Monika Agarwal', '13', 'Junoon'),
  ('CS Monika Agarwal', '14', 'Mehfil'),
  ('CS Monika Agarwal', '15', 'PR & Emcee'),
  ('CS Monika Agarwal', '17', 'SAPS'),
  ('CS Monika Agarwal', '18', 'Social Media Club')
ON CONFLICT (teacher_name, club_id) DO NOTHING;
