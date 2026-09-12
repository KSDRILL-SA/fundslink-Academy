import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { type IconNode, UiIconComponent } from '../icon/ui-icon.component';

/**
 * Badge tones (component-library.md §6).
 *
 * `neutral` is what a declined application wears. That is a product decision,
 * not a styling one: a harsh red badge on a student who did not get funding
 * makes a rejection feel like a personal failure. Amber and grey carry the
 * status without the verdict (P4, and the "amber-never-red" rule on S15).
 */
export const badgeVariants = cva(
  cn(
    // fl-plate (styles/surfaces.css) adds the hairline inner ring and lit top
    // edge that the icon tiles have, so a badge reads as a small object rather
    // than a rectangle of tint. It adds no colour of its own.
    'fl-plate inline-flex items-center gap-1.5 rounded-full border font-medium',
    'px-2.5 py-1 text-sm whitespace-nowrap',
  ),
  {
    variants: {
      tone: {
        neutral: 'border-transparent bg-muted text-muted-foreground',
        info: 'border-transparent bg-primary/10 text-primary dark:bg-primary/20',
        success: 'border-transparent bg-success/12 text-success dark:bg-success/20',
        warning: 'border-transparent bg-warning/15 text-warning dark:bg-warning/25',
        accent: 'border-transparent bg-accent/15 text-accent-foreground dark:text-accent',
        /** Reserved for irreversible/destructive context — never for a student's outcome. */
        danger: 'border-transparent bg-destructive/12 text-destructive dark:bg-destructive/20',
        outline: 'border-border bg-transparent text-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

/**
 * A status badge: colour **and** icon **and** text.
 *
 * The icon is not decoration. Colour alone fails WCAG 1.4.1 and is invisible
 * to a colour-blind reader and in a black-and-white print of an application;
 * the icon plus the label are what actually carry the status, and the colour
 * only reinforces it (P3).
 *
 * There is deliberately no way to render this without a label.
 */
@Component({
  selector: 'ui-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconComponent],
  template: `
    <span [class]="classes()">
      @if (icon(); as node) {
        <ui-icon [name]="node" size="sm" />
      }
      <span>{{ label() }}</span>
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class UiBadgeComponent {
  readonly tone = input<BadgeTone>('neutral');
  /** The text is required — a badge is never colour alone. */
  readonly label = input.required<string>();
  readonly icon = input<IconNode | null>(null);
  readonly class = input<string>('');

  protected readonly classes = computed(() =>
    cn(badgeVariants({ tone: this.tone() }), this.class()),
  );
}
