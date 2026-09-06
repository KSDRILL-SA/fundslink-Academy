import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input } from '@angular/core';
import { TriangleAlert } from 'lucide';
import { cn } from '../utils/cn';
import { type IconNode, UiIconComponent } from '../components/icon/ui-icon.component';

export interface FieldError {
  /** The `id` of the control this error belongs to — from `ui-form-field`. */
  readonly controlId: string;
  /** What is wrong, in the same words the field itself shows. */
  readonly message: string;
}

/**
 * The summary shown after a failed submit (§2).
 *
 * A form that says "something is wrong" and leaves the person hunting is the
 * failure this exists to prevent — and on a long application form, hunting is
 * where people give up (P8).
 *
 * Each entry is a real link to its control, so activating it moves focus to
 * the field rather than merely scrolling near it. `tabindex="-1"` on the
 * container lets the caller focus the summary itself on submit, which is what
 * makes a screen-reader user hear the whole list at once instead of one error
 * as they wander into it.
 *
 * `role="alert"` is deliberately NOT used: an alert interrupts, and the caller
 * is already moving focus here. Two announcements of the same thing is noise.
 */
@Component({
  selector: 'ui-error-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconComponent],
  template: `
    @if (errors().length) {
      <div
        tabindex="-1"
        [attr.aria-labelledby]="headingId"
        role="group"
        [class]="classes()"
      >
        <div class="flex items-start gap-3">
          <span class="text-destructive">
            <ui-icon [name]="alertIcon" size="md" />
          </span>
          <div class="min-w-0">
            <h2 [id]="headingId" class="font-semibold text-foreground">
              {{ heading() }}
            </h2>
            <ul class="mt-2 space-y-1">
              @for (error of errors(); track error.controlId) {
                <li>
                  <a
                    [href]="'#' + error.controlId"
                    class="rounded-sm text-sm text-destructive underline underline-offset-4
                           outline-none focus-visible:outline-[3px]
                           focus-visible:outline-offset-2 focus-visible:outline-ring"
                    (click)="focusField($event, error.controlId)"
                    >{{ error.message }}</a
                  >
                </li>
              }
            </ul>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class UiErrorSummaryComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly errors = input.required<readonly FieldError[]>();
  readonly heading = input<string>('Please check these before continuing');
  readonly class = input<string>('');

  protected readonly headingId = `ui-error-summary-heading`;
  protected readonly alertIcon = TriangleAlert as IconNode;

  protected readonly classes = computed(() =>
    cn('rounded-lg border border-destructive/30 bg-destructive/8 p-4', this.class()),
  );

  /** Move focus to the field, not just the viewport. */
  protected focusField(event: Event, controlId: string): void {
    const doc = (this.host.nativeElement as HTMLElement).ownerDocument;
    const target = doc?.getElementById(controlId);
    if (!target) {
      // No element with that id: let the browser handle the href rather than
      // swallowing the click and leaving the person with a dead link.
      return;
    }
    event.preventDefault();
    target.focus();
    target.scrollIntoView({ block: 'center', behavior: 'auto' });
  }

  /** Called by the form after a failed submit so the whole list is announced. */
  focus(): void {
    const container = (this.host.nativeElement as HTMLElement).querySelector(
      '[tabindex="-1"]',
    ) as HTMLElement | null;
    container?.focus();
  }
}
