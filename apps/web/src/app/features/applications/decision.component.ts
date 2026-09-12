import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowRight, HeartHandshake, PartyPopper, Search } from 'lucide';
import {
  UiButtonComponent,
  UiCardComponent,
  UiIconComponent,
  UiIconTileComponent,
  type IconNode,
} from 'ui';

/** The decision statuses this screen renders, and nothing else. */
const APPROVED = 'APPROVED';
const WAITLISTED = 'APPROVED_WAITLISTED';

/**
 * S16 — the decision screens.
 *
 * Blocked since the build began (#220) and unblocked by the L4 ruling that added
 * `decision_reason`, `decided_at` and `waitlist_position` to the contract. Until then a student
 * opening their decision saw a status chip and nothing else, because the reviewer's words —
 * written, stored, and required by A03 to be at least forty of them with a concrete next step —
 * had no channel to travel back through.
 *
 * **S16-REJ is the screen this product is judged by.** Its structure is locked in
 * ux-screen-map.md §3 and is followed here in order:
 *
 *   1. the decision, plainly, in the first line — never buried;
 *   2. the human-written reason, verbatim, never summarised or auto-generated;
 *   3. immediately, the doors that are still open (P2 — never a dead end);
 *   4. a sign-off from a person.
 *
 * And what is forbidden is forbidden here: no "Unfortunately" opener, no exclamation marks, no
 * red, no "rejected" about a person, and no link that loops back to the thing that just closed.
 *
 * S16-WAIT tells the truth it actually has. The design sentence imagines "the pool can fund N
 * students and you are position #K"; there is no N — this system holds no funding capacity — so
 * the screen gives the position, says plainly what the position means, and promises only the
 * notification it can keep.
 */
@Component({
  selector: 'fl-decision',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiCardComponent, UiButtonComponent, UiIconComponent, UiIconTileComponent],
  template: `
    @switch (variant()) {
      <!-- ---------------- Approved ---------------- -->
      @case ('approved') {
        <ui-card variant="highlight" padding="lg">
          <ui-icon-tile [icon]="icons.approved" tone="success" size="lg" />
          <h1 class="fl-display mt-5 text-3xl">Your funding has been approved</h1>
          <p class="fl-lead mt-3 max-w-prose">
            A reviewer read your application and approved it{{ decidedOn() }}.
          </p>

          @if (reason(); as words) {
            <section class="mt-6" aria-labelledby="reason-heading">
              <h2 id="reason-heading" class="fl-caption">In the reviewer's words</h2>
              <p class="mt-2 max-w-prose whitespace-pre-line text-lg">{{ words }}</p>
            </section>
          }

          <p class="mt-6 max-w-prose text-muted-foreground">
            We will be in touch about what happens next. Nothing further is needed from you right
            now.
          </p>
        </ui-card>
      }

      <!-- ---------------- Waitlisted ---------------- -->
      @case ('waitlisted') {
        <ui-card variant="highlight" padding="lg">
          <ui-icon-tile [icon]="icons.waitlisted" tone="gold" size="lg" />
          <h1 class="fl-display mt-5 text-3xl">You qualify</h1>

          @if (position(); as place) {
            <!-- The live number the whole screen exists for (E4). -->
            <p class="fl-lead mt-3 max-w-prose">
              You are number <span class="tabular font-semibold text-foreground">{{ place }}</span>
              on the waitlist, counted by when each application was waitlisted.
            </p>
          } @else {
            <p class="fl-lead mt-3 max-w-prose">You are on the waitlist.</p>
          }

          <p class="mt-4 max-w-prose text-muted-foreground">
            That means a reviewer decided your application deserves funding and there was not
            enough available when they reached it. As donations arrive we fund down the list. We
            will tell you the moment your position changes — you do not need to check.
          </p>

          @if (reason(); as words) {
            <section class="mt-6" aria-labelledby="wait-reason-heading">
              <h2 id="wait-reason-heading" class="fl-caption">In the reviewer's words</h2>
              <p class="mt-2 max-w-prose whitespace-pre-line text-lg">{{ words }}</p>
            </section>
          }

          <!-- A door, because waiting is not the only thing they can do (P2). -->
          <div class="mt-8 flex flex-wrap gap-3">
            <a routerLink="/app/matches" class="inline-flex">
              <ui-button variant="secondary">
                See bursaries matched to you
                <ui-icon [name]="icons.arrow" size="sm" />
              </ui-button>
            </a>
          </div>
        </ui-card>
      }

      <!-- ---------------- Not funded (S16-REJ) ---------------- -->
      @case ('declined') {
        <ui-card padding="lg">
          <!-- 1. The decision, plainly, first. No "Unfortunately", no burying. -->
          <h1 class="fl-display text-3xl">We cannot fund this application</h1>
          <p class="fl-lead mt-3 max-w-prose">
            A person read your application in full and made this decision{{ decidedOn() }}. It is
            not a judgement of you, and it does not close the other doors below.
          </p>

          <!-- 2. The human-written reason. Verbatim. The substance of the decision. -->
          @if (reason(); as words) {
            <section class="mt-8" aria-labelledby="decline-reason-heading">
              <h2 id="decline-reason-heading" class="fl-caption">Why, in the reviewer's words</h2>
              <blockquote
                class="mt-3 max-w-prose whitespace-pre-line border-l-4 border-l-accent
                       bg-secondary/40 py-4 pl-5 pr-4 text-lg"
              >
                {{ words }}
              </blockquote>
            </section>
          } @else {
            <!-- Should not happen: A03 refuses a decline without written reasons. If it ever
                 does, say so plainly rather than showing an empty space where a person's
                 explanation belongs. -->
            <p class="mt-8 max-w-prose rounded-lg bg-secondary/60 p-4 text-muted-foreground">
              The reviewer's reasons are not showing here. That is our fault, not yours — please
              contact us and we will send them to you.
            </p>
          }

          <!-- 3. Immediately, the doors that remain open (P2). -->
          <section class="mt-10" aria-labelledby="next-heading">
            <h2 id="next-heading" class="text-xl font-semibold tracking-tight">
              What you can do from here
            </h2>

            <ul class="mt-5 grid gap-4 sm:grid-cols-2">
              <li class="fl-surface flex h-full flex-col p-5">
                <ui-icon-tile [icon]="icons.matches" tone="gold" />
                <p class="mt-4 font-semibold">Bursaries matched to your profile</p>
                <p class="mt-1 flex-1 text-sm text-muted-foreground">
                  Your profile is already complete, so these are ready to apply to now.
                </p>
                <a routerLink="/app/matches" class="mt-4 inline-flex">
                  <ui-button variant="secondary" size="sm">See my matches</ui-button>
                </a>
              </li>

              <li class="fl-surface flex h-full flex-col p-5">
                <ui-icon-tile [icon]="icons.appeal" tone="navy" />
                <p class="mt-4 font-semibold">Ask us to look again</p>
                <p class="mt-1 flex-1 text-sm text-muted-foreground">
                  If something was missing, wrong, or has changed, a different reviewer will read
                  it again. You have one appeal.
                </p>
                <p class="mt-4 text-sm text-muted-foreground">The form is below.</p>
              </li>
            </ul>

            <p class="mt-6 max-w-prose text-muted-foreground">
              You are also welcome to apply again at the next intake. Nothing about this decision
              counts against a future application.
            </p>
          </section>

          <!-- 4. Signed by a person. -->
          <p class="mt-10 text-muted-foreground">— Reviewed with care by the FundsLink team.</p>
        </ui-card>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class DecisionComponent {
  readonly status = input.required<string>();
  readonly reason = input<string | null>(null);
  readonly decidedAt = input<string | null>(null);
  readonly position = input<number | null>(null);

  protected readonly icons = {
    approved: PartyPopper as IconNode,
    waitlisted: HeartHandshake as IconNode,
    matches: Search as IconNode,
    appeal: HeartHandshake as IconNode,
    arrow: ArrowRight as IconNode,
  };

  protected readonly variant = computed(() => {
    const status = this.status();
    if (status === APPROVED) {
      return 'approved';
    }
    if (status === WAITLISTED) {
      return 'waitlisted';
    }
    return 'declined';
  });

  /** " on 3 March 2026", or nothing at all rather than a broken date. */
  protected readonly decidedOn = computed(() => {
    const iso = this.decidedAt();
    if (!iso) {
      return '';
    }
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    return ` on ${parsed.toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}`;
  });
}
