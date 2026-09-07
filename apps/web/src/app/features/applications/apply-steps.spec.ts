import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApplyStepsComponent } from './apply-steps.component';
import { DocumentsComponent } from './documents.component';
import { routes } from '../../app.routes';

function setup<T>(component: Type<T>, params: Record<string, string>) {
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

describe('S11 guided steps', () => {
  let fixture: ReturnType<typeof setup<ApplyStepsComponent>>['fixture'];
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  /** Click the real submit button — the path a student actually takes. */
  function advance() {
    const submit = Array.from(el().querySelectorAll('button')).find(
      (b) => b.getAttribute('type') === 'submit',
    ) as HTMLButtonElement;
    submit.click();
    fixture.detectChanges();
  }

  function fillAndAdvance() {
    fixture.componentInstance.form.patchValue({
      academic_year: '2026',
      requested_amount: '18000.50',
    });
    advance();
    advance();
  }

  beforeEach(() => {
    ({ fixture, http } = setup(ApplyStepsComponent, { category: 'ug_cat_c' }));
  });

  it('shows progress, because a form of unknown length is where people stop', () => {
    expect(text()).toContain('Step 1 of 3');
    expect(el().querySelector('ui-stepper nav')?.getAttribute('aria-label')).toBeTruthy();
  });

  it('does not show errors for questions it has not asked yet', () => {
    // Marking the whole form touched on step 1 would scold someone for not
    // answering step 3.
    advance();
    expect(text()).toContain('Choose the year you need funding for.');
    expect(text()).not.toContain('Tell us roughly how much you need.');
  });

  it('never turns the amount into a number', () => {
    // handoff §4.4 / DB-D29 — parseFloat on R18 000,50 is how a decimal
    // silently becomes 18000.499999999996.
    fillAndAdvance();
    advance();

    const request = http.expectOne((r) => r.url === '/api/v1/applications');
    const body = request.request.body as Record<string, unknown>;
    expect(typeof body['requested_amount']).toBe('string');
    expect(body['requested_amount']).toBe('18000.50');
  });

  it('uses a text input with a decimal keypad, never type="number"', () => {
    fixture.componentInstance.form.patchValue({ academic_year: '2026' });
    advance();
    const amount = el().querySelector('input[inputmode="decimal"]') as HTMLInputElement;
    expect(amount).toBeTruthy();
    expect(amount.type).toBe('text');
  });

  it('does not present the income band as a hurdle', () => {
    // The contract is explicit that this is NOT a means test — the engine
    // annotates, a human decides (§5.7, D-016/D-017).
    fillAndAdvance();
    expect(text()).toContain('This is not a test you can fail');
    expect(text()).toContain('I would rather not say');
    expect(text().toLowerCase()).not.toContain('qualify');
    expect(text().toLowerCase()).not.toContain('eligible');
  });

  it('says plainly that a deadline does not buy priority', () => {
    // Priority is ADMIN_REVIEWER-only and anti-gaming (D-002/D-013).
    // Implying otherwise teaches students that honesty costs them.
    fixture.componentInstance.form.patchValue({ academic_year: '2026' });
    advance();
    expect(text()).toContain('does not move you up a queue');
  });

  it('asks for the NSFAS reason only where there is a letter to read it off', () => {
    fillAndAdvance();
    expect(text()).toContain('What reason did NSFAS give?');
  });

  it('does not ask other categories for an NSFAS reason', () => {
    // A different category means a different route param, so the module has
    // to be rebuilt rather than reconfigured.
    TestBed.resetTestingModule();
    ({ fixture, http } = setup(ApplyStepsComponent, { category: 'postgrad' }));
    fixture.componentInstance.form.patchValue({
      academic_year: '2026',
      requested_amount: '9000',
    });
    advance();
    advance();
    expect(text()).not.toContain('What reason did NSFAS give?');
  });

  it('omits empty optional fields rather than sending blanks', () => {
    fillAndAdvance();
    advance();
    const body = http.expectOne((r) => r.url === '/api/v1/applications').request.body as Record<
      string,
      unknown
    >;
    expect(Object.keys(body).sort()).toEqual([
      'academic_year',
      'application_type',
      'requested_amount',
    ]);
    expect(body['application_type']).toBe('UG_CAT_C');
  });

  it('has no serious or critical accessibility violations', async () => {
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('S13 documents', () => {
  let fixture: ReturnType<typeof setup<DocumentsComponent>>['fixture'];
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  function chooseFile(file: File) {
    const input = el().querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    ({ fixture } = setup(DocumentsComponent, { id: 'a1' }));
  });

  it('tells someone a phone photo is fine', () => {
    // The alternative is a student who assumes they need a scanner.
    expect(text()).toContain('A photo from your phone is fine');
  });

  it('rejects an oversized file in the design own words, before uploading it', () => {
    // Saves someone on metered data from sending 8 MB that was never going to
    // be accepted.
    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 8 * 1024 * 1024 });
    chooseFile(big);
    expect(text()).toContain("That file's a bit big");
    expect(text()).toContain('under 5 MB');
  });

  it('catches an empty file', () => {
    const empty = new File([], 'empty.pdf', { type: 'application/pdf' });
    Object.defineProperty(empty, 'size', { value: 0 });
    chooseFile(empty);
    expect(text()).toContain('That file was empty');
  });

  it('catches a type it cannot use', () => {
    const wrong = new File(['x'], 'notes.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    Object.defineProperty(wrong, 'size', { value: 1000 });
    chooseFile(wrong);
    expect(text()).toContain("We can't read that file type");
  });

  it('never claims a file is safe — it only checks what a browser can know', () => {
    // Magic-byte validation, EXIF stripping and the AV scan are the server's
    // (ST-2.4). This screen must not imply it has verified anything.
    const lower = text().toLowerCase();
    expect(lower).not.toContain('verified');
    expect(lower).not.toContain('scanned');
    expect(lower).not.toContain('safe');
  });

  it('has no serious or critical accessibility violations', async () => {
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('apply route order', () => {
  it('matches the literal explain path before the :category wildcard', () => {
    // Angular matches in order. With ':category' first, a student choosing
    // "My situation is different" would land in the wizard with
    // category="EXPLAIN" instead of on the screen built to invite writing.
    const appRoute = routes.find((r) => r.path === 'app');
    const paths = (appRoute?.children ?? []).map((c) => c.path ?? '');
    expect(paths.indexOf('applications/new/explain')).toBeGreaterThan(-1);
    expect(paths.indexOf('applications/new/explain')).toBeLessThan(
      paths.indexOf('applications/new/:category'),
    );
  });
});
