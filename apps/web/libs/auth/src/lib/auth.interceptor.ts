import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, map, switchMap, throwError } from 'rxjs';

import { AuthApiService } from './auth-api.service';
import { AuthTokenService } from './auth-token.service';
import { RefreshCoordinator } from './refresh-coordinator';

/**
 * The single auth interceptor (S3.15): attaches the in-memory Bearer token + an X-Request-ID to
 * every request; on a 401 it triggers ONE shared silent refresh (deduplicated across concurrent
 * 401s via RefreshCoordinator) and retries with the new token. A failed refresh clears the
 * token. The /auth endpoints are skipped to avoid a refresh loop. Server is authoritative (S3.19).
 */
function newRequestId(): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `req_${uuid.replace(/-/g, '').slice(0, 24)}`;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(AuthTokenService);
  const api = inject(AuthApiService);
  const coordinator = inject(RefreshCoordinator);

  const withHeaders = (token: string | null) => {
    let headers = req.headers.set('X-Request-ID', newRequestId());
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return req.clone({ headers });
  };

  // The auth endpoints carry no Bearer and must not loop through refresh-on-401.
  if (req.url.includes('/api/v1/auth/')) {
    return next(req.clone({ headers: req.headers.set('X-Request-ID', newRequestId()) }));
  }

  return next(withHeaders(tokens.get())).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) {
        return throwError(() => error);
      }
      return coordinator
        .refreshOnce(() =>
          api.refresh().pipe(
            map((t) => {
              tokens.set(t.access_token);
              return t.access_token;
            }),
          ),
        )
        .pipe(
          switchMap((newToken) => next(withHeaders(newToken))),
          catchError((refreshError) => {
            tokens.clear(); // refresh failed -> drop the session (server already revoked it)
            return throwError(() => refreshError);
          }),
        );
    }),
  );
};
