import { DOCUMENT } from '@angular/common';
import { type Signal, inject, signal } from '@angular/core';

/**
 * Whether the viewer has asked for reduced motion, as a signal.
 *
 * Read live rather than once at construction: the preference can change while
 * the app is open (a system setting, or an assistive tool toggling it), and a
 * component that captured it at startup would keep animating for someone who
 * has since asked it to stop.
 *
 * base.css already flattens CSS transitions globally. This exists for the
 * behaviour CSS cannot reach — a requestAnimationFrame loop does not care what
 * a media query says, so the JavaScript has to ask.
 */
export function prefersReducedMotion(): Signal<boolean> {
  const document = inject(DOCUMENT);
  const query = document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  const reduced = signal(query?.matches ?? false);

  query?.addEventListener('change', (event) => reduced.set(event.matches));

  return reduced.asReadonly();
}
