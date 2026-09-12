import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FileText, House } from 'lucide';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type IconNode } from '../components/icon/ui-icon.component';
import { type ScrollNavItem, UiScrollNavComponent } from './ui-scroll-nav.component';
import { describeViolations, findA11yViolations } from 'ui/testing';

@Component({ standalone: true, template: '<p>home</p>' })
class StubPage {}

@Component({
  standalone: true,
  imports: [UiScrollNavComponent],
  template: `<ui-scroll-nav [items]="items()" [ariaLabel]="ariaLabel()" />`,
})
class HostComponent {
  readonly items = signal<readonly ScrollNavItem[]>([
    { label: 'Dashboard', route: '/app', icon: House as IconNode },
    { label: 'Applications', route: '/app/applications', icon: FileText as IconNode },
    { label: 'Notifications', route: '/app/notifications', badge: 3 },
  ]);
  readonly ariaLabel = signal('Primary');
}

describe('ui-scroll-nav (rendered)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>;

  const nav = () => fixture.nativeElement.querySelector('nav') as HTMLElement;
  const links = () => Array.from(nav().querySelectorAll('a')) as HTMLAnchorElement[];
  const arrows = () => Array.from(nav().querySelectorAll('button')) as HTMLButtonElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([{ path: '**', component: StubPage }])],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  describe('the accessibility contract (§2.2)', () => {
    it('is a landmark with an accessible name', () => {
      expect(nav()).toBeTruthy();
      expect(nav().getAttribute('aria-label')).toBe('Primary');
    });

    it('renders every destination as a real link, in Tab order', () => {
      // This is the whole story: the scroll behaviour is pointer convenience
      // layered on a plain list of links. A keyboard or screen-reader user
      // reaches everything regardless of scroll position.
      expect(links()).toHaveLength(3);
      for (const link of links()) {
        expect(link.getAttribute('href')).toBeTruthy();
        // No positive tabindex, and never removed from the tab order.
        expect(link.getAttribute('tabindex')).toBeNull();
      }
    });

    it('never hides a destination behind the arrows', () => {
      // The classic content trap: items only reachable by scrolling. Every
      // item is in the DOM and focusable from the start.
      const labels = links().map((a) => a.textContent?.trim().split(/\s+/)[0]);
      expect(labels).toEqual(['Dashboard', 'Applications', 'Notifications']);
    });

    it('renders a badge as text, not as colour alone', () => {
      const notifications = links()[2];
      expect(notifications.textContent).toContain('3');
    });

    it('gives every link a visible focus ring', () => {
      for (const link of links()) {
        expect(link.className).toContain('focus-visible:outline');
        expect(link.className).toContain('outline-ring');
      }
    });

    it('meets the 44px target floor on every link', () => {
      for (const link of links()) {
        expect(link.className).toContain('h-11');
      }
    });

    it('has no serious or critical accessibility violations', async () => {
      const failures = await findA11yViolations(fixture.nativeElement);
      expect(failures, describeViolations(failures)).toEqual([]);
    });
  });

  describe('scroll affordances', () => {
    it('shows no arrows when nothing overflows', () => {
      // jsdom reports zero dimensions, so scrollWidth === clientWidth and the
      // component correctly concludes there is nothing to scroll. An arrow
      // offered with nowhere to go is a lie about the interface.
      expect(arrows()).toHaveLength(0);
    });

    it('scrolls a focused item into view', () => {
      // Without this, tabbing to an off-screen destination leaves focus on
      // something invisible — the reason keyboard users avoid scrolling navs.
      const link = links()[2];
      const scrollIntoView = vi.fn();
      Object.defineProperty(link, 'scrollIntoView', { value: scrollIntoView });

      link.dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();

      expect(scrollIntoView).toHaveBeenCalledOnce();
      expect(scrollIntoView.mock.calls[0][0]).toMatchObject({
        block: 'nearest',
        inline: 'nearest',
      });
    });

    it('lets the rail scroll natively so touch keeps its momentum', () => {
      const rail = nav().querySelector('.ui-nav-rail') as HTMLElement;
      expect(rail.className).toContain('overflow-x-auto');
      // The rail, not the page, is what scrolls horizontally.
      expect(rail.className).toContain('min-w-0');
    });

    it('drops smooth scrolling under reduced motion', () => {
      const rail = nav().querySelector('.ui-nav-rail') as HTMLElement;
      expect(rail.className).toContain('motion-reduce:scroll-auto');
    });
  });

  describe('active state', () => {
    it('marks the current route with aria-current and a weight change, not colour alone', async () => {
      const router = TestBed.inject(await import('@angular/router').then((m) => m.Router));
      await router.navigateByUrl('/app/applications');
      fixture.detectChanges();

      const current = links().filter((a) => a.getAttribute('aria-current') === 'page');
      expect(current).toHaveLength(1);
      expect(current[0].textContent).toContain('Applications');
      // ui-nav-active carries font-weight AND the gold rule (P3).
      expect(current[0].classList.contains('ui-nav-active')).toBe(true);
    });

    it('keeps a section marked current on its child routes', async () => {
      // The prefix rule must fix the double-current bug WITHOUT breaking this:
      // a student opening one application is still inside Applications.
      const router = TestBed.inject(await import('@angular/router').then((m) => m.Router));
      await router.navigateByUrl('/app/applications/123');
      fixture.detectChanges();

      const current = links().filter((a) => a.getAttribute('aria-current') === 'page');
      expect(current).toHaveLength(1);
      expect(current[0].textContent).toContain('Applications');
    });

    it('does not mark the site root current on every page', async () => {
      // The marketing shell's shape: "/" beside "/how-it-works". Every path
      // starts with "/", so prefix matching lit Home on every page — two pills
      // current at once, which is what the Founder saw. The prefix rule above
      // cannot catch this one: no route starts with "//".
      const host = TestBed.createComponent(HostComponent);
      host.componentInstance.items.set([
        { label: 'Home', route: '/' },
        { label: 'How it works', route: '/how-it-works' },
        { label: 'About', route: '/about' },
      ]);
      host.detectChanges();

      const router = TestBed.inject(await import('@angular/router').then((m) => m.Router));
      await router.navigateByUrl('/how-it-works');
      host.detectChanges();

      const current = Array.from(
        host.nativeElement.querySelectorAll('a[aria-current="page"]'),
      ) as HTMLAnchorElement[];
      expect(current).toHaveLength(1);
      expect(current[0].textContent).toContain('How it works');
    });

    it('marks exactly one link as current, never two', async () => {
      // The defect this rule exists for: /app is a prefix of every other
      // destination, so prefix matching made Dashboard current everywhere and
      // two links claimed aria-current="page" at once.
      const router = TestBed.inject(await import('@angular/router').then((m) => m.Router));
      for (const url of ['/app', '/app/applications', '/app/notifications']) {
        await router.navigateByUrl(url);
        fixture.detectChanges();
        const current = links().filter((a) => a.getAttribute('aria-current') === 'page');
        expect(current, `${url} marked ${current.length} links current`).toHaveLength(1);
      }
    });
  });
});
