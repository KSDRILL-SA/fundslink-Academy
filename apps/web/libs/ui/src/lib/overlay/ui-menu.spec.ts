import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type MenuItem, UiMenuComponent } from './ui-menu.component';

@Component({ standalone: true, template: '<p>destination</p>' })
class StubPage {}

@Component({
  standalone: true,
  imports: [UiMenuComponent],
  template: `
    <ui-menu ariaLabel="Your account" [items]="items()" (selected)="chosen.set($event.id)">
      <span>Menu</span>
    </ui-menu>
  `,
})
class HostComponent {
  readonly items = signal<readonly MenuItem[]>([
    { id: 'profile', label: 'Your profile', route: '/profile' },
    { id: 'account', label: 'Account & security', route: '/account' },
    { id: 'signout', label: 'Sign out', danger: true, separated: true },
  ]);
  readonly chosen = signal<string | null>(null);
}

/**
 * The menu-button pattern, tested where it actually breaks.
 *
 * A menu is the component most often shipped broken: it opens on click, looks
 * right, and is unusable without a mouse. Every test here is a way that
 * happens — no focus on open, no way to close with a key, focus stranded after
 * closing, items that are not menu items.
 *
 * This landed a PR late: the component shipped in the account-menu work with
 * only indirect coverage, and I said in that review it needed its own spec.
 */
describe('ui-menu', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>;

  const el = () => fixture.nativeElement as HTMLElement;
  const trigger = () => el().querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
  const menu = () => el().querySelector('[role="menu"]') as HTMLElement | null;
  const items = () => Array.from(el().querySelectorAll('[role="menuitem"]')) as HTMLElement[];

  /** Frame callbacks the component has queued, not yet run. */
  let frames: FrameRequestCallback[] = [];

  /**
   * Run whatever the component queued for the next frame.
   *
   * Ordering matters and got this test wrong first: the component opens the
   * menu and asks for a frame in the same tick, but the items do not exist
   * until change detection has run. A stub that invokes the callback
   * immediately therefore focuses nothing — which is the browser behaviour it
   * is supposed to be standing in for, inverted.
   */
  function flushFrame(): void {
    const queued = frames;
    frames = [];
    for (const callback of queued) {
      callback(0);
    }
    fixture.detectChanges();
  }

  function press(target: Element, key: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
    flushFrame();
  }

  beforeEach(async () => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([{ path: '**', component: StubPage }])],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  describe('the trigger', () => {
    it('is a button that says it opens a menu', () => {
      expect(trigger()).toBeTruthy();
      expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
      expect(trigger().getAttribute('aria-label')).toBe('Your account');
    });

    it('keeps nothing in the DOM while closed', () => {
      // A hidden menu that is still in the accessibility tree is a menu a
      // screen-reader user finds and cannot use.
      expect(menu()).toBeNull();
      expect(items()).toHaveLength(0);
    });
  });

  describe('opening', () => {
    it('opens on click and marks itself expanded', () => {
      trigger().click();
      fixture.detectChanges();

      expect(menu()).toBeTruthy();
      expect(trigger().getAttribute('aria-expanded')).toBe('true');
      expect(menu()?.getAttribute('aria-labelledby')).toBe(trigger().id);
    });

    it('moves focus onto the first item — a menu nobody is inside is not open', () => {
      press(trigger(), 'ArrowDown');
      expect(document.activeElement).toBe(items()[0]);
    });

    it('opens on the last item with ArrowUp', () => {
      press(trigger(), 'ArrowUp');
      const all = items();
      expect(document.activeElement).toBe(all[all.length - 1]);
    });

    it('renders every entry as a menu item', () => {
      trigger().click();
      fixture.detectChanges();
      expect(items()).toHaveLength(3);
      // One tab stop: the items are reached with arrows, not with Tab.
      for (const item of items()) {
        expect(item.getAttribute('tabindex')).toBe('-1');
      }
    });
  });

  describe('the keyboard model', () => {
    beforeEach(() => {
      press(trigger(), 'ArrowDown');
    });

    it('moves with the arrows and wraps at both ends', () => {
      const all = items();
      press(all[0], 'ArrowDown');
      expect(document.activeElement).toBe(all[1]);

      press(all[1], 'ArrowUp');
      expect(document.activeElement).toBe(all[0]);

      // Wrapping means a user never has to know how long the list is.
      press(all[0], 'ArrowUp');
      expect(document.activeElement).toBe(all[all.length - 1]);
    });

    it('jumps to the ends with Home and End', () => {
      const all = items();
      press(all[0], 'End');
      expect(document.activeElement).toBe(all[all.length - 1]);

      press(all[all.length - 1], 'Home');
      expect(document.activeElement).toBe(all[0]);
    });

    it('closes on Escape and gives focus back to the trigger', () => {
      // The failure this prevents: dismissing a menu and being left with focus
      // on nothing, with no way back except the mouse.
      press(items()[0], 'Escape');
      expect(menu()).toBeNull();
      expect(document.activeElement).toBe(trigger());
    });

    it('closes on Tab, because tabbing out is a decision to leave', () => {
      press(items()[0], 'Tab');
      expect(menu()).toBeNull();
    });
  });

  describe('choosing', () => {
    it('emits the item and closes', () => {
      press(trigger(), 'ArrowDown');
      const signOut = items().find((item) => item.textContent?.includes('Sign out')) as HTMLElement;
      signOut.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.chosen()).toBe('signout');
      expect(menu()).toBeNull();
    });

    it('renders a route entry as a link, so it can be opened in a new tab', () => {
      // A router-navigating button breaks middle-click and "open in new tab",
      // and is announced as the wrong thing.
      trigger().click();
      fixture.detectChanges();
      const profile = items().find((item) => item.textContent?.includes('Your profile'));
      expect(profile?.tagName).toBe('A');
      expect(profile?.getAttribute('href')).toBe('/profile');
    });

    it('closes when a click lands outside it', () => {
      trigger().click();
      fixture.detectChanges();
      document.body.click();
      fixture.detectChanges();
      expect(menu()).toBeNull();
    });
  });

  it('has no serious or critical accessibility violations while open', async () => {
    trigger().click();
    fixture.detectChanges();
    const failures = await findA11yViolations(fixture.nativeElement);
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});
