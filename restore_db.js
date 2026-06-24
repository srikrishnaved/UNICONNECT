// restore_db.js
// Reads db_backup/*.json and restores each table to exactly that state.
//
// REQUIRES the Supabase service role key (bypasses RLS so DELETE works on all tables).
// Get it from: Supabase Dashboard → Project Settings → API → service_role key
//
// Usage:
//   SUPABASE_SERVICE_KEY=<key> node restore_db.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://qoseoqvdwiaqdkmivrxk.supabase.co';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) {
  console.error('\nError: SUPABASE_SERVICE_KEY is required.\n');
  console.error('  Get it from: Supabase Dashboard → Project Settings → API → service_role');
  console.error('  Run as: SUPABASE_SERVICE_KEY=<key> node restore_db.js\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Delete in this order so FK constraints are never violated:
//   children first (deepest deps), parents last.
// Insert in the reverse order (parents first, children last).
//
// FK chain summary:
//   profiles (root)
//     ← teacher_profiles (CASCADE)
//     ← teacher_subjects (CASCADE) + subjects (CASCADE)
//     ← timetable_change_log (SET NULL)
//         ← compensatory_requests (SET NULL)
//     ← timetable_slots (no FK to profiles, but comp_req + sub_req reference it)
//         ← compensatory_requests (SET NULL)
//         ← substitute_requests (SET NULL)
//     ← saps_applications (CASCADE)
//     ← cr_requests (CASCADE)
//     ← subject_requests (SET NULL)
//     ← club_events (SET NULL)
const DELETE_ORDER = [
  // Deepest leaf tables
  'compensatory_requests',       // → timetable_change_log, timetable_slots, profiles
  'substitute_requests',         // → timetable_slots, profiles
  'teacher_subjects',            // → profiles (CASCADE), subjects (CASCADE)
  'subject_requests',            // → profiles (SET NULL)
  'cr_requests',                 // → profiles (CASCADE)
  'club_events',                 // → profiles (SET NULL)
  'event_tracker_steps',         // no FK, but depends on hub_events conceptually
  'saps_members',
  'saps_applications',           // → profiles (CASCADE)
  'teacher_tasks',
  'club_member_hours',
  'connection_requests',
  // Mid-tier
  'teacher_profiles',            // → profiles (CASCADE)
  'timetable_change_log',        // → profiles (SET NULL)
  'timetable_slots',
  'timetable_paired_sessions',
  'timetable_periods',
  'timetable_classrooms',
  'timetable_faculty_constraints',
  'faculty_availability',
  'subjects',                    // → profiles (SET NULL via created_by)
  // Tables that use text teacher IDs (no FK to profiles uuid)
  'teacher_announcements',
  'mentor_visits',
  'faculty_club_requests',
  // App data tables (no strict FK deps with uuid constraints)
  'club_memberships',
  'club_join_requests',
  'club_admins',
  'club_admin_requests',
  'club_invites',
  'club_notices',
  'club_resource_persons',
  'club_wings',
  'hub_events',
  'direct_messages',
  'group_messages',
  'group_memberships',
  'created_groups',
  'student_groups',
  'notifications',
  'user_connections',
  'blocked_users',
  'reports',
  'study_sessions',
  'event_interests',
  'club_following',
  // Root
  'profiles',
];

const INSERT_ORDER = [...DELETE_ORDER].reverse();
const CHUNK_SIZE = 500;

// Tables with no 'id' or 'created_at' column — composite-key junction tables.
// These use user_id as the delete filter.
const COMPOSITE_KEY_TABLES = new Set([
  'user_connections',
  'group_memberships',
  'created_groups',
  'event_interests',
  'club_following',
]);

async function deleteAll(tableName) {
  // The service role key bypasses RLS so no policy check is needed.
  if (COMPOSITE_KEY_TABLES.has(tableName)) {
    const { error } = await supabase.from(tableName).delete().not('user_id', 'is', null);
    if (error) throw error;
    return;
  }
  // Standard tables: delete by uuid id PK.
  const { error } = await supabase.from(tableName).delete().not('id', 'is', null);
  if (error) {
    if (error.code === '42703') {
      // Fallback: created_at
      const { error: e2 } = await supabase
        .from(tableName)
        .delete()
        .gte('created_at', '1900-01-01');
      if (e2) throw e2;
    } else {
      throw error;
    }
  }
}

async function insertChunked(tableName, rows) {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from(tableName).insert(chunk);
    if (error) throw error;
  }
}

async function main() {
  const backupDir = path.join(__dirname, 'db_backup');
  if (!fs.existsSync(backupDir)) {
    console.error('\nNo db_backup/ directory found. Run backup_db.js first.\n');
    process.exit(1);
  }

  const available = new Set(
    fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
      .map((f) => f.replace('.json', '')),
  );

  // Tables in DELETE_ORDER that have a backup file
  const deleteList = DELETE_ORDER.filter((t) => available.has(t));
  // Any extras not in the known order — treat as no-FK, delete/insert at start/end
  const extras = [...available].filter((t) => !DELETE_ORDER.includes(t));
  const insertList = [
    ...[...deleteList].reverse(),
    ...extras,
  ];

  console.log('\nRestoring database from db_backup/\n');

  // ── Step 1: Clear tables ─────────────────────────────────────────────────
  console.log('Step 1 — Clearing tables (FK-safe order: children first)\n');
  for (const table of [...extras, ...deleteList]) {
    try {
      await deleteAll(table);
      console.log(`  ✓  ${table.padEnd(38)} cleared`);
    } catch (err) {
      console.log(`  ✗  ${table.padEnd(38)} clear failed — ${err.message}`);
    }
  }

  // ── Step 2: Re-insert rows ───────────────────────────────────────────────
  console.log('\nStep 2 — Re-inserting rows (FK-safe order: parents first)\n');
  let totalInserted = 0;
  for (const table of insertList) {
    const file = path.join(backupDir, `${table}.json`);
    if (!fs.existsSync(file)) continue;

    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (rows.length === 0) {
      console.log(`  –  ${table.padEnd(38)}     0 rows (empty, skipped)`);
      continue;
    }
    try {
      await insertChunked(table, rows);
      console.log(`  ✓  ${table.padEnd(38)} ${String(rows.length).padStart(5)} rows inserted`);
      totalInserted += rows.length;
    } catch (err) {
      console.log(`  ✗  ${table.padEnd(38)} insert failed — ${err.message}`);
    }
  }

  console.log(`\n${'─'.repeat(52)}`);
  console.log(`  Total rows restored : ${totalInserted}`);
  console.log(`${'─'.repeat(52)}\n`);
}

main().catch((err) => {
  console.error('Restore failed:', err);
  process.exit(1);
});
