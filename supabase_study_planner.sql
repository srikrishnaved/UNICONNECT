-- Study Planner tables — run in Supabase SQL Editor

create table study_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  subject_name text not null,
  exam_date date not null,
  syllabus_text text,
  syllabus_file_url text,
  created_at timestamptz default now()
);

create table study_topics (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references study_exams(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  topic_name text not null,
  estimated_weight text, -- 'light' | 'medium' | 'heavy'
  scheduled_date date,
  status text not null default 'pending', -- 'pending' | 'done'
  sort_order int default 0,
  created_at timestamptz default now()
);

create table study_availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  day_of_week text not null, -- 'MON'..'SUN'
  hours_available numeric default 2,
  unique(user_id, day_of_week)
);

-- RLS: open policies for all three tables

alter table study_exams enable row level security;
create policy "study_exams_select" on study_exams for select using (true);
create policy "study_exams_insert" on study_exams for insert with check (true);
create policy "study_exams_update" on study_exams for update using (true) with check (true);
create policy "study_exams_delete" on study_exams for delete using (true);

alter table study_topics enable row level security;
create policy "study_topics_select" on study_topics for select using (true);
create policy "study_topics_insert" on study_topics for insert with check (true);
create policy "study_topics_update" on study_topics for update using (true) with check (true);
create policy "study_topics_delete" on study_topics for delete using (true);

alter table study_availability enable row level security;
create policy "study_availability_select" on study_availability for select using (true);
create policy "study_availability_insert" on study_availability for insert with check (true);
create policy "study_availability_update" on study_availability for update using (true) with check (true);
create policy "study_availability_delete" on study_availability for delete using (true);

-- Storage bucket for syllabus file uploads
-- 1. Create the bucket in Supabase Dashboard → Storage:
--      Bucket name: study-syllabus   Public: true
-- 2. Run the RLS policies below — the bucket's "Public" toggle does NOT
--    cover uploads; storage.objects needs its own policies.

create policy "study_syllabus_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'study-syllabus');

create policy "study_syllabus_select"
  on storage.objects
  for select
  using (bucket_id = 'study-syllabus');

create policy "study_syllabus_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'study-syllabus');
