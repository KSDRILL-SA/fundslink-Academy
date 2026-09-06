import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * PLACEHOLDER — replaced by the real marketing home in TASK 5
 * (marketing-site.md: hero, how-it-works, Enterprise Gateway sections).
 *
 * It exists only so the marketing shell has something to route to and the
 * routing skeleton can be verified end to end. It is intentionally content-free
 * rather than a half-written hero, so nobody mistakes it for the real page.
 */
@Component({
  selector: 'fl-marketing-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-prose px-4 py-24">
      <h1 class="text-4xl font-semibold tracking-tight">FundsLink Academy</h1>
      <p class="mt-4 text-lg text-muted-foreground">
        Funding South African students who fall through the NSFAS gap.
      </p>
    </section>
  `,
})
export class MarketingHomeComponent {}
