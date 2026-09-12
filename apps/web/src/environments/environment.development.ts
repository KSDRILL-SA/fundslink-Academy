/**
 * DEVELOPMENT environment — swapped in by `ng serve` via fileReplacements.
 *
 * `useMockApi` turns on preview mode: an in-browser mock of the contract, so
 * every screen can be walked without the backend (the build host cannot run
 * PostgreSQL). It can only ever be true in this file, and a test asserts the
 * production environment keeps it false.
 */
export const environment = {
  production: false,
  name: 'development',
  apiBase: '/api/v1',
  sentryDsn: '',
  useMockApi: true,
};
