/** Build-time environment. The Sentry DSN is injected per-environment at deploy (Vercel) and is
 *  never committed (S3.20); empty here disables Sentry in local dev. */
export const environment = {
  production: false,
  name: 'development',
  apiBase: '/api/v1',
  sentryDsn: '',
};
