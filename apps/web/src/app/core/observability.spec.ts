import { ApplicationInitStatus, type ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferredErrorHandler, sentryProviders, startSentry } from './observability';

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

/**
 * When the SDK is fetched, not just whether.
 *
 * The bytes were always lazy; the *timing* is what the L4 ruling of 2026-09-12
 * changed (handoff-s04-s05.md §3). An initializer that merely avoided `await`
 * still opened the request while the first route was in flight, so on 3G the
 * reporter raced the screen the student came for. These tests pin the fix: no
 * DSN does nothing at all, and a DSN waits for idle.
 */
describe('sentryProviders — scheduling', () => {
  let idle: ReturnType<typeof vi.fn>;
  let timer: ReturnType<typeof vi.fn>;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    idle = vi.fn();
    timer = vi.fn();
    vi.stubGlobal('requestIdleCallback', idle);
    vi.stubGlobal('setTimeout', timer);
  });

  /** Runs the app initializers the providers register, as bootstrap would. */
  async function boot(dsn: string): Promise<void> {
    TestBed.configureTestingModule({ providers: sentryProviders(dsn, 'test') });
    await TestBed.inject(ApplicationInitStatus).donePromise;
  }

  it('schedules nothing when no DSN is configured', async () => {
    // Local dev and CI. Not merely "does not download" — does not even queue.
    await boot('');

    expect(idle).not.toHaveBeenCalled();
    expect(timer).not.toHaveBeenCalled();
  });

  it('waits for idle rather than starting the fetch at bootstrap', async () => {
    await boot('https://key@example.ingest.sentry.io/1');

    expect(idle).toHaveBeenCalledTimes(1);
    // A deadline, so a page that never idles still gets a reporter.
    expect(idle.mock.calls[0][1]).toEqual({ timeout: 3000 });
  });

  it('falls back to a timer where requestIdleCallback does not exist', async () => {
    // Older Safari, and jsdom. A real path, not a formality.
    vi.stubGlobal('requestIdleCallback', undefined);

    await boot('https://key@example.ingest.sentry.io/1');

    expect(timer).toHaveBeenCalledTimes(1);
    expect(timer.mock.calls[0][1]).toBe(3000);
  });
});

describe('startSentry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports not-started for an empty DSN instead of importing the SDK', async () => {
    expect(await startSentry('', 'test', new DeferredErrorHandler())).toBe(false);
  });
});
