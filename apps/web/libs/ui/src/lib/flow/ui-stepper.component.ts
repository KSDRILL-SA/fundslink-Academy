import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../utils/cn';

export interface StepDescriptor {
  readonly label: string;
}

/**
 * Progress through a multi-step flow (component-library.md §9).
 *
 * Progress is always visible because the alternative — a form of unknown
 * length — is where people stop. "Step 2 of 3" is a promise that this ends.
 *
 * The current step is announced through `aria-current="step"` and the whole
 * bar is labelled, so a screen-reader user hears position without having to
 * infer it from a row of dots. The dots themselves are `aria-hidden`: they are
 * a picture of the text that sits beside them.
 */
@Component({
  selector: 'ui-stepper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav [attr.aria-label]="ariaLabel()">
      <p class="text-sm font-medium text-muted-foreground">
        Step {{ current() + 1 }} of {{ steps().length }} — {{ steps()[current()].label }}
      </p>

      <ol class="mt-3 flex gap-2" aria-hidden="true">
        @for (step of steps(); track step.label; let i = $index) {
          <li
            [class]="barClasses(i)"
            [attr.aria-current]="i === current() ? 'step' : null"
          ></li>
        }
      </ol>
    </nav>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class UiStepperComponent {
  readonly steps = input.required<readonly StepDescriptor[]>();
  readonly current = input.required<number>();
  readonly ariaLabel = input<string>('Progress');

  protected barClasses(index: number): string {
    return cn(
      'h-1.5 flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none',
      index < this.current() ? 'bg-accent' : '',
      index === this.current() ? 'bg-accent' : '',
      index > this.current() ? 'bg-border' : '',
    );
  }
}
