# DebtDetox Implementation Plan

## Overview
Full-stack debt payoff application with Next.js 14 (App Router), Supabase (Postgres + Auth), and Vercel deployment. Features anonymous sessions with upgrade to magic link auth, debt tracking, payoff plan generation (snowball/avalanche), detox sprints, and notifications.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes + Server Actions
- **Database**: Supabase (Postgres)
- **Auth**: Supabase Auth (magic link) with anonymous session upgrade
- **Email**: Supabase built-in (or Resend for custom templates later)
- **Deployment**: Vercel + Supabase
- **State**: Server as source of truth, React Query for caching
- **Components**: shadcn/ui (Radix primitives + Tailwind styling)

---

## Phase 1: Project Setup & Foundation

### 1.1 Initialize Next.js Project
- Create Next.js 14 app with App Router
- Configure Tailwind CSS
- Set up project structure:
  ```
  /app
    /api
    /(marketing)     # Landing, pricing
    /(app)           # Dashboard, debts, plans, detox, settings
  /lib
    /supabase        # Client + server utilities
    /payoff-engine   # Pure payoff calculation functions
  /components
    /ui              # Reusable UI components
    /forms           # Form components
  /types             # TypeScript types
  ```

### 1.2 Supabase Setup
- Create Supabase project
- Configure environment variables
- Set up Supabase clients (browser + server)

### 1.3 Database Schema
Create tables with RLS policies:

```sql
-- Users (extends Supabase auth.users)
-- Supabase handles this via auth.users

-- Sessions (for anonymous users)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  merged_into_user_id UUID REFERENCES auth.users(id)
);

-- Debts
CREATE TABLE debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('session', 'user')),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- credit_card, student_loan, mortgage, auto, personal, medical, other
  balance_cents BIGINT NOT NULL,
  apr_bps INTEGER NOT NULL, -- basis points (500 = 5.00%)
  min_payment_cents BIGINT NOT NULL,
  due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plans
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('session', 'user')),
  owner_id UUID NOT NULL,
  strategy TEXT NOT NULL, -- snowball, avalanche, custom
  extra_payment_cents BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan Snapshots (computed payoff schedules)
CREATE TABLE plan_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  snapshot_json JSONB NOT NULL,
  total_interest_cents BIGINT NOT NULL,
  debt_free_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments (logged payments)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('session', 'user')),
  owner_id UUID NOT NULL,
  debt_id UUID REFERENCES debts(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL,
  paid_at DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Detox Sprints
CREATE TABLE detox_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('session', 'user')),
  owner_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  rules_json JSONB, -- { no_dining_out: true, no_subscriptions: true, ... }
  status TEXT DEFAULT 'active', -- active, completed, abandoned
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Detox Wins (logged achievements during sprint)
CREATE TABLE detox_wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id UUID REFERENCES detox_sprints(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount_saved_cents BIGINT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification Preferences
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_reminders BOOLEAN DEFAULT true,
  reminder_days_before INTEGER DEFAULT 3,
  weekly_summary BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_debts_owner ON debts(owner_type, owner_id);
CREATE INDEX idx_plans_owner ON plans(owner_type, owner_id);
CREATE INDEX idx_payments_owner ON payments(owner_type, owner_id);
CREATE INDEX idx_detox_sprints_owner ON detox_sprints(owner_type, owner_id);
```

---

## Phase 2: Auth & Session System

### 2.1 Anonymous Session Flow
- On first visit, create anonymous session (stored in cookie)
- Track session in `sessions` table
- All data linked via `owner_type='session'` + `owner_id`

### 2.2 Magic Link Auth
- Implement magic link flow using Supabase Auth
- Email input -> send magic link -> verify -> create/login user

### 2.3 Session Merge (Upgrade)
- When anonymous user authenticates:
  1. Find all data with `owner_type='session'` + `owner_id=session.id`
  2. Update to `owner_type='user'` + `owner_id=user.id`
  3. Mark session as `merged_into_user_id`
- Handle in a database transaction

### 2.4 Files to Create
- `/lib/supabase/client.ts` - Browser Supabase client
- `/lib/supabase/server.ts` - Server Supabase client
- `/lib/supabase/middleware.ts` - Session handling
- `/app/api/auth/session/route.ts` - Anonymous session creation
- `/app/api/auth/callback/route.ts` - Magic link callback
- `/app/api/auth/merge/route.ts` - Session merge logic

---

## Phase 3: Core UI Shell

### 3.1 Marketing Pages
- `/app/(marketing)/page.tsx` - Landing page
- `/app/(marketing)/pricing/page.tsx` - Pricing (placeholder for now)
- Clean, modern design with Tailwind

### 3.2 App Shell (Protected)
- `/app/(app)/layout.tsx` - App layout with sidebar nav
- `/app/(app)/dashboard/page.tsx` - Overview dashboard
- `/app/(app)/debts/page.tsx` - Debt list & management
- `/app/(app)/plan/page.tsx` - Payoff plan view
- `/app/(app)/detox/page.tsx` - Detox sprint management
- `/app/(app)/settings/page.tsx` - User settings

### 3.3 Shared Components (via shadcn/ui)
Install these shadcn/ui components:
- `button`, `input`, `label`, `card`, `dialog`, `dropdown-menu`
- `table`, `tabs`, `toast`, `form`, `select`, `checkbox`
- `progress`, `badge`, `separator`, `skeleton`

Custom components:
- `/components/forms/debt-form.tsx`
- `/components/layout/sidebar.tsx`
- `/components/layout/header.tsx`

---

## Phase 4: Debt Management

### 4.1 CRUD Operations
- Add debt form (name, type, balance, APR, min payment, due day)
- Edit debt inline or modal
- Delete with confirmation
- List view with sorting/filtering

### 4.2 API Routes
- `GET /api/debts` - List user's debts
- `POST /api/debts` - Create debt
- `PATCH /api/debts/[id]` - Update debt
- `DELETE /api/debts/[id]` - Delete debt

### 4.3 Server Actions (Alternative)
- Can use Server Actions for mutations with form handling

---

## Phase 5: Payoff Engine

### 5.1 Core Algorithm (`/lib/payoff-engine/`)
Pure functions, fully testable:

```typescript
interface Debt {
  id: string;
  name: string;
  balance_cents: number;
  apr_bps: number;
  min_payment_cents: number;
}

interface PayoffResult {
  schedule: MonthlyPayment[][];
  totalInterest_cents: number;
  debtFreeDate: Date;
  monthlyBreakdown: MonthlyBreakdown[];
}

function calculatePayoff(
  debts: Debt[],
  strategy: 'snowball' | 'avalanche',
  extraPayment_cents: number
): PayoffResult
```

### 5.2 Strategies
- **Snowball**: Order by balance (smallest first)
- **Avalanche**: Order by APR (highest first)
- Both: Pay minimums on all, apply extra to target debt

### 5.3 Plan Generation & Storage
- Generate plan on demand
- Store snapshot in `plan_snapshots` for history/comparison
- "Compare" view: before/after with different strategies

---

## Phase 6: Dashboard & Visualizations

### 6.1 Dashboard Components
- Total debt overview card
- Debt-free countdown
- Monthly payment summary
- Progress chart (debt reduction over time)
- Next actions (upcoming due dates)

### 6.2 Plan Visualization
- Monthly payment schedule table
- Debt payoff timeline chart
- Interest saved comparison

---

## Phase 7: Detox Sprints

### 7.1 Sprint Management
- Create sprint (duration, rules/goals)
- Active sprint view with daily check-in
- Log "wins" (money saved moments)
- Complete/abandon sprint

### 7.2 Gamification Elements
- Streak tracking
- Total saved during sprint
- Achievement badges (optional)

---

## Phase 8: Notifications

### 8.1 Email Notifications (via Supabase Edge Functions or Vercel Cron)
- Payment due reminders (X days before)
- Weekly summary emails
- Sprint reminders

### 8.2 Notification Preferences
- Settings page to configure preferences
- Stored in `notification_preferences` table

### 8.3 Implementation Options
- Vercel Cron for scheduled jobs
- Or Supabase Edge Functions

---

## Phase 9: Data Rights & Export

### 9.1 Export
- `GET /api/export` - Download all user data as JSON/CSV
- Include: debts, payments, plans, detox history

### 9.2 Account Deletion
- `DELETE /api/me` - Soft or hard delete
- Remove all associated data
- Confirmation flow

---

## Phase 10: Polish & Deploy

### 10.1 Error Handling
- Global error boundary
- API error responses
- Form validation (Zod)

### 10.2 Performance
- React Query for data fetching/caching
- Optimistic updates for better UX

### 10.3 Deployment
- Vercel project setup
- Environment variables
- Supabase production project

---

## Files to Create (Summary)

### Config & Setup
- `package.json` - Dependencies
- `next.config.js` - Next.js config
- `tailwind.config.ts` - Tailwind config
- `.env.local` - Environment variables (template)
- `middleware.ts` - Auth middleware

### Lib
- `/lib/supabase/client.ts`
- `/lib/supabase/server.ts`
- `/lib/payoff-engine/calculate.ts`
- `/lib/payoff-engine/types.ts`

### App Routes
- `/app/layout.tsx`
- `/app/(marketing)/page.tsx`
- `/app/(marketing)/pricing/page.tsx`
- `/app/(app)/layout.tsx`
- `/app/(app)/dashboard/page.tsx`
- `/app/(app)/debts/page.tsx`
- `/app/(app)/plan/page.tsx`
- `/app/(app)/detox/page.tsx`
- `/app/(app)/settings/page.tsx`

### API Routes
- `/app/api/auth/session/route.ts`
- `/app/api/auth/callback/route.ts`
- `/app/api/auth/merge/route.ts`
- `/app/api/debts/route.ts`
- `/app/api/debts/[id]/route.ts`
- `/app/api/plans/route.ts`
- `/app/api/plans/generate/route.ts`
- `/app/api/detox/route.ts`
- `/app/api/export/route.ts`
- `/app/api/me/route.ts`

### Components
- `/components/ui/*` - UI primitives
- `/components/forms/debt-form.tsx`
- `/components/dashboard/*`
- `/components/plan/*`
- `/components/detox/*`

---

## Implementation Order

1. **Phase 1**: Project setup (Next.js, Tailwind, Supabase connection)
2. **Phase 2**: Auth system (anonymous sessions, magic link, merge)
3. **Phase 3**: App shell (layout, navigation, basic pages)
4. **Phase 4**: Debt CRUD (add, edit, delete, list debts)
5. **Phase 5**: Payoff engine (calculation logic, plan generation)
6. **Phase 6**: Dashboard (overview, visualizations)
7. **Phase 7**: Detox sprints (create, track, complete)
8. **Phase 8**: Notifications (email reminders via cron)
9. **Phase 9**: Export & deletion (data rights)
10. **Phase 10**: Polish & deploy

Each phase is independently deployable - you can ship incrementally.
