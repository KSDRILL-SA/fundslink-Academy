import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthTokenService } from './auth-token.service';

/**
 * Route guard — UX only (S3.19). It redirects an unauthenticated user to /auth/login, but it is NOT
 * the security boundary: the FastAPI `Depends` layer is (S3.17). A user who bypasses this guard
 * gets a 401/403 from the API, never unauthorised data.
 */
export const authGuard: CanActivateFn = () => {
  const tokens = inject(AuthTokenService);
  const router = inject(Router);
  // The auth screens live under the auth shell (/auth/login) since the Stage 04
  // routing skeleton; redirecting to /login would land on the wildcard route.
  return tokens.get() ? true : router.parseUrl('/auth/login');
};
