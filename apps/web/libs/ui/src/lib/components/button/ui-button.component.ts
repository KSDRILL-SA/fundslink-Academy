import { ChangeDetectionStrategy, Component, computed, input, output,
  booleanAttribute,
} from '@angular/core';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';

/**
 * Button classes, also exported so an anchor can be styled as a button without
 * a second component — an `<a>` that navigates must stay an `<a>` (a button
 * that routes breaks middle-click, "open in new tab", and the screen-reader
 * announcement).
 *
 * Variants map to the catalogue in component-library.md §1. Every colour is a
 * token; there is no hex here and there must never be.
 */
export const buttonVariants = cva(
  // Base: the universal rules from §0 that no variant may opt out of.
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-md font-medium select-none',
    'transition-[background-color,border-color,color,box-shadow,transform]',
    'duration-150 ease-out',
    // Focus is never removed. `focus-visible` keeps it off mouse clicks while
    // guaranteeing it for keyboard and switch users.
    'outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2',
    'focus-visible:outline-ring',
    // Disabled reads as disabled without relying on colour alone: the cursor
    // changes and pointer events stop, alongside the opacity.
    'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
    // A press that moves layout feels cheap and shifts the page; scale does not.
    'active:scale-[0.98] motion-reduce:active:scale-100 motion-reduce:transition-none',
    '[&_svg]:pointer-events-none',
  ),
  {
    variants: {
      variant: {
        /** The one main action per screen. */
        primary: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        /** Hope-moments only — never an error or a warning (design-system.md §2). */
        accent: 'bg-accent text-accent-foreground shadow-xs hover:bg-accent/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'bg-transparent text-foreground hover:bg-secondary',
        /** Irreversible actions only, and always paired with a confirmation. */
        destructive:
          'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
      },
      size: {
        // 44px is the accessibility floor (§0). `sm` is 36px and is therefore
        // only legitimate inside an already-large hit area, such as a table row
        // whose whole row is clickable.
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-5 text-base',
        lg: 'h-13 px-7 text-lg',
      },
      full: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', full: false },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;

/**
 * The primary action component.
 *
 * Loading keeps the button's width. The label stays in the DOM and in layout,
 * turned invisible, with the spinner centred over it — swapping the label for
 * a spinner would resize the button mid-interaction, moving whatever sits
 * beside it at the exact moment the user is looking at it.
 *
 * A loading button is also genuinely `disabled` rather than merely styled that
 * way, so a double submit cannot start a second request.
 */
@Component({
  selector: 'ui-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [attr.type]="type()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [attr.aria-label]="ariaLabel() || null"
      [class]="classes()"
      (click)="clicked.emit($event)"
    >
      @if (loading()) {
        <span class="absolute inline-flex" aria-hidden="true">
          <svg
            class="h-5 w-5 animate-spin motion-reduce:animate-none"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25" />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
            />
          </svg>
        </span>
      }
      <!-- Kept in layout so the width never changes, and hidden from sight
           only. It must NOT be aria-hidden: the spinner is decorative, so the
           label is the button's entire accessible name and hiding it leaves a
           screen-reader user on an unnamed button. aria-busy above already
           says it is working. Caught by axe as button-name, critical. -->
      <span [class.invisible]="loading()">
        <ng-content />
      </span>
    </button>
  `,
  styles: `
    :host {
      display: contents;
    }
    button {
      position: relative;
    }
  `,
})
export class UiButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  readonly full = input(false, { transform: booleanAttribute });
  /** Required when the button's only content is an icon (§0). */
  readonly ariaLabel = input<string>('');
  readonly class = input<string>('');

  readonly clicked = output<MouseEvent>();

  protected readonly classes = computed(() =>
    cn(
      buttonVariants({ variant: this.variant(), size: this.size(), full: this.full() }),
      this.class(),
    ),
  );
}
