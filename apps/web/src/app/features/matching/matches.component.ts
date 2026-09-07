import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService, type Page, type Schema } from 'data-access';
import { Info } from 'lucide';
import {
  UiButtonComponent,
  UiCardComponent,
  UiEmptyStateComponent,
  UiErrorStateComponent,
  UiIconComponent,
  UiSkeletonComponent,
  type IconNode,
} from 'ui';
import { asyncState } from '../../core/async-state';

type Match = Schema<'Match'>;

/**
 * S17 — Matches. Advisory, and said so out loud.
 *
 * Matching suggests; it never decides funding (ADR-0007, BR-M02). Three rules
 * follow from that and each is a line on this screen rather than a comment in
 * a design doc:
 *
 * **Browse-all keeps equal prominence** (BR-M02). A student who does not trust
 * the algorithm, or whose profile is thin, must be able to see everything
 * without hunting — so the link to the full list sits at the top, not below
 * the results as a consolation.
 *
 * **The score is never a percentage.** `score` is a 0-1 ordering signal, and
 * rendering it as "87% match" reads as a probability of being funded, which is
 * exactly what it is not. It orders the list and otherwise stays out of sight.
 *
 * **A degraded result set is disclosed** (S8.51, §4). When the API returns
 * `mode: FALLBACK` the screen says so plainly. Silently serving rule-based
 * results as if they were the real thing is a lie of omission about how the
 * list was made.
 */
@Component({
  selector: 'fl-matches',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiCardComponent,
    UiButtonComponent,
    UiSkeletonComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
    UiIconComponent,
  ],
  template: `
    <h1 class="text-2xl font-semibold tracking-tight">Bursaries that suit you</h1>
    <p class="mt-2 max-w-prose text-muted-foreground">
      Suggestions based on your profile. They are a starting point, not a decision — and you can
      apply to anything on the full list whether it appears here or not.
    </p>

    <!-- Equal prominence, above the results rather than under them (BR-M02). -->
    <div class="mt-6">
      <a routerLink="/app/bursaries" class="inline-flex">
        <ui-button variant="secondary">Browse every bursary</ui-button>
      </a>
    </div>

    @if (isFallback()) {
      <!-- S8.51 — the degraded state, named. -->
      <div class="mt-6 flex items-start gap-3 rounded-lg border border-border bg-secondary/50 p-4">
        <span class="mt-0.5 text-muted-foreground">
          <ui-icon [name]="infoIcon" size="md" />
        </span>
        <p class="text-sm text-muted-foreground">
          Smart matching is resting — showing rule-based results. These are still real bursaries you
          can apply to; the ordering is simply less tailored than usual.
        </p>
      </div>
    }

    @switch (state().status) {
      @case ('loading') {
        <div class="mt-8 flex flex-col gap-4">
          @for (row of [1, 2, 3]; track row) {
            <ui-skeleton class="h-28 w-full" shape="block" />
          }
        </div>
        <p class="sr-only" role="status">Finding bursaries that suit you.</p>
      }

      @case ('error') {
        <ui-error-state class="mt-8" [code]="state().errorCode" (retry)="load()" />
      }

      @case ('empty') {
        <ui-empty-state
          class="mt-8"
          title="No suggestions yet"
          message="Once your profile has a bit more in it, we can suggest bursaries that fit. In the meantime the full list is open to you."
          actionLabel="Browse every bursary"
          (action)="browseAll()"
        />
      }

      @case ('success') {
        <ul class="mt-8 flex flex-col gap-4">
          @for (match of matches(); track match.id) {
            <li>
              <ui-card variant="interactive">
                <h2 class="text-lg font-semibold">
                  <a
                    [href]="match.bursary.source_url || null"
                    rel="noopener noreferrer"
                    target="_blank"
                    class="rounded-sm underline-offset-4 outline-none hover:underline
                           focus-visible:outline-[3px] focus-visible:outline-offset-2
                           focus-visible:outline-ring"
                    >{{ match.bursary.name }}</a
                  >
                </h2>
                <p class="mt-1 text-sm text-muted-foreground">{{ match.bursary.provider }}</p>

                @if (match.reasoning_summary) {
                  <p class="mt-3 max-w-prose">{{ match.reasoning_summary }}</p>
                }

                @if (match.bursary.next_deadline; as deadline) {
                  <p class="mt-3 text-sm text-muted-foreground">
                    Closes {{ deadline }}
                  </p>
                }
              </ui-card>
            </li>
          }
        </ul>
      }
    }
  `,
})
export class MatchesComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly store = asyncState<readonly Match[]>((items) => items.length === 0);

  protected readonly state = this.store.state;
  protected readonly matches = computed(() => this.state().data ?? []);
  protected readonly infoIcon = Info as IconNode;

  /** Any result produced in fallback means the whole list was (S8.51). */
  protected readonly isFallback = computed(() =>
    this.matches().some((match) => match.mode === 'FALLBACK'),
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    this.store.loading();
    this.api.get<Page<Match>>('/matches/me').subscribe({
      next: (page) => this.store.loaded(page.items),
      error: (error: unknown) => this.store.failed(error),
    });
  }

  protected browseAll(): void {
    void this.router.navigateByUrl('/app/bursaries');
  }
}
