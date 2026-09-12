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

  const tokenAtSend = tokens.get();

  return next(withHeaders(tokenAtSend)).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) {
        return throwError(() => error);
      }

      /*
       * Only refresh a session that existed.
       *
       * Found on the first real end-to-end run: a visitor with no account
       * opened a public page, the request came back 401, and the interceptor
       * tried to refresh anyway. The refresh failed — correctly, there was
       * nothing to refresh — and its `invalid_token` surfaced instead of the
       * original error, so the screen read "That link has expired" to someone
       * who had never been sent a link.
       *
       * With no token there is no session, and the 401 is the honest answer.
       */
      if (!tokenAtSend) {
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
