import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccountActivityComponent } from './account-activity.component';
import { describeActivity } from './activity-wording';
import { DashboardComponent } from './dashboard.component';

/**
 * S08 — the dashboard's figures and activity are the account's own, from the server (#294).
 *
 * The central claim is "nothing is hardcoded", so the figures are rendered from TWO different
 * responses and must change with them: a page that printed a fixed number would pass a single
 * rendering and fail the second.
 */

const OVERVIEW = '/api/v1/students/me/overview';
const ACTIVITY = '/api/v1/students/me/activity';

function overview(overrides: Record<string, unknown> = {}) {
  return {
    generated_at: '2026-09-13T08:00:00Z',
    applications: {
      total: 3, drafts: 1, needs_your_action: 1, with_fundslink: 0, decided: 1,
      by_status: [],
    },
    tracking: {
      total: 4, active: 2, by_status: [],
      next_deadline: {
        tracked_application_id: 't1', bursary_name: 'Sasol Bursary', due_on: '2026-09-17',
        deadline_type: 'APPLICATION',
      },
    },
    matches: { total: 12, last_run_at: '2026-09-10T09:00:00Z' },
    notifications: { total: 5, last_at: '2026-09-12T09:00:00Z' },
    account: {
      member_since: '2026-01-01T00:00:00Z', previous_sign_in_at: '2026-09-11T06:15:00Z',
      mfa_enabled: false,
    },
    ...overrides,
  };
}

const ITEMS = [
  { id: 'e1', occurred_at: '2026-09-12T10:00:00Z', category: 'APPLICATION',
    event: 'APPLICATION_STATUS_CHANGED', actor: 'FUNDSLINK', resource_id: 'a1',
    to_status: 'RETURNED_FOR_INFO', label: null },
  { id: 'e2', occurred_at: '2026-09-11T06:15:00Z', category: 'SECURITY',
    event: 'AUTH_LOGIN_SUCCESS', actor: 'YOU', resource_id: null, to_status: null, label: null },
  { id: 'e3', occurred_at: '2026-09-10T06:15:00Z', category: 'TRACKING',
    event: 'TRACKER_STATUS_CHANGED', actor: 'YOU', resource_id: 't1', to_status: 'SHORTLISTED',
    label: 'Sasol Bursary' },
];

describe('S08 dashboard — live figures', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent?.replace(/\s+/g, ' ') ?? '';

  function render(figures: object, items: object[] = ITEMS) {
    http.expectOne((r) => r.url === '/api/v1/applications').flush({ items: [], meta: {} });
    http.expectOne((r) => r.url === '/api/v1/students/me/profile').flush(null);
    http.expectOne((r) => r.url === OVERVIEW).flush(figures);
    http.expectOne((r) => r.url === ACTIVITY).flush({ items, meta: { next_cursor: null } });
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
  });

  it('prints the numbers the server counted, and different numbers when they change', () => {
    render(overview());
    const values = () =>
      Array.from(el().querySelectorAll('ui-stat .tabular')).map((v) => v.textContent?.trim());
    expect(values()).toEqual(['3', '2', '12', '5']);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
    render(overview({
      applications: { total: 1, drafts: 0, needs_your_action: 0, with_fundslink: 1, decided: 0,
                      by_status: [] },
      matches: { total: 0, last_run_at: null },
    }));
    expect(values()).toEqual(['1', '2', '0', '5']);
    expect(text()).toContain('1 with FundsLink');
    expect(text()).toContain('Not searched yet');
  });

  it('puts what needs the student first, and names the next real deadline', () => {
    render(overview());
    expect(text()).toContain('1 needs you · 1 draft · 1 decided');
    expect(text()).toContain('Next deadline: Sasol Bursary, 17 September 2026');
  });

  it('counts a decision from the server — a waitlisted student has had one', () => {
    render(overview());
    expect(text()).toContain('Decision made — done');
    expect(text()).toContain('Submitted for review — done');
  });

  it('does not draw the journey ring until the figures have arrived', () => {
    expect(el().querySelector('ui-progress-ring')).toBeNull();
    http.expectOne((r) => r.url === '/api/v1/applications').flush({ items: [], meta: {} });
    http.expectOne((r) => r.url === '/api/v1/students/me/profile').flush(null);
    http.expectOne((r) => r.url === OVERVIEW).flush(
      { error: { code: 'internal_error', message: 'x', request_id: 'r1' } },
      { status: 500, statusText: 'Error' },
    );
    fixture.detectChanges();
    expect(el().querySelector('ui-progress-ring')).toBeNull();
    expect(text()).toContain('Try again');
  });

  it('shows the previous sign-in and whether two-step verification is on', () => {
    render(overview());
    expect(text()).toContain('Previous sign-in:');
    expect(text()).toContain('Not you? Change your password now.');
    expect(text()).toContain('Two-step verification is off.');
  });

  it('says so plainly when there is no earlier sign-in', () => {
    render(overview({ account: { member_since: '2026-01-01T00:00:00Z',
                                 previous_sign_in_at: null, mfa_enabled: true } }));
    expect(text()).toContain('first sign-in we have recorded');
    expect(text()).toContain('Two-step verification is on.');
  });

  it('has no serious or critical accessibility violations', async () => {
    render(overview());
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('S08 account activity', () => {
  let fixture: ComponentFixture<AccountActivityComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent?.replace(/\s+/g, ' ') ?? '';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AccountActivityComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(AccountActivityComponent);
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
  });

  it('words every entry, and says who acted without naming a reviewer', () => {
    http.expectOne((r) => r.url === ACTIVITY).flush({ items: ITEMS, meta: { next_cursor: null } });
    fixture.detectChanges();
    const rows = Array.from(el().querySelectorAll('li')).map((li) => li.textContent ?? '');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Your application: Needs more information');
    expect(rows[0]).toContain('By FundsLink');
    expect(rows[1]).toContain('You signed in');
    expect(rows[1]).toContain('By you');
    expect(rows[2]).toContain('Sasol Bursary: shortlisted');
  });

  it('pages back through older activity with the server cursor', () => {
    http.expectOne((r) => r.url === ACTIVITY)
      .flush({ items: ITEMS.slice(0, 2), meta: { next_cursor: 'c-1' } });
    fixture.detectChanges();
    const more = Array.from(el().querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Show earlier activity'));
    more?.click();
    const next = http.expectOne((r) => r.url === ACTIVITY && r.params.get('cursor') === 'c-1');
    next.flush({ items: ITEMS.slice(2), meta: { next_cursor: null } });
    fixture.detectChanges();
    expect(el().querySelectorAll('li')).toHaveLength(3);
    expect(text()).not.toContain('Show earlier activity');
  });

  it('teaches what will appear when nothing has been recorded', () => {
    http.expectOne((r) => r.url === ACTIVITY).flush({ items: [], meta: { next_cursor: null } });
    fixture.detectChanges();
    expect(text()).toContain('Nothing recorded yet');
  });

  it('offers a retry when the timeline cannot load', () => {
    http.expectOne((r) => r.url === ACTIVITY).flush(
      { error: { code: 'internal_error', message: 'boom', request_id: 'r9' } },
      { status: 500, statusText: 'Error' },
    );
    fixture.detectChanges();
    expect(text()).toContain('Try again');
    expect(text()).not.toContain('boom');
  });
});

describe('activity wording', () => {
  it('never renders a blank row for an event this build has not seen', () => {
    expect(describeActivity({ event: 'SOMETHING_NEW_HAPPENED', actor: 'YOU' }).text)
      .toBe('Something new happened');
    expect(describeActivity({ event: 'APPLICATION_STATUS_CHANGED', actor: 'FUNDSLINK',
                              to_status: 'BRAND_NEW' }).text).toBe('Your application: Brand new');
  });

  it('never calls a student rejected', () => {
    for (const status of ['REJECTED', 'REJECTED_FINAL']) {
      expect(describeActivity({ event: 'APPLICATION_STATUS_CHANGED', actor: 'FUNDSLINK',
                                to_status: status }).text).not.toMatch(/reject/i);
    }
    expect(describeActivity({ event: 'TRACKER_STATUS_CHANGED', actor: 'YOU',
                              to_status: 'REJECTED', label: 'X' }).text).not.toMatch(/reject/i);
  });
});
