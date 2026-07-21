---
name: security-review
description: Security review for ChristConnect/UniConnect — auditing RLS policies, multi-tenant isolation, auth flows, student data exposure, and JS client patterns. Use whenever new tables, policies, screens, or auth logic are added. Also use before any migration is applied to production. Covers both Supabase/Postgres security and React Native client-side concerns.
---

# Security Review — ChristConnect / UniConnect

This app handles student academic records, attendance, personal profiles, bunkmate matching, and faculty schedules. The primary threat is **cross-university data leakage** — one university's users seeing another's data.

## Step 1: Supabase RLS Audit

For any new or modified tables, check each of these:

### 1a. RLS enabled?
```sql
-- Should return true for every table
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```
A table with `rowsecurity = false` is fully exposed to any authenticated user.

### 1b. All four operations covered?
Every table needs policies for SELECT, INSERT, UPDATE, DELETE. A missing policy silently returns 0 rows (SELECT) or silently blocks writes (INSERT/UPDATE/DELETE) — no error, just wrong behavior.

```sql
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, cmd;
```

### 1c. University isolation correct?
Every policy on a multi-tenant table must use:
```sql
university_id = coalesce(get_my_university_id(), '290a9e2c-c6b3-4397-a3ee-fd95f6e0addd'::uuid)
```
Flag any policy that uses `auth.uid()` alone on a non-user-owned table — that would let any authenticated user read all universities' data.

### 1d. No RLS recursion?
Policies on `profiles` must NOT query `profiles` inline. They must use `get_my_university_id()`. If a new SECURITY DEFINER function is added, verify it doesn't itself query a table with a recursive policy.

### 1e. Role escalation?
Check that no policy allows a student to update their own `role` column:
```sql
-- profiles UPDATE policy must be:
USING (id = auth.uid()) WITH CHECK (id = auth.uid())
-- NOT: WITH CHECK (id = auth.uid() AND role = <anything>)
-- The WITH CHECK must not restrict role changes — there should be a separate trigger or no role in the check
```
Actually — verify the profiles UPDATE policy explicitly excludes role promotion: a student should not be able to set `role = 'admin'` on their own row.

## Step 2: JS Client Audit

Scan `src/screens/` and `src/context/` for:

**Bad patterns to flag:**
```js
// Hardcoded university ID in JS — bypasses RLS intent
.eq('university_id', '290a9e2c-...')

// Filtering by role client-side after fetching all rows
const admins = data.filter(u => u.role === 'admin')  // if data came from .select('*') with no RLS

// Exposing service role key anywhere in client code
SUPABASE_SERVICE_ROLE_KEY  // must never appear in app JS

// Direct auth.uid() assumptions without checking session
const userId = supabase.auth.user()?.id  // outdated v1 pattern — use getSession()
```

**Check env vars:**
```
SUPABASE_URL — safe to expose
SUPABASE_ANON_KEY — safe to expose (RLS is the guard)
SUPABASE_SERVICE_ROLE_KEY — must NEVER be in client code or committed to git
```

## Step 3: Profile & PII Exposure

The `profiles` table contains student names, contact info, room numbers (bunkmate feature), and academic details.

Check that:
- Profile SELECT policy only returns profiles within the same university
- No screen fetches all profiles without a filter that RLS would enforce
- Bunkmate matching queries do not expose profiles from other universities
- Image upload paths in Supabase Storage are scoped (not public buckets with guessable paths)

## Step 4: Admin Role Checks

There are multiple role levels: `super_admin`, `app_admin`, `university_admin`, `teacher`, `student`, `cr`.

For any screen gating:
- Role checks must happen server-side via RLS or edge functions, not just in the React Native UI
- `AdminDashboardScreen`, `AppAdminScreen`, `SuperAdminScreen` should verify roles via a Supabase query, not just from local state/context
- A user who manipulates local state should not gain server-side access

## Step 5: Migration Safety

Before applying any migration to production:
- [ ] No `DROP TABLE` without explicit confirmation from user
- [ ] No removal of RLS from existing tables
- [ ] `ADD COLUMN IF NOT EXISTS` (not bare `ADD COLUMN`)
- [ ] Backfill statements won't time out on large tables (use batched updates if > 10k rows)
- [ ] No new columns that expose sensitive data without corresponding RLS update

## Output Format

Report findings as:

**CRITICAL** — data leakage or privilege escalation possible right now  
**HIGH** — likely exploitable with moderate effort  
**MEDIUM** — defense-in-depth gap, not immediately exploitable  
**LOW** — best practice violation, low risk  
**INFO** — observation, no risk

For each finding: what table/file/line, what the risk is, and the exact fix.
