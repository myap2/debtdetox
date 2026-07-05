# DebtDetox

Track, plan, and pay off your debt faster. DebtDetox combines debt tracking, payment logging, snowball/avalanche payoff planning, spending-freeze sprints, and investment projections in one app.

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables in `.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Create the database schema (see `supabase/README.md` for details):
   - **Local development:** `supabase start` (Supabase CLI + Docker) applies `supabase/migrations/` automatically; `supabase status` prints the URL/key for `.env.local`.
   - **New cloud project:** run `supabase/schema.sql` in the Supabase SQL Editor.
   - **Legacy cloud database:** run `supabase/upgrades/001_complete_features.sql` (adds payment notes/balance deltas, plan names, extra notification preferences, and the activity log to an older schema).

4. Start the dev server:

   ```bash
   npm run dev
   ```

### Commands

```bash
npm run dev              # Start dev server at localhost:3000
npm run build            # Production build
npm run lint             # Run ESLint
npm test                 # Run all Jest tests
npm run test:unit        # Run unit/component/hook tests
npm run test:api         # Run mocked API route integration tests
npm run test:ci          # Run unit + API integration tests
npm run test:smoke:api   # Run API smoke checks against a running app
npm run test:smoke:ui    # Run Playwright UI smoke checks against a running app
npm run test:smoke       # Run API + UI smoke checks
```

## Features

- **Debt tracking** — add debts with balance, APR, and minimum payment; anonymous sessions work out of the box and merge into your account when you sign in.
- **Payment logging** — record payments per debt with dates and notes; balances, plans, and analytics update automatically.
- **Payoff plans** — compare snowball vs. avalanche live, then save named plans you can reopen, rename, duplicate, and refresh later.
- **Detox sprints** — time-boxed spending freezes with logged wins, streaks, and badges.
- **Investment tools** — growth calculator with tax/inflation adjustments, debt-vs-invest comparison, and saved investment profiles.
- **Analytics** — totals, averages, interest saved, payoff percentage, and charts built from your payment history.
- **Activity log** — a filterable timeline of everything that happened in your account.

## Architecture

### Session/User Ownership

All data rows carry `owner_type` (`'session' | 'user'`) and `owner_id`. Anonymous visitors get a cookie-backed session row; signing in migrates their data to the user (`mergeSessionToUser` in `src/lib/session.ts`). API routes resolve the caller with `getOrCreateSession()`.

### Money Representation

All monetary values are integers in cents (`balance_cents`, `amount_cents`). Interest rates are basis points (`apr_bps`: 500 = 5.00%).

### Data Flow

React components → TanStack Query hooks (`src/hooks/`) → API routes (`src/app/api/`) → Supabase. Mutations invalidate every related query key (debts, payoff plan, payments, analytics, activity) so all derived views refresh automatically.

## Payment Flow

Payments are the source of truth for progress. Recording one:

1. `POST /api/payments` validates the amount (> 0), date, and debt ownership.
2. If the amount exceeds the remaining balance, the API returns `422` with code `EXCEEDS_BALANCE`; the UI asks the user to confirm, then resubmits with `allow_overpayment: true`.
3. The payment row stores both `amount_cents` (what was paid) and `balance_delta_cents` (how much the balance was actually reduced — an overpayment only applies up to the remaining balance).
4. The debt's balance is reduced by the delta.

**Editing** a payment restores its old delta, validates the new amount against the restored balance, and applies a new delta. **Deleting** restores exactly `balance_delta_cents`. This makes edit/delete perfectly reversible even around overpayments — see the regression suite in `src/app/api/payments/[id]/__tests__/route.test.ts`.

Deletes across the app use an **undo snackbar** (`src/hooks/use-undoable-delete.ts`): the row disappears immediately but the server delete is deferred ~5 seconds, so Undo is lossless.

## Saved Plans

`POST /api/plans` runs the payoff engine server-side and stores:

- a `plans` row (name, strategy, extra payment), and
- a `plan_snapshots` row whose `snapshot_json` captures everything needed to re-render the plan without recalculating: the debts as they were, the full monthly schedule, payoff order, totals, and snowball-vs-avalanche comparison data.

Opening a saved plan renders purely from the snapshot. "Update using current balances" (`POST /api/plans/[id]/refresh`) explicitly recomputes and appends a new snapshot (history is preserved; the latest one is displayed). Duplicate copies the plan and its latest snapshot.

## Notification Architecture

Preferences live in `notification_preferences` (one row per authenticated user; anonymous sessions can't receive email). The Settings page saves each toggle immediately with an optimistic update.

Delivery is provider-pluggable (`src/lib/notifications/`):

- `types.ts` — `EmailProvider` interface, notification kinds, and the mapping from each kind to its preference column.
- `service.ts` — `sendNotification()` re-checks the user's preference and routes through `getEmailProvider()`. Ships with a console provider; implement `EmailProvider` for Resend/SendGrid/Postmark and return it from `getEmailProvider()` based on env config to go live.
- `scheduler.ts` — declares the recurring jobs (weekly summary, monthly report, payment reminders, detox check-ins) with cron expressions, ready to be triggered by Vercel Cron or Supabase pg_cron.

## Investment Profiles

The `investments` table stores named scenarios (starting amount, monthly contribution, expected return, tax status/rate, inflation, time horizon). The Profiles tab on the Invest page supports create/edit/duplicate/delete; **Load** seeds the calculator instantly, after which edits autosave back to the profile (debounced). "Save as Profile" captures the current calculator inputs as a new profile.

## Analytics

`GET /api/analytics` aggregates the caller's payments and debts:

- totals, average payment, average monthly payment, largest payment, last payment date
- longest/current monthly payment streaks
- payoff percentage (paid down vs. everything tracked)
- monthly payment totals (trailing 12 months)
- balance history, reconstructed by walking payments backwards from current balances using `balance_delta_cents`
- estimated interest saved: projected interest on current balances vs. what the projection would be had no payments been applied

The pure math lives in `src/lib/analytics/calculate.ts` and is unit-tested independently. The dashboard's analytics section is lazy-loaded (`next/dynamic`) so charts don't block first paint.

## Activity Log

`activity_events` records every meaningful action (debts added/updated/deleted, payments recorded/updated/deleted, sprints started/completed/abandoned, badges earned, investment profiles saved/deleted, plans saved/deleted). Rows are written server-side via `logActivity()` in `src/lib/activity.ts` — logging failures never break the primary operation. Badge events are derived idempotently by `syncBadgeActivity()` after sprint/win mutations. The Activity page filters by category.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/debts` | List / create debts |
| GET/PATCH/DELETE | `/api/debts/[id]` | Read / update / delete a debt |
| GET | `/api/payments?debt_id=` | List payments (optionally per debt) |
| POST | `/api/payments` | Record a payment (`422 EXCEEDS_BALANCE` unless `allow_overpayment`) |
| PATCH/DELETE | `/api/payments/[id]` | Edit / delete a payment (balances restored exactly) |
| POST | `/api/plans/generate` | Compute a payoff plan or comparison (not persisted) |
| GET/POST | `/api/plans` | List saved plans / save a plan with snapshot |
| GET/PATCH/DELETE | `/api/plans/[id]` | Read (with latest snapshot) / rename / delete a plan |
| POST | `/api/plans/[id]/duplicate` | Copy a plan and its latest snapshot |
| POST | `/api/plans/[id]/refresh` | Recompute the snapshot from current balances |
| GET/POST | `/api/investments` | List / create investment profiles |
| GET/PATCH/DELETE | `/api/investments/[id]` | Read / update / delete a profile |
| POST | `/api/investments/project` | Compute a growth projection |
| POST | `/api/investments/compare-debt` | Debt-vs-invest comparison |
| GET/PATCH | `/api/notifications/preferences` | Read / update notification preferences (auth required) |
| GET | `/api/analytics` | Payment analytics and chart series |
| GET | `/api/activity?type=` | Activity log, filterable by event type(s) |
| GET/POST | `/api/detox`, `/api/detox/[id]`, `/api/detox/[id]/wins` | Detox sprints and wins |
| GET | `/api/export` | Download all data as JSON |
| GET/DELETE | `/api/me` | Session info / delete all data |

## Database Changes (from the original MVP schema)

Applied by `supabase/upgrades/001_complete_features.sql` (already included in `schema.sql` and `supabase/migrations/` for new installs):

- `payments.note TEXT` — optional payment notes
- `payments.balance_delta_cents BIGINT` — exact balance reduction applied, enabling precise restore on edit/delete
- `payments` UPDATE row-level-security policy + `idx_payments_debt` index
- `plans.name TEXT` — user-facing plan names
- `plan_snapshots` DELETE policy
- `notification_preferences.monthly_report / detox_reminders / milestone_alerts BOOLEAN`, `updated_at` + trigger
- New `activity_events` table (owner columns, `event_type` check constraint, `metadata JSONB`, RLS policies, owner+time index)

## Testing

Tests live in `__tests__/` directories beside the code. Component tests use the custom render from `@/test/test-utils` (wraps in `QueryClientProvider`); API route tests use the stateful in-memory Supabase mock in `src/test/supabase-mock.ts`, which lets them assert on real balance mutations.

The required PR gate is `.github/workflows/ci.yml`. It runs lint, `test:unit`, `test:api`, `build`, API smoke checks, and Playwright UI smoke checks in the `quality-gate` job. Smoke tests use `SKIP_SUPABASE_AUTH_REFRESH=true` and test/dummy Supabase environment variables so the merge gate does not depend on live Supabase.

For first-time UI smoke runs, install the Chromium browser used by Playwright:

```bash
npx playwright install chromium
```

To run smoke checks locally, use two terminals. In the first terminal, build and start the app:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key \
SKIP_SUPABASE_AUTH_REFRESH=true \
npm run build

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key \
SKIP_SUPABASE_AUTH_REFRESH=true \
npm run start:ci
```

Leave `npm run start:ci` running, then run the smoke checks in a second terminal:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
SMOKE_BASE_URL=http://127.0.0.1:3000 \
npm run test:smoke
```

```bash
npm test                          # all Jest tests
npm test -- src/app/api/payments  # one area
```

Key suites: payoff/investment engine math, analytics calculations, payment API balance bookkeeping (including the edit/delete regression cycle), plan persistence, notification preferences, and form validation.
