import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { authInterceptor } from 'auth';

import { routes } from './app.routes';
import { sentryProviders } from './core/observability';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // The single auth interceptor (S3.15): attaches the token + dedups 401-refresh.
    provideHttpClient(withInterceptors([authInterceptor])),
    ...sentryProviders(),
  ],
};
