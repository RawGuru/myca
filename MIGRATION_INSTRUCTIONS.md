# Database Migration Instructions

## How to Run the Migrations

Since Supabase CLI is not installed, please run these migrations manually through the Supabase Dashboard:

### Step 1: Access Supabase SQL Editor

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/ksramckuggspsqymcjpo
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"

### Step 2: Run Migration 1 - Session Protocol Tables

Copy and paste the entire contents of:
```
supabase/migrations/add_session_protocol.sql
```

Click "Run" or press Cmd+Enter

This creates:
- `session_states` table (phase tracking)
- `session_milestones` table (event logging)
- `giver_metrics` table (quality scoring)
- Trigger function `update_giver_quality_metrics()`

### Step 3: Run Migration 2 - Update RLS Policies

Copy and paste the entire contents of:
```
supabase/migrations/update_giver_metrics_rls.sql
```

Click "Run" or press Cmd+Enter

This updates:
- RLS policy for `giver_metrics` to allow SELECT (for discovery ranking)
- Blocks all write operations from clients

### Step 4: Verify Migrations

Run this query to verify tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('session_states', 'session_milestones', 'giver_metrics');
```

You should see all 3 tables listed.

### Step 5: Test Quality Score Computation

Run this query to verify the quality_score computed column works:

```sql
SELECT giver_id, total_sessions_completed, would_book_again_count, matched_mode_count, quality_score
FROM giver_metrics
LIMIT 5;
```

If there's no data yet, that's normal. The scores will populate as feedback is submitted.

## Troubleshooting

### Error: "relation already exists"
- This means the table was already created. You can skip that migration.

### Error: "permission denied"
- Make sure you're logged in as the project owner or have admin access.

### Error: "policy already exists"
- Run: `DROP POLICY IF EXISTS "policy_name" ON table_name;` before creating the new policy.

## Alternative: Supabase CLI (Optional)

If you want to install Supabase CLI for future migrations:

```bash
npm install -g supabase
supabase login
supabase link --project-ref ksramckuggspsqymcjpo
supabase db push
```
