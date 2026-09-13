import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { DecisionComponent } from './decision.component';

/**
 * S16 — the decision screens.
 *
 * This component tells a student whether they were funded, and it had no tests at all. The design
 * package names S16-REJ "the screen we build first in every design review", with a locked
 * structure; nothing held that structure in place.
 *
 * Two defects were found while writing this spec (#284):
 * - the not-funded screen rendered for ANY status that was not approved or waitlisted, safe only
 *   because the single caller filtered first;
 * - a student whose appeal had already been heard (REJECTED_FINAL) was told "You have one appeal.
 *   The form is below." — and the page, correctly, showed no form.
 */

@Component({
  imports: [DecisionComponent],
  template: `<fl-decision
    [status]="status()"
    [reason]="reason()"
    [decidedAt]="decidedAt()"
    [position]="position()"
  />`,
})
class HostComponent {
  // Signals, not plain fields: the component is OnPush (TRAP 3 in the Stage 04 notes).
  readonly status = signal('APPROVED');
  readonly reason = signal<string | null>(null);
  readonly decidedAt = signal<string | null>(null);
  readonly position = signal<number | null>(null);
}

describe('DecisionComponent (S16)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => el().textContent?.replace(/\s+/g, ' ') ?? '';

  function render(overrides: Partial<Record<'status' | 'reason' | 'decidedAt', string | null>> & {
    position?: number | null;
  }): void {
    if (overrides.status !== undefined) host.status.set(overrides.status as string);
    if (overrides.reason !== undefined) host.reason.set(overrides.reason);
    if (overrides.decidedAt !== undefined) host.decidedAt.set(overrides.decidedAt);
    if (overrides.position !== undefined) host.position.set(overrides.position);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
  });

  describe('which screen', () => {
    it('never guesses a decision the application has not received', () => {
      // SUSPENDED is reversible (D-012); UNDER_REVIEW has no decision yet. Neither may be shown
      // the not-funded screen, whatever the caller passes.
      for (const status of ['SUSPENDED', 'UNDER_REVIEW', 'REVOKED', 'SOMETHING_NEW']) {
        render({ status });
        expect(text(), `${status} rendered a decision screen`).not.toMatch(
          /cannot fund|you qualify|approved/i,
        );
      }
    });

    it('shows the not-funded screen for both REJECTED and REJECTED_FINAL', () => {
      for (const status of ['REJECTED', 'REJECTED_FINAL']) {
        render({ status, reason: 'Reasons.' });
        expect(text()).toContain('We cannot fund this application');
      }
    });
  });

  describe('S16-REJ — the locked structure', () => {
    const REASON =
      'Your household income was assessed above the NSFAS funding line.\nPlease apply to the missing-middle loan scheme.';

    beforeEach(() => render({ status: 'REJECTED', reason: REASON, decidedAt: '2026-03-03T10:00:00Z' }));

    it('says the decision first, plainly', () => {
      const h1 = el().querySelector('h1');
      expect(h1?.textContent?.trim()).toBe('We cannot fund this application');
    });

    it("shows the reviewer's words verbatim, not a summary", () => {
      const quote = el().querySelector('blockquote');
      expect(quote?.textContent?.trim()).toBe(REASON);
    });

    it('never calls the student rejected (product law)', () => {
      expect(text()).not.toMatch(/\breject(ed|ion)?\b/i);
    });

    it('opens the doors that remain, then signs off as a person', () => {
      expect(text()).toContain('What you can do from here');
      expect(text()).toContain('apply again at the next intake');
      expect(text()).toContain('Reviewed with care by the FundsLink team');
      // Order matters: the reason before the doors, the doors before the signature.
      const t = text();
      expect(t.indexOf(REASON.split('\n')[0])).toBeLessThan(t.indexOf('What you can do from here'));
      expect(t.indexOf('What you can do from here')).toBeLessThan(t.indexOf('Reviewed with care'));
    });

    it('offers the appeal where one can be made', () => {
      expect(text()).toContain('Ask us to look again');
      expect(text()).toContain('You have one appeal');
    });

    it('says so plainly if the reasons are missing, rather than leaving a hole', () => {
      render({ reason: null });
      expect(el().querySelector('blockquote')).toBeNull();
      expect(text()).toContain("That is our fault, not yours");
    });

    it('has no serious or critical accessibility violations', async () => {
      const failures = await findA11yViolations(el());
      expect(failures, describeViolations(failures)).toEqual([]);
    });
  });

  describe('after the appeal has been heard (REJECTED_FINAL)', () => {
    beforeEach(() => render({ status: 'REJECTED_FINAL', reason: 'Upheld on appeal.' }));

    it('does not promise an appeal that no longer exists', () => {
      expect(text()).not.toContain('You have one appeal');
      expect(text()).not.toContain('The form is below');
      expect(text()).not.toContain('Ask us to look again');
    });

    it('tells the student the appeal was heard and this is final', () => {
      expect(text()).toContain('Your appeal was heard');
      expect(text()).toContain('final decision');
    });

    it('still leaves the other doors open', () => {
      expect(text()).toContain('apply again at the next intake');
    });
  });

  describe('S16-WAIT — a transparent position (E4)', () => {
    it('shows the number when there is one', () => {
      render({ status: 'APPROVED_WAITLISTED', position: 7 });
      expect(text()).toContain('You are number 7 on the waitlist');
    });

    it('does not print a number it does not have', () => {
      render({ status: 'APPROVED_WAITLISTED', position: null });
      expect(text()).toContain('You are on the waitlist.');
      expect(text()).not.toMatch(/number \d/);
    });

    it('explains how the waitlist is ordered, in the order E4 states it', () => {
      render({ status: 'APPROVED_WAITLISTED', position: 3 });
      const items = Array.from(el().querySelectorAll('ol li')).map((li) => li.textContent ?? '');

      expect(items).toHaveLength(3);
      expect(items[0]).toMatch(/postgraduate/i);
      expect(items[1]).toMatch(/greatest financial need/i);
      expect(items[2]).toMatch(/waited longest/i);
    });

    it('is honest that the number can get worse', () => {
      render({ status: 'APPROVED_WAITLISTED', position: 3 });
      expect(text()).toContain('someone in greater need joins after you');
    });

    it('has no serious or critical accessibility violations', async () => {
      render({ status: 'APPROVED_WAITLISTED', position: 3, reason: 'Strong application.' });
      const failures = await findA11yViolations(el());
      expect(failures, describeViolations(failures)).toEqual([]);
    });
  });

  describe('approved', () => {
    it('says so in the heading, with the decision date when it is valid', () => {
      render({ status: 'APPROVED', decidedAt: '2026-03-03T10:00:00Z' });
      expect(el().querySelector('h1')?.textContent).toContain('approved');
      expect(text()).toContain('on 3 March 2026');
    });

    it('omits a broken date rather than printing "Invalid Date"', () => {
      render({ status: 'APPROVED', decidedAt: 'not-a-date' });
      expect(text()).not.toMatch(/invalid date|NaN/i);
    });
  });
});
