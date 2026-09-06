import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';

/**
 * Card variants (component-library.md §3). The premium here comes from
 * whitespace and a restrained shadow scale, not from decoration.
 */
export const cardVariants = cva(
  cn('relative rounded-lg border border-border bg-card text-card-foreground', 'shadow-sm'),
  {
    variants: {
      variant: {
        static: '',
        /** Lifts on hover; the caller must place a real focusable link inside. */
        interactive: cn(
          'transition-[box-shadow,transform] duration-200 ease-out',
          'hover:shadow-md hover:-translate-y-0.5',
          'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
          'focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-ring',
        ),
        /** A single number and its label — tabular figures come from base.css. */
        stat: '',
        /** Gold left rule for hope-moments. Never for warnings or errors. */
        highlight: 'border-l-4 border-l-accent',
      },
      padding: {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: { variant: 'static', padding: 'md' },
  },
);

export type CardVariant = NonNullable<VariantProps<typeof cardVariants>['variant']>;
export type CardPadding = NonNullable<VariantProps<typeof cardVariants>['padding']>;

/**
 * The container primitive.
 *
 * `interactive` deliberately does not make the card itself clickable. A
 * clickable `<div>` is invisible to keyboards and unreadable to screen
 * readers; the card lifts on hover and shows a focus ring when something
 * inside it is focused, and the consumer supplies a real `<a>` or button as
 * the target (§3 — "whole-card link with a focusable target").
 */
@Component({
  selector: 'ui-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()">
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class UiCardComponent {
  readonly variant = input<CardVariant>('static');
  readonly padding = input<CardPadding>('md');
  readonly class = input<string>('');

  protected readonly classes = computed(() =>
    cn(cardVariants({ variant: this.variant(), padding: this.padding() }), this.class()),
  );
}
