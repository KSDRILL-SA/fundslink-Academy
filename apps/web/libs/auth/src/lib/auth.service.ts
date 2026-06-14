import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

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
}
