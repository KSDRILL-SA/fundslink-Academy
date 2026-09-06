import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  inject,
  input,
} from '@angular/core';
import { prefersReducedMotion } from '../utils/reduced-motion';

/**
 * Reveals an element as it scrolls into view — fade plus a small rise.
 *
 * Two rules from design-system.md §5 are load-bearing here.
 *
 * **Reduced motion means the content is simply there.** Not a faster
 * animation, not a shorter distance — visible from the first paint, with the
 * observer never attached. Someone who asks for reduced motion because
 * movement makes them ill is not helped by a quicker version of the thing
 * that makes them ill.
 *
 * **It must fail visible, never invisible.** The starting state is applied by
 * this directive at runtime, so if the JavaScript never runs — a parse error,
 * an old browser, IntersectionObserver missing — the element keeps its normal
 * appearance. Doing it the usual way (hide in CSS, reveal in JS) means a
 * broken script leaves the entire page blank, which is the worst failure a
 * marketing site can have.
 */
@Directive({
  selector: '[uiReveal]',
  standalone: true,
})
export class UiRevealDirective {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reducedMotion = prefersReducedMotion();

  /** Stagger within a group: 30-50ms per step reads as one motion, not a queue. */
  readonly uiRevealDelay = input(0);

  private observer: IntersectionObserver | null = null;

  constructor() {
    afterNextRender(() => this.start());
    this.destroyRef.onDestroy(() => this.observer?.disconnect());
  }

  private start(): void {
    const el = this.host.nativeElement as HTMLElement;
    const view = this.document.defaultView;

    // Reduced motion, or no observer to watch with: leave the element exactly
    // as it renders. Nothing is hidden, so nothing can stay hidden.
    if (this.reducedMotion() || !view || typeof view.IntersectionObserver === 'undefined') {
      return;
    }

    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transitionProperty = 'opacity, transform';
    el.style.transitionDuration = '300ms';
    el.style.transitionTimingFunction = 'var(--ease-out)';
    el.style.transitionDelay = `${this.uiRevealDelay()}ms`;
    // The element is moving, so tell assistive tech nothing about it changed —
    // this is decoration, not content arriving.
    el.style.willChange = 'opacity, transform';

    this.observer = new view.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          el.style.opacity = '1';
          el.style.transform = 'none';
          // Reveal once. Re-animating on every scroll past is the thing that
          // makes a page feel restless rather than considered.
          this.observer?.disconnect();
          this.observer = null;
          // Release the compositor hint once the animation is done.
          el.addEventListener('transitionend', () => (el.style.willChange = 'auto'), {
            once: true,
          });
        }
      },
      // Start slightly before the element is fully on screen, so it has
      // finished arriving by the time it is properly in view.
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );

    this.observer.observe(el);
  }
}
