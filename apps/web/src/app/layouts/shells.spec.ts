import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describeViolations, findA11yViolations } from 'ui/testing';
import { describe, expect, it } from 'vitest';
import { AppShellComponent } from './app-shell/app-shell.component';
import { AuthShellComponent } from './auth-shell/auth-shell.component';
import { MarketingShellComponent } from './marketing-shell/marketing-shell.component';

@Component({ standalone: true, template: '<p>routed content</p>' })
class StubPage {}

async function render(shell: unknown) {
  await TestBed.configureTestingModule({
    imports: [shell as never],
    providers: [provideRouter([{ path: '**', component: StubPage }])],
  }).compileComponents();
  const fixture = TestBed.createComponent(shell as never);
  fixture.detectChanges();
  return fixture;
}

/**
 * Every shell owes the same structural contract, so it is asserted the same
 * way for all three. These are the things that make a page navigable rather
 * than merely visible, and all of them are invisible in a screenshot.
 */
const SHELLS = [
  { name: 'app-shell', component: AppShellComponent },
  { name: 'marketing-shell', component: MarketingShellComponent },
  { name: 'auth-shell', component: AuthShellComponent },
] as const;

describe.each(SHELLS)('$name (rendered)', ({ component }) => {
  it('offers a skip link as the first focusable element', async () => {
    // Without it, a keyboard user pays for the whole header on every single
    // page before reaching what they came for.
    const fixture = await render(component);
    const first = fixture.nativeElement.querySelector('a, button') as HTMLAnchorElement;
    expect(first.classList.contains('skip-link')).toBe(true);
    expect(first.getAttribute('href')).toBe('#main-content');
  });

  it('points the skip link at a real, focusable main landmark', async () => {
    // A skip link aimed at nothing is worse than none: it moves focus into the
    // void and the user cannot tell it happened.
    const fixture = await render(component);
    const main = fixture.nativeElement.querySelector('main#main-content') as HTMLElement;
    expect(main).toBeTruthy();
    expect(main.getAttribute('tabindex')).toBe('-1');
  });

  it('renders exactly one main landmark', async () => {
    const fixture = await render(component);
    expect(fixture.nativeElement.querySelectorAll('main')).toHaveLength(1);
  });

  it('renders the routed content through an outlet', async () => {
    const fixture = await render(component);
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });

  it('has no serious or critical accessibility violations', async () => {
    const fixture = await render(component);
    const failures = await findA11yViolations(fixture.nativeElement);
    expect(failures, describeViolations(failures)).toEqual([]);
  });
});

describe('app-shell', () => {
  it('names every navigation landmark so they are distinguishable', async () => {
    const fixture = await render(AppShellComponent);
    const navs = Array.from(fixture.nativeElement.querySelectorAll('nav')) as HTMLElement[];
    expect(navs.length).toBeGreaterThan(0);
    for (const nav of navs) {
      expect(nav.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('gives the icon-only controls accessible names', async () => {
    const fixture = await render(AppShellComponent);
    const notifications = fixture.nativeElement.querySelector('a[aria-label="Notifications"]');
    expect(notifications).toBeTruthy();
    const themeToggle = fixture.nativeElement.querySelector('fl-theme-toggle button');
    expect(themeToggle?.getAttribute('aria-label')).toContain('Theme');
  });

  it('reserves the header height so content cannot jump on scroll', async () => {
    // The header gains a shadow on scroll; if its height were content-driven,
    // that would shift the page (§5, CLS).
    const fixture = await render(AppShellComponent);
    const header = fixture.nativeElement.querySelector('header') as HTMLElement;
    expect(header.className).toContain('h-16');
    expect(header.className).toContain('sticky');
  });
});

describe('marketing-shell', () => {
  it('names each footer column navigation so they are not four anonymous lists', async () => {
    const fixture = await render(MarketingShellComponent);
    const footerNavs = Array.from(
      fixture.nativeElement.querySelectorAll('footer nav'),
    ) as HTMLElement[];
    expect(footerNavs.length).toBe(3);
    expect(footerNavs.map((n) => n.getAttribute('aria-label'))).toEqual([
      'Platform',
      'Trust',
      'Connect',
    ]);
  });

  it('surfaces POPIA and the Information Officer without hunting', async () => {
    // A platform handling money and the personal data of vulnerable people
    // puts these where a visitor can find them, not in the small print.
    const fixture = await render(MarketingShellComponent);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Privacy & POPIA');
    expect(text).toContain('Information Officer');
  });

  it('sends Sign in and Apply to the auth shell, not the old top-level routes', async () => {
    const fixture = await render(MarketingShellComponent);
    const hrefs = Array.from(fixture.nativeElement.querySelectorAll('a')).map((a) =>
      (a as HTMLAnchorElement).getAttribute('href'),
    );
    expect(hrefs).toContain('/auth/login');
    expect(hrefs).toContain('/auth/register');
  });
});

describe('auth-shell', () => {
  it('stays quiet — no navigation rail to distract someone signing in', async () => {
    const fixture = await render(AuthShellComponent);
    expect(fixture.nativeElement.querySelector('ui-scroll-nav')).toBeNull();
    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
  });
});
