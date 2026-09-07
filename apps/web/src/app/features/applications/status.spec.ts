import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApplicationDetailComponent } from './application-detail.component';

function setup(id = 'a1') {
  TestBed.configureTestingModule({
    imports: [ApplicationDetailComponent],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', id]]) } } },
    ],
  });
  const fixture = TestBed.createComponent(ApplicationDetailComponent);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

describe('S14 application status', () => {
  let fixture: ReturnType<typeof setup>['fixture'];
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  beforeEach(() => {
    TestBed.resetTestingModule();
    ({ fixture, http } = setup());
  });

  function load(application: Record<string, unknown>) {
    http.expectOne((r) => r.url === '/api/v1/applications/a1').flush(application);
    fixture.detectChanges();
  }

  it('shows the Human-Final sentence during pre-screening (P5, §5.8)', () => {
    // The exact moment a student is most likely to believe a machine is
    // deciding their funding.
    load({ id: 'a1', status: 'PRE_SCREENING', created_at: '2026-02-01T00:00:00Z' });
    expect(text()).toContain('it cannot approve or decline you');
    expect(text()).toContain('Only a person can do that');
  });

  it('does not repeat that sentence once a person actually has it', () => {
    load({ id: 'a1', status: 'UNDER_REVIEW', created_at: '2026-02-01T00:00:00Z' });
    expect(text()).not.toContain('cannot approve or decline you');
    expect(text()).toContain('it is the part a person does');
  });

  it('marks the current step for a screen reader, not just visually', () => {
    load({ id: 'a1', status: 'UNDER_REVIEW', created_at: '2026-02-01T00:00:00Z' });
    const current = el().querySelector('[aria-current="step"]');
    expect(current?.textContent).toContain('With a reviewer');
  });

  it('makes no promise about timing it cannot keep', () => {
    // "About N days" needs the config endpoint (E12). Until then the screen
    // says what it can defend rather than inventing a number.
    load({ id: 'a1', status: 'READY_FOR_REVIEW', created_at: '2026-02-01T00:00:00Z' });
    expect(text()).toContain('in the order they arrive');
    expect(text()).not.toMatch(/\b\d+\s*(?:working\s*)?days\b/);
  });

  it('has no serious or critical accessibility violations', async () => {
    load({ id: 'a1', status: 'PRE_SCREENING', created_at: '2026-02-01T00:00:00Z' });
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('S15 the fix list (P4 flagship)', () => {
  let fixture: ReturnType<typeof setup>['fixture'];
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  const RETURNED = (cycle = 1) => ({
    id: 'a1',
    status: 'RETURNED_FOR_INFO',
    created_at: '2026-02-01T00:00:00Z',
    pre_screen: {
      outcome: 'RETURNED',
      cycle_no: cycle,
      fix_list: [
        'Proof of registration for 2026',
        'A clearer copy of your academic transcript',
        'Your latest fee statement',
      ],
    },
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    ({ fixture, http } = setup());
  });

  function load(application: Record<string, unknown>) {
    http.expectOne((r) => r.url === '/api/v1/applications/a1').flush(application);
    fixture.detectChanges();
  }

  it('counts the work and calls it small', () => {
    load(RETURNED());
    expect(text()).toContain("Almost there — 3 small things and you're back in the queue.");
  });

  it('says nothing is wrong with the application', () => {
    load(RETURNED());
    expect(text()).toContain('Nothing is wrong with your application');
  });

  it('NEVER uses the word "rejected", or any language of failure', () => {
    // P4 — a return is not a rejection, and this is the screen where that is
    // either true or merely claimed elsewhere.
    load(RETURNED());
    const lower = text().toLowerCase();
    for (const forbidden of ['reject', 'fail', 'denied', 'invalid', 'error', 'problem with your']) {
      expect(lower, `forbidden word: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('uses amber and informational colour, never destructive', () => {
    // "Different colour language from rejection entirely" — the design is
    // explicit. A destructive token anywhere here would undo the whole screen.
    load(RETURNED());
    const markup = el().innerHTML;
    expect(markup).toContain('text-warning');
    expect(markup).not.toContain('destructive');
    expect(markup).not.toMatch(/\b(?:text|bg|border)-red-/);
  });

  it('says why each item is needed, not just what', () => {
    // "Proof of registration" is a demand; the reason is why someone acts on it.
    load(RETURNED());
    expect(text()).toContain('So we can confirm with your institution');
    expect(text()).toContain('understand your progress, not to judge a single result');
  });

  it('holds resubmit until the list is done, and says so', () => {
    load(RETURNED());
    const send = Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Send it back'),
    ) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    expect(text()).toContain('Tick each one as you sort it');
  });

  it('enables resubmit once every item is ticked', () => {
    load(RETURNED());
    for (const box of Array.from(
      el().querySelectorAll('input[type="checkbox"]'),
    ) as HTMLInputElement[]) {
      box.click();
    }
    fixture.detectChanges();

    const send = Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Send it back'),
    ) as HTMLButtonElement;
    expect(send.disabled).toBe(false);
  });

  it('offers the outreach only at the third cycle (BR-E04)', () => {
    load(RETURNED(1));
    expect(text()).not.toContain('Struggling with these?');
  });

  it('changes tone at cycle 3 rather than repeating the same list', () => {
    load(RETURNED(3));
    expect(text()).toContain('Struggling with these?');
    // And it takes the blame, which is the point of the outreach.
    expect(text()).toContain('our form is the problem and not you');
  });

  it('has no serious or critical accessibility violations', async () => {
    load(RETURNED(3));
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});
