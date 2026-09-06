import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  ApiError,
  NETWORK_ERROR_CODE,
  UNEXPECTED_ERROR_CODE,
  toApiError,
} from './api-error';
import { fillPath, toHttpParams } from './api.service';
import type { Page, Schema } from './api.types';

describe('fillPath', () => {
  it('substitutes contract path templates', () => {
    expect(fillPath('/applications/{id}', { id: 'abc' })).toBe('/applications/abc');
    expect(fillPath('/applications/{id}/appeal', { id: 42 })).toBe('/applications/42/appeal');
  });

  it('URL-encodes values', () => {
    // Path parameters are user-controlled — an id from a link, a token from an
    // email. Interpolated raw, a value containing / or ? silently becomes a
    // different request.
    expect(fillPath('/t/{token}', { token: 'a/b?c=d' })).toBe('/t/a%2Fb%3Fc%3Dd');
  });

  it('leaves a template alone when there are no parameters', () => {
    expect(fillPath('/applications')).toBe('/applications');
  });

  it('throws rather than sending a URL with a hole in it', () => {
    // Silently producing "/applications/undefined" would reach the server and
    // return a confusing 404 instead of failing where the bug is.
    expect(() => fillPath('/applications/{id}', {})).toThrow(/Missing path parameter "id"/);
  });
});

describe('toHttpParams', () => {
  it('omits absent values rather than sending them empty', () => {
    // An omitted filter and a filter set to empty are different requests.
    const params = toHttpParams({ cursor: 'abc', status: undefined, q: null, limit: 20 });
    expect(params.get('cursor')).toBe('abc');
    expect(params.get('limit')).toBe('20');
    expect(params.has('status')).toBe(false);
    expect(params.has('q')).toBe(false);
  });

  it('keeps a deliberate false', () => {
    // `false` is a value, not an absence.
    expect(toHttpParams({ archived: false }).get('archived')).toBe('false');
  });

  it('handles no query at all', () => {
    expect(toHttpParams().keys()).toEqual([]);
  });
});

describe('toApiError', () => {
  it('reads the contract error envelope', () => {
    const error = toApiError(
      new HttpErrorResponse({
        status: 409,
        error: {
          error: { code: 'sa_id_required', message: 'SA ID required', request_id: 'req-1' },
        },
      }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('sa_id_required');
    expect(error.requestId).toBe('req-1');
    expect(error.status).toBe(409);
  });

  it('distinguishes "never reached the server" from a server error', () => {
    // status 0 means no response arrived at all. A student should be told to
    // check their connection, not shown a server message that never existed.
    const error = toApiError(new HttpErrorResponse({ status: 0 }));
    expect(error.code).toBe(NETWORK_ERROR_CODE);
    expect(error.status).toBe(0);
  });

  it('never surfaces the body of a response that lacks the envelope', () => {
    // A proxy error page or an unhandled 500 can carry server detail — stack
    // traces, internal hostnames — that a student must never read.
    const leaky = '<html>Traceback: /srv/app/internal/db.py line 42</html>';
    const error = toApiError(new HttpErrorResponse({ status: 502, error: leaky }));
    expect(error.code).toBe(UNEXPECTED_ERROR_CODE);
    expect(error.message).not.toContain('Traceback');
    expect(error.message).not.toContain('srv');
    expect(error.requestId).toBeNull();
  });

  it('always produces a code, whatever it was handed', () => {
    // The UI's error-presentation table branches on `code`; it must be total.
    for (const thrown of [new Error('boom'), 'a string', null, undefined, 42]) {
      const error = toApiError(thrown);
      expect(typeof error.code).toBe('string');
      expect(error.code.length).toBeGreaterThan(0);
    }
  });

  it('passes an ApiError through unchanged', () => {
    const original = new ApiError('forbidden', 'no', 'req-9', 403);
    expect(toApiError(original)).toBe(original);
  });
});

describe('the generated contract surface', () => {
  it('types are derived from the contract, not restated', () => {
    // A compile-time assertion: these only typecheck if the generated schemas
    // carry the shapes the app relies on. If openapi.yaml renames a field,
    // this file stops compiling — which is the whole point of contract-first.
    const tokens: Schema<'AuthTokens'> = {
      access_token: 'a',
      token_type: 'bearer',
      expires_in: 900,
    };
    expect(tokens.expires_in).toBe(900);

    const page: Page<Schema<'Application'>> = { items: [], meta: { next_cursor: null } };
    expect(page.meta.next_cursor).toBeNull();
  });

  it('models money as a string, never a number', () => {
    // parseFloat on a currency amount is how R1 234.56 becomes
    // 1234.5599999999999 (handoff §4.4).
    const application = { requested_amount: '1234.56' } as Partial<Schema<'Application'>>;
    expect(typeof application.requested_amount).toBe('string');
  });
});
