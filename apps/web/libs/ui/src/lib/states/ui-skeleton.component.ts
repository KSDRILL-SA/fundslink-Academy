import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../utils/cn';

/**
 * A shimmering placeholder that reserves the space its content will occupy.
 *
 * The point is layout, not decoration: a spinner on a blank page tells the
 * user nothing and then shoves the page down when content lands (CLS). A
 * skeleton that matches the eventual shape means the arrival is a fill, not a
 * jump (component-library.md §7).
 *
 * The shimmer is suppressed under prefers-reduced-motion; the block still
 * reserves the space, which is the part that matters.
 */
@Component({
  selector: 'ui-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [class]="classes()" aria-hidden="true"></div>`,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class UiSkeletonComponent {
  /** Any Tailwind sizing: `h-4 w-32`, `h-40 w-full`. */
  readonly class = input<string>('h-4 w-full');
  /** `circle` for avatars, `text` for lines, `block` for cards and media. */
  readonly shape = input<'text' | 'circle' | 'block'>('text');

  protected readonly classes = computed(() =>
    cn(
      'animate-pulse bg-muted motion-reduce:animate-none',
      this.shape() === 'circle' ? 'rounded-full' : this.shape() === 'text' ? 'rounded-sm' : 'rounded-lg',
      this.class(),
    ),
  );
}
