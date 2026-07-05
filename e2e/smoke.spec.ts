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
    const debtsResponse = page.waitForResponse(
      (response) => response.url().includes('/api/debts') && response.status() === 200,
    );
    const planResponse = page.waitForResponse(
      (response) => response.url().includes('/api/plans/generate') && response.status() === 400,
    );

    await page.goto('/dashboard');
    await debtsResponse;
    await planResponse;

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Overview of your debt payoff journey')).toBeVisible();
    await expect(page.getByText('Anonymous Session')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Getting Started' })).toBeVisible();
    await expect(page.getByText('Add your debts to get started')).toBeVisible();
    await expect(page.getByRole('link', { name: /Add Debts/ })).toBeVisible();
  });
});
