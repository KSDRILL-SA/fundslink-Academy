import { Component } from '@angular/core';

/** Non-production trigger to prove Sentry capture from the SPA (Gate G2). Navigating here throws
 *  an uncaught error, which the Sentry ErrorHandler reports. */
@Component({
  selector: 'app-debug-sentry',
  standalone: true,
  template: '<p>Triggering a test error for Sentry…</p>',
})
export class DebugSentryComponent {
  constructor() {
    throw new Error('debug-sentry: intentional test error for Sentry verification (web)');
  }
}
