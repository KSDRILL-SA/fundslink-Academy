import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiStatusChipComponent } from './ui-status-chip.component';
import { describeViolations, findA11yViolations } from 'ui/testing';

@Component({
  standalone: true,
  imports: [UiStatusChipComponent],
  template: `<ui-status-chip [status]="status()" [kind]="kind()" />`,
})
class HostComponent {
  readonly status = signal<string | null>('RETURNED_FOR_INFO');
  readonly kind = signal<'application' | 'source'>('application');
}

describe('ui-status-chip (rendered)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>;

  const text = () => (fixture.nativeElement.textContent as string).trim();
  const svg = () => fixture.nativeElement.querySelector('svg') as SVGElement | null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders the icon AND the text, never colour alone', () => {
    // WCAG 1.4.1. The table test proves the data has both; this proves they
    // reach the DOM, which is the part a user actually gets.
    expect(svg()).toBeTruthy();
    expect(text()).toBe('Needs more information');
  });

  it('marks the status icon decorative so it is not announced twice', () => {
    // The label sits right beside it; an icon announced as well is noise.
    expect(svg()?.getAttribute('aria-hidden')).toBe('true');
  });

  it('never shows the word "rejected" for a declined application', () => {
    fixture.componentInstance.status.set('REJECTED');
    fixture.detectChanges();
    expect(text().toLowerCase()).not.toContain('reject');
    expect(text()).toBe('Not funded this time');
  });

  it('renders a source badge when asked for one', () => {
    fixture.componentInstance.kind.set('source');
    fixture.componentInstance.status.set('SELF_REPORT');
    fixture.detectChanges();
    expect(text()).toBe('You reported');
  });

  it('renders an unknown status readably instead of blank or throwing', () => {
    fixture.componentInstance.status.set('A_STATUS_ADDED_AFTER_THIS_BUILD');
    fixture.detectChanges();
    expect(text()).toBe('A status added after this build');
    expect(svg()).toBeTruthy();
  });

  it('survives a null status', () => {
    fixture.componentInstance.status.set(null);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(text()).toBe('Unknown');
  });

  it('has no serious or critical accessibility violations', async () => {
    const failures = await findA11yViolations(fixture.nativeElement);
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});
