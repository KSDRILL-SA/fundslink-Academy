import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiRevealDirective } from './ui-reveal.directive';

@Component({
  standalone: true,
  imports: [UiRevealDirective],
  template: `<p uiReveal [uiRevealDelay]="40">Funding you can apply for</p>`,
})
class HostComponent {}

/**
 * The one rule this directive must never break: **content cannot stay
 * invisible.**
 *
 * The original implementation hid the element and waited for an
 * IntersectionObserver. If the observer never fired — an embedded web view
 * that throttles them, a print or screenshot path, a scroll container that
 * confuses the root — the element stayed at `opacity: 0` for the life of the
 * page. On this product that is several screens of blank where the reasons a
 * student should trust us are supposed to be.
 */
describe('uiReveal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** A constructible stand-in: `new IntersectionObserver(...)` must work. */
  function stubObserver(onConstruct?: (cb: (entries: unknown[]) => void) => void) {
    class StubObserver {
      constructor(callback: (entries: unknown[]) => void) {
        onConstruct?.(callback);
      }
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
      takeRecords(): unknown[] {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', StubObserver);
  }

  async function render() {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement.querySelector('p') as HTMLParagraphElement;
  }

  it('reveals on its own when the observer never fires', async () => {
    vi.useFakeTimers();
    // An observer that accepts the subscription and then says nothing — the
    // exact failure mode that left the page blank.
    stubObserver();

    const el = await render();
    vi.advanceTimersByTime(2000);

    expect(el.style.opacity).toBe('1');
    expect(el.style.transform).toBe('none');
  });

  it('never hides anything when there is no observer at all', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const el = await render();

    // Not "revealed" — never hidden in the first place. The element keeps the
    // appearance it rendered with.
    expect(el.style.opacity).not.toBe('0');
  });

  it('reveals when the element comes into view', async () => {
    const callbacks: ((entries: unknown[]) => void)[] = [];
    stubObserver((callback) => callbacks.push(callback));

    const el = await render();
    expect(callbacks).toHaveLength(1);
    callbacks[0]([{ isIntersecting: true }]);

    expect(el.style.opacity).toBe('1');
    expect(el.style.transform).toBe('none');
  });
});
