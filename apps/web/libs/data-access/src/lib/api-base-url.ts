import { InjectionToken } from '@angular/core';

/**
 * Where the API lives.
 *
 * An injection token rather than an import of `environment`, because
 * `libs/data-access` is a library and must not reach into the application's
 * environment files — that coupling is what stops a library being testable
 * without booting the app, and what makes a second consumer impossible.
 * The app provides it in `app.config.ts`; a test provides whatever it likes.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  // Same-origin default matching the deployed proxy path. Overridden by the
  // application at bootstrap.
  factory: () => '/api/v1',
});
