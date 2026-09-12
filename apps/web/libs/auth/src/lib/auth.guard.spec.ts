import { TestBed } from '@angular/core/testing';
import { GuardResult, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { authGuard } from './auth.guard';

/**
 * The guard restores a session before it refuses one (S3.19).
 *
 * The access token lives in memory only (S3.14), so a reload or a bookmarked /app link arrives
 * with nothing in hand while the HttpOnly refresh cookie is still valid. The guard used to
 * redirect on that — signing students out of their own account on every F5.
 */
describe('authGuard — restore before refuse (S3.19 / S3.14)', () => {
  let restore: ReturnType<typeof vi.fn>;

  /** Guards run in an injection context; the two ActivatedRoute args are unused here. */
  const run = () => TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

  /**
   * The guard may answer synchronously (token in hand) or asynchronously (after a restore).
   * These tests are about where a user lands, not about which shape the answer arrived in, so
   * the outcome is unwrapped either way — otherwise a test meant to pin behaviour fails the
   * moment the implementation changes its mind about being async.
   */
  const settled = (result: ReturnType<typeof run>): Promise<GuardResult> =>
    result instanceof Observable ? firstValueFrom(result) : Promise.resolve(result);

  beforeEach(() => {
    restore = vi.fn();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { restore } }],
    });
  });

  it('lets a signed-in user through without asking the server', () => {
    TestBed.inject(AuthTokenService).set('an-access-token');

    expect(run()).toBe(true);
    expect(restore).not.toHaveBeenCalled(); // in-app navigation must cost nothing
  });

  it('restores the session the browser still holds instead of refusing it', async () => {
    restore.mockReturnValue(of(true)); // the F5 case: no token, valid refresh cookie

    expect(await settled(run())).toBe(true);
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it('redirects to the auth shell when there is no session to restore', async () => {
    restore.mockReturnValue(of(false));

    // /auth/login, not /login — /login would land on the wildcard route.
    expect(String(await settled(run()))).toBe('/auth/login');
  });

  it('redirects rather than hanging when the refresh itself fails', async () => {
    restore.mockReturnValue(throwError(() => new Error('network down'))); // dropped connection

    expect(String(await settled(run()))).toBe('/auth/login');
  });
});
