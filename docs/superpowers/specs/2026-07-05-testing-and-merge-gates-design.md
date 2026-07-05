# Testing and Merge Gates Design

## Goal

Add a reliable PR testing gate for `main` that covers unit tests, mocked API integration tests, build validation, API smoke checks, and browser UI smoke checks, then document the GitHub merge enforcement required to block merges when those checks fail.

## Current State

DebtDetox is a Next.js 16 app with Jest, React Testing Library, and an in-memory Supabase mock already configured. The repository has unit and API route tests under colocated `__tests__/` directories, but it does not currently have a GitHub Actions workflow, Playwright smoke tests, or documented branch protection requirements.

## Test Strategy

The required PR gate will stay deterministic and fast. Existing Jest tests will remain the main unit and API integration layer. API route tests will continue using `src/test/supabase-mock.ts` instead of requiring a real Supabase instance in CI.

The test suite will be split into explicit commands:

- Unit tests: pure calculation engines, hooks, component behavior, and validation tests.
- API integration tests: Next route handler tests with the in-memory Supabase mock.
- Build check: `next build` through the existing `npm run build` script.
- API smoke tests: lightweight HTTP checks against a running built app.
- UI smoke tests: Playwright browser tests against a running app to catch route rendering and critical navigation failures.

Real Supabase integration will not be part of the required PR gate. It can be added later as a manual or scheduled workflow if higher-fidelity database coverage becomes necessary.

## CI Workflow

Add a GitHub Actions workflow for pull requests targeting `main` and pushes to `main`. The workflow should:

1. Install Node.js and dependencies with `npm ci`.
2. Run lint.
3. Run unit and mocked API integration tests.
4. Build the Next.js app.
5. Start the built app locally.
6. Run API smoke checks.
7. Run Playwright UI smoke checks.

The workflow should use stable check names so GitHub branch protection can require them.

## Merge Enforcement

Configure GitHub branch protection or a repository ruleset for `main` after the workflow is merged. Required status checks should include the CI jobs created by the workflow. The rule should block direct merging when any required check fails.

Recommended settings:

- Require pull requests before merging.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Require the CI workflow jobs that run lint, tests, build, API smoke, and UI smoke.

## Documentation

Update project documentation with the new local and CI test commands, including how to run unit/API tests, API smoke tests, and UI smoke tests locally.

## Risks

Playwright adds a browser dependency to CI and may increase runtime. Keeping the UI smoke suite small limits that cost. API smoke tests should target stable routes and avoid relying on live Supabase credentials.

Mocked API integration tests do not prove cloud Supabase schema or RLS behavior. That tradeoff is intentional for the required PR gate because the normal merge blocker should be fast, repeatable, and independent of external services.
