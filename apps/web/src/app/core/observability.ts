import {
  type EnvironmentProviders,
  ErrorHandler,
  Injectable,
  type Provider,
  inject,
  provideAppInitializer,
} from '@angular/core';

/**
 * Sentry for the SPA (S3.34 / Gate G2), loaded lazily and off the first-visit path.
 *
 * Sentry was previously a static import, which put the whole SDK in the
 * initial bundle — downloaded on first paint by every visitor, including
 * someone reading the public marketing page who will never authenticate. On
 * the mid-range SA mobile + 3G profile G4 is measured against, that is paid
 * before anything renders (P6).
 *
 * It is now a dynamic import, so the SDK is its own chunk (461 kB raw /
 * ~130 kB transfer) fetched only when a DSN is configured. Local dev and CI
 * have no DSN and never download it at all.
 *
 * **It is fetched when the browser goes idle, not at bootstrap.** An app
 * initializer that did not await the import still started the request while
 * the first route was being fetched, so on 3G those ~130 kB competed for the
 * same bandwidth as the screen the student was waiting for — enough to put a
 * student route over G4's 200 kB first-load bar (handoff-s04-s05.md §3, L4
 * ruling 2026-09-12). Waiting for idle means the reporter costs nothing until
 * the page the student came for has arrived.
 *
 * The cost of deferring is a window in which an error can be thrown before the
 * reporter exists, and idle makes that window longer than bootstrap did.
 * DeferredErrorHandler closes it by buffering, so no error is lost to the
 * optimisation — that buffer is what makes this trade safe, not an extra.
 */

/** Errors held while the SDK loads. Capped so a boot loop cannot exhaust memory. */
const MAX_BUFFERED_ERRORS = 20;

/**
 * Longest we wait for an idle moment before fetching anyway.
 *
 * A busy page might never report idle, and a reporter that never loads is not
 * a reporter. This bounds the buffering window on the slowest device.
 */
const IDLE_DEADLINE_MS = 3000;

type IdleScheduler = (callback: () => void, options?: { timeout: number }) => unknown;

/**
 * Run `task` once the browser is idle.
 *
 * `requestIdleCallback` is unavailable in older Safari and absent from jsdom,
 * so the timer fallback is a real path, not a formality. Both are bounded by
 * the same deadline, so the reporter always arrives.
 */
function whenIdle(task: () => void): void {
  const scheduler = (globalThis as { requestIdleCallback?: IdleScheduler }).requestIdleCallback;
  if (typeof scheduler === 'function') {
    scheduler(task, { timeout: IDLE_DEADLINE_MS });
    return;
  }
  setTimeout(task, IDLE_DEADLINE_MS);
}

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
      // Nothing is scheduled without a DSN, so dev and CI do no work at all.
      if (!dsn) {
        return;
      }
      const handler = inject(DeferredErrorHandler);
      // Neither awaited nor started here: the SDK must not compete with the
      // route the user actually asked for.
      whenIdle(() => void startSentry(dsn, environment, handler));
    }),
  ];
}
