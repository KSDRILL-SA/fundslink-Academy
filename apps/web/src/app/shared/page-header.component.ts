import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft } from 'lucide';
import { UiIconComponent, UiIconTileComponent, cn, type IconNode } from 'ui';

/**
 * The header every screen inside the account wears.
 *
 * Fifteen screens each wrote their own `<h1 class="text-2xl font-semibold
 * tracking-tight">` with their own spacing beneath it. They were individually
 * fine and collectively a mess: the eye had to re-learn where a page begins on
 * every navigation, and a change of mind about page titles meant fifteen edits
 * and one screen quietly left behind.
 *
 * So it is one component, and the only thing a screen decides is what it says:
 * an optional back link, an optional tile, the title, a lead line, and a slot
 * for the screen's own actions.
 *
 * App vocabulary rather than a shared primitive (frontend-structure.md §3) —
 * "the header of an account page" is a decision about this product, not a
 * reusable widget, and putting it in `libs/ui` would invite marketing pages to
 * grow account chrome.
 */
@Component({
  selector: 'fl-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiIconComponent, UiIconTileComponent],
  template: `
    <header [class]="classes()">
      @if (backRoute()) {
        <!-- A real link, not history.back(): it must work when this screen is
             the first one a student opened (an emailed link, a bookmark). -->
        <a
          [routerLink]="backRoute()"
          class="mb-5 inline-flex items-center gap-2 rounded-sm text-sm font-medium
                 text-muted-foreground underline-offset-4 outline-none transition-colors
                 hover:text-foreground hover:underline focus-visible:outline-[3px]
                 focus-visible:outline-offset-2 focus-visible:outline-ring
                 motion-reduce:transition-none"
        >
          <ui-icon [name]="backIcon" size="sm" />
          {{ backLabel() }}
        </a>
      }

      <div class="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        <div class="flex min-w-0 items-start gap-4">
          @if (icon(); as glyph) {
            <ui-icon-tile [icon]="glyph" [tone]="tone()" size="lg" class="mt-0.5" />
          }

          <div class="min-w-0">
            @if (eyebrow()) {
              <p class="fl-caption mb-2">{{ eyebrow() }}</p>
            }
            <h1 class="fl-display text-3xl sm:text-4xl">{{ title() }}</h1>
            @if (lead()) {
              <p class="mt-3 max-w-prose text-muted-foreground">{{ lead() }}</p>
            }
          </div>
        </div>

        <!-- The screen's own actions, right-aligned on wide screens and
             wrapping underneath rather than shrinking on narrow ones. -->
        <div class="flex flex-wrap items-center gap-3">
          <ng-content select="[actions]" />
        </div>
      </div>

      <ng-content />
    </header>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly lead = input<string>('');
  readonly eyebrow = input<string>('');
  readonly icon = input<IconNode | null>(null);
  readonly tone = input<'gold' | 'navy' | 'success' | 'warning' | 'neutral'>('navy');
  /** Where "back" goes. Omitted on a top-level screen. */
  readonly backRoute = input<string>('');
  readonly backLabel = input<string>('Back');
  readonly class = input<string>('');

  protected readonly backIcon = ArrowLeft as IconNode;

  protected readonly classes = computed(() => cn('pb-2', this.class()));
}
