import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { UiLogoComponent } from 'ui';

/**
 * The sign-in / register shell.
 *
 * Deliberately the quietest surface in the product: logo, one card, nothing
 * else (navigation-and-shells.md §1, §3). No navigation rail, no footer links,
 * no theme toggle — someone signing in has one job, and every additional
 * choice on this screen is a way to not finish it.
 *
 * The calm navy ground is the brand's authority doing reassurance work at the
 * moment a student is handing over their identity.
 */
@Component({
  selector: 'fl-auth-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, UiLogoComponent],
  template: `
    <a class="skip-link" href="#main-content">Skip to content</a>

    <div
      class="fl-wash relative flex min-h-dvh flex-col items-center justify-center overflow-hidden
             px-4 py-12"
    >
      <!-- The Rising Door, at the size of a doorway, behind the card. The one
           piece of atmosphere this screen gets: it says whose building this is
           without adding anything to read. -->
      <span
        class="fl-arch-motif left-1/2 top-8 hidden h-[34rem] w-[34rem] -translate-x-1/2 sm:block"
        aria-hidden="true"
      ></span>

      <a
        routerLink="/"
        class="relative rounded-md outline-none focus-visible:outline-[3px]
               focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ui-logo size="lg" />
      </a>

      <main
        id="main-content"
        tabindex="-1"
        class="relative mt-8 w-full max-w-md outline-none"
      >
        <div class="fl-surface p-6 sm:p-8">
          <router-outlet />
        </div>
      </main>

      <p class="relative mt-8 text-sm text-muted-foreground">
        &copy; 2026 FundsLink Academy
      </p>
    </div>
  `,
})
export class AuthShellComponent {}
