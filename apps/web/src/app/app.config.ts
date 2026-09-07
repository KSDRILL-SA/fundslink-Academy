import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
// Narrow entry, not the 'auth' barrel: the barrel re-exports the five auth
// screens, so importing the interceptor at bootstrap pulled every screen into
// the initial bundle. The interceptor and the guard are the two pieces of a
// lazy library that must load eagerly, so each has its own entry point.
import { authInterceptor } from 'auth/interceptor';
import { API_BASE_URL } from 'data-access';

import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { sentryProviders } from './core/observability';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // The single auth interceptor (S3.15): attaches the token + dedups 401-refresh.
    provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
    // Sentry loads lazily, after bootstrap and only when a DSN is set, so the
    // SDK never sits in the initial bundle (see core/observability.ts).
    // The generated client's base URL comes from the app, not from the
    // library — libs/data-access must not reach into environment files.
    { provide: API_BASE_URL, useValue: environment.apiBase },
    ...sentryProviders(environment.sentryDsn, environment.name),
  ],
};
