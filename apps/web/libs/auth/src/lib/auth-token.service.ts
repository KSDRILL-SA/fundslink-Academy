import { Injectable, signal } from '@angular/core';

/**
 * The access token lives ONLY in memory (S3.14). Never localStorage/sessionStorage/cookie
 * (AP-S3.14a/CF-01) — an XSS theft is then limited to the 15-minute access-token window, with
 * no refresh capability. The refresh token is an HttpOnly cookie the browser holds; this
 * service never sees it. The token is lost on tab close and re-minted via silent refresh.
 */
@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  private accessToken: string | null = null;
  /** Reactive flag for route guards / UI gating (UX only — the API is the boundary, S3.19). */
  readonly isAuthenticated = signal(false);

  set(token: string): void {
    this.accessToken = token;
    this.isAuthenticated.set(true);
  }

  get(): string | null {
    return this.accessToken;
  }

  clear(): void {
    this.accessToken = null;
    this.isAuthenticated.set(false);
  }
}
