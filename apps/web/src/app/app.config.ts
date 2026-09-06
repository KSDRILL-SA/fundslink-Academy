import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { authInterceptor } from 'auth';

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
    ...sentryProviders(environment.sentryDsn, environment.name),
  ],
};
