import { expect, type Page } from '@playwright/test';

/**
 * Shared journey helpers.
 *
 * Everything here addresses the page the way a person does — by visible label
 * and accessible role, never by CSS class. Two reasons, both learned in Stage
 * 04: class-based selectors broke on every visual pass and taught nothing, and
 * a journey that can only be driven through the accessibility tree is a
 * journey a screen-reader user can complete.
 */

/**
 * A fresh identity per run. The suite shares one database and must not collide.
 *
 * NOT a `.test` domain: it is an IANA special-use TLD and the API's email
 * validator refuses it outright, which surfaces as a 422 that looks like an
 * application bug rather than a bad fixture.
 */
export function freshEmail(tag: string): string {
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return `e2e-${tag}-${unique}@fundslink-e2e.co.za`;
}

/** Strong enough for the API's own policy (S3.32 — the API is authoritative). */
export const PASSWORD = 'Corr3ct-Horse-Batt3ry!';

/**
 * Register a brand-new student and land inside the account.
 *
 * Registration signs the student in and routes to the verify-email screen;
 * `EMAIL_VERIFICATION_REQUIRED` is off by default, so the account area is
 * reachable from there. Returns the email so a journey can sign back in as the
 * same person later.
 */
export async function registerStudent(page: Page, tag: string): Promise<string> {
  const email = freshEmail(tag);

  await page.goto('/auth/register');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: false }).first().fill(PASSWORD);
  // Consent is requiredTrue (BR-A05) — the form refuses without it.
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();

  // Registration signs the student in and routes to verify-email.
  await expect(page).toHaveURL(/\/auth\/verify-email/, { timeout: 20_000 });

  // The session is real from here; the account area is reachable.
  await page.goto('/app');
  await expect(page).toHaveURL(/\/app(\/|$)/, { timeout: 20_000 });

  // Wait for the guard's session restore to SETTLE before handing back.
  //
  // Every fresh page load restores through POST /auth/refresh, and that call
  // ROTATES the cookie. Navigating again while the first refresh is still in
  // flight sends the superseded token, which the API correctly rejects — so a
  // journey that reloads too quickly signs itself out and looks like an
  // application bug. It is not: it is two restores racing over one rotating
  // credential.
  await page.waitForLoadState('networkidle');
  return email;
}

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: false }).first().fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/app(\/|$)/, { timeout: 20_000 });
}

/**
 * Assert the page never renders a raw server error string to a student (S4.12).
 *
 * Stage 04 shipped screens that rendered `err?.error?.error?.message`. A unit
 * test greps the source for that shape; this catches the same class of leak at
 * runtime, including from a code path no unit test covers.
 */
export async function expectNoRawErrorLeak(page: Page): Promise<void> {
  const body = (await page.locator('body').innerText()).toLowerCase();
  for (const leak of ['traceback', 'internal server error', 'sqlalchemy', 'psycopg', 'undefined']) {
    expect(body, `a raw "${leak}" reached the student`).not.toContain(leak);
  }
}

/**
 * A complete student profile, including the SA ID that D-007 requires before submit.
 *
 * The ID is a structurally valid 13 digits; the API stores it encrypted with a
 * blind index (BR-A04) and does not verify the check digit, so a fixture value
 * is honest here rather than a shortcut. It must be unique per student — the
 * blind index is UNIQUE.
 */
export async function completeProfile(page: Page, idNumber: string): Promise<void> {
  await page.goto('/app/profile');
  await page.getByLabel('First name', { exact: false }).fill('Lebo');
  await page.getByLabel('Last name', { exact: false }).fill('Dlamini');
  await page.getByLabel('Level of study', { exact: false }).selectOption({ label: 'Undergraduate' });
  await page.getByLabel('Field of study', { exact: false }).fill('BEng Civil');
  await page.getByLabel('South African ID number', { exact: false }).fill(idNumber);
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.waitForLoadState('networkidle');

  // Prove it PERSISTED, rather than that a confirmation appeared. The first
  // version asserted a "Saved." message, which is transient — it passed alone
  // and failed in a full run, which is the signature of asserting a toast's
  // lifetime instead of a fact. Reloading and reading the field back cannot
  // flake, and it is what the next step actually depends on: D-007 refuses a
  // submit without an SA ID on the profile.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('Field of study', { exact: false })).toHaveValue('BEng Civil');
}

/** A unique 13-digit SA ID per run — the blind index is UNIQUE (BR-A04). */
export function freshIdNumber(): string {
  const digits = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-13);
  return digits.padStart(13, '9');
}
