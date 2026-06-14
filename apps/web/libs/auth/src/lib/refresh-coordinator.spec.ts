import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { RefreshCoordinator } from './refresh-coordinator';

describe('RefreshCoordinator — concurrent 401 refresh dedup (S3.15 / S7.12)', () => {
  it('triggers exactly one refresh for concurrent callers and shares the new token', () => {
    const source = new Subject<string>();
    const refreshFn = vi.fn(() => source.asObservable());
    const coordinator = new RefreshCoordinator();
    const got: string[] = [];

    // Three requests 401 at the same time -> all call refreshOnce before any completes.
    coordinator.refreshOnce(refreshFn).subscribe((t) => got.push(t));
    coordinator.refreshOnce(refreshFn).subscribe((t) => got.push(t));
    coordinator.refreshOnce(refreshFn).subscribe((t) => got.push(t));

    expect(refreshFn).toHaveBeenCalledTimes(1); // dedup: one refresh, not three

    source.next('new-token');
    source.complete();

    expect(got).toEqual(['new-token', 'new-token', 'new-token']); // all retried with new token
  });

  it('starts a fresh refresh after the previous one completes', () => {
    let source = new Subject<string>();
    const refreshFn = vi.fn(() => source.asObservable());
    const coordinator = new RefreshCoordinator();

    coordinator.refreshOnce(refreshFn).subscribe();
    source.next('t1');
    source.complete();

    source = new Subject<string>(); // a later, separate 401
    coordinator.refreshOnce(refreshFn).subscribe();

    expect(refreshFn).toHaveBeenCalledTimes(2); // window reset -> new refresh
  });

  it('resets after a failed refresh so the next attempt can retry', () => {
    let source = new Subject<string>();
    const refreshFn = vi.fn(() => source.asObservable());
    const coordinator = new RefreshCoordinator();

    coordinator.refreshOnce(refreshFn).subscribe({ error: () => undefined });
    source.error(new Error('refresh failed'));

    source = new Subject<string>();
    coordinator.refreshOnce(refreshFn).subscribe({ error: () => undefined });

    expect(refreshFn).toHaveBeenCalledTimes(2);
  });
});
