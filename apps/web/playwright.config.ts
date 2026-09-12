import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the REAL stack — Angular, FastAPI, PostgreSQL (G5 item 1).
 *
 * `start:live` is deliberate: it turns the dev preview fixtures OFF, so every
 * assertion here travels the whole path to a real row. A suite run against the
 * fixtures would pass while the application was unable to talk to its own API,
 * which is exactly the class of defect Stage 04 shipped twice (the apply flow
 * that never submitted, and the guard that signed students out on reload).
 *
 * The API is NOT started here. It needs PostgreSQL, RS256 keys and a redis
 * stand-in (`apps/api/scripts/dev_server.py`), which is more than a webServer
 * entry can honestly express — and starting it implicitly would hide a missing
 * backend as a mysterious timeout. `globalSetup` fails loudly instead.
 *
 * ⚠️ The URLs say `localhost`, not `127.0.0.1`, and that is load-bearing on
 * this host: `ng serve` binds to IPv6 loopback (`[::1]`) only, so a
 * `127.0.0.1` health check never succeeds and Playwright concludes the server
 * failed to start while it is in fact serving happily.
 *
 * Workers are pinned to 1. These journeys share one database and several
 * assert on position and ordering (waitlist, return-cycle counts); run in
 * parallel they would interfere and fail intermittently, which teaches a team
 * to re-run tests instead of reading them.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // One at a time: shared database, order-sensitive assertions.
  workers: 1,
  fullyParallel: false,
  // A flake that passes on retry is a defect that ships. Surface it instead.
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run start:live',
    url: 'http://localhost:4200',
    // A cold Angular build on this host is slow; this is not a hang.
    timeout: 240_000,
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
