import type { ErrorHandler } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferredErrorHandler } from './observability';

/**
 * Deferring Sentry buys first-paint bytes at the cost of a window in which an
 * error can be thrown before the reporter exists. These tests pin the buffer
 * that closes that window — without it, the optimisation silently loses the
 * earliest errors, which are exactly the ones worth having.
 */
describe('DeferredErrorHandler', () => {
  let handler: DeferredErrorHandler;
  let reported: unknown[];
  let delegate: ErrorHandler;

  // Without an explicit restore, each beforeEach spies on the PREVIOUS spy and
  // call counts accumulate across tests — the cap test alone contributes 100.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    handler = new DeferredErrorHandler();
    reported = [];
    delegate = { handleError: (error: unknown) => reported.push(error) };
  });

  it('buffers errors thrown before the reporter arrives, then flushes in order', () => {
    handler.handleError('first');
    handler.handleError('second');
    expect(reported).toEqual([]);

    handler.adopt(delegate);
    expect(reported).toEqual(['first', 'second']);
  });

  it('forwards straight through once adopted', () => {
    handler.adopt(delegate);
    handler.handleError('later');
    expect(reported).toEqual(['later']);
  });

  it('caps the buffer so a boot loop cannot exhaust memory', () => {
    for (let i = 0; i < 100; i += 1) {
      handler.handleError(i);
    }
    handler.adopt(delegate);
    expect(reported).toHaveLength(20);
    // The earliest errors are the ones kept — a boot failure's first throw
    // explains the rest, and the tail is usually the same error repeating.
    expect(reported[0]).toBe(0);
    expect(reported[19]).toBe(19);
  });

  it('always logs to the console, with or without a reporter', () => {
    // With no DSN configured — local dev and CI — this is the only report
    // there is, so it must not be conditional on Sentry being present.
    handler.handleError('before');
    handler.adopt(delegate);
    handler.handleError('after');
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
