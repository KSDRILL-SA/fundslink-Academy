import { describe, expect, it } from 'vitest';

import { AuthTokenService } from './auth-token.service';

describe('AuthTokenService — in-memory only (S3.14, defends AP-S3.14a / CF-01)', () => {
  it('stores the access token in memory and never in localStorage', () => {
    const svc = new AuthTokenService();
    svc.set('aaa.bbb.ccc');

    expect(svc.get()).toBe('aaa.bbb.ccc');
    expect(svc.isAuthenticated()).toBe(true);
    if (typeof localStorage !== 'undefined') {
      expect(JSON.stringify(localStorage)).not.toContain('aaa.bbb.ccc');
    }
  });

  it('clears the token on logout', () => {
    const svc = new AuthTokenService();
    svc.set('x');
    svc.clear();

    expect(svc.get()).toBeNull();
    expect(svc.isAuthenticated()).toBe(false);
  });
});
