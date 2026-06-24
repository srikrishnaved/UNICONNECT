-- Run once in Supabase SQL Editor.
-- Stores the roll-number roster per class for the CR attendance checklist.

create table if not exists cr_class_rolls (
  id          uuid primary key default gen_random_uuid(),
  class_name  text not null,
  roll_number int  not null,
  created_at  timestamptz default now(),
  unique(class_name, roll_number)
);

alter table cr_class_rolls enable row level security;
create policy "cr_rolls_select" on cr_class_rolls for select using (true);
create policy "cr_rolls_insert" on cr_class_rolls for insert with check (true);
create policy "cr_rolls_delete" on cr_class_rolls for delete using (true);

-- ── Seed ──────────────────────────────────────────────────────────────────────
-- 1st-year classes (profiles.year = '1st Year' → prefix 1)
insert into cr_class_rolls (class_name, roll_number)
  select '1BcomF&A', gs from generate_series(1, 80) gs on conflict do nothing;

insert into cr_class_rolls (class_name, roll_number)
  select '1BcomIAF', gs from generate_series(1, 79) gs on conflict do nothing;

insert into cr_class_rolls (class_name, roll_number)
  select '1BcomIBA', gs from generate_series(1, 21) gs on conflict do nothing;

-- 2nd-year classes (profiles.year = '2nd Year' → prefix 3)
insert into cr_class_rolls (class_name, roll_number)
  select '3BcomF&A A', gs from generate_series(1,  46) gs on conflict do nothing;

insert into cr_class_rolls (class_name, roll_number)
  select '3BcomF&A B', gs from generate_series(47, 96) gs on conflict do nothing;

insert into cr_class_rolls (class_name, roll_number)
  select '3BcomIAF', gs from generate_series(1, 73) gs on conflict do nothing;

insert into cr_class_rolls (class_name, roll_number)
  select '3BcomIBA', gs from generate_series(1, 29) gs on conflict do nothing;

-- 3rd-year classes (profiles.year = '3rd Year' → prefix 5)
insert into cr_class_rolls (class_name, roll_number)
  select '5BcomF&A A', gs from generate_series(1, 82) gs on conflict do nothing;

insert into cr_class_rolls (class_name, roll_number)
  select '5BcomF&A B', gs from generate_series(1, 32) gs on conflict do nothing;

insert into cr_class_rolls (class_name, roll_number)
  select '5BcomIAF', gs from generate_series(1, 73) gs on conflict do nothing;

-- NOTE: 5BcomIBA is not seeded — add when roll data is available.
