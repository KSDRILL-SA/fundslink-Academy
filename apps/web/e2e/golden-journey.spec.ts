import { expect, test } from '@playwright/test';
import {
  completeProfile,
  expectNoRawErrorLeak,
  freshIdNumber,
  registerStudent,
} from './support';

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

/**
 * The rest of the golden journey — profile, application, submit, status.
 *
 * This is the path the whole product exists to serve, and it is the one no
 * unit test can walk: it crosses five screens, two API modules, and the
 * eligibility pre-screen, and the defects live in the joins. Stage 04 shipped
 * an apply flow that created a draft and never submitted it; every completed
 * application sat unread. Nothing but this test would have noticed.
 */
test.describe('golden journey — apply and submit', () => {
  test('a student completes a profile, applies, submits, and sees a real status', async ({
    page,
  }) => {
    await registerStudent(page, 'apply');
    await completeProfile(page, freshIdNumber());

    await page.goto('/app/applications/new');
    await page.getByRole('button', { name: /starting Honours/ }).click();

    // Step 1 of 3 — the year.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/year/i);
    await page.getByLabel('Which academic year', { exact: false }).selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2 of 3 — what they need. Money is a decimal string end to end.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/what would help/i);
    await page.getByLabel('How much do you need', { exact: false }).fill('25000');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 3 of 3 — funding history, all optional. Answer the selects so the
    // reviewer gets context, then send it.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/context/i);
    await page.getByLabel('Who funded your studies before this', { exact: false }).selectOption({
      label: 'NSFAS',
    });
    await page
      .getByLabel('Roughly what does your household earn', { exact: false })
      .selectOption({ label: 'Up to R350 000' });

    // Wait on the SUBMIT RESPONSE, not on a URL change. Asserting navigation
    // made this test intermittent and told me nothing when it failed: a slow
    // or refused submit and a broken redirect look identical from the address
    // bar. The response is the fact; it also names the failure if there is one.
    const submitted = page.waitForResponse(
      (r) => /\/applications\/[^/]+\/submit$/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    // The button is named for what it does to a person, not "Submit".
    await page.getByRole('button', { name: 'Send my application for review' }).click();

    const response = await submitted;
    expect(response.status(), `submit failed: ${await response.text()}`).toBe(200);
    await expectNoRawErrorLeak(page);

    // The assertion a weaker version of this test got wrong. "The page did not
    // say DRAFT" passes just as well when nothing was created at all, and
    // "an application exists" passes while it sits unsubmitted — which is the
    // defect Stage 04 shipped, where the apply flow created a draft and never
    // submitted it, and every completed application sat unread. So both:
    // the application must exist, and it must have left DRAFT.
    await page.goto('/app/applications');
    await page.waitForLoadState('networkidle');
    const list = page.locator('main');
    await expect(list).toContainText(/2026|2027/); // the academic year chosen
    await expect(list).not.toContainText(/draft/i);
    await expect(list).not.toContainText(/no applications|nothing here/i);
  });
});
