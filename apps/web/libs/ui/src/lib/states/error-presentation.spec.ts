import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERROR_PRESENTATION, UNKNOWN_ERROR, presentError } from './error-presentation';

/**
 * The error table is the only place the API's stable `error.code` becomes a
 * sentence a student reads. Its failures are silent — a blaming line or a
 * leaked internal reads fine to the engineer who wrote it.
 */
describe('error presentation', () => {
  const entries = Object.entries(ERROR_PRESENTATION);

  it('covers every code in the canonical registry', () => {
    // docs/architecture/error-codes.md is the source of truth (28 codes). If a
    // code is added there and not here, students get the generic fallback for
    // a failure we could have explained — so the drift is caught at build time.
    const registry = readFileSync(
      // libs/ui/src/lib/states -> apps/web -> apps -> repo root
      join(__dirname, '..', '..', '..', '..', '..', '..', '..', 'docs', 'architecture', 'error-codes.md'),
      'utf8',
    );
    const documented = [...registry.matchAll(/^\|\s*`([a-z_]+)`\s*\|/gm)].map((m) => m[1]);

    expect(documented.length, 'no codes parsed from the registry').toBeGreaterThan(20);
    const missing = documented.filter((code) => !(code in ERROR_PRESENTATION));
    expect(missing, `codes with no presentation: ${missing.join(', ')}`).toEqual([]);
  });

  it('always offers a way forward', () => {
    for (const [code, presented] of entries) {
      expect(presented.title.trim(), `${code} has no title`).not.toBe('');
      expect(presented.message.trim(), `${code} has no message`).not.toBe('');
      // An error with no recovery path is a dead end, and a dead end in a
      // funding application is someone giving up (P2).
      expect(presented.message.length, `${code} message is too terse to help`).toBeGreaterThan(20);
    }
  });

  it('never blames the person reading it', () => {
    for (const [code, presented] of entries) {
      const text = `${presented.title} ${presented.message}`.toLowerCase();
      for (const phrase of ['you failed', 'you did not', "you didn't", 'your fault', 'invalid user']) {
        expect(text, `${code} blames the reader`).not.toContain(phrase);
      }
    }
  });

  it('never leaks internals', () => {
    for (const [code, presented] of entries) {
      const text = `${presented.title} ${presented.message}`.toLowerCase();
      for (const leak of ['null', 'undefined', 'exception', 'stack', 'sql', 'traceback', '500']) {
        expect(text, `${code} leaks an internal detail`).not.toContain(leak);
      }
    }
  });

  it('marks permanent failures as not retryable', () => {
    // Offering "Try again" for a failure that cannot succeed teaches people to
    // hammer a button that will never work.
    for (const code of ['forbidden', 'email_taken', 'appeal_exists', 'sa_id_required']) {
      expect(ERROR_PRESENTATION[code].retryable, `${code} should not be retryable`).toBe(false);
    }
    for (const code of ['rate_limited', 'payload_too_large', 'invalid_transition']) {
      expect(ERROR_PRESENTATION[code].retryable, `${code} should be retryable`).toBe(true);
    }
  });

  it('does not invent a cause for an unknown code', () => {
    const presented = presentError('something_we_have_never_seen');
    expect(presented).toEqual(UNKNOWN_ERROR);
    // Says it was not the user, and says what to do — without claiming to know
    // what happened.
    expect(presented.message).toContain("wasn't you");
    expect(presented.retryable).toBe(true);
  });

  it('handles null and undefined without throwing', () => {
    for (const value of [null, undefined, '']) {
      expect(() => presentError(value)).not.toThrow();
      expect(presentError(value)).toEqual(UNKNOWN_ERROR);
    }
  });
});
