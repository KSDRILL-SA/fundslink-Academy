import { ErrorHandler, Provider } from '@angular/core';
import * as Sentry from '@sentry/angular';

/** Sentry for the SPA (S3.34 / Gate G2). No-op without a DSN (local dev). PII is never sent. */
export function initWebSentry(dsn: string, environment: string): boolean {
  if (!dsn) {
    return false;
  }
  Sentry.init({ dsn, environment, sendDefaultPii: false, tracesSampleRate: 0 });
  return true;
}

/** Routes uncaught errors to Sentry so a thrown error is reported (Gate G2). */
export function sentryProviders(): Provider[] {
  return [{ provide: ErrorHandler, useValue: Sentry.createErrorHandler() }];
}
