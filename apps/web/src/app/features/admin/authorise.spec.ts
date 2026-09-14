import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdminApplicationComponent } from './admin-application.component';
import { AuthoriseDecisionComponent } from './authorise-decision.component';
import { DecisionComposeComponent } from './decision-compose.component';

/**
 * A02 — the authorise step and the appeal ruling (MASTER-SPEC §16.4 · BR-S05 · BR-E07, #309).
 *
 * Before this, a reviewer could take an application to APPROVED_PROPOSED and the screen offered
 * nothing further: no student could be funded. These hold the two halves apart — a reviewer
 * proposes and never approves, a second person rules and is never shown a proposal form — and
 * hold the ruling that ends an appeal to the same standard as any other refusal.
 */

const AUTHORIZE = '/api/v1/admin/applications/a1/authorize';
const REVIEW = '/api/v1/admin/applications/a1/review';
const DETAIL = '/api/v1/admin/applications/a1';

/** 40+ words of the kind a person would actually write. */
const REAL_MESSAGE = Array.from({ length: 45 }, (_, i) => `word${i}`).join(' ');

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
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

describe('the authorise step', () => {
  let fixture: ComponentFixture<AuthoriseDecisionComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent?.replace(/\s+/g, ' ') ?? '';
  const options = () =>
    Array.from(el().querySelectorAll('option'))
      .map((o) => o.getAttribute('value'))
      .filter(Boolean);
  const submitButton = () =>
    Array.from(el().querySelectorAll('button')).find(
      (b) => b.getAttribute('type') === 'submit',
    ) as HTMLButtonElement;

  function start(status: string) {
    ({ fixture, http } = setup(AuthoriseDecisionComponent));
    fixture.componentRef.setInput('applicationId', 'a1');
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
  }

  function fill(values: Record<string, unknown>) {
    fixture.componentInstance.form.patchValue(values);
    fixture.detectChanges();
  }

  it('offers only the rulings that are legal from here', () => {
    // Every option in the list must be a transition the server will accept (BR-S04) — a choice
    // that always 409s is a control that lies about what it does.
    start('APPROVED_PROPOSED');
    expect(options()).toEqual(['APPROVED', 'APPROVED_WAITLISTED', 'REJECTED']);

    start('APPROVED_WAITLISTED');
    expect(options()).toEqual(['APPROVED']);
    expect(text()).toContain('Release this waitlisted student');
  });

  it('funds a student, and says who reads the reason', () => {
    start('APPROVED_PROPOSED');
    fill({ decision: 'APPROVED', reason: 'Funded in full for 2026 from the missing-middle pool.' });
    expect(submitButton().disabled).toBe(false);
    submitButton().click();

    const request = http.expectOne((r) => r.url === AUTHORIZE && r.method === 'POST');
    expect(request.request.body).toEqual({
      decision: 'APPROVED',
      reason: 'Funded in full for 2026 from the missing-middle pool.',
    });
  });

  it('PHYSICALLY REFUSES a refusal with too few words', () => {
    // A student turned down at the last step reads the same kind of message as one turned down at
    // the first (§5.8). The floor is the enforcement, not the guidance beside it.
    start('APPROVED_PROPOSED');
    fill({ decision: 'REJECTED', reason: 'Not eligible.', next_step_confirmed: true });
    expect(submitButton().disabled).toBe(true);
    fixture.componentInstance.form.markAllAsTouched();
    submitButton().click();
    http.expectNone(() => true);

    fill({ reason: REAL_MESSAGE, next_step_confirmed: false });
    expect(submitButton().disabled).toBe(true);
    submitButton().click();
    http.expectNone(() => true);

    fill({ next_step_confirmed: true });
    expect(submitButton().disabled).toBe(false);
    submitButton().click();
    expect(http.expectOne((r) => r.url === AUTHORIZE).request.body).toEqual({
      decision: 'REJECTED',
      reason: REAL_MESSAGE,
    });
  });

  it('will not send an approval with no reason at all', () => {
    start('APPROVED_PROPOSED');
    fill({ decision: 'APPROVED', reason: 'ok' });
    expect(submitButton().disabled).toBe(true);
    submitButton().click();
    http.expectNone(() => true);
  });

  it('says plainly when the proposer tries to authorise their own proposal', () => {
    // The two-person rule is the server's — it reads who proposed it from the append-only status
    // event. This is only how that refusal reaches the person in front of the screen.
    start('APPROVED_PROPOSED');
    fill({ decision: 'APPROVED', reason: 'Approved on merit and verified documents.' });
    submitButton().click();
    http.expectOne((r) => r.url === AUTHORIZE).flush(
      {
        error: {
          code: 'two_person_rule',
          message: 'Two-person rule violated: actor==proposer',
          request_id: 'r1',
        },
      },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();

    expect(el().querySelector('[role="alert"]')).toBeTruthy();
    expect(text()).toContain('A second person has to authorise this');
    // Never the raw server wording — the reviewer reads our sentence, not the API's.
    expect(text()).not.toContain('Two-person rule violated');
  });

  it('has no serious or critical accessibility violations', async () => {
    start('APPROVED_PROPOSED');
    fill({ decision: 'REJECTED', reason: REAL_MESSAGE });
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('ruling on an appeal (BR-E07)', () => {
  let fixture: ComponentFixture<DecisionComposeComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const options = () =>
    Array.from(el().querySelectorAll('option'))
      .map((o) => o.getAttribute('value'))
      .filter(Boolean);
  const submitButton = () =>
    Array.from(el().querySelectorAll('button')).find(
      (b) => b.getAttribute('type') === 'submit',
    ) as HTMLButtonElement;

  function start(status: string) {
    ({ fixture, http } = setup(DecisionComposeComponent));
    fixture.componentInstance.applicationId.set('a1');
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
  }

  it('offers the appeal rulings, and only on an appeal', () => {
    start('APPEALED');
    expect(options()).toEqual(['APPROVED_PROPOSED', 'REJECTED_FINAL']);
    expect(el().textContent).toContain('You are hearing an appeal');
    expect(el().textContent).toContain('there is no further appeal after this');

    // REJECTED_FINAL is reachable from APPEALED and nowhere else — the ordinary review must not
    // acquire a shortcut past the rejection a student is still allowed to appeal.
    start('READY_FOR_REVIEW');
    expect(options()).toEqual([
      'UNDER_REVIEW',
      'INTERVIEW_SCHEDULED',
      'APPROVED_PROPOSED',
      'REJECTED',
    ]);
    expect(el().textContent).not.toContain('You are hearing an appeal');
  });

  it('holds an upheld appeal to the same 40-word floor as any other refusal', () => {
    start('APPEALED');
    fixture.componentInstance.form.patchValue({
      decision: 'REJECTED_FINAL',
      reason_category: 'ELIGIBILITY_MISMATCH',
      note: 'Nothing new.',
      next_step_confirmed: true,
    });
    fixture.detectChanges();
    expect(submitButton().disabled).toBe(true);
    submitButton().click();
    http.expectNone(() => true);

    fixture.componentInstance.form.patchValue({ note: REAL_MESSAGE });
    fixture.detectChanges();
    expect(submitButton().disabled).toBe(false);
    submitButton().click();
    expect(http.expectOne((r) => r.url === REVIEW).request.body).toEqual({
      decision: 'REJECTED_FINAL',
      note: REAL_MESSAGE,
    });
  });

  it('overturning proposes approval rather than granting it', () => {
    // An appeal cannot fund anyone by itself: a second person still authorises it (§16.4).
    start('APPEALED');
    fixture.componentInstance.form.patchValue({ decision: 'APPROVED_PROPOSED' });
    fixture.detectChanges();
    submitButton().click();
    expect(http.expectOne((r) => r.url === REVIEW).request.body).toEqual({
      decision: 'APPROVED_PROPOSED',
    });
  });
});

describe('A02 — which half of the decision is yours', () => {
  let fixture: ComponentFixture<AdminApplicationComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent?.replace(/\s+/g, ' ') ?? '';

  const application = (overrides: Record<string, unknown>) => ({
    id: 'a1',
    application_type: 'POSTGRAD',
    academic_year: '2026',
    created_at: '2026-02-01T00:00:00Z',
    recused_by_me: false,
    ...overrides,
  });

  function load(overrides: Record<string, unknown>) {
    ({ fixture, http } = setup(AdminApplicationComponent, { id: 'a1' }));
    fixture.detectChanges();
    http.expectOne((r) => r.url === DETAIL).flush(application(overrides));
    fixture.detectChanges();
  }

  it('gives an authorizer the ruling, and never a proposal form', () => {
    load({ status: 'APPROVED_PROPOSED', can_authorize: true });
    expect(el().querySelector('fl-authorise-decision')).toBeTruthy();
    expect(el().querySelector('fl-decision-compose')).toBeFalsy();
    expect(text()).toContain('You are the second person it needs');
  });

  it('gives a reviewer the proposal form, and never the ruling', () => {
    // A control that always refuses the person looking at it is worse than no control.
    load({ status: 'APPROVED_PROPOSED', can_authorize: false });
    expect(el().querySelector('fl-decision-compose')).toBeTruthy();
    expect(el().querySelector('fl-authorise-decision')).toBeFalsy();
  });

  it('tells an authorizer when there is nothing proposed yet', () => {
    load({ status: 'READY_FOR_REVIEW', can_authorize: true });
    expect(el().querySelector('fl-authorise-decision')).toBeFalsy();
    expect(text()).toContain('Nothing to authorise yet');
  });

  it('re-reads the application from the server after a ruling', () => {
    // The server decides what is now true — the screen never advances the status on its own.
    load({ status: 'APPROVED_PROPOSED', can_authorize: true });
    const card = fixture.debugElement.children
      .map((child) => child.componentInstance)
      .find((instance) => instance instanceof AuthoriseDecisionComponent) as
      | AuthoriseDecisionComponent
      | undefined;
    const authorise =
      card ??
      (fixture.debugElement.query((node) => node.name === 'fl-authorise-decision')
        ?.componentInstance as AuthoriseDecisionComponent);

    authorise.ruled.emit();
    fixture.detectChanges();
    http.expectOne((r) => r.url === DETAIL).flush(
      application({ status: 'APPROVED', can_authorize: true }),
    );
    fixture.detectChanges();
    expect(el().querySelector('fl-authorise-decision')).toBeFalsy();
    expect(text()).toContain('Nothing to authorise yet');
  });

  it('offers neither to a reviewer who stepped aside', () => {
    load({ status: 'APPROVED_PROPOSED', can_authorize: true, recused_by_me: true });
    expect(el().querySelector('fl-authorise-decision')).toBeFalsy();
    expect(el().querySelector('fl-decision-compose')).toBeFalsy();
    expect(text()).toContain('You stepped aside from this application');
  });
});
