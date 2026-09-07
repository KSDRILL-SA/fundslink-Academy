import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable, catchError, throwError } from 'rxjs';
import { toApiError } from 'data-access';

import { AuthTokens, LoginRequest, RegisterRequest } from './auth.models';

/** Thin client for the /auth endpoints (FROM the contract, S2.7). `withCredentials` lets the
 *  HttpOnly refresh cookie ride the refresh/logout calls (S3.14).
 *
 *  Every call is normalised through `toApiError`, so a failure always carries a
 *  stable `error.code`. That is what lets the screens branch on the code and
 *  render the presentation table's wording (S4.12) instead of reading
 *  `error.message` — which is not a contract and can be reworded, translated,
 *  or made deliberately vaguer for security at any time. */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/auth';

  register(body: RegisterRequest): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.base}/register`, body, { withCredentials: true }).pipe(
      catchError((error: unknown) => throwError(() => toApiError(error))),
    );
  }

  login(body: LoginRequest): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.base}/login`, body, { withCredentials: true }).pipe(
      catchError((error: unknown) => throwError(() => toApiError(error))),
    );
  }

  refresh(): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.base}/refresh`, {}, { withCredentials: true }).pipe(
      catchError((error: unknown) => throwError(() => toApiError(error))),
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/logout`, {}, { withCredentials: true }).pipe(
      catchError((error: unknown) => throwError(() => toApiError(error))),
    );
  }

  verifyEmail(token: string): Observable<void> {
    return this.http.post<void>(`${this.base}/verify-email`, { token }).pipe(
      catchError((error: unknown) => throwError(() => toApiError(error))),
    );
  }

  resendVerification(email: string): Observable<void> {
    return this.http.post<void>(`${this.base}/verify-email/resend`, { email }).pipe(
      catchError((error: unknown) => throwError(() => toApiError(error))),
    );
  }

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${this.base}/forgot-password`, { email }).pipe(
      catchError((error: unknown) => throwError(() => toApiError(error))),
    );
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.base}/reset-password`, { token, new_password: newPassword }).pipe(
      catchError((error: unknown) => throwError(() => toApiError(error))),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(
      `${this.base}/change-password`,
      { current_password: currentPassword, new_password: newPassword },
      { withCredentials: true },
    ).pipe(
      catchError((error: unknown) => throwError(() => toApiError(error))),
    );
  }
}
