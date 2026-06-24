// backup_db.js
// Connects to Supabase and saves every table as JSON to db_backup/.
// Usage: node backup_db.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://qoseoqvdwiaqdkmivrxk.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvc2VvcXZkd2lhcWRrbWl2cnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTE0NzcsImV4cCI6MjA5NjMyNzQ3N30.2ykDB6h_VYClR6yxHuqK0N3UTpztBYcTTK7wvO5tGoY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// All known tables in the public schema.
// Script gracefully skips any that don't exist or aren't readable.
const TABLES = [
  'profiles',
  'teacher_profiles',
  'subjects',
  'subject_requests',
  'teacher_subjects',
  'teacher_tasks',
  'teacher_announcements',
  'timetable_periods',
  'timetable_classrooms',
  'timetable_faculty_constraints',
  'timetable_paired_sessions',
  'timetable_slots',
  'timetable_change_log',
  'compensatory_requests',
  'substitute_requests',
  'faculty_availability',
  'club_events',
  'club_memberships',
  'club_join_requests',
  'club_admins',
  'club_admin_requests',
  'club_invites',
  'club_notices',
  'club_resource_persons',
  'club_wings',
  'club_member_hours',
  'faculty_club_requests',
  'hub_events',
  'event_tracker_steps',
  'direct_messages',
  'group_messages',
  'group_memberships',
  'created_groups',
  'student_groups',
  'notifications',
  'mentor_visits',
  'user_connections',
  'blocked_users',
  'reports',
  'study_sessions',
  'event_interests',
  'club_following',
  'cr_requests',
  'saps_applications',
  'saps_members',
  'connection_requests',
];

const PAGE_SIZE = 1000;

async function fetchAll(tableName) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function main() {
  const backupDir = path.join(__dirname, 'db_backup');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  console.log(`\nBacking up to ${backupDir}/\n`);

  const meta = {
    timestamp: new Date().toISOString(),
    tables: {},
  };

  let totalRows = 0;
  let okCount = 0;
  let skipCount = 0;

  for (const table of TABLES) {
    try {
      const rows = await fetchAll(table);
      fs.writeFileSync(
        path.join(backupDir, `${table}.json`),
        JSON.stringify(rows, null, 2),
      );
      console.log(`  ✓  ${table.padEnd(38)} ${String(rows.length).padStart(5)} rows`);
      meta.tables[table] = { rows: rows.length, status: 'ok' };
      totalRows += rows.length;
      okCount++;
    } catch (err) {
      const msg = err?.message || String(err);
      const isNotFound =
        msg.includes('does not exist') ||
        msg.includes('relation') ||
        err?.code === '42P01' ||
        err?.code === 'PGRST116';
      if (isNotFound) {
        console.log(`  –  ${table.padEnd(38)} table not found (skipped)`);
        meta.tables[table] = { rows: 0, status: 'not_found' };
      } else {
        console.log(`  ✗  ${table.padEnd(38)} ERROR — ${msg}`);
        meta.tables[table] = { rows: 0, status: 'error', error: msg };
      }
      skipCount++;
    }
  }

  fs.writeFileSync(
    path.join(backupDir, '_meta.json'),
    JSON.stringify(meta, null, 2),
  );

  console.log(`\n${'─'.repeat(52)}`);
  console.log(`  Tables backed up : ${okCount}`);
  console.log(`  Tables skipped   : ${skipCount}`);
  console.log(`  Total rows       : ${totalRows}`);
  console.log(`  Timestamp        : ${meta.timestamp}`);
  console.log(`  Output dir       : ${backupDir}`);
  console.log(`${'─'.repeat(52)}\n`);
}

main().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
