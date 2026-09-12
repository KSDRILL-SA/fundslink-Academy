/**
 * PRODUCTION environment — the default.
 *
 * This file is what ships. It previously declared `production: false` and was
 * the only environment file, with no fileReplacements in angular.json, so every
 * production build believed it was not production. Anything gated on that flag
 * would have leaked into the live site — the preview-mode mock API above all.
 *
 * Development values live in environment.development.ts and are swapped in by
 * the `development` build configuration only.
 *
 * The Sentry DSN is injected per environment at deploy and never committed
 * (S3.20).
 */
export const environment = {
  production: true,
  name: 'production',
  apiBase: '/api/v1',
  sentryDsn: '',
  /** Never true here. A mock API in production would show students fake data. */
  useMockApi: false,
};
