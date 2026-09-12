import { inject, provideAppInitializer, type EnvironmentProviders } from '@angular/core';
import { AuthService } from 'auth/session';
import { firstValueFrom } from 'rxjs';

/**
 * Give a returning visitor their session back before the first route resolves.
 *
 * The access token is held in memory and never in storage (S3.14) — which is
 * the right call, and which means a page reload, a bookmark, or a link from an
 * email arrives with nothing in hand. The refresh token is in an HttpOnly
 * cookie the browser still has and this code cannot read.
 *
 * Without this, `authGuard` saw "not authenticated" and redirected to sign-in
 * while a perfectly valid session sat in the cookie jar. It was found the first
 * time anyone signed in against the real API and pressed F5 — no unit test
 * could have caught it, because the guard was behaving exactly as written.
 *
 * One request, before routing, and only when there is no token already (so
 * preview mode, which seeds one, skips it entirely). A failure is the normal
 * case for someone who has never signed in, so it resolves quietly and the
 * visitor stays anonymous.
 */
export function sessionRestoreProviders(): EnvironmentProviders {
  return provideAppInitializer(async () => {
    const auth = inject(AuthService);
    try {
      await firstValueFrom(auth.restore());
    } catch {
      // Never block the application from starting over a session that is not
      // there. An anonymous visitor is a valid state, not an error.
    }
  });
}
