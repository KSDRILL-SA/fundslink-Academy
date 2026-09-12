import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';

/**
 * Card variants (component-library.md §3), on the premium surface layer.
 *
 * Every variant starts from `.fl-surface` (styles/surfaces.css): a top-edge
 * highlight and a two-layer shadow, which is what makes a card read as a
 * physical object lit from above rather than an outlined box. The variants
 * change emphasis, never the underlying construction — so every card in the
 * product shares one lighting model.
 */
export const cardVariants = cva('fl-surface relative', {
  variants: {
    variant: {
      /** The default surface. */
      static: '',
      /** Lifts on hover; the caller must place a real focusable link inside. */
      interactive: 'fl-surface-interactive',
      /** A single number and its label — tabular figures come from base.css. */
      stat: '',
      /** Gold gradient border for hope-moments. Never for warnings or errors. */
      highlight: 'fl-gradient-border',
      /** Frosted, for surfaces that sit over atmosphere (a mesh, a hero). */
      glass: 'fl-glass',
    },
    padding: {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    },
  },
  defaultVariants: { variant: 'static', padding: 'md' },
});

export type CardVariant = NonNullable<VariantProps<typeof cardVariants>['variant']>;
export type CardPadding = NonNullable<VariantProps<typeof cardVariants>['padding']>;

/**
 * The container primitive.
 *
 * `interactive` deliberately does not make the card itself clickable. A
 * clickable `<div>` is invisible to keyboards and unreadable to screen
 * readers; the card lifts on hover and rings when something inside it is
 * focused, and the consumer supplies a real `<a>` or button as the target
 * (§3 — "whole-card link with a focusable target").
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
