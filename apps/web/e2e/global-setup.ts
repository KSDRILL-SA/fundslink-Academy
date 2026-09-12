/**
 * Refuse to run without a real backend.
 *
 * Without this, a missing API surfaces as every journey timing out on a
 * selector, which reads like a broken application and costs an hour to
 * diagnose. The suite's whole value is that it talks to real PostgreSQL, so
 * "no backend" is a setup error, not a test failure.
 */
const API_HEALTH = process.env.E2E_API_HEALTH ?? 'http://127.0.0.1:8000/healthz';

export default async function globalSetup(): Promise<void> {
  let response: Response;
  try {
    response = await fetch(API_HEALTH, { signal: AbortSignal.timeout(5000) });
  } catch (cause) {
    throw new Error(
      [
        `E2E: no API answering at ${API_HEALTH}.`,
        '',
        'These journeys assert against real rows, so the backend is required:',
        '  cd apps/api && ./.venv/Scripts/python.exe scripts/dev_server.py',
        '',
        `(${String(cause)})`,
      ].join('\n'),
    );
  }

  if (!response.ok) {
    throw new Error(`E2E: API at ${API_HEALTH} answered ${response.status}, expected 200.`);
  }
}
