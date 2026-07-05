# Testing and Merge Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unit/API test commands, API and UI smoke tests, a GitHub Actions PR gate, and GitHub branch protection for `main`.

**Architecture:** Keep Jest as the unit and mocked API integration runner. Add a dependency-free health route plus smoke scripts that run against a built Next.js server with Supabase auth refresh skipped by an explicit CI/test environment flag. Use one required GitHub Actions job named `quality-gate` so branch protection has a stable status check to require.

**Tech Stack:** Next.js 16, React 19, Jest 30, React Testing Library, Playwright, GitHub Actions, GitHub branch protection through `gh api`.

---

## Baseline

Current local baseline before implementation:

- `npm test -- --runInBand`: 22 test suites passed, 231 tests passed.
- `npm run lint`: exits 0 with existing warnings.
- No existing `.github/workflows` files.
- No existing Playwright or smoke-test setup.

## File Structure

- Create: `src/app/api/health/route.ts`
  - Dependency-free health endpoint for API smoke checks.
- Create: `src/app/api/health/__tests__/route.test.ts`
  - Jest route test for `/api/health`.
- Modify: `src/lib/supabase/middleware.ts`
  - Add `SKIP_SUPABASE_AUTH_REFRESH=true` bypass for smoke/CI runs.
- Create: `src/lib/supabase/__tests__/middleware.test.ts`
  - Jest tests proving the bypass does not call Supabase and the default path still refreshes auth.
- Modify: `package.json`
  - Add explicit unit, API integration, smoke, and CI scripts.
- Modify: `package-lock.json`
  - Add `@playwright/test` from `npm install --save-dev @playwright/test`.
- Create: `scripts/smoke-api.mjs`
  - Node HTTP smoke checks against a running app.
- Create: `playwright.config.ts`
  - Playwright configuration for Chromium smoke tests.
- Create: `e2e/smoke.spec.ts`
  - Browser smoke tests for public and app-shell routes.
- Create: `.github/workflows/ci.yml`
  - Required PR workflow with job `quality-gate`.
- Modify: `README.md`
  - Document local test and smoke commands plus CI behavior.
- Modify: `CLAUDE.md`
  - Add the new commands for future agents.
- Modify: `eslint.config.mjs`
  - Ignore `coverage/**` so local generated coverage reports do not create lint noise.

---

### Task 1: Add Health Route

**Files:**
- Create: `src/app/api/health/__tests__/route.test.ts`
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/health/__tests__/route.test.ts`:

```typescript
/**
 * @jest-environment node
 */

import { GET } from '../route';

describe('/api/health', () => {
  it('returns a stable ok response without external dependencies', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      service: 'debtdetox',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/app/api/health --runInBand
```

Expected: FAIL because `src/app/api/health/route.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'debtdetox',
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/app/api/health --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/health
git commit -m "test: add health endpoint smoke target"
```

---

### Task 2: Add Smoke-Safe Middleware Bypass

**Files:**
- Create: `src/lib/supabase/__tests__/middleware.test.ts`
- Modify: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/supabase/__tests__/middleware.test.ts`:

```typescript
/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { updateSession } from '../middleware';

const mockGetUser = jest.fn();

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

describe('updateSession', () => {
  const originalSkip = process.env.SKIP_SUPABASE_AUTH_REFRESH;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    delete process.env.SKIP_SUPABASE_AUTH_REFRESH;
  });

  afterAll(() => {
    if (originalSkip === undefined) {
      delete process.env.SKIP_SUPABASE_AUTH_REFRESH;
    } else {
      process.env.SKIP_SUPABASE_AUTH_REFRESH = originalSkip;
    }
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    }
    if (originalKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    }
  });

  it('skips Supabase auth refresh when smoke mode is enabled', async () => {
    process.env.SKIP_SUPABASE_AUTH_REFRESH = 'true';
    const request = new NextRequest('https://debtdetox.test/dashboard');

    const response = await updateSession(request);

    expect(response.status).toBe(200);
    expect(createServerClient).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('refreshes Supabase auth by default', async () => {
    const request = new NextRequest('https://debtdetox.test/dashboard');

    const response = await updateSession(request);

    expect(response.status).toBe(200);
    expect(createServerClient).toHaveBeenCalledTimes(1);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/supabase --runInBand
```

Expected: FAIL because `SKIP_SUPABASE_AUTH_REFRESH=true` still creates the Supabase client.

- [ ] **Step 3: Write minimal implementation**

Update `src/lib/supabase/middleware.ts` to this full content:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  if (process.env.SKIP_SUPABASE_AUTH_REFRESH === 'true') {
    return NextResponse.next({
      request,
    });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshing the auth token
  await supabase.auth.getUser();

  return supabaseResponse;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/lib/supabase --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/middleware.ts src/lib/supabase/__tests__/middleware.test.ts
git commit -m "test: allow smoke tests to skip auth refresh"
```

---

### Task 3: Add Test Scripts and Playwright Dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Verify the new scripts do not exist yet**

Run:

```bash
npm run test:unit
```

Expected: FAIL with `Missing script: "test:unit"`.

- [ ] **Step 2: Install Playwright test runner**

Run:

```bash
npm install --save-dev @playwright/test
```

Expected: `package.json` and `package-lock.json` update with `@playwright/test`.

- [ ] **Step 3: Add explicit scripts**

Update the `scripts` block in `package.json` to this exact block:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "start:ci": "next start -H 127.0.0.1 -p 3000",
  "lint": "eslint",
  "test": "jest",
  "test:unit": "jest --runInBand src/components src/hooks src/lib",
  "test:api": "jest --runInBand src/app/api",
  "test:ci": "npm run test:unit && npm run test:api",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:smoke:api": "node scripts/smoke-api.mjs",
  "test:smoke:ui": "playwright test",
  "test:smoke": "npm run test:smoke:api && npm run test:smoke:ui"
}
```

- [ ] **Step 4: Verify unit and API scripts pass**

Run:

```bash
npm run test:unit
npm run test:api
```

Expected: both commands PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "test: add explicit test commands"
```

---

### Task 4: Add API Smoke Script

**Files:**
- Create: `scripts/smoke-api.mjs`

- [ ] **Step 1: Verify the smoke command fails before the script exists**

Run:

```bash
npm run test:smoke:api
```

Expected: FAIL because `scripts/smoke-api.mjs` does not exist.

- [ ] **Step 2: Add the smoke script**

Create `scripts/smoke-api.mjs`:

```javascript
const baseUrl =
  process.env.SMOKE_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  'http://127.0.0.1:3000';

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${response.url}, received: ${text.slice(0, 200)}`);
  }
}

async function checkHealth() {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await readJson(response);

  if (response.status !== 200) {
    throw new Error(`/api/health returned ${response.status}`);
  }

  if (body.status !== 'ok' || body.service !== 'debtdetox') {
    throw new Error(`/api/health returned unexpected body: ${JSON.stringify(body)}`);
  }
}

async function checkInlineInvestmentProjection() {
  const response = await fetch(`${baseUrl}/api/investments/project`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      investment: {
        initial_balance_cents: 100000,
        monthly_contribution_cents: 10000,
        annual_return_bps: 700,
        tax_status: 'taxable',
        tax_rate_bps: 2500,
        inflation_rate_bps: 300,
      },
      years: 1,
      include_inflation: true,
      include_taxes: true,
    }),
  });
  const body = await readJson(response);

  if (response.status !== 200) {
    throw new Error(`/api/investments/project returned ${response.status}: ${JSON.stringify(body)}`);
  }

  if (!Array.isArray(body.schedule) || body.schedule.length !== 12) {
    throw new Error('Investment projection smoke check expected a 12-month schedule');
  }

  if (typeof body.final_balance_cents !== 'number' || body.final_balance_cents <= 100000) {
    throw new Error('Investment projection smoke check expected growth above the initial balance');
  }
}

async function main() {
  await checkHealth();
  await checkInlineInvestmentProjection();
  console.log(`API smoke checks passed against ${baseUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 3: Run against no server to verify the check is meaningful**

Run:

```bash
npm run test:smoke:api
```

Expected: FAIL with a connection error if no app server is running.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-api.mjs
git commit -m "test: add API smoke checks"
```

---

### Task 5: Add Playwright UI Smoke Tests

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`

- [ ] **Step 1: Add Playwright config**

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

- [ ] **Step 2: Add failing browser smoke tests**

Create `e2e/smoke.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';

test.describe('DebtDetox smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: null }),
      });
    });

    await page.route('**/api/debts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/plans/generate', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No debts found' }),
      });
    });
  });

  test('renders the landing page and login page', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Take Control of Your Debt' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

    await page.getByRole('link', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in to DebtDetox' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Magic Link' })).toBeVisible();
  });

  test('renders the dashboard shell with empty anonymous state', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Overview of your debt payoff journey')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Getting Started' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Add Debts/ })).toBeVisible();
  });
});
```

- [ ] **Step 3: Verify tests fail when no app server is running**

Run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:smoke:ui
```

Expected: FAIL with a connection error if no app server is running.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts e2e/smoke.spec.ts
git commit -m "test: add UI smoke checks"
```

---

### Task 6: Add CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Verify no workflow exists**

Run:

```bash
find .github/workflows -maxdepth 1 -type f -print
```

Expected: no files are listed, or `.github/workflows` does not exist.

- [ ] **Step 2: Add the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality-gate:
    name: quality-gate
    runs-on: ubuntu-latest
    timeout-minutes: 20
    env:
      CI: true
      NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
      NEXT_PUBLIC_SUPABASE_ANON_KEY: test-anon-key
      SKIP_SUPABASE_AUTH_REFRESH: true
      PLAYWRIGHT_BASE_URL: http://127.0.0.1:3000
      SMOKE_BASE_URL: http://127.0.0.1:3000

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Unit tests
        run: npm run test:unit

      - name: API integration tests
        run: npm run test:api

      - name: Build
        run: npm run build

      - name: Install Playwright browser
        run: npx playwright install --with-deps chromium

      - name: Start built app
        run: |
          npm run start:ci > /tmp/debtdetox-next.log 2>&1 &
          echo "NEXT_PID=$!" >> "$GITHUB_ENV"

      - name: Wait for app
        run: |
          for attempt in {1..30}; do
            if curl -fsS "$SMOKE_BASE_URL/api/health" >/dev/null; then
              exit 0
            fi
            sleep 2
          done
          cat /tmp/debtdetox-next.log
          exit 1

      - name: API smoke tests
        run: npm run test:smoke:api

      - name: UI smoke tests
        run: npm run test:smoke:ui

      - name: Stop built app
        if: always()
        run: |
          if [ -n "${NEXT_PID:-}" ]; then
            kill "$NEXT_PID" || true
          fi
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add quality gate workflow"
```

---

### Task 7: Update Documentation and Lint Ignore

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Update ESLint generated-output ignores**

Change `eslint.config.mjs` `globalIgnores` to include `coverage/**`:

```javascript
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
  ]),
```

- [ ] **Step 2: Update README commands**

Replace the README command block under `### Commands` with:

````markdown
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
````

Add this paragraph under the README `## Testing` section:

````markdown
The required PR gate is `.github/workflows/ci.yml`. It runs lint, `test:unit`, `test:api`, `build`, API smoke checks, and Playwright UI smoke checks in the `quality-gate` job. Smoke tests use `SKIP_SUPABASE_AUTH_REFRESH=true` and test/dummy Supabase environment variables so the merge gate does not depend on live Supabase.

To run smoke checks locally, build and start the app first:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key \
SKIP_SUPABASE_AUTH_REFRESH=true \
npm run build

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key \
SKIP_SUPABASE_AUTH_REFRESH=true \
npm run start:ci

PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
SMOKE_BASE_URL=http://127.0.0.1:3000 \
npm run test:smoke
```
````

- [ ] **Step 3: Update CLAUDE commands**

Replace the testing commands in `CLAUDE.md` with:

```markdown
# Testing
npm test                 # Run all Jest tests
npm run test:unit        # Run unit/component/hook tests
npm run test:api         # Run mocked API route integration tests
npm run test:ci          # Run unit + API integration tests
npm run test:watch       # Run tests in watch mode
npm test -- path/to/test.test.ts  # Run a single test file

# Smoke tests
npm run test:smoke:api   # API smoke checks against a running app
npm run test:smoke:ui    # Playwright UI smoke checks against a running app
npm run test:smoke       # API + UI smoke checks
```

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md eslint.config.mjs
git commit -m "docs: document testing gate commands"
```

---

### Task 8: Verify Local Gate End-to-End

**Files:**
- No file changes expected.

- [ ] **Step 1: Run lint**

Run:

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 2: Run unit and API integration tests**

Run:

```bash
npm run test:unit
npm run test:api
```

Expected: both commands PASS.

- [ ] **Step 3: Build with smoke env**

Run:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key SKIP_SUPABASE_AUTH_REFRESH=true npm run build
```

Expected: build exits 0.

- [ ] **Step 4: Start the built app**

Run:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key SKIP_SUPABASE_AUTH_REFRESH=true npm run start:ci
```

Expected: server starts on `http://127.0.0.1:3000`. Keep it running for the next steps.

- [ ] **Step 5: Run smoke tests**

In another shell, run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 SMOKE_BASE_URL=http://127.0.0.1:3000 npm run test:smoke
```

Expected: API smoke and Playwright UI smoke both PASS.

- [ ] **Step 6: Stop the built app**

Stop the `npm run start:ci` process with `Ctrl-C`.

---

### Task 9: Configure GitHub Branch Protection

**Files:**
- No repository file changes expected.

- [ ] **Step 1: Confirm workflow check context**

After `.github/workflows/ci.yml` has been pushed and a CI run has started, confirm the check context:

```bash
gh pr checks --watch
```

Expected: a required candidate check named `quality-gate`.

- [ ] **Step 2: Apply branch protection to `main`**

Run:

```bash
gh api \
  --method PUT \
  repos/myap2/debtdetox/branches/main/protection \
  --field 'required_status_checks[strict]=true' \
  --field 'required_status_checks[contexts][]=quality-gate' \
  --field 'enforce_admins=false' \
  --field 'required_pull_request_reviews=null' \
  --field 'restrictions=null' \
  --field 'required_linear_history=false' \
  --field 'allow_force_pushes=false' \
  --field 'allow_deletions=false' \
  --field 'required_conversation_resolution=true'
```

Expected: GitHub returns the branch protection JSON for `main` and includes `quality-gate` in `required_status_checks.contexts`.

- [ ] **Step 3: Verify protection**

Run:

```bash
gh api repos/myap2/debtdetox/branches/main/protection --jq '.required_status_checks.contexts'
```

Expected:

```json
[
  "quality-gate"
]
```

---

## Final Verification

Run these commands before reporting completion:

```bash
git status --short
npm run lint
npm run test:unit
npm run test:api
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key SKIP_SUPABASE_AUTH_REFRESH=true npm run build
```

Then start the built app and run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 SMOKE_BASE_URL=http://127.0.0.1:3000 npm run test:smoke
```

Report any remaining lint warnings separately from failures because the baseline currently has warnings while exiting successfully.
