# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server at localhost:3000

# Testing
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm test -- path/to/test.test.ts  # Run a single test file

# Build & Lint
npm run build        # Production build
npm run lint         # Run ESLint
```

## Architecture

### Tech Stack
- **Next.js 16** with App Router (React 19)
- **Supabase** for database and auth
- **TanStack Query** for data fetching/caching
- **Tailwind CSS 4** with shadcn/ui components
- **Zod** for API validation
- **Jest** + React Testing Library for tests

### Directory Structure

```
src/
├── app/
│   ├── (marketing)/     # Public pages (landing, login)
│   ├── (app)/           # Protected app pages (dashboard, debts, plan, invest, detox)
│   └── api/             # API routes
├── components/
│   ├── ui/              # shadcn/ui primitives
│   ├── charts/          # Recharts visualizations
│   ├── debts/           # Debt management components
│   ├── invest/          # Investment components
│   └── gamification/    # Badges and streak displays
├── hooks/               # TanStack Query hooks for data fetching
├── lib/
│   ├── payoff-engine/   # Debt payoff calculation (snowball/avalanche)
│   ├── investment-engine/ # Investment growth projections
│   ├── gamification/    # Badge definitions
│   └── supabase/        # Client (browser) and server Supabase clients
└── types/
    └── database.ts      # All TypeScript types for Supabase tables
```

### Key Patterns

**Session/User Ownership**: All data uses `owner_type` ('session' | 'user') and `owner_id` for ownership. Anonymous users get session-based storage that merges to their account on signup. Use `getOrCreateSession()` from `@/lib/session` in API routes.

**Money in Cents**: All monetary values stored as integers in cents (`balance_cents`, `payment_cents`). Interest rates in basis points (`apr_bps`: 500 = 5.00%).

**Data Flow**: React components → TanStack Query hooks (`use-debts.ts`, `use-payoff-plan.ts`) → API routes → Supabase. Hooks auto-invalidate related queries on mutations.

**Calculation Engines**: Pure functions in `lib/payoff-engine/` and `lib/investment-engine/` handle all financial math. These are unit tested independently.

### Testing

Tests live alongside source files in `__tests__/` directories. Use the custom render from `@/test/test-utils` which wraps components in QueryClientProvider:

```typescript
import { render } from '@/test/test-utils';
```

### Path Alias

Use `@/` for imports from `src/`:
```typescript
import { Button } from '@/components/ui/button';
```
