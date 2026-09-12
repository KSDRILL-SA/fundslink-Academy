import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';

/**
 * Route guard — UX only (S3.19). It redirects an unauthenticated user to /auth/login, but it is NOT
 * the security boundary: the FastAPI `Depends` layer is (S3.17). A user who bypasses this guard
 * gets a 401/403 from the API, never unauthorised data.
 *
 * **It restores a session before it refuses one.** The access token lives in memory only
 * (S3.14), so a reload, a bookmark or a link from an email arrives with nothing in hand while
 * the HttpOnly refresh cookie is still perfectly valid. Without this the guard threw signed-in
 * students out of their own account on every refresh — found the first time anyone signed in
 * against the real API and pressed F5.
 *
 * The restore lives here rather than in a bootstrap initialiser on purpose. It runs only when
 * somebody actually asks for a protected route, so a visitor reading the public site never pays
 * for a request that could only fail — and nothing has to be remembered in storage to know when
 * it is worth asking, which keeps the "never localStorage" rule (AP-S3.14a / CF-01) intact.
 */
export const authGuard: CanActivateFn = () => {
  const tokens = inject(AuthTokenService);
  const auth = inject(AuthService);
  const router = inject(Router);

  // The auth screens live under the auth shell (/auth/login) since the Stage 04
  // routing skeleton; redirecting to /login would land on the wildcard route.
  const signIn = () => router.parseUrl('/auth/login');

  if (tokens.get()) {
    return true;
  }

  return auth.restore().pipe(
    map((restored) => (restored ? true : signIn())),
    catchError(() => of(signIn())),
  );
};
