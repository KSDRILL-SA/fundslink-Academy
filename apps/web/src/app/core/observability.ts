import {
  type EnvironmentProviders,
  ErrorHandler,
  Injectable,
  type Provider,
  inject,
  provideAppInitializer,
} from '@angular/core';

/**
 * Sentry for the SPA (S3.34 / Gate G2), loaded lazily.
 *
 * Sentry was previously a static import, which put the whole SDK in the
 * initial bundle — downloaded on first paint by every visitor, including
 * someone reading the public marketing page who will never authenticate. On
 * the mid-range SA mobile + 3G profile G4 is measured against, that is paid
 * before anything renders (P6).
 *
 * It is now a dynamic import behind an app initializer, so the SDK becomes its
 * own chunk fetched after bootstrap, and only when a DSN is configured. Local
 * dev and CI have no DSN and therefore never download it at all.
 *
 * The cost of deferring is a window, however short, in which an error can be
 * thrown before the reporter exists. DeferredErrorHandler closes that window
 * by buffering, so no error is lost to the optimisation.
 */

/** Errors held while the SDK loads. Capped so a boot loop cannot exhaust memory. */
const MAX_BUFFERED_ERRORS = 20;

@Injectable()
export class DeferredErrorHandler implements ErrorHandler {
  private delegate: ErrorHandler | null = null;
  private readonly buffered: unknown[] = [];

  handleError(error: unknown): void {
    // Always surface locally: with no DSN this is the only report there is.
    console.error(error);

    if (this.delegate) {
      this.delegate.handleError(error);
      return;
    }
    if (this.buffered.length < MAX_BUFFERED_ERRORS) {
      this.buffered.push(error);
    }
  }

  /** Hand over to the real reporter and flush anything thrown before it arrived. */
  adopt(delegate: ErrorHandler): void {
    this.delegate = delegate;
    while (this.buffered.length) {
      delegate.handleError(this.buffered.shift());
    }
  }
}

/**
 * Load and initialise Sentry, returning whether it started.
 *
 * Never rejects: observability failing is not a reason for the application to
 * fail. A student mid-application does not lose their work because an error
 * reporter could not be fetched.
 */
export async function startSentry(
  dsn: string,
  environment: string,
  handler: DeferredErrorHandler,
): Promise<boolean> {
  if (!dsn) {
    return false;
  }
  try {
    const Sentry = await import('@sentry/angular');
    Sentry.init({ dsn, environment, sendDefaultPii: false, tracesSampleRate: 0 });
    handler.adopt(Sentry.createErrorHandler());
    return true;
  } catch (error) {
    console.error('observability: Sentry failed to load', error);
    return false;
  }
}

/**
 * Providers for error reporting.
 *
 * `dsn` is build-time configuration (S3.20) — injected per environment at
 * deploy, never committed.
 */
export function sentryProviders(
  dsn: string,
  environment: string,
): (Provider | EnvironmentProviders)[] {
  return [
    DeferredErrorHandler,
    { provide: ErrorHandler, useExisting: DeferredErrorHandler },
    provideAppInitializer(() => {
      const handler = inject(DeferredErrorHandler);
      // Not awaited: the SDK must not stand between the user and first paint.
      void startSentry(dsn, environment, handler);
    }),
  ];
}
