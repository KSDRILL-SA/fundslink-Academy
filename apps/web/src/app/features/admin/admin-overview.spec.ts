import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdminOverviewComponent } from './admin-overview.component';

/** A00 — the operations overview renders the server's figures and nothing else (#294). */

const OVERVIEW = '/api/v1/admin/overview';
const ACTIVITY = '/api/v1/admin/activity';
const THEMES = '/api/v1/admin/themes';

const NO_THEMES = {
  generated_at: '2026-09-13T08:00:00Z',
  window_days: 90,
  tagged_applications: 0,
  themes: [] as { tag: string; applications: number }[],
};

function figures(window = 7, overdue = 2) {
  return {
    generated_at: '2026-09-13T08:00:00Z',
    window_days: window,
    queue: {
      awaiting_review: 14, overdue, emergency: 3, unscreened: 1, awaiting_student: 6,
      by_status: [{ status: 'READY_FOR_REVIEW', count: 9 }, { status: 'APPEALED', count: 5 }],
    },
    flow: { submitted: 40, approved: 8, waitlisted: 4, not_funded: 11,
            median_days_to_decision: 6.5 as number | null },
    notifications: { pending: 3, failed: 1, sent: 120 },
    accounts: { registered: 31, sign_ins: 210, failed_sign_ins: 17, locked: 2 },
  };
}

describe('A00 operations overview', () => {
  let fixture: ComponentFixture<AdminOverviewComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent?.replace(/\s+/g, ' ') ?? '';
  const stats = () =>
    Array.from(el().querySelectorAll('ui-stat .tabular')).map((v) => v.textContent?.trim());

  function render(body: object = figures(), items: object[] = [], themes: object = NO_THEMES) {
    http.expectOne((r) => r.url === OVERVIEW).flush(body);
    http.expectOne((r) => r.url === ACTIVITY).flush({ items, meta: { next_cursor: null } });
    http.expectOne((r) => r.url === THEMES).flush(themes);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminOverviewComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(AdminOverviewComponent);
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
  });

  it('renders the queue, throughput, delivery and account figures from the response', () => {
    render();
    // South African notation: a decimal comma (6,5), as the rest of the platform's figures use.
    expect(stats()).toEqual(['14', '2', '3', '1', '40', (6.5).toLocaleString('en-ZA'), '1', '31']);
    expect(text()).toContain('6 waiting on the student');
    expect(text()).toContain('8 approved · 4 waitlisted · 11 not funded');
    expect(text()).toContain('3 queued · 120 sent');
    expect(text()).toContain('210 sign-ins · 17 failed · 2 locked');
  });

  it('asks the server again for the window the viewer picks', () => {
    http.expectOne((r) => r.url === OVERVIEW && r.params.get('days') === '7').flush(figures());
    http.expectOne((r) => r.url === ACTIVITY).flush({ items: [], meta: {} });
    fixture.detectChanges();

    const thirty = Array.from(el().querySelectorAll<HTMLInputElement>('input[type=radio]'))
      .find((input) => input.value === '30');
    thirty?.dispatchEvent(new Event('change'));
    http.expectOne((r) => r.url === OVERVIEW && r.params.get('days') === '30')
      .flush(figures(30, 0));
    fixture.detectChanges();
    expect(text()).toContain('Last 30 days');
    expect(stats()[1]).toBe('0');
  });

  it('says "No decisions" rather than inventing a median', () => {
    const body = figures();
    render({ ...body, flow: { ...body.flow, median_days_to_decision: null } });
    expect(stats()[5]).toBe('No decisions');
  });

  it('shows system activity as kinds of actor, never names', () => {
    render(figures(), [
      { id: 'x1', occurred_at: '2026-09-13T07:00:00Z', action: 'AUTH_LOGIN_FAILURE',
        resource_type: 'user', resource_id: null, actor_kind: 'ANONYMOUS' },
      { id: 'x2', occurred_at: '2026-09-13T06:00:00Z', action: 'APPLICATION_REVIEWED',
        resource_type: 'funding_application', resource_id: 'a1', actor_kind: 'STAFF' },
    ]);
    const rows = Array.from(el().querySelectorAll('tbody tr')).map((r) => r.textContent ?? '');
    expect(rows[0]).toContain('Login failure');
    expect(rows[0]).toContain('Not signed in');
    expect(rows[1]).toContain('Application reviewed');
    expect(rows[1]).toContain('Staff');
  });

  it('keeps the figures when activity fails, and offers a retry for each', () => {
    http.expectOne((r) => r.url === OVERVIEW).flush(figures());
    http.expectOne((r) => r.url === ACTIVITY).flush(
      { error: { code: 'internal_error', message: 'x', request_id: 'r' } },
      { status: 500, statusText: 'Error' },
    );
    fixture.detectChanges();
    expect(stats()).toHaveLength(8);
    expect(text()).toContain('Try again');
  });

  it('has no serious or critical accessibility violations', async () => {
    render();
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });

  // --- the quarterly theme report (MASTER-SPEC §5.6, D-018, #317) ---

  it('shows what the categories keep missing, in the reviewer’s words', () => {
    render(figures(), [], {
      generated_at: '2026-09-13T08:00:00Z',
      window_days: 90,
      tagged_applications: 7,
      themes: [
        { tag: 'FINANCIAL_GAP', applications: 5 },
        { tag: 'INSTITUTIONAL', applications: 2 },
      ],
    });

    expect(text()).toContain('What the categories keep missing');
    expect(text()).toContain('7 cases outside our categories were given a theme in the last 90 days');
    // The label a reviewer ticked, never the database code.
    expect(text()).toContain('A funding gap no category covers');
    expect(text()).not.toContain('FINANCIAL_GAP');
  });

  it('says plainly when nothing has been recorded yet, instead of an empty chart', () => {
    render();
    expect(text()).toContain('No themes recorded yet');
  });

  it('counts one case once, however many themes it carries', () => {
    // The report exists to spot a recurring edge. A thorough reviewer must not look like a trend.
    render(figures(), [], {
      generated_at: '2026-09-13T08:00:00Z',
      window_days: 90,
      tagged_applications: 1,
      themes: [
        { tag: 'HEALTH', applications: 1 },
        { tag: 'FAMILY_CRISIS', applications: 1 },
      ],
    });
    expect(text()).toContain('1 case outside our categories was given a theme');
  });
});
