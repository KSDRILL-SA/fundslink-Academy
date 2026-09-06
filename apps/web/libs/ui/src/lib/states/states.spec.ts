import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiEmptyStateComponent } from './ui-empty-state.component';
import { UiErrorStateComponent } from './ui-error-state.component';
import { UiSuccessStateComponent } from './ui-success-state.component';
import { UiSkeletonComponent } from './ui-skeleton.component';
import { describeViolations, findA11yViolations } from 'ui/testing';

@Component({
  standalone: true,
  imports: [UiEmptyStateComponent],
  template: `
    <ui-empty-state
      title="No bursaries yet"
      message="When you start applying, they will show up here."
      [actionLabel]="actionLabel()"
      (action)="acted.set(acted() + 1)"
    />
  `,
})
class EmptyHost {
  readonly actionLabel = signal('Browse bursaries');
  readonly acted = signal(0);
}

@Component({
  standalone: true,
  imports: [UiErrorStateComponent],
  template: `<ui-error-state [code]="code()" (retry)="retried.set(retried() + 1)" />`,
})
class ErrorHost {
  readonly code = signal<string | null>('rate_limited');
  readonly retried = signal(0);
}

@Component({
  standalone: true,
  imports: [UiSuccessStateComponent],
  template: `<ui-success-state title="Application submitted" message="We will be in touch." />`,
})
class SuccessHost {}

@Component({
  standalone: true,
  imports: [UiSkeletonComponent],
  template: `<ui-skeleton class="h-4 w-32" />`,
})
class SkeletonHost {}

describe('ui-empty-state (rendered)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<EmptyHost>>;
  const buttons = () =>
    Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EmptyHost] }).compileComponents();
    fixture = TestBed.createComponent(EmptyHost);
    fixture.detectChanges();
  });

  it('offers exactly one way forward — never a dead end, never a menu (P2)', () => {
    expect(buttons()).toHaveLength(1);
    expect(buttons()[0].textContent).toContain('Browse bursaries');
  });

  it('emits when the one action is taken', () => {
    buttons()[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.acted()).toBe(1);
  });

  it('renders no action when there genuinely is nothing to do', () => {
    fixture.componentInstance.actionLabel.set('');
    fixture.detectChanges();
    expect(buttons()).toHaveLength(0);
    // The explanation must survive even when the action does not.
    expect(fixture.nativeElement.textContent).toContain('No bursaries yet');
  });

  it('has no serious or critical accessibility violations', async () => {
    const failures = await findA11yViolations(fixture.nativeElement);
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('ui-error-state (rendered)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ErrorHost>>;
  const text = () => fixture.nativeElement.textContent as string;
  const retry = () => fixture.nativeElement.querySelector('button') as HTMLButtonElement | null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ErrorHost] }).compileComponents();
    fixture = TestBed.createComponent(ErrorHost);
    fixture.detectChanges();
  });

  it('announces itself once, as an alert', () => {
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('renders the mapped message for the code, never a raw server string', () => {
    expect(text()).toContain('Too many attempts');
    expect(text()).toContain('Give it a minute');
  });

  it('offers retry for a retryable code', () => {
    expect(retry()).toBeTruthy();
    retry()?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.retried()).toBe(1);
  });

  it('withholds retry for a permanent failure', () => {
    // Offering "Try again" for something that cannot succeed teaches people to
    // hammer a button that will never work.
    fixture.componentInstance.code.set('forbidden');
    fixture.detectChanges();
    expect(retry()).toBeNull();
    expect(text()).toContain("You don't have access to this");
  });

  it('falls back safely for an unknown code without inventing a cause', () => {
    fixture.componentInstance.code.set('some_code_from_the_future');
    fixture.detectChanges();
    expect(text()).toContain('Something went wrong on our side');
    expect(text()).toContain("wasn't you");
  });

  it('has no serious or critical accessibility violations', async () => {
    const failures = await findA11yViolations(fixture.nativeElement);
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('ui-success-state (rendered)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<SuccessHost>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SuccessHost] }).compileComponents();
    fixture = TestBed.createComponent(SuccessHost);
    fixture.detectChanges();
  });

  it('announces politely rather than stealing focus', () => {
    // A keyboard user must be told what happened without being thrown out of
    // wherever they were.
    const live = fixture.nativeElement.querySelector('[aria-live]');
    expect(live?.getAttribute('aria-live')).toBe('polite');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('has no serious or critical accessibility violations', async () => {
    const failures = await findA11yViolations(fixture.nativeElement);
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('ui-skeleton (rendered)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<SkeletonHost>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SkeletonHost] }).compileComponents();
    fixture = TestBed.createComponent(SkeletonHost);
    fixture.detectChanges();
  });

  it('is hidden from assistive technology — it is a placeholder, not content', () => {
    const block = fixture.nativeElement.querySelector('div');
    expect(block?.getAttribute('aria-hidden')).toBe('true');
  });

  it('reserves the space it was given', () => {
    const block = fixture.nativeElement.querySelector('div') as HTMLElement;
    expect(block.className).toContain('h-4');
    expect(block.className).toContain('w-32');
  });

  it('stops shimmering under reduced motion', () => {
    const block = fixture.nativeElement.querySelector('div') as HTMLElement;
    expect(block.className).toContain('motion-reduce:animate-none');
  });
});
