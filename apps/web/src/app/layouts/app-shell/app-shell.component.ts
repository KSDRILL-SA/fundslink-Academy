import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Bell, FileText, House, Search, Send } from 'lucide';
import {
  UiIconComponent,
  UiLogoComponent,
  UiScrollNavComponent,
  type IconNode,
  type ScrollNavItem,
} from 'ui';
import { ThemeToggleComponent } from '../../core/theme-toggle.component';

/**
 * The authenticated shell — student and admin.
 *
 * Shells are the only place headers, footers and navigation are composed
 * (navigation-and-shells.md §1). A feature that needs a header does not build
 * one; it routes through here.
 *
 * The header is sticky and its height is fixed, so the content below never
 * jumps when it gains its shadow on scroll (§5 — no CLS). The skip link is the
 * first thing in the tab order: without it, a keyboard user pays for the whole
 * navigation rail on every single page before reaching what they came for.
 */
@Component({
  selector: 'fl-app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    UiIconComponent,
    UiLogoComponent,
    UiScrollNavComponent,
    ThemeToggleComponent,
  ],
  template: `
    <a class="skip-link" href="#main-content">Skip to content</a>

    <div class="flex min-h-dvh flex-col bg-background">
      <header
        class="sticky top-0 z-40 h-16 shrink-0 border-b border-border bg-background/95 backdrop-blur"
      >
        <div class="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4">
          <a
            routerLink="/app"
            class="shrink-0 rounded-md outline-none focus-visible:outline-[3px]
                   focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ui-logo size="sm" [showWordmark]="false" />
            <span class="sr-only">FundsLink Academy — dashboard</span>
          </a>

          <ui-scroll-nav class="min-w-0 flex-1" [items]="navItems" ariaLabel="Primary" />

          <div class="flex shrink-0 items-center gap-1">
            <a
              routerLink="/app/notifications"
              class="relative inline-flex h-11 w-11 items-center justify-center rounded-md
                     text-muted-foreground outline-none hover:text-foreground
                     focus-visible:outline-[3px] focus-visible:outline-offset-2
                     focus-visible:outline-ring"
              aria-label="Notifications"
            >
              <ui-icon [name]="bellIcon" size="md" />
            </a>

            <fl-theme-toggle />
          </div>
        </div>
      </header>

      <main id="main-content" tabindex="-1" class="flex-1 outline-none">
        <div class="mx-auto max-w-[1400px] px-4 py-8">
          <router-outlet />
        </div>
      </main>

      <!-- Slim by design: the app is for doing, not for reading a footer (§4). -->
      <footer class="shrink-0 border-t border-border">
        <div
          class="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4
                 text-sm text-muted-foreground"
        >
          <span>&copy; 2026 FundsLink Academy</span>
          <a
            routerLink="/privacy"
            class="rounded-sm underline-offset-4 outline-none hover:underline
                   focus-visible:outline-[3px] focus-visible:outline-offset-2
                   focus-visible:outline-ring"
            >Privacy</a
          >
          <a
            routerLink="/help"
            class="rounded-sm underline-offset-4 outline-none hover:underline
                   focus-visible:outline-[3px] focus-visible:outline-offset-2
                   focus-visible:outline-ring"
            >Help</a
          >
        </div>
      </footer>
    </div>
  `,
})
export class AppShellComponent {
  protected readonly bellIcon = Bell as IconNode;

  /**
   * The student journey, in the order it is walked (ux-screen-map.md).
   * Admin destinations join this list when A01-A04 land and there is a role
   * signal to gate them with.
   */
  protected readonly navItems: readonly ScrollNavItem[] = [
    { label: 'Dashboard', route: '/app', icon: House as IconNode },
    { label: 'Applications', route: '/app/applications', icon: FileText as IconNode },
    { label: 'Bursaries', route: '/app/bursaries', icon: Search as IconNode },
    { label: 'Tracking', route: '/app/tracking', icon: Send as IconNode },
    { label: 'Notifications', route: '/app/notifications', icon: Bell as IconNode },
  ];
}
