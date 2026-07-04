# Supabase Setup

SQL for the DebtDetox database, usable with either a cloud project or the local Supabase stack.

## Local development (Supabase CLI + Docker)

```bash
brew install supabase/tap/supabase   # once
supabase start                        # boots the local stack and applies migrations/
supabase status                       # prints the local URL and anon key for .env.local
```

`migrations/20260704000000_init.sql` (identical to `schema.sql`) is applied automatically on first start and on `supabase db reset`. Local Studio runs at http://127.0.0.1:54323.

## Cloud project

| Situation | Run this in the SQL Editor |
|---|---|
| **Fresh Supabase project** (no DebtDetox tables yet) | `schema.sql` — the complete schema |
| **Legacy DebtDetox database** (created before payment logging / saved plans / activity log) | `upgrades/001_complete_features.sql` — adds only the new pieces |

Both are idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, guarded policies), so re-running them is safe. Note that `schema.sql` creates tables but does not add new columns to tables that already exist — that's what the upgrade file is for.

## What `schema.sql` creates

### Tables

| Table | Purpose |
|---|---|
| `sessions` | Anonymous browser sessions (cookie-backed). `merged_into_user_id` is set when the visitor signs up and their data migrates. |
| `debts` | One row per debt: `balance_cents`, `apr_bps` (basis points, 500 = 5.00%), `min_payment_cents`, optional `due_day`. |
| `payments` | Logged payments. `amount_cents` is what was paid; `balance_delta_cents` is how much the debt balance was actually reduced (an overpayment only applies up to the remaining balance) — edits/deletes restore balances from this. `note` is optional. |
| `plans` | Saved payoff plans: `name`, `strategy` (snowball/avalanche), `extra_payment_cents`. |
| `plan_snapshots` | Frozen calculations for a saved plan. `snapshot_json` holds the debts at save time, full monthly schedule, payoff order, and strategy comparison, so plans reopen without recalculating. Refreshing a plan appends a new snapshot; the latest is displayed. |
| `detox_sprints` | Spending-freeze sprints with `start_date`, `end_date`, `rules_json`, `status`. |
| `detox_wins` | Wins logged during a sprint (description + optional `amount_saved_cents`). |
| `investments` | Saved investment profiles: starting amount, monthly contribution, expected return, tax status/rate, inflation, optional target amount/years. |
| `notification_preferences` | One row per authenticated user (`user_id` → `auth.users`): `email_reminders`, `reminder_days_before`, `weekly_summary`, `monthly_report`, `detox_reminders`, `milestone_alerts`. |
| `activity_events` | Activity log. `event_type` is check-constrained to the known events (debt/payment/sprint/badge/investment/plan actions); `metadata` is free-form JSONB. |

### Ownership model

Every user-data table (except `notification_preferences` and the child tables `plan_snapshots`/`detox_wins`) carries:

```sql
owner_type TEXT NOT NULL CHECK (owner_type IN ('session', 'user')),
owner_id   UUID NOT NULL
```

`owner_id` points at either a `sessions.id` (anonymous) or an `auth.users.id` (signed in). On signup, the app rewrites `owner_type`/`owner_id` across `debts`, `plans`, `payments`, `detox_sprints`, `investments`, and `activity_events` (see `mergeSessionToUser` in `src/lib/session.ts`).

### Row Level Security

RLS is enabled on every table. The standard policy shape for owner-scoped tables:

```sql
(owner_type = 'user' AND owner_id = auth.uid()) OR (owner_type = 'session')
```

Session-owned rows are scoped by the API layer (routes always filter on the session id from the HTTP-only cookie); user-owned rows are additionally enforced by `auth.uid()`. Child tables (`plan_snapshots`, `detox_wins`) check ownership through their parent via `EXISTS`. `notification_preferences` is strictly `user_id = auth.uid()`.

### Indexes

Owner lookups on every owner-scoped table (`idx_<table>_owner` on `(owner_type, owner_id)`), plus:

- `idx_payments_debt` on `payments(debt_id)` — per-debt payment history
- `idx_activity_events_owner` on `(owner_type, owner_id, created_at DESC)` — newest-first activity feed

### Triggers

`update_updated_at_column()` sets `updated_at = NOW()` before updates on `debts`, `plans`, `investments`, and `notification_preferences`.

## What `upgrades/001_complete_features.sql` changes

Deltas from the original MVP schema, for databases that already exist:

1. **`payments`** — adds `note TEXT` and `balance_delta_cents BIGINT NOT NULL DEFAULT 0` (backfilled from `amount_cents` for any legacy rows), an UPDATE policy (payment editing), and `idx_payments_debt`.
2. **`plans`** — adds `name TEXT NOT NULL DEFAULT 'Untitled Plan'`.
3. **`plan_snapshots`** — adds a DELETE policy (scoped through the parent plan).
4. **`notification_preferences`** — adds `monthly_report`, `detox_reminders`, `milestone_alerts` (all `BOOLEAN DEFAULT true`) and `updated_at` with its trigger.
5. **`activity_events`** — creates the table, its index, RLS, and all four policies.

Policies and triggers are wrapped in `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` blocks so the file can be re-run without errors.

## Verifying the setup

After running the SQL, spot-check from the SQL Editor:

```sql
-- All tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- New payment columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'payments' AND column_name IN ('note', 'balance_delta_cents');

-- RLS is on everywhere
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

Then set the project's URL and anon key in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```
