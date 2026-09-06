import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide';
import { cn } from '../utils/cn';
import { prefersReducedMotion } from '../utils/reduced-motion';
import { type IconNode, UiIconComponent } from '../components/icon/ui-icon.component';

export interface ScrollNavItem {
  readonly label: string;
  readonly route: string;
  readonly icon?: IconNode;
  /** A small count, e.g. unread notifications. Rendered as text, never colour alone. */
  readonly badge?: number | string;
}

/** Auto: hover an arrow to scroll. Step: click an arrow to move exactly one item. */
export type ScrollNavMode = 'auto' | 'step';

const MODE_STORAGE_KEY = 'fl-nav-mode';
/** Pixels per frame while auto-scrolling — brisk enough to feel responsive, slow enough to read. */
const AUTO_SCROLL_SPEED = 8;

/**
 * The signature horizontal navigation rail.
 *
 * The scroll behaviour is a **pointer convenience layered on top of a plain
 * list of links** — never the mechanism by which a destination is reached.
 * That ordering is the whole accessibility story: every item is a real
 * `<a routerLink>` in Tab order, so a keyboard or screen-reader user reaches
 * everything regardless of scroll position, and focusing an item that happens
 * to be off-screen scrolls it into view rather than leaving focus somewhere
 * invisible. The arrows are decoration for people using a mouse.
 *
 * Reduced motion is honoured at every branch, not bolted on: auto-scroll is
 * disabled entirely (a rAF loop does not care what a media query says), arrows
 * become step-only, and every programmatic scroll switches from `smooth` to
 * `auto`. The feature degrades; it never breaks.
 *
 * Spec: navigation-and-shells.md §2.
 */
@Component({
  selector: 'ui-scroll-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, UiIconComponent],
  template: `
    <nav [attr.aria-label]="ariaLabel()" class="relative flex min-w-0 items-center">
      <!-- Left arrow. Rendered only when there is something to scroll back to,
           and hidden from assistive tech because it is pointer convenience:
           the links themselves are already in Tab order. -->
      @if (canScrollLeft() && !isTouch()) {
        <button
          type="button"
          [attr.aria-label]="stepMode() ? 'Scroll one item left' : 'Scroll left'"
          [class]="arrowClasses('left')"
          (mouseenter)="startAutoScroll(-1)"
          (mouseleave)="stopAutoScroll()"
          (focus)="stopAutoScroll()"
          (click)="onArrowClick(-1)"
          (dblclick)="toggleMode()"
        >
          <ui-icon [name]="stepMode() ? chevronsLeft : chevronLeft" size="md" />
        </button>
      }

      <!-- The rail. overflow-x-auto gives touch devices native momentum
           scrolling for free; scroll-snap makes it settle on an item. -->
      <div
        #rail
        class="ui-nav-rail flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scroll-smooth motion-reduce:scroll-auto"
        (scroll)="updateOverflow()"
      >
        <ul class="flex items-center gap-2">
          @for (item of entries(); track item.route) {
            <li class="shrink-0 snap-start">
              <a
                [routerLink]="item.route"
                routerLinkActive="ui-nav-active"
                #link="routerLinkActive"
                [routerLinkActiveOptions]="item.matchOptions"
                [attr.aria-current]="link.isActive ? 'page' : null"
                [class]="itemClasses()"
                (focus)="revealOnFocus($event)"
              >
                @if (item.icon; as icon) {
                  <ui-icon [name]="icon" size="sm" />
                }
                <span>{{ item.label }}</span>
                @if (item.badge !== undefined && item.badge !== null) {
                  <span
                    class="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-foreground"
                  >
                    {{ item.badge }}
                  </span>
                }
              </a>
            </li>
          }
        </ul>
      </div>

      @if (canScrollRight() && !isTouch()) {
        <button
          type="button"
          [attr.aria-label]="stepMode() ? 'Scroll one item right' : 'Scroll right'"
          [class]="arrowClasses('right')"
          (mouseenter)="startAutoScroll(1)"
          (mouseleave)="stopAutoScroll()"
          (focus)="stopAutoScroll()"
          (click)="onArrowClick(1)"
          (dblclick)="toggleMode()"
        >
          <ui-icon [name]="stepMode() ? chevronsRight : chevronRight" size="md" />
        </button>
      }
    </nav>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    /* The rail scrolls; the scrollbar itself is noise on a nav. Overflow is
       signalled by the edge fade and the arrows instead. */
    .ui-nav-rail {
      scrollbar-width: none;
      scroll-snap-type: x proximity;
      -webkit-overflow-scrolling: touch;
    }
    .ui-nav-rail::-webkit-scrollbar {
      display: none;
    }

    /* Active state carries weight AND colour, never colour alone (P3). The
       gold rule is the brand's hope accent doing the marking. */
    .ui-nav-active {
      font-weight: 600;
      color: hsl(var(--foreground));
      box-shadow: inset 0 -2px 0 0 hsl(var(--accent));
    }
  `,
})
export class UiScrollNavComponent {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reducedMotion = prefersReducedMotion();

  readonly items = input.required<readonly ScrollNavItem[]>();
  readonly ariaLabel = input<string>('Primary');

  private readonly rail = viewChild.required<ElementRef<HTMLElement>>('rail');

  private readonly mode = signal<ScrollNavMode>(this.readStoredMode());
  private readonly overflowLeft = signal(false);
  private readonly overflowRight = signal(false);

  /**
   * Items, each carrying how strictly its route should match.
   *
   * A destination whose route is a prefix of another destination's — /app
   * beside /app/applications — must match EXACTLY, or it stays active on every
   * child route and two links claim aria-current="page" at once. Everything
   * else matches by prefix, so /app/applications/123 still marks Applications
   * as current.
   *
   * Derived rather than configured: a consumer should not have to reason about
   * prefix collisions to get correct semantics out of a nav.
   */
  protected readonly entries = computed(() => {
    const all = this.items();
    return all.map((item) => ({
      ...item,
      matchOptions: {
        exact: all.some(
          (other) => other.route !== item.route && other.route.startsWith(`${item.route}/`),
        ),
      },
    }));
  });

  /** Auto-scroll is meaningless without a pointer, and unwanted under reduced motion. */
  protected readonly stepMode = computed(() => this.mode() === 'step' || this.reducedMotion());
  protected readonly canScrollLeft = computed(() => this.overflowLeft());
  protected readonly canScrollRight = computed(() => this.overflowRight());

  protected readonly chevronLeft = ChevronLeft as IconNode;
  protected readonly chevronRight = ChevronRight as IconNode;
  protected readonly chevronsLeft = ChevronsLeft as IconNode;
  protected readonly chevronsRight = ChevronsRight as IconNode;

  private frame: number | null = null;
  private observer: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      this.updateOverflow();
      this.observeResize();
    });
    this.destroyRef.onDestroy(() => {
      this.stopAutoScroll();
      this.observer?.disconnect();
    });
  }

  /**
   * Touch devices get native swipe scrolling, which is better than any arrow
   * we could build — so the arrows are simply not rendered there rather than
   * sitting unused next to a gesture that already works.
   */
  protected isTouch(): boolean {
    return this.document.defaultView?.matchMedia?.('(hover: none)').matches ?? false;
  }

  protected itemClasses(): string {
    return cn(
      'inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium',
      'text-muted-foreground transition-colors duration-150 hover:text-foreground',
      'outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring',
      'whitespace-nowrap',
    );
  }

  protected arrowClasses(side: 'left' | 'right'): string {
    return cn(
      'z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-md',
      'bg-background/90 text-muted-foreground hover:text-foreground',
      'outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring',
      side === 'left' ? 'mr-1' : 'ml-1',
    );
  }

  /** Recompute which arrows are warranted. Cheap; called on scroll and resize. */
  protected updateOverflow(): void {
    const el = this.rail().nativeElement;
    const max = el.scrollWidth - el.clientWidth;
    // A sub-pixel remainder is not overflow; without the tolerance an arrow
    // flickers on at the end of every scroll.
    this.overflowLeft.set(el.scrollLeft > 1);
    this.overflowRight.set(el.scrollLeft < max - 1);
  }

  /**
   * Bring a focused item into view.
   *
   * Without this, tabbing into an off-screen destination leaves focus on
   * something the user cannot see — the classic failure of a scrolling nav,
   * and the reason keyboard users usually avoid them.
   */
  protected revealOnFocus(event: FocusEvent): void {
    const target = event.target as HTMLElement | null;
    target?.scrollIntoView({
      behavior: this.reducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }

  protected startAutoScroll(direction: -1 | 1): void {
    // Under reduced motion, or in step mode, hovering does nothing — the click
    // is the interaction.
    if (this.stepMode()) {
      return;
    }
    this.stopAutoScroll();

    const el = this.rail().nativeElement;
    const step = () => {
      el.scrollLeft += direction * AUTO_SCROLL_SPEED;
      this.updateOverflow();
      this.frame = this.document.defaultView?.requestAnimationFrame(step) ?? null;
    };
    this.frame = this.document.defaultView?.requestAnimationFrame(step) ?? null;
  }

  protected stopAutoScroll(): void {
    if (this.frame !== null) {
      this.document.defaultView?.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  protected onArrowClick(direction: -1 | 1): void {
    if (!this.stepMode()) {
      return;
    }
    this.scrollByOneItem(direction);
  }

  /** Move exactly one item, measured from the rail rather than a magic number. */
  private scrollByOneItem(direction: -1 | 1): void {
    const el = this.rail().nativeElement;
    const first = el.querySelector('li') as HTMLElement | null;
    const distance = first ? first.offsetWidth + 8 : el.clientWidth / 2;
    el.scrollBy({
      left: direction * distance,
      behavior: this.reducedMotion() ? 'auto' : 'smooth',
    });
  }

  protected toggleMode(): void {
    // Under reduced motion the mode is forced to step, so offering a toggle
    // that cannot take effect would be a lie.
    if (this.reducedMotion()) {
      return;
    }
    this.stopAutoScroll();
    const next: ScrollNavMode = this.mode() === 'auto' ? 'step' : 'auto';
    this.mode.set(next);
    try {
      this.document.defaultView?.sessionStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Blocked storage: the mode still applies for this view, it simply is
      // not remembered. Never break navigation over a preference.
    }
  }

  private readStoredMode(): ScrollNavMode {
    try {
      return this.document.defaultView?.sessionStorage.getItem(MODE_STORAGE_KEY) === 'step'
        ? 'step'
        : 'auto';
    } catch {
      return 'auto';
    }
  }

  private observeResize(): void {
    const view = this.document.defaultView;
    // ResizeObserver is absent in some test and server environments; overflow
    // is still computed on scroll, so its absence degrades rather than throws.
    if (!view || typeof view.ResizeObserver === 'undefined') {
      return;
    }
    this.observer = new view.ResizeObserver(() => this.updateOverflow());
    this.observer.observe(this.rail().nativeElement);
  }
}
