import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { MatchesComponent } from './matches.component';
import { TrackingBoardComponent } from '../tracking/tracking-board.component';

function setup<T>(component: Type<T>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [component],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

const BURSARY = {
  id: 'b1',
  name: 'Sasol Engineering Bursary',
  provider: 'Sasol Foundation',
  status: 'OPEN',
  next_deadline: '2026-10-31',
};

describe('S17 matches', () => {
  let fixture: ReturnType<typeof setup<MatchesComponent>>['fixture'];
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  beforeEach(() => {
    ({ fixture, http } = setup(MatchesComponent));
  });

  function load(items: unknown[]) {
    http.expectOne((r) => r.url === '/api/v1/matches/me').flush({ items, meta: {} });
    fixture.detectChanges();
  }

  it('says out loud that matching does not decide anything', () => {
    // Advisory only (ADR-0007, BR-M02). A student must not read a suggestion
    // list as a verdict.
    expect(text()).toContain('a starting point, not a decision');
  });

  it('keeps browse-all at equal prominence, above the results (BR-M02)', () => {
    // Matching must never become the only path to a bursary.
    load([{ id: 'm1', bursary: BURSARY, score: 0.87, mode: 'LIVE', created_at: '2026-02-01T00:00:00Z' }]);
    const browse = Array.from(el().querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Browse every bursary'),
    );
    expect(browse).toBeTruthy();
    // It appears before the first result in document order.
    const list = el().querySelector('ul');
    expect(browse!.compareDocumentPosition(list!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('never renders the score as a percentage', () => {
    // 0.87 shown as "87% match" reads as a probability of being funded, which
    // is exactly what it is not.
    load([{ id: 'm1', bursary: BURSARY, score: 0.87, mode: 'LIVE', created_at: '2026-02-01T00:00:00Z' }]);
    expect(text()).not.toContain('87');
    expect(text()).not.toContain('%');
    expect(text().toLowerCase()).not.toContain('match score');
  });

  it('discloses a degraded result set (S8.51)', () => {
    load([{ id: 'm1', bursary: BURSARY, score: 0.4, mode: 'FALLBACK', created_at: '2026-02-01T00:00:00Z' }]);
    expect(text()).toContain('Smart matching is resting');
    // And still says the results are usable, rather than implying they are junk.
    expect(text()).toContain('still real bursaries you can apply to');
  });

  it('says nothing about fallback when matching is live', () => {
    load([{ id: 'm1', bursary: BURSARY, score: 0.9, mode: 'LIVE', created_at: '2026-02-01T00:00:00Z' }]);
    expect(text()).not.toContain('Smart matching is resting');
  });

  it('points an empty list at the full list rather than a dead end (P2)', () => {
    load([]);
    expect(text()).toContain('No suggestions yet');
    expect(text()).toContain('the full list is open to you');
  });

  it('has no serious or critical accessibility violations', async () => {
    load([{ id: 'm1', bursary: BURSARY, score: 0.9, mode: 'FALLBACK', created_at: '2026-02-01T00:00:00Z' }]);
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('S18 tracking board', () => {
  let fixture: ReturnType<typeof setup<TrackingBoardComponent>>['fixture'];
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  const tracked = (overrides: Record<string, unknown> = {}) => ({
    id: 't1',
    bursary: BURSARY,
    status: 'SHORTLISTED',
    status_source: 'SELF_REPORT',
    last_activity_at: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    ({ fixture, http } = setup(TrackingBoardComponent));
  });

  function load(items: unknown[]) {
    http.expectOne((r) => r.url === '/api/v1/tracked-applications').flush({ items, meta: {} });
    fixture.detectChanges();
  }

  it('shows where every status came from (P3, §12.4)', () => {
    // "Shortlisted" the student typed and "Shortlisted" read off an email are
    // not the same claim. Rendering them identically implies a certainty the
    // platform does not have.
    load([tracked()]);
    expect(text()).toContain('You reported');

    // The board renders twice — a table on wide screens, cards on narrow ones.
    // The source chip has to survive in BOTH, or the rule quietly holds on a
    // laptop and fails on the phone most students actually use.
    const row = el().querySelector('table tbody tr');
    expect(row?.querySelectorAll('ui-status-chip')).toHaveLength(2);
    const card = el().querySelector('ul ui-card');
    expect(card?.querySelectorAll('ui-status-chip')).toHaveLength(2);
  });

  it('labels an email-captured status differently from a self-reported one', () => {
    load([tracked({ status_source: 'EMAIL_CAPTURE' })]);
    expect(text()).toContain('From email');
    expect(text()).not.toContain('You reported');
  });

  it('promises to chase a quiet funder, rather than warning the student', () => {
    // §12.5 — the student should know someone is acting, not feel they need
    // to nag a funder themselves.
    const quiet = new Date(Date.now() - 26 * 86_400_000).toISOString();
    load([tracked({ last_activity_at: quiet })]);
    expect(text()).toContain('We will nudge them for you on day 30');
    expect(text()).toContain('you do not need to do anything');
  });

  it('stays quiet about silence before day 25', () => {
    const recent = new Date(Date.now() - 3 * 86_400_000).toISOString();
    load([tracked({ last_activity_at: recent })]);
    expect(text()).not.toContain('nudge them');
  });

  it('teaches S19 from the empty state (§4)', () => {
    load([]);
    expect(text()).toContain('Nothing tracked yet');
    expect(text()).toContain('Track an application');
  });

  it('survives an unparseable timestamp instead of showing a false warning', () => {
    load([tracked({ last_activity_at: 'not a date' })]);
    expect(text()).not.toContain('nudge them');
  });

  it('has no serious or critical accessibility violations', async () => {
    load([tracked()]);
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('the advisory rule, enforced in source', () => {
  it('never formats a match score for display', () => {
    // The only safe way to keep "87% match" out of the product is to never
    // turn the number into text at all.
    const source = readFileSync(join(__dirname, 'matches.component.ts'), 'utf8');
    expect(source).not.toMatch(/score\s*\*\s*100/);
    expect(source).not.toMatch(/\{\{\s*[\w.]*score/);
    expect(source).not.toContain('toFixed');
  });
});
