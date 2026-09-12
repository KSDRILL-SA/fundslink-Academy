import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { UiButtonComponent, UiLogoComponent, UiScrollNavComponent, type ScrollNavItem } from 'ui';
import { ThemeToggleComponent } from '../../core/theme-toggle.component';

/**
 * The public shell.
 *
 * Uses the same `ui-scroll-nav` as the app (§2.3 — one interaction model
 * everywhere), so a visitor who becomes a student does not have to relearn how
 * navigation behaves the moment they sign in.
 *
 * Two calls to action, deliberately unequal: **Sign in** is quiet because
 * returning users know where it is, and **Apply** carries the gold accent
 * because it is the hope-moment this whole site exists to reach
 * (design-system.md §2 — gold lifts the human moments).
 */
@Component({
  selector: 'fl-marketing-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    UiLogoComponent,
    UiScrollNavComponent,
    UiButtonComponent,
    ThemeToggleComponent,
  ],
  template: `
    <a class="skip-link" href="#main-content">Skip to content</a>

    <div class="flex min-h-dvh flex-col bg-background">
      <header class="fl-glass sticky top-0 z-40 h-16 shrink-0 border-x-0 border-t-0">
        <div class="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4">
          <a
            routerLink="/"
            class="shrink-0 rounded-md outline-none focus-visible:outline-[3px]
                   focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ui-logo variant="plate" size="sm" />
          </a>

          <ui-scroll-nav class="min-w-0 flex-1" [items]="navItems" ariaLabel="Site" />

          <div class="flex shrink-0 items-center gap-2">
            <fl-theme-toggle />
            <a
              routerLink="/auth/login"
              class="hidden h-11 items-center rounded-md px-4 text-sm font-medium
                     text-foreground outline-none hover:bg-secondary
                     focus-visible:outline-[3px] focus-visible:outline-offset-2
                     focus-visible:outline-ring sm:inline-flex"
              >Sign in</a
            >
            <a routerLink="/auth/register" class="inline-flex">
              <ui-button variant="accent" size="sm">Apply</ui-button>
            </a>
          </div>
        </div>
      </header>

      <main id="main-content" tabindex="-1" class="flex-1 outline-none">
        <router-outlet />
      </main>

      <footer class="shrink-0 border-t border-border bg-secondary/40">
        <div class="mx-auto max-w-[1400px] px-4 py-12">
          <div class="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <ui-logo variant="plate" size="md" />
              <p class="mt-4 max-w-prose-narrow text-sm text-muted-foreground">
                Funding South African students who fall through the NSFAS gap.
              </p>
            </div>

            @for (column of footerColumns; track column.title) {
              <nav [attr.aria-label]="column.title">
                <h2 class="text-sm font-semibold text-foreground">{{ column.title }}</h2>
                <ul class="mt-4 space-y-3">
                  @for (link of column.links; track link.route) {
                    <li>
                      <a
                        [routerLink]="link.route"
                        class="rounded-sm text-sm text-muted-foreground underline-offset-4
                               outline-none hover:text-foreground hover:underline
                               focus-visible:outline-[3px] focus-visible:outline-offset-2
                               focus-visible:outline-ring"
                        >{{ link.label }}</a
                      >
                    </li>
                  }
                </ul>
              </nav>
            }
          </div>

          <!-- A named slot so a page can add its own band here — the "Need help?
               Talk to us" strip on the decision screen, for instance (§4, P2). -->
          <ng-content select="[footer-extra]" />

          <div
            class="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-6
                   text-sm text-muted-foreground"
          >
            <span>&copy; 2026 FundsLink Academy</span>
            <span>A non-profit funding South African students.</span>
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class MarketingShellComponent {
  protected readonly navItems: readonly ScrollNavItem[] = [
    { label: 'Home', route: '/' },
    { label: 'How it works', route: '/how-it-works' },
    { label: 'For students', route: '/for-students' },
    { label: 'For donors', route: '/for-donors' },
    { label: 'About', route: '/about' },
  ];

  /**
   * Four columns per §4. Trust is its own column rather than a line in the
   * small print: on a platform handling money and the personal data of
   * vulnerable people, POPIA and the Information Officer are things a visitor
   * should be able to find without hunting.
   */
  protected readonly footerColumns = [
    {
      title: 'Platform',
      links: [
        { label: 'How it works', route: '/how-it-works' },
        { label: 'For students', route: '/for-students' },
        { label: 'For donors', route: '/for-donors' },
        { label: 'Browse bursaries', route: '/bursaries' },
      ],
    },
    {
      title: 'Trust',
      links: [
        { label: 'Privacy & POPIA', route: '/privacy' },
        { label: 'Information Officer', route: '/information-officer' },
        { label: 'Terms', route: '/terms' },
        { label: 'Contact', route: '/contact' },
      ],
    },
    {
      title: 'Connect',
      links: [
        { label: 'Contact us', route: '/contact' },
        { label: 'Help', route: '/help' },
      ],
    },
  ] as const;
}
