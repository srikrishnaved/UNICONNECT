---
name: supabase
description: Guidance for all Supabase work on ChristConnect/UniConnect — writing RLS policies, authoring migrations, running SQL queries, using the Supabase MCP tools, and debugging auth/data issues. Use this whenever the task involves database schema, RLS policies, migrations, Supabase queries in JS, edge functions, or anything touching the Supabase project (ref: qoseoqvdwiaqdkmivrxk, project: Uni Connect).
---

# Supabase — ChristConnect / UniConnect

Project ref: `qoseoqvdwiaqdkmivrxk` | Project name: Uni Connect

## Multi-Tenant Architecture

Every table is scoped by `university_id uuid`. All RLS policies enforce this. New tables and new columns **must** follow this pattern — never create a table that stores data without scoping it to a university.

The hardcoded UUID `290a9e2c-c6b3-4397-a3ee-fd95f6e0addd` is CHRIST University — used as the bootstrap fallback in `coalesce()` while the platform is single-tenant.

## The RLS Pattern

All RLS policies use `get_my_university_id()` via `coalesce` to handle the case where the function returns null (unauthenticated or profile not yet created):

```sql
-- SELECT
USING (university_id = coalesce(get_my_university_id(), '290a9e2c-c6b3-4397-a3ee-fd95f6e0addd'::uuid))

-- INSERT
WITH CHECK (university_id = coalesce(get_my_university_id(), '290a9e2c-c6b3-4397-a3ee-fd95f6e0addd'::uuid))

-- UPDATE needs both
USING (...) WITH CHECK (...)
```

The `get_my_university_id()` function is SECURITY DEFINER to avoid RLS recursion when reading `profiles`:

```sql
CREATE OR REPLACE FUNCTION get_my_university_id()
RETURNS uuid AS $$
  SELECT university_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;
```

Never inline `(SELECT university_id FROM profiles WHERE id = auth.uid())` in a policy — this causes infinite recursion on the profiles table. Always use the function.

## User-owned data (not university-scoped)

For rows that belong to a specific user (e.g. own profile updates, own requests):
```sql
-- profiles UPDATE — users can only update their own row
USING (id = auth.uid()) WITH CHECK (id = auth.uid())
```

## Migration Workflow

Migrations are drafted as SQL files in `supabase/.temp/` and applied via the Supabase MCP tool. There is no `supabase/migrations/` folder in use — `.temp/` is the working location.

**Steps for a new migration:**
1. Draft the SQL in `supabase/.temp/migration_<descriptive_name>.sql`
2. Review it — check for: RLS policies on new tables, `university_id` column, constraints, indexes
3. Apply via MCP: use `mcp__claude_ai_Supabase__apply_migration` or `mcp__claude_ai_Supabase__execute_sql`
4. Verify with `mcp__claude_ai_Supabase__list_tables` or a SELECT query

**Migration safety checklist before applying:**
- [ ] New tables have `university_id uuid` column
- [ ] RLS is ENABLED on the table (`ALTER TABLE x ENABLE ROW LEVEL SECURITY`)
- [ ] All four operations (SELECT, INSERT, UPDATE, DELETE) have policies
- [ ] No hardcoded UUIDs in app code — use `get_my_university_id()`
- [ ] `ADD COLUMN IF NOT EXISTS` used (not bare `ADD COLUMN`) for safety
- [ ] Constraints use `DROP ... IF EXISTS` before re-creating

## Known Tables

Core: `profiles`, `universities`, `university_setup_requests`, `university_setup_progress`

Timetable: `timetable_slots` (has `is_external` bool), `timetable_classrooms`, `timetable_faculty_constraints`, `timetable_paired_sessions`

Requests: `substitute_requests`, `compensatory_requests`

Features: clubs, events, groups, teams, mentors, bunkmates — check `list_tables` for current state as these evolve.

## External/Protected Slots

`timetable_slots.is_external = true` marks slots that must not be auto-scheduled (language courses, common courses, external faculty). Check this flag before any timetable generation logic touches a slot.

## Supabase MCP Tools

- `mcp__claude_ai_Supabase__list_tables` — see current schema
- `mcp__claude_ai_Supabase__execute_sql` — run a query (read or write)
- `mcp__claude_ai_Supabase__apply_migration` — apply a migration SQL block
- `mcp__claude_ai_Supabase__get_logs` — debug edge function / auth errors
- `mcp__claude_ai_Supabase__get_advisors` — security and performance advisors

Always load these tools via ToolSearch before calling: `select:mcp__claude_ai_Supabase__execute_sql` etc.

## JS Client Patterns

```js
// Always use the supabase client from context — never re-initialize
import { supabase } from '../context/AppContext';

// Correct: let RLS filter automatically
const { data } = await supabase.from('timetable_slots').select('*');

// Wrong: never filter by university_id in JS — RLS handles it
// .eq('university_id', hardcodedId)  ← don't do this
```

## Common Pitfalls

- **RLS recursion**: Never query `profiles` inside a profiles policy — use `get_my_university_id()`
- **Missing policies**: A table with RLS enabled but no policy returns 0 rows for all users — always add all 4 policies
- **Missing `university_id`**: New tables without it will leak data across universities when multi-tenancy is live
- **Policy name collisions**: Always `DROP POLICY IF EXISTS` before `CREATE POLICY` — duplicate names cause apply failures
