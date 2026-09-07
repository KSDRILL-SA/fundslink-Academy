import { ChangeDetectionStrategy, Component, Directive, computed, input,
  booleanAttribute,
} from '@angular/core';
import { cn } from '../utils/cn';

/**
 * Wraps a control with a leading and/or trailing affix — a currency symbol, a
 * unit, an icon.
 *
 * The affix is `aria-hidden` and the field's label carries the meaning
 * instead. A screen reader announcing "R edit text" for an amount field is
 * worse than announcing the label alone, and the currency belongs in the
 * label or hint where it is read once rather than fighting the value.
 *
 * `pointer-events-none` on the affix matters: a symbol sitting over the input
 * that swallows clicks makes part of the field dead to a mouse, and people
 * click the currency symbol constantly when they mean to type an amount.
 */
@Component({
  selector: 'ui-input-affix',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative flex items-center">
      @if (prefix()) {
        <span
          aria-hidden="true"
          class="pointer-events-none absolute left-3 text-base text-muted-foreground"
          >{{ prefix() }}</span
        >
      }

      <ng-content />

      @if (suffix()) {
        <span
          aria-hidden="true"
          class="pointer-events-none absolute right-3 text-base text-muted-foreground"
          >{{ suffix() }}</span
        >
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class UiInputAffixComponent {
  readonly prefix = input<string>('');
  readonly suffix = input<string>('');
}

/**
 * `<input uiInput uiMoneyInput>` — an amount field.
 *
 * Money is a decimal STRING from the API to the screen and back
 * (handoff-s03-s04 §4.4). `type="text"` with `inputmode="decimal"` rather than
 * `type="number"` is deliberate: a number input silently coerces, exposes
 * spinners that let someone scroll an amount by accident, and in several
 * browsers drops the value entirely when it cannot parse — which loses what
 * the person typed rather than telling them it was wrong.
 *
 * Tabular figures keep the digits in their column, so a value changing in
 * place cannot shift the layout.
 */
@Directive({
  selector: 'input[uiMoneyInput]',
  standalone: true,
  host: {
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    '[class]': 'classes()',
  },
})
export class UiMoneyInputDirective {
  /** Extra left padding when an affix sits over the field. */
  readonly hasPrefix = input(true, { transform: booleanAttribute });

  protected readonly classes = computed(() =>
    cn('[font-variant-numeric:tabular-nums]', this.hasPrefix() ? 'pl-7' : ''),
  );
}
