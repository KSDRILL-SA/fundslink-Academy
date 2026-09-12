import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
// Narrow entry, not the 'auth' barrel: the barrel re-exports the five auth
// screens, and this shell loads on every authenticated route (see #210).
import { AuthService } from 'auth/session';
import { Bell, FileText, House, LogOut, Search, Send, ShieldCheck, UserRound } from 'lucide';
import {
  UiAvatarComponent,
  UiIconComponent,
  UiLogoComponent,
  UiMenuComponent,
  UiScrollNavComponent,
  type IconNode,
  type MenuItem,
  type ScrollNavItem,
} from 'ui';
import { ShellSignalsService } from '../../core/shell-signals.service';
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
    UiAvatarComponent,
    UiIconComponent,
    UiLogoComponent,
    UiMenuComponent,
    UiScrollNavComponent,
    ThemeToggleComponent,
  ],
  template: `
    <a class="skip-link" href="#main-content">Skip to content</a>

    <div class="fl-wash flex min-h-dvh flex-col">
      <!-- Glass, not a flat bar: the header sits OVER the page wash, so the
           content scrolling beneath it stays faintly visible. h-16 is fixed so
           the page cannot jump when the shadow appears (§5, CLS). -->
      <header class="fl-glass sticky top-0 z-40 h-16 shrink-0 border-x-0 border-t-0">
        <div class="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4">
          <a
            routerLink="/app"
            class="shrink-0 rounded-md outline-none focus-visible:outline-[3px]
                   focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ui-logo variant="plate" size="sm" [showWordmark]="false" />
            <span class="sr-only">FundsLink Academy — dashboard</span>
          </a>

          <span class="h-6 w-px shrink-0 bg-border" aria-hidden="true"></span>

          <ui-scroll-nav class="min-w-0 flex-1" [items]="navItems" ariaLabel="Primary" />

          <div class="flex shrink-0 items-center gap-1">
            <a
              routerLink="/app/notifications"
              class="relative inline-flex h-11 w-11 items-center justify-center rounded-full
                     text-muted-foreground outline-none transition-colors hover:bg-card
                     hover:text-foreground focus-visible:outline-[3px]
                     focus-visible:outline-offset-2 focus-visible:outline-ring
                     motion-reduce:transition-none"
              [attr.aria-label]="
                notices() > 0 ? 'Notifications, ' + notices() + ' waiting' : 'Notifications'
              "
            >
              <ui-icon [name]="bellIcon" size="md" />
              @if (notices() > 0) {
                <!-- The count is in the accessible name above; this dot is
                     decoration, so it never carries the meaning alone (P3). -->
                <span
                  class="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-accent
                         ring-2 ring-background"
                  aria-hidden="true"
                ></span>
              }
            </a>

            <fl-theme-toggle />

            <!--
              The account menu.

              Until now the avatar linked to the profile page and there was no
              way to sign out from anywhere in this product — the endpoint
              existed and nothing called it. A session that cannot be ended is
              a security problem on a shared or borrowed device, which is most
              devices for the people this platform serves.
            -->
            <ui-menu
              class="ml-1"
              ariaLabel="Your account"
              triggerClass="h-11 px-1 hover:bg-card transition-colors motion-reduce:transition-none"
              [items]="accountMenu"
              (selected)="onAccountAction($event)"
            >
              <ui-avatar [name]="displayName()" size="md" />
            </ui-menu>
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
  private readonly shell = inject(ShellSignalsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly bellIcon = Bell as IconNode;

  protected readonly accountMenu: readonly MenuItem[] = [
    { id: 'profile', label: 'Your profile', icon: UserRound as IconNode, route: '/app/profile' },
    {
      id: 'account',
      label: 'Account & security',
      hint: 'Password and two-factor',
      icon: ShieldCheck as IconNode,
      route: '/app/account',
    },
    {
      id: 'privacy',
      label: 'Data & privacy',
      icon: FileText as IconNode,
      route: '/app/privacy',
    },
    {
      id: 'signout',
      label: 'Sign out',
      icon: LogOut as IconNode,
      danger: true,
      separated: true,
    },
  ];

  /**
   * End the session.
   *
   * The server call clears the refresh cookie; `AuthService.logout` clears the
   * in-memory access token. The redirect happens either way — if the request
   * fails, the token is still gone from this browser, and leaving someone
   * signed in because a network call failed would be the wrong way round on a
   * shared device.
   */
  protected onAccountAction(item: MenuItem): void {
    if (item.id !== 'signout') {
      return;
    }
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl('/'),
      error: () => void this.router.navigateByUrl('/'),
    });
  }
  protected readonly notices = this.shell.noticeCount;
  protected readonly displayName = this.shell.displayName;

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
