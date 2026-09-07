import { Directive, ElementRef, computed, inject, input } from '@angular/core';
import { cn } from '../utils/cn';
import { UiFormFieldComponent } from './ui-form-field.component';

/**
 * Shared control styling and field wiring.
 *
 * These are directives on native elements rather than ControlValueAccessor
 * wrapper components, and that is a deliberate architectural choice. A native
 * `<input formControlName>` keeps autofill, the correct mobile keyboard, the
 * platform's own validation semantics, password-manager integration and
 * screen-reader behaviour for free. A custom CVA re-implements all of it and
 * usually loses some — most often autofill and the software keyboard, which
 * are exactly what matters on the low-end phones this product targets (P6).
 *
 * Each directive finds its parent `ui-form-field` through DI and takes its
 * `id`, `aria-describedby` and `aria-invalid` from it, so a screen author
 * cannot forget the wiring: it happens by placing the control inside the field.
 */

const BASE_CONTROL = cn(
  'w-full rounded-md border border-input bg-background text-foreground',
  // 16px minimum. Below it, iOS zooms the viewport on focus and the layout
  // jumps under the user's finger (design-system.md §3).
  'text-base placeholder:text-muted-foreground',
  'outline-none transition-[border-color,box-shadow] duration-150',
  'focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring',
  // Disabled is unreachable by keyboard; read-only is still readable and
  // copyable. They must not look the same (§2).
  'disabled:cursor-not-allowed disabled:opacity-50',
  'read-only:bg-muted read-only:text-muted-foreground',
  'aria-[invalid=true]:border-destructive',
);

@Directive()
abstract class UiControlBase {
  protected readonly field = inject(UiFormFieldComponent, { optional: true });
  readonly class = input<string>('');

  /**
   * An id supplied by the caller, for a control used outside a `ui-form-field`.
   *
   * Declared as an input rather than read off the element, because a *bound*
   * `[id]="..."` is applied after construction — reading the attribute at
   * construction time saw nothing, and the host binding below then wrote null
   * over the caller's id, leaving an unlabelled control. Taking it as an input
   * means the directive receives the value instead of racing it.
   */
  readonly id = input<string>('');

  /** A static id, for the plain `id="x"` case where no binding is involved. */
  private readonly staticId =
    (inject(ElementRef).nativeElement as HTMLElement).getAttribute('id') || null;

  /** The field's id when there is a field; otherwise leave the caller's alone. */
  protected readonly controlId = computed(
    () => this.field?.controlId() ?? (this.id() || this.staticId),
  );
  protected readonly describedBy = computed(() => this.field?.describedBy() ?? null);
  protected readonly invalid = computed(() =>
    this.field?.invalid() ? 'true' : null,
  );
}

/** `<input uiInput type="email" formControlName="email">` */
@Directive({
  selector: 'input[uiInput]',
  standalone: true,
  host: {
    '[attr.id]': 'controlId()',
    '[attr.aria-describedby]': 'describedBy()',
    '[attr.aria-invalid]': 'invalid()',
    '[class]': 'classes()',
  },
})
export class UiInputDirective extends UiControlBase {
  // h-11 is 44px — the target floor (§0).
  protected readonly classes = computed(() => cn(BASE_CONTROL, 'h-11 px-3', this.class()));
}

/** `<textarea uiTextarea formControlName="motivation">` */
@Directive({
  selector: 'textarea[uiTextarea]',
  standalone: true,
  host: {
    '[attr.id]': 'controlId()',
    '[attr.aria-describedby]': 'describedBy()',
    '[attr.aria-invalid]': 'invalid()',
    '[class]': 'classes()',
  },
})
export class UiTextareaDirective extends UiControlBase {
  protected readonly classes = computed(() =>
    cn(BASE_CONTROL, 'min-h-28 resize-y px-3 py-2', this.class()),
  );
}

/** `<select uiSelect formControlName="institution">` */
@Directive({
  selector: 'select[uiSelect]',
  standalone: true,
  host: {
    '[attr.id]': 'controlId()',
    '[attr.aria-describedby]': 'describedBy()',
    '[attr.aria-invalid]': 'invalid()',
    '[class]': 'classes()',
  },
})
export class UiSelectDirective extends UiControlBase {
  protected readonly classes = computed(() => cn(BASE_CONTROL, 'h-11 px-3', this.class()));
}

/**
 * `<input uiCheckbox type="checkbox" formControlName="agree">`
 *
 * A native checkbox, restyled. `accent-color` themes the platform control
 * without replacing it, so it keeps its keyboard behaviour, its indeterminate
 * state, and the way assistive tech already knows how to describe it.
 */
@Directive({
  selector: 'input[uiCheckbox]',
  standalone: true,
  host: {
    // The id is not optional here either. Omitting it left the field's <label
    // for=...> pointing at nothing, so the checkbox had no accessible name at
    // all — axe caught it as `label`, critical.
    '[attr.id]': 'controlId()',
    '[attr.aria-describedby]': 'describedBy()',
    '[attr.aria-invalid]': 'invalid()',
    '[class]': 'classes()',
  },
})
export class UiCheckboxDirective extends UiControlBase {
  protected readonly classes = computed(() =>
    cn(
      'h-5 w-5 shrink-0 rounded-sm border-input',
      'outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2',
      'focus-visible:outline-ring',
      'disabled:cursor-not-allowed disabled:opacity-50',
      '[accent-color:hsl(var(--primary))]',
      this.class(),
    ),
  );
}
