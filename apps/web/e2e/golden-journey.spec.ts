import { expect, test } from '@playwright/test';
import { expectNoRawErrorLeak, registerStudent } from './support';

/**
 * G5 item 1 — the golden journey.
 *
 * A student arrives, creates an account, and reaches their account area with a
 * real session against real PostgreSQL. Every step here is one that unit tests
 * cannot see, because the defect lives between the screen and the database
 * rather than inside either.
 */
test.describe('golden journey', () => {
  test('a student can register and reach their account', async ({ page }) => {
    await registerStudent(page, 'golden');

    // One h1 per screen is a standing rule; the account area must have landed.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expectNoRawErrorLeak(page);
  });

  test('a reload keeps the student signed in', async ({ page }) => {
    // The defect this pins shipped: the access token lives in memory (S3.14),
    // so a reload arrives with nothing while the refresh cookie is still
    // valid, and the guard used to redirect to sign-in. Found by hand, fixed
    // in #245, unit-tested in #247 — and this is the first test that proves it
    // against a real cookie from a real API.
    await registerStudent(page, 'reload');

    await page.reload();

    await expect(page).toHaveURL(/\/app(\/|$)/);
    await expect(page.getByRole('link', { name: /sign in/i })).toHaveCount(0);
  });
});
