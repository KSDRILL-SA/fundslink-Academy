import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { cn } from '../utils/cn';

/** How the mark is presented. */
export type LogoVariant = 'mono' | 'color' | 'plate';
export type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PX: Record<LogoSize, number> = { sm: 28, md: 32, lg: 44, xl: 64 };
/** The plate is larger than the artwork it holds, the way a seal is. */
const PLATE_PX: Record<LogoSize, number> = { sm: 34, md: 40, lg: 54, xl: 76 };
const TEXT: Record<LogoSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl',
};

/** Gradient ids must be unique per instance or the first one on the page wins. */
let nextId = 0;

/**
 * The Rising Door — a navy doorway of access framing a gold rising figure.
 * Founder-chosen canonical mark (brand-identity.md; the source SVG lives at
 * docs/experience/assets/logo/logo-mark.svg).
 *
 * The geometry is untouched, because it is the brand. What changed is how it is
 * **made**: the figure is drawn with a gold gradient rather than a flat fill,
 * the arch carries a lighter inner stroke so the doorway reads as having
 * depth, and `plate` seats the whole mark in a navy tile with a top-edge
 * highlight and an inner ring — the difference between a logo that was placed
 * on a page and one that was struck.
 *
 * Three variants, each with a job:
 *   - `mono`  — draws in `currentColor`, so it themes with its surroundings.
 *               The right choice inside chrome that must work in both themes.
 *   - `color` — the two-tone mark on a light surface where the mark is the point.
 *   - `plate` — the seal: for headers, the auth screen, anywhere the brand is
 *               introducing itself rather than labelling a page.
 *
 * The wordmark is real text, not part of the SVG: it stays selectable,
 * searchable and readable to a screen reader, and it scales with the type
 * rather than with the artwork. The accessible name is present in every
 * configuration, including when no wordmark is drawn.
 */
@Component({
  selector: 'ui-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()">
      @if (variant() === 'plate') {
        <span [class]="plateClasses()" [style.width.px]="platePx()" [style.height.px]="platePx()">
          <svg
            [attr.width]="markPx()"
            [attr.height]="markPx()"
            viewBox="0 0 64 64"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient [attr.id]="goldId" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="hsl(43 96% 68%)" />
                <stop offset="55%" stop-color="hsl(38 92% 50%)" />
                <stop offset="100%" stop-color="hsl(30 90% 46%)" />
              </linearGradient>
            </defs>

            <!-- The doorway, in ivory on the navy plate, with a softer inner
                 stroke that gives the arch thickness rather than outline. -->
            <path
              d="M14 57 V31 a18 18 0 0 1 36 0 V57"
              stroke="hsl(210 40% 96%)"
              stroke-width="6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M20 57 V31.5 a12 12 0 0 1 24 0 V57"
              stroke="hsl(210 40% 96% / 0.22)"
              stroke-width="2"
              stroke-linecap="round"
            />
            <circle cx="32" cy="26" r="5.5" [attr.fill]="goldRef" />
            <path
              d="M22 48 L32 35 L42 48"
              [attr.stroke]="goldRef"
              stroke-width="6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      } @else if (variant() === 'mono') {
        <svg
          [attr.width]="markPx()"
          [attr.height]="markPx()"
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
          [attr.width]="markPx()"
          [attr.height]="markPx()"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient [attr.id]="goldId" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="hsl(43 96% 66%)" />
              <stop offset="55%" stop-color="hsl(38 92% 50%)" />
              <stop offset="100%" stop-color="hsl(30 90% 44%)" />
            </linearGradient>
          </defs>
          <path
            d="M14 57 V31 a18 18 0 0 1 36 0 V57"
            stroke="hsl(222 47% 24%)"
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="32" cy="26" r="5.5" [attr.fill]="goldRef" />
          <path
            d="M22 48 L32 35 L42 48"
            [attr.stroke]="goldRef"
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      }

      @if (showWordmark()) {
        <!-- Tight tracking and a lighter second word: the lockup reads as one
             name with a qualifier, not as two words of equal weight. -->
        <span class="font-semibold leading-none tracking-[-0.02em]">
          FundsLink<span class="font-normal text-muted-foreground"> Academy</span>
          @if (tagline()) {
            <span class="mt-1 block text-xs font-normal tracking-normal text-muted-foreground">
              Trusted Institution, humanised
            </span>
          }
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
  private readonly uid = nextId++;

  readonly variant = input<LogoVariant>('mono');
  readonly size = input<LogoSize>('md');
  readonly showWordmark = input(true, { transform: booleanAttribute });
  /** The positioning line, under the wordmark. Marketing surfaces only. */
  readonly tagline = input(false, { transform: booleanAttribute });
  readonly class = input<string>('');

  protected readonly goldId = `fl-logo-gold-${this.uid}`;
  protected readonly goldRef = `url(#fl-logo-gold-${this.uid})`;

  protected readonly markPx = computed(() =>
    // Inside the plate the artwork sits at ~72% of the tile, which is the
    // optical padding a seal needs to not look crowded.
    this.variant() === 'plate' ? Math.round(SIZE_PX[this.size()] * 0.82) : SIZE_PX[this.size()],
  );
  protected readonly platePx = computed(() => PLATE_PX[this.size()]);

  protected readonly classes = computed(() =>
    cn('inline-flex items-center gap-2.5 text-foreground', TEXT[this.size()], this.class()),
  );

  protected readonly plateClasses = computed(() =>
    cn('fl-logo-plate inline-flex shrink-0 items-center justify-center'),
  );
}
