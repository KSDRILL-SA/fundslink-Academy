import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdminApplicationComponent } from './admin-application.component';
import { DecisionComposeComponent, MINIMUM_REASON_WORDS, countWords } from './decision-compose.component';
import { ReviewQueueComponent } from './review-queue.component';

function setup<T>(component: Type<T>, params: Record<string, string> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [component],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: new Map(Object.entries(params)) } },
      },
    ],
  });
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

/** 40+ words of the kind a reviewer would actually write. */
const REAL_MESSAGE = Array.from({ length: 45 }, (_, i) => `word${i}`).join(' ');

describe('A03 decision compose — the enforcement', () => {
  let fixture: ReturnType<typeof setup<DecisionComposeComponent>>['fixture'];
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const submitButton = () =>
    Array.from(el().querySelectorAll('button')).find(
      (b) => b.getAttribute('type') === 'submit',
    ) as HTMLButtonElement;

  beforeEach(() => {
    ({ fixture, http } = setup(DecisionComposeComponent));
    fixture.componentInstance.applicationId.set('a1');
  });

  function decline(overrides: Record<string, unknown> = {}) {
    fixture.componentInstance.form.patchValue({
      decision: 'REJECTED',
      reason_category: 'FUNDS_EXHAUSTED',
      note: REAL_MESSAGE,
      next_step_confirmed: true,
      ...overrides,
    });
    fixture.detectChanges();
  }

  it('PHYSICALLY REFUSES a decline with too few words', () => {
    // The whole kind-rejection design rests on this. A reviewer must not be
    // able to send a two-word decline at four on a Friday.
    decline({ note: 'Not eligible.' });
    expect(submitButton().disabled).toBe(true);

    fixture.componentInstance.submit();
    http.expectNone(() => true);
  });

  it('PHYSICALLY REFUSES a decline with no next-step confirmation', () => {
    decline({ next_step_confirmed: false });
    expect(submitButton().disabled).toBe(true);

    fixture.componentInstance.submit();
    http.expectNone(() => true);
  });

  it('PHYSICALLY REFUSES a decline with no reason category', () => {
    decline({ reason_category: '' });
    expect(submitButton().disabled).toBe(true);

    fixture.componentInstance.submit();
    http.expectNone(() => true);
  });

  it('allows a decline once all three conditions are met', () => {
    decline();
    expect(submitButton().disabled).toBe(false);

    fixture.componentInstance.submit();
    const request = http.expectOne((r) => r.url === '/api/v1/admin/applications/a1/review');
    expect(request.request.body).toMatchObject({ decision: 'REJECTED', note: REAL_MESSAGE });
  });

  it('counts down rather than only failing at submit', () => {
    // A hard floor discovered only on submit trains people to resent it.
    decline({ note: 'Three words only' });
    expect(el().textContent).toContain('more before this can be sent');
  });

  it('does not impose the message rules on a non-decline', () => {
    // A move to "under review" is not a message to a student.
    fixture.componentInstance.form.patchValue({ decision: 'UNDER_REVIEW' });
    fixture.detectChanges();
    expect(submitButton().disabled).toBe(false);
    expect(el().textContent).not.toContain('This message goes to the student');
  });

  it('tells the reviewer what the message is for, and what it must not say', () => {
    // §5.8 forbids citing language or writing quality. No UI can enforce that,
    // so it is said where the reviewer is actually writing.
    decline();
    const text = el().textContent ?? '';
    expect(text).toContain('They will read it as the reason they were not funded');
    expect(text).toContain('Do not comment on their writing or their language');
  });

  it('states why the button is disabled instead of leaving silence', () => {
    decline({ note: 'Short.' });
    expect(el().textContent).toContain('more words needed');
  });

  it('has no serious or critical accessibility violations', async () => {
    decline();
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('countWords', () => {
  it('counts words, not characters or whitespace', () => {
    expect(countWords('  one   two \n three ')).toBe(3);
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
  });

  it('holds the floor the design specifies', () => {
    expect(MINIMUM_REASON_WORDS).toBe(40);
  });
});

describe('A01 review queue', () => {
  let fixture: ReturnType<typeof setup<ReviewQueueComponent>>['fixture'];
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    ({ fixture, http } = setup(ReviewQueueComponent));
  });

  function load(items: unknown[]) {
    http.expectOne((r) => r.url === '/api/v1/admin/applications').flush({ items, meta: {} });
    fixture.detectChanges();
  }

  it('shows priority read-only, never as something to set here', () => {
    // Only ADMIN_REVIEWER+ may raise it, and the anti-gaming rule is only real
    // if the queue does not become a place to nudge it (D-002/D-013).
    load([
      {
        id: 'a1',
        application_type: 'UG_CAT_C',
        academic_year: '2026',
        status: 'READY_FOR_REVIEW',
        priority: 'URGENT',
        created_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      },
    ]);
    expect(el().textContent).toContain('Urgent');
    expect(el().querySelector('select')).toBeNull();
    expect(el().querySelector('input')).toBeNull();
  });

  it('shows when each review is due, from the server, and says overdue in words', () => {
    // Replaces "Waiting N days", which was computed on this device's clock from when the DRAFT
    // was created. The due date and the breach flag are the server's (config-driven SLA, D-002).
    load([
      {
        id: 'on-time',
        application_type: 'POSTGRAD',
        academic_year: '2026',
        status: 'READY_FOR_REVIEW',
        created_at: '2026-09-01T08:00:00Z',
        review_due_at: '2026-09-17T08:00:00Z',
        sla_breached: false,
      },
      {
        id: 'late',
        application_type: 'UG_CAT_A',
        academic_year: '2026',
        status: 'UNDER_REVIEW',
        created_at: '2026-08-01T08:00:00Z',
        review_due_at: '2026-08-15T08:00:00Z',
        sla_breached: true,
      },
    ]);
    const text = el().textContent ?? '';
    expect(text).toContain('Due 17 September 2026');
    expect(text).toContain('Overdue — was due 15 August 2026');
    expect(text).not.toMatch(/Waiting \d+ days/);
  });

  it('keeps the server order, and describes it truthfully to screen readers', () => {
    load([
      { id: 'first', application_type: 'POSTGRAD', academic_year: '2026', status: 'APPEALED',
        created_at: '2026-09-10T08:00:00Z', priority: 'CRITICAL' },
      { id: 'second', application_type: 'POSTGRAD', academic_year: '2026', status: 'UNSCREENED',
        created_at: '2026-08-01T08:00:00Z' },
    ]);
    const rows = Array.from(el().querySelectorAll('tbody th a')).map((a) => a.getAttribute('href'));
    expect(rows[0]).toContain('first');
    expect(rows[1]).toContain('second');
    expect(el().querySelector('caption')?.textContent).toMatch(/triage order/i);
    expect(el().querySelector('caption')?.textContent).not.toMatch(/oldest wait first/i);
  });

  it('has no serious or critical accessibility violations', async () => {
    load([
      {
        id: 'a1',
        application_type: 'POSTGRAD',
        academic_year: '2026',
        status: 'READY_FOR_REVIEW',
        created_at: new Date().toISOString(),
      },
    ]);
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('A02 application detail', () => {
  let fixture: ReturnType<typeof setup<AdminApplicationComponent>>['fixture'];
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  beforeEach(() => {
    ({ fixture, http } = setup(AdminApplicationComponent, { id: 'a1' }));
  });

  function load(application: Record<string, unknown>) {
    // The reviewer's endpoint — the student one returns 403 to a reviewer (#288).
    http.expectOne((r) => r.url === '/api/v1/admin/applications/a1').flush(application);
    fixture.detectChanges();
  }

  it('frames annotations as observations to verify, never as decisions', () => {
    // §5.7 / D-010 — the engine annotates, a human decides. The framing is the
    // safeguard against a tired reviewer treating a flag as an instruction.
    load({
      id: 'a1',
      application_type: 'UG_CAT_C',
      academic_year: '2026',
      status: 'READY_FOR_REVIEW',
      created_at: '2026-02-01T00:00:00Z',
      pre_screen: { annotations: ['Household income above the postgraduate ceiling'] },
    });

    expect(text()).toContain('Worth checking');
    expect(text()).toContain('observations for you to verify');
    expect(text()).toContain('none of them is a decision');
    // And never the language of a recommendation.
    expect(text().toLowerCase()).not.toContain('recommend');
    expect(text().toLowerCase()).not.toContain('should be declined');
  });

  it('shows the applicant own words in full, and first', () => {
    load({
      id: 'a1',
      application_type: 'OTHER',
      academic_year: '2026',
      status: 'READY_FOR_REVIEW',
      created_at: '2026-02-01T00:00:00Z',
      motivation: {
        situation: 'My mother lost her job in March.',
        why_not_categories: 'I was never registered with NSFAS.',
        support_needed: 'R18 000 for outstanding fees.',
      },
      pre_screen: { annotations: ['Some flag'] },
    });

    expect(text()).toContain("In the applicant's own words");
    expect(text()).toContain('My mother lost her job in March.');

    const ownWords = text().indexOf("In the applicant's own words");
    const flags = text().indexOf('Worth checking');
    expect(ownWords).toBeLessThan(flags);
  });

  describe('conflict of interest (BR-E09 · E8)', () => {
    const READY = {
      id: 'a1',
      application_type: 'POSTGRAD',
      academic_year: '2026',
      status: 'READY_FOR_REVIEW',
      created_at: '2026-02-01T00:00:00Z',
      recused_by_me: false,
    };
    const button = (label: string) =>
      Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes(label));

    it('offers to step aside before any action, and asks how the reviewer knows them', () => {
      load(READY);
      expect(text()).toContain('Do you know this applicant?');
      expect(text().indexOf('Do you know this applicant?')).toBeLessThan(
        text().indexOf('Triage priority'),
      );
      button('Step aside from this application')?.click();
      fixture.detectChanges();
      expect(text()).toContain('How you know them');
    });

    it('records the reason, then withholds the decision and priority actions', () => {
      load(READY);
      button('Step aside from this application')?.click();
      fixture.detectChanges();
      const reason = el().querySelector('textarea') as HTMLTextAreaElement;
      reason.value = 'She is my cousin and I know the family.';
      reason.dispatchEvent(new Event('input'));
      reason.dispatchEvent(new Event('blur'));
      (el().querySelector('form[class*="flex-col"] button[type="submit"]') as HTMLButtonElement).click();

      const request = http.expectOne((r) => r.url === '/api/v1/admin/applications/a1/recusal');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ reason: 'She is my cousin and I know the family.' });
      request.flush({ application_id: 'a1', created_at: '2026-09-14T08:00:00Z' }, { status: 201, statusText: 'Created' });

      load({ ...READY, recused_by_me: true });
      expect(text()).toContain('You stepped aside from this application');
      expect(text()).not.toContain('Triage priority');
      expect(el().querySelector('fl-decision-compose')).toBeNull();
    });

    it('does not send a recusal without a reason', () => {
      load(READY);
      button('Step aside from this application')?.click();
      fixture.detectChanges();
      (el().querySelector('form[class*="flex-col"] button[type="submit"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      http.expectNone((r) => r.url.endsWith('/recusal'));
      expect(text()).toContain('Say briefly how you know them');
    });
  });

  it('has no serious or critical accessibility violations', async () => {
    load({
      id: 'a1',
      application_type: 'POSTGRAD',
      academic_year: '2026',
      status: 'READY_FOR_REVIEW',
      created_at: '2026-02-01T00:00:00Z',
    });
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});
