import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { APPLICATION_CATEGORIES } from './application-categories';
import { CategoryPickerComponent } from './category-picker.component';
import { MotivationComponent } from './motivation.component';
import { EMPTY_DRAFT, SA_LANGUAGES, readDraft, writeDraft } from './motivation-draft';

function setup<T>(component: Type<T>) {
  TestBed.configureTestingModule({
    imports: [component],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

describe('S10 category picker', () => {
  let fixture: ReturnType<typeof setup<CategoryPickerComponent>>['fixture'];
  const el = () => fixture.nativeElement as HTMLElement;
  const cards = () => Array.from(el().querySelectorAll('li button')) as HTMLButtonElement[];

  beforeEach(() => {
    ({ fixture } = setup(CategoryPickerComponent));
  });

  it('offers all five doors', () => {
    expect(cards()).toHaveLength(5);
  });

  it('renders Category D as an equal card, not a footnote link', () => {
    // §5.6 — a first-class door. The students most likely to need it are the
    // least likely to push on a small link underneath.
    const other = cards()[4];
    expect(other.textContent).toContain('My situation is different');
    // Same element type, same grid, same classes as the other four.
    expect(other.tagName).toBe('BUTTON');
    expect(other.className).toBe(cards()[0].className);
    expect(other.closest('ul')).toBe(cards()[0].closest('ul'));
  });

  it('never says a student failed', () => {
    // §5.2 — describe the event, not the person. "I failed" is a sentence
    // about someone; "NSFAS paused my funding" is a sentence about a
    // circumstance, and only one of them should be clickable.
    const text = (el().textContent ?? '').toLowerCase();
    expect(text).not.toContain('i failed');
    expect(text).not.toContain('you failed');
    expect(text).not.toContain('failure');
    expect(text).toContain('nsfas paused my funding');
  });

  it('never shows the internal application_type', () => {
    const text = el().textContent ?? '';
    for (const category of APPLICATION_CATEGORIES) {
      expect(text).not.toContain(category.type);
    }
  });

  it('makes every card a real button, keyboard reachable', () => {
    // A clickable div here would be invisible to a keyboard on the screen that
    // decides whether someone can apply at all.
    for (const card of cards()) {
      expect(card.tagName).toBe('BUTTON');
      expect(card.getAttribute('type')).toBe('button');
      expect(card.getAttribute('tabindex')).toBeNull();
    }
  });

  it('tells someone unsure that they can pick the closest one', () => {
    expect(el().textContent).toContain('Not sure?');
  });

  it('has no serious or critical accessibility violations', async () => {
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('S12 OTHER motivation', () => {
  let fixture: ReturnType<typeof setup<MotivationComponent>>['fixture'];
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* storage unavailable in this environment */
    }
    ({ fixture, http } = setup(MotivationComponent));
  });

  it('carries the promise line verbatim, character for character', () => {
    // MASTER-SPEC §5.6. This is not copy to be tightened — it is the
    // commitment made to someone about to write something difficult. If a
    // later edit softens it, that is the promise breaking, and this fails.
    const EXPECTED =
      "If your story doesn't fit our forms, our forms are incomplete — not your story. " +
      'Tell us. A human will read every word.';
    const quote = el().querySelector('blockquote');
    expect(quote).toBeTruthy();
    expect(quote?.textContent?.replace(/\s+/g, ' ').trim()).toBe(EXPECTED);
  });

  it('states the promise in the source too, so a refactor cannot drop it', () => {
    // Whitespace-normalised: the line wraps in the template, so a raw
    // substring match would pass or fail on formatting rather than on words.
    const source = readFileSync(join(__dirname, 'motivation.component.ts'), 'utf8').replace(
      /\s+/g,
      ' ',
    );
    expect(source).toContain('A human will read every word.');
    expect(source).toContain('Verbatim, MASTER-SPEC');
  });

  it('asks three answerable questions, each with a real example', () => {
    // A blank box labelled "motivation" is the hardest thing on any form.
    const text = el().textContent ?? '';
    expect(text).toContain('What is your situation?');
    expect(text).toContain('Why did none of the other options fit?');
    expect(text).toContain('What would help?');
    expect((text.match(/For example:/g) ?? []).length).toBe(3);
  });

  it('invites every official South African language (E11, P7)', () => {
    const options = Array.from(el().querySelectorAll('option')) as HTMLOptionElement[];
    expect(options).toHaveLength(SA_LANGUAGES.length);
    expect(options.map((o) => o.textContent?.trim())).toContain('isiXhosa');
    expect(options.map((o) => o.textContent?.trim())).toContain('Sepedi');
    expect(el().textContent).toContain('Write in the language you think in');
  });

  it('asks for what is missing, never "this field is required"', () => {
    fixture.componentInstance.form.markAllAsTouched();
    fixture.detectChanges();
    const text = el().textContent ?? '';
    expect(text).toContain('Tell us what is happening');
    expect(text.toLowerCase()).not.toContain('is required');
  });

  it('keeps the draft until the server has it, not merely until submit', () => {
    // Clearing on submit would lose the text if the request failed on the way
    // — which on mobile data is exactly when it fails.
    fixture.componentInstance.form.setValue({
      language: 'zu',
      situation: 'My mother lost her job in March.',
      why_not_categories: 'I was never registered with NSFAS.',
      support_needed: 'R18 000 for outstanding fees.',
    });
    fixture.componentInstance.submit();

    http
      .expectOne((r) => r.url === '/api/v1/applications')
      .flush(
        { error: { code: 'rate_limited', message: 'slow', request_id: 'r1' } },
        { status: 429, statusText: 'Too Many Requests' },
      );
    fixture.detectChanges();

    expect(readDraft(window.localStorage).situation).toBe('My mother lost her job in March.');
  });

  it('sends the motivation object the contract specifies', () => {
    fixture.componentInstance.form.setValue({
      language: 'xh',
      situation: 'Situation text.',
      why_not_categories: 'Why text.',
      support_needed: 'Support text.',
    });
    fixture.componentInstance.submit();

    const request = http.expectOne((r) => r.url === '/api/v1/applications');
    expect(request.request.body).toMatchObject({
      application_type: 'OTHER',
      motivation: {
        situation: 'Situation text.',
        why_not_categories: 'Why text.',
        support_needed: 'Support text.',
        language: 'xh',
      },
    });
  });

  it('has no serious or critical accessibility violations', async () => {
    const failures = await findA11yViolations(el());
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('motivation drafts', () => {
  it('survives a reload', () => {
    writeDraft(window.localStorage, { ...EMPTY_DRAFT, situation: 'Half a sentence' });
    expect(readDraft(window.localStorage).situation).toBe('Half a sentence');
  });

  it('reads field by field, never trusting the stored shape', () => {
    // The value is user-writable and survives deploys. A stale or tampered
    // shape must not reach the form.
    window.localStorage.setItem(
      'fl-motivation-draft',
      JSON.stringify({ situation: 42, extra: 'nope' }),
    );
    const draft = readDraft(window.localStorage);
    expect(draft.situation).toBe('');
    expect(Object.keys(draft).sort()).toEqual([
      'language',
      'situation',
      'support_needed',
      'why_not_categories',
    ]);
  });

  it('never throws when storage is unavailable', () => {
    // Private mode, a full quota, and a blocked-storage browser all throw —
    // and none of them is a reason to stop someone writing.
    expect(() => readDraft(undefined)).not.toThrow();
    expect(() => writeDraft(undefined, EMPTY_DRAFT)).not.toThrow();
    expect(readDraft(undefined)).toEqual(EMPTY_DRAFT);
  });

  it('recovers from corrupt storage instead of breaking the form', () => {
    window.localStorage.setItem('fl-motivation-draft', 'not json at all');
    expect(readDraft(window.localStorage)).toEqual(EMPTY_DRAFT);
  });
});
