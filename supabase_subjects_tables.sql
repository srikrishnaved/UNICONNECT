-- Run this in the Supabase SQL editor to create the subjects management tables

CREATE TABLE IF NOT EXISTS subjects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL,
  class text NOT NULL,
  programme text NOT NULL,
  semester text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subject_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_name text NOT NULL,
  subject_code text NOT NULL,
  class text NOT NULL,
  programme text NOT NULL,
  semester text NOT NULL,
  requested_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  requester_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_requests ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read subjects
CREATE POLICY "subjects_read" ON subjects FOR SELECT USING (true);

-- Allow all authenticated users to insert/update subjects (admin handles via app logic)
CREATE POLICY "subjects_write" ON subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "subjects_update" ON subjects FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "subjects_delete" ON subjects FOR DELETE USING (true);

-- Allow all authenticated users to read/write subject_requests
CREATE POLICY "subject_requests_read" ON subject_requests FOR SELECT USING (true);
CREATE POLICY "subject_requests_write" ON subject_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "subject_requests_update" ON subject_requests FOR UPDATE USING (true) WITH CHECK (true);
