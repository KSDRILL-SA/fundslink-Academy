import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { AuthTokens, LoginRequest, RegisterRequest } from './auth.models';

/** Thin client for the /auth endpoints (FROM the contract, S2.7). `withCredentials` lets the
 *  HttpOnly refresh cookie ride the refresh/logout calls (S3.14). */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/auth';

  register(body: RegisterRequest): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.base}/register`, body, { withCredentials: true });
  }

  login(body: LoginRequest): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.base}/login`, body, { withCredentials: true });
  }

  refresh(): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.base}/refresh`, {}, { withCredentials: true });
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/logout`, {}, { withCredentials: true });
  }

  verifyEmail(token: string): Observable<void> {
    return this.http.post<void>(`${this.base}/verify-email`, { token });
  }

  resendVerification(email: string): Observable<void> {
    return this.http.post<void>(`${this.base}/verify-email/resend`, { email });
  }

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${this.base}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.base}/reset-password`, { token, new_password: newPassword });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(
      `${this.base}/change-password`,
      { current_password: currentPassword, new_password: newPassword },
      { withCredentials: true },
    );
  }
}
