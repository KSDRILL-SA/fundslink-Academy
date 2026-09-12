import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { AuthApiService } from './auth-api.service';
import { AuthTokenService } from './auth-token.service';
import { AuthTokens, LoginRequest, RegisterRequest } from './auth.models';

/** Facade for components: register/login store the access token in memory; logout clears it. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApiService);
  private readonly tokens = inject(AuthTokenService);
  readonly isAuthenticated = this.tokens.isAuthenticated;

  register(body: RegisterRequest): Observable<AuthTokens> {
    return this.api.register(body).pipe(tap((t) => this.tokens.set(t.access_token)));
  }

  login(body: LoginRequest): Observable<AuthTokens> {
    return this.api.login(body).pipe(tap((t) => this.tokens.set(t.access_token)));
  }

  logout(): Observable<void> {
    return this.api.logout().pipe(tap(() => this.tokens.clear()));
  }

  /**
   * Restore a session that the browser still holds, once, at startup.
   *
   * The access token lives in memory (S3.14), so a reload or a bookmarked
   * `/app/...` link arrives with nothing — and the guard redirected to sign-in
   * even when the HttpOnly refresh cookie was still perfectly valid. Found on
   * the first real end-to-end run: signing in, pressing F5, and being thrown
   * out.
   *
   * The refresh endpoint is the only thing that can tell us whether a session
   * exists, because the cookie is deliberately invisible to this code. A
   * failure here is the normal case for a visitor who has never signed in, so
   * it resolves quietly rather than erroring.
   */
  restore(): Observable<boolean> {
    if (this.tokens.get()) {
      return of(true);
    }
    return this.api.refresh().pipe(
      tap((t) => this.tokens.set(t.access_token)),
      map(() => true),
      catchError(() => of(false)),
    );
  }
}
