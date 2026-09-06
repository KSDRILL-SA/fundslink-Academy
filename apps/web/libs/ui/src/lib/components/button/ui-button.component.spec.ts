import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiButtonComponent } from './ui-button.component';
import { describeViolations, findA11yViolations } from 'ui/testing';

@Component({
  standalone: true,
  imports: [UiButtonComponent],
  template: `
    <ui-button
      [loading]="loading()"
      [disabled]="disabled()"
      [ariaLabel]="ariaLabel()"
      [type]="type()"
    >
      Submit application
    </ui-button>
  `,
})
class HostComponent {
  // Signals, not plain fields: the components under test are OnPush, and a
  // signal write is what actually marks them dirty. A plain field mutated
  // between detectChanges() calls silently fails to propagate, which reads as
  // a component bug rather than a test bug.
  readonly loading = signal(false);
  readonly disabled = signal(false);
  readonly ariaLabel = signal('');
  readonly type = signal<'button' | 'submit' | 'reset'>('button');
}

describe('ui-button (rendered)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>;

  const button = () => fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  // The spinner span is aria-hidden and absolutely positioned; the label is
  // the one that is neither.
  const label = () => button().querySelector('span:not(.absolute)') as HTMLElement | null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders a real <button> with the projected label', () => {
    expect(button()).toBeTruthy();
    expect(button().textContent).toContain('Submit application');
  });

  it('is a type="button" by default so it cannot submit a form by accident', () => {
    expect(button().getAttribute('type')).toBe('button');
  });

  describe('loading', () => {
    beforeEach(() => {
      fixture.componentInstance.loading.set(true);
      fixture.detectChanges();
    });

    it('keeps the label in the DOM and in layout', () => {
      // This is the mechanism that stops the button resizing mid-interaction.
      // jsdom has no layout engine, so the width itself cannot be measured —
      // what is asserted is the thing that guarantees it: the label is still
      // rendered, and hidden with `invisible` (visibility:hidden, which keeps
      // its box) rather than removed or `hidden` (display:none, which does not).
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Submit application');

      const labelSpan = label() as HTMLElement;
      expect(labelSpan.classList.contains('invisible')).toBe(true);
      expect(labelSpan.classList.contains('hidden')).toBe(false);
    });

    it('takes the spinner out of flow so it cannot widen the button', () => {
      const spinner = button().querySelector('span.absolute');
      expect(spinner).toBeTruthy();
      expect(spinner?.querySelector('svg')).toBeTruthy();
    });

    it('is genuinely disabled, not merely styled as disabled', () => {
      // A double submit must not be able to start a second request.
      expect(button().disabled).toBe(true);
    });

    it('announces itself as busy', () => {
      expect(button().getAttribute('aria-busy')).toBe('true');
    });

    it('keeps an accessible name while loading', () => {
      // axe flagged this as `button-name` (critical) when the label was
      // aria-hidden during loading: the spinner is decorative, so hiding the
      // label left a screen-reader user on a completely unnamed button.
      expect(label()?.getAttribute('aria-hidden')).toBeNull();
      expect(button().textContent).toContain('Submit application');
    });

    it('keeps the spinner decorative', () => {
      expect(button().querySelector('span.absolute')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('is not busy when idle', () => {
    expect(button().getAttribute('aria-busy')).toBeNull();
    expect(button().disabled).toBe(false);
  });

  it('disables without claiming to be busy', () => {
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    expect(button().disabled).toBe(true);
    expect(button().getAttribute('aria-busy')).toBeNull();
  });

  it('applies an explicit accessible name when given one', () => {
    fixture.componentInstance.ariaLabel.set('Close');
    fixture.detectChanges();
    expect(button().getAttribute('aria-label')).toBe('Close');
  });

  it('has no serious or critical accessibility violations', async () => {
    const failures = await findA11yViolations(fixture.nativeElement);
    expect(failures, describeViolations(failures)).toEqual([]);
  });

  it('has no accessibility violations while loading', async () => {
    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();
    const failures = await findA11yViolations(fixture.nativeElement);
    expect(failures, describeViolations(failures)).toEqual([]);
  });

  it('keeps its accessible name from the label when no ariaLabel is given', () => {
    // An icon-only button needs ariaLabel; a text button must not lose its
    // name to an empty one.
    expect(button().getAttribute('aria-label')).toBeNull();
    expect(label()?.textContent?.trim()).toBe('Submit application');
  });
});
