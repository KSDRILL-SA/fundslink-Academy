import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../utils/cn';

let nextId = 0;

/**
 * A form field: visible label, control, helper text, error.
 *
 * The wiring is the point. A label that is not programmatically associated
 * with its control, a hint no screen reader reaches, an error announced
 * nowhere — all three look perfect and all three make the form unusable for
 * someone. Doing that wiring here means a screen author gets it right by
 * using the component, rather than by remembering four aria attributes
 * (component-library.md §2).
 *
 * There is deliberately no way to render this without a label. Placeholder-as-
 * label is listed in §11's anti-patterns for a concrete reason: the
 * placeholder disappears the moment someone types, so the field loses its name
 * exactly when it is being filled — and never comes back if they tab away and
 * return.
 *
 * The control is projected as a native element carrying `uiInput`, `uiSelect`
 * or `uiTextarea`. Those directives find this field through DI and take their
 * `id`, `aria-describedby` and `aria-invalid` from it.
 */
@Component({
  selector: 'ui-form-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()">
      <label [attr.for]="controlId()" class="text-sm font-medium text-foreground">
        {{ label() }}
        @if (required()) {
          <!-- The asterisk is decorative; "(required)" is what gets announced,
               because a lone * is read as "star" or skipped entirely. -->
          <span aria-hidden="true" class="ml-0.5 text-destructive">*</span>
          <span class="sr-only">(required)</span>
        }
        @if (optionalMarker() && !required()) {
          <span class="ml-1 font-normal text-muted-foreground">(optional)</span>
        }
      </label>

      <ng-content />

      @if (hint() && !error()) {
        <p [id]="hintId()" class="text-sm text-muted-foreground">{{ hint() }}</p>
      }

      @if (error(); as message) {
        <!-- role="alert" announces the message when it appears, without moving
             focus off the input the person is still working in. -->
        <p [id]="errorId()" role="alert" class="text-sm font-medium text-destructive">
          {{ message }}
        </p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class UiFormFieldComponent {
  private readonly uid = `ui-field-${nextId++}`;

  /** Required. A field without a visible label is not a field we ship. */
  readonly label = input.required<string>();
  /** Guidance shown while the field is valid. Hidden once an error replaces it. */
  readonly hint = input<string>('');
  /** The message to show. Falsy means valid. */
  readonly error = input<string | null>(null);
  readonly required = input(false);
  /** Mark optional fields explicitly on forms where most fields are required. */
  readonly optionalMarker = input(false);
  readonly class = input<string>('');

  readonly controlId = computed(() => `${this.uid}-control`);
  readonly hintId = computed(() => `${this.uid}-hint`);
  readonly errorId = computed(() => `${this.uid}-error`);

  /**
   * What the control should point `aria-describedby` at.
   *
   * The error replaces the hint rather than joining it: two messages read out
   * together is noise at the moment the person most needs one clear
   * instruction.
   */
  readonly describedBy = computed(() => {
    if (this.error()) {
      return this.errorId();
    }
    return this.hint() ? this.hintId() : null;
  });

  readonly invalid = computed(() => Boolean(this.error()));

  protected readonly classes = computed(() => cn('flex flex-col gap-1.5', this.class()));
}
