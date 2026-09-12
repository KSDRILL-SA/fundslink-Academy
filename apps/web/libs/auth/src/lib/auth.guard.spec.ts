import { TestBed } from '@angular/core/testing';
import { GuardResult, provideRouter } from '@angular/router';
import { Observable, Subject, firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthApiService } from './auth-api.service';
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

/**
 * One refresh, however many callers (S3.15 / S7.12, AP-S3.15a).
 *
 * A refresh ROTATES the cookie. Two overlapping refreshes mean the second
 * presents a token the first already rotated, reuse-detection trips, and the
 * student is signed out — the precise failure `RefreshCoordinator` exists to
 * prevent. `AuthService.restore()` was calling the API directly and bypassing
 * it, so a guard restore on a fresh page load could race an interceptor
 * refresh triggered by a 401 from that page's first data request.
 */
describe('AuthService.restore — shares one in-flight refresh', () => {
  it('refreshes once for concurrent callers, and hands both the session', async () => {
    // A SUBJECT, not of(...). With a synchronous source the first restore
    // completes and sets the token before the second even subscribes, so the
    // second short-circuits on `tokens.get()` and never refreshes — the test
    // then passes against the bypassing implementation too and proves nothing.
    // (It did. I ran it against the old code to find out.) The race only
    // exists while a refresh is genuinely in flight.
    const source = new Subject<{ access_token: string }>();
    const refresh = vi.fn(() => source.asObservable());
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthApiService, useValue: { refresh } }],
    });
    const auth = TestBed.inject(AuthService);

    const first = firstValueFrom(auth.restore());
    const second = firstValueFrom(auth.restore());

    // Asserted WHILE in flight — this is the whole test.
    expect(refresh, 'a second refresh would present a token the first rotated').toHaveBeenCalledTimes(
      1,
    );

    source.next({ access_token: 'fresh-token' });
    source.complete();

    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(TestBed.inject(AuthTokenService).get()).toBe('fresh-token');
  });

  it('reports no session when the refresh fails, without throwing', async () => {
    const refresh = vi.fn(() => throwError(() => new Error('no cookie')));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthApiService, useValue: { refresh } }],
    });

    expect(await firstValueFrom(TestBed.inject(AuthService).restore())).toBe(false);
  });
});
