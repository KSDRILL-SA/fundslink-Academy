import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../utils/cn';

/** How the mark is coloured. */
export type LogoVariant = 'mono' | 'color';
export type LogoSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<LogoSize, number> = { sm: 28, md: 32, lg: 44 };

/**
 * The Rising Door — a navy doorway of access framing a gold rising figure.
 * Founder-chosen canonical mark (brand-identity.md; the source SVG lives at
 * docs/experience/assets/logo/logo-mark.svg).
 *
 * `mono` is the default because it draws in `currentColor` and therefore
 * themes with its surroundings — navy on a light header, near-white on a dark
 * one. The two-tone `color` variant hard-codes the brand navy, which vanishes
 * against the dark background; it belongs on light marketing surfaces where
 * the full mark is the point, not in chrome that has to work in both themes.
 *
 * The wordmark is real text, not part of the SVG: it stays selectable,
 * searchable, and readable to a screen reader, and it scales with the type
 * rather than with the artwork.
 */
@Component({
  selector: 'ui-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()">
      @if (variant() === 'mono') {
        <svg
          [attr.width]="px()"
          [attr.height]="px()"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M14 57 V31 a18 18 0 0 1 36 0 V57"
            stroke="currentColor"
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="32" cy="26" r="5.5" fill="currentColor" />
          <path
            d="M22 48 L32 35 L42 48"
            stroke="currentColor"
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      } @else {
        <svg
          [attr.width]="px()"
          [attr.height]="px()"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M14 57 V31 a18 18 0 0 1 36 0 V57"
            stroke="#1b2c4d"
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="32" cy="26" r="5.5" fill="#f59e0b" />
          <path
            d="M22 48 L32 35 L42 48"
            stroke="#f59e0b"
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      }

      @if (showWordmark()) {
        <span class="font-semibold tracking-tight" [class.sr-only]="false">
          FundsLink<span class="text-muted-foreground"> Academy</span>
        </span>
      } @else {
        <!-- The name still has to reach assistive tech even when it is not drawn. -->
        <span class="sr-only">FundsLink Academy</span>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class UiLogoComponent {
  readonly variant = input<LogoVariant>('mono');
  readonly size = input<LogoSize>('md');
  readonly showWordmark = input(true);
  readonly class = input<string>('');

  protected readonly px = computed(() => SIZE_PX[this.size()]);

  protected readonly classes = computed(() =>
    cn(
      'inline-flex items-center gap-2 text-foreground',
      this.size() === 'lg' ? 'text-xl' : 'text-base',
      this.class(),
    ),
  );
}
