import { NgTemplateOutlet } from '@angular/common';
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

const SIZE_PX: Record<LogoSize, number> = { sm: 32, md: 36, lg: 48, xl: 72 };
/**
 * The plate is larger than the artwork it holds, the way a seal is. These were 34/40/54/76 with the
 * artwork at 82% of the tile, and in the header the mark was a gold smudge (Founder, 2026-09-13:
 * "too small and not visible enough"). Bigger tiles, and the artwork now fills 90%.
 */
const PLATE_PX: Record<LogoSize, number> = { sm: 40, md: 46, lg: 60, xl: 84 };
const PLATE_FILL = 0.9;
/** Below this many pixels the doorway is drawn heavier and the tread highlights are dropped. */
export const OPTICAL_SMALL_BELOW = 40;
const TEXT: Record<LogoSize, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl',
  xl: 'text-2xl',
};

/** Gradient ids must be unique per instance or the first one on the page wins. */
let nextId = 0;

/**
 * The Rising Door — a doorway of access; inside it, three steps that rise; at the top, a graduation
 * cap. The Founder-chosen concept (brand-identity.md), strengthened on Founder direction 2026-09-13:
 * "on top of the existing one", "at least 3 steps", "proper real icons, clean and professional".
 *
 * v1 put a dot over a chevron inside the arch; at small sizes it read as a caret and nothing rose.
 * The mark is now drawn in the icon language of Lucide — the icon set this interface already uses,
 * on its 24-unit grid — and the cap is Lucide's own `graduation-cap` glyph, placed and filled. The
 * logo and the product's icons are one family.
 *
 * The geometry is generated, not hand-copied: `apps/web/scripts/build-logo.mjs` owns it and writes
 * every SVG, PNG and the favicon. The paths below must match that file; the logo test holds them to
 * it. Below 40 px the doorway is drawn heavier and the tread highlights are dropped, so the mark
 * stays crisp in the header and the browser tab.
 *
 * Three variants, each with a job:
 *   - `mono`  — draws in `currentColor`, so it themes with its surroundings.
 *   - `color` — the two-tone mark on a light surface where the mark is the point.
 *   - `plate` — the seal: the mark on a navy tile with light through the doorway, for headers, the
 *               auth screen, anywhere the brand is introducing itself rather than labelling a page.
 *
 * The wordmark is real text, not part of the SVG: it stays selectable, searchable and readable to a
 * screen reader, and it scales with the type rather than with the artwork. The accessible name is
 * present in every configuration, including when no wordmark is drawn.
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
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient [attr.id]="goldId" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#fcd34d" />
                <stop offset="55%" stop-color="#f59e0b" />
                <stop offset="100%" stop-color="#d97706" />
              </linearGradient>
              <linearGradient [attr.id]="silverId" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#f1f5f9" />
                <stop offset="55%" stop-color="#cbd5e1" />
                <stop offset="100%" stop-color="#94a3b8" />
              </linearGradient>
              <radialGradient [attr.id]="lightId" cx="12" cy="8.5" r="9" gradientUnits="userSpaceOnUse">
                <stop offset="0" stop-color="#fde68a" stop-opacity="0.55" />
                <stop offset="0.6" stop-color="#fbbf24" stop-opacity="0.12" />
                <stop offset="1" stop-color="#fbbf24" stop-opacity="0" />
              </radialGradient>
            </defs>
            @if (optical() === 'full') {
              <!-- Light through the doorway: large sizes only. -->
              <path d="M5.8 21V10a6.2 6.2 0 0 1 12.4 0v11z" [attr.fill]="lightRef" />
            }
            <path
              d="M4.5 21V10a7.5 7.5 0 0 1 15 0v11"
              stroke="#f1f5f9"
              [attr.stroke-width]="doorWeight()"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <ng-container *ngTemplateOutlet="steps; context: { $implicit: goldRef, silver: silverRef }" />
          </svg>
        </span>
      } @else if (variant() === 'mono') {
        <svg
          [attr.width]="markPx()"
          [attr.height]="markPx()"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M4.5 21V10a7.5 7.5 0 0 1 15 0v11"
            stroke="currentColor"
            [attr.stroke-width]="doorWeight()"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M7.2 21v-2.5h3v-2.5h3v-2.5h3.4v7.5z"
            fill="currentColor"
            stroke="currentColor"
            stroke-width="0.9"
            stroke-linejoin="round"
          />
          <g transform="translate(8.94 5.08) scale(0.38)" stroke-linecap="round" stroke-linejoin="round">
            <path
              d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"
              fill="currentColor"
              stroke="currentColor"
              stroke-width="1.3"
            />
            <path
              d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"
              fill="currentColor"
              stroke="currentColor"
              stroke-width="1.3"
              fill-opacity="0.75"
              stroke-opacity="0.75"
            />
            <path d="M22 10v6" stroke="currentColor" stroke-width="2.2" />
          </g>
        </svg>
      } @else {
        <svg
          [attr.width]="markPx()"
          [attr.height]="markPx()"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient [attr.id]="goldId" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#fcd34d" />
              <stop offset="55%" stop-color="#f59e0b" />
              <stop offset="100%" stop-color="#d97706" />
            </linearGradient>
            <linearGradient [attr.id]="silverId" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#f1f5f9" />
              <stop offset="55%" stop-color="#cbd5e1" />
              <stop offset="100%" stop-color="#94a3b8" />
            </linearGradient>
          </defs>
          <path
            d="M4.5 21V10a7.5 7.5 0 0 1 15 0v11"
            stroke="#1b2c4d"
            [attr.stroke-width]="doorWeight()"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <ng-container *ngTemplateOutlet="steps; context: { $implicit: goldRef, silver: silverRef }" />
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

    <!-- The steps (silver) and the cap (gold), shared by the two colour variants: the path in silver,
         the achievement in gold (Founder choice, 2026-09-13). -->
    <ng-template #steps let-gold let-silver="silver">
      <svg:path
        d="M7.2 21v-2.5h3v-2.5h3v-2.5h3.4v7.5z"
        [attr.fill]="silver"
        [attr.stroke]="silver"
        stroke-width="0.9"
        stroke-linejoin="round"
      />
      @if (optical() === 'full') {
        <svg:path
          d="M7.6 18.8h2.4M10.6 16.3h2.4M13.6 13.8h2.6"
          stroke="#ffffff"
          stroke-opacity="0.9"
          stroke-width="0.5"
          stroke-linecap="round"
        />
      }
      <svg:g transform="translate(8.94 5.08) scale(0.38)" stroke-linecap="round" stroke-linejoin="round">
        <svg:path
          d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"
          [attr.fill]="gold"
          [attr.stroke]="gold"
          stroke-width="1.3"
        />
        <svg:path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" fill="#d97706" stroke="#d97706" stroke-width="1.3" />
        <svg:path d="M22 10v6" stroke="#b45309" stroke-width="2.2" />
      </svg:g>
    </ng-template>
  `,
  imports: [NgTemplateOutlet],
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
  protected readonly silverId = `fl-logo-silver-${this.uid}`;
  protected readonly silverRef = `url(#fl-logo-silver-${this.uid})`;
  protected readonly lightId = `fl-logo-light-${this.uid}`;
  protected readonly lightRef = `url(#fl-logo-light-${this.uid})`;

  protected readonly markPx = computed(() =>
    this.variant() === 'plate'
      ? Math.round(PLATE_PX[this.size()] * PLATE_FILL)
      : SIZE_PX[this.size()],
  );
  /** Which weighting of the mark suits the pixels it will actually occupy. */
  protected readonly optical = computed(() =>
    this.markPx() < OPTICAL_SMALL_BELOW ? 'small' : 'full',
  );
  protected readonly doorWeight = computed(() => (this.optical() === 'small' ? 3.2 : 2.6));
  protected readonly platePx = computed(() => PLATE_PX[this.size()]);

  protected readonly classes = computed(() =>
    cn('inline-flex items-center gap-2.5 text-foreground', TEXT[this.size()], this.class()),
  );

  protected readonly plateClasses = computed(() =>
    cn('fl-logo-plate inline-flex shrink-0 items-center justify-center'),
  );
}
