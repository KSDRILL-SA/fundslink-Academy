import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService, type Page, type Schema } from 'data-access';
import {
  UiButtonComponent,
  UiCardComponent,
  UiEmptyStateComponent,
  UiErrorStateComponent,
  UiSkeletonComponent,
  UiStatusChipComponent,
} from 'ui';
import { asyncState } from '../../core/async-state';

type Tracked = Schema<'Tracked'>;

/** Days after which we tell the student we will chase the funder (§12.5). */
const SILENCE_NUDGE_DAYS = 25;

/**
 * S18 — Tracking board: applications the student made elsewhere.
 *
 * **Every status carries where it came from** (P3, §12.4). "Shortlisted" that
 * the student typed and "Shortlisted" read off an email are not the same
 * claim, and a board that renders them identically is implying a certainty the
 * platform does not have. The source badge sits beside every chip, always.
 *
 * The silence indicator is a promise, not a warning. After 25 days of nothing,
 * the screen says we will chase on day 30 — so a student watching an
 * application go quiet knows someone is doing something about it, rather than
 * wondering whether to nag a funder themselves.
 */
@Component({
  selector: 'fl-tracking-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiCardComponent,
    UiButtonComponent,
    UiStatusChipComponent,
    UiSkeletonComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
  ],
  template: `
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Your other applications</h1>
        <p class="mt-2 max-w-prose text-muted-foreground">
          Bursaries you applied for elsewhere, in one place. We will keep an eye on them with you.
        </p>
      </div>
      <a routerLink="/app/tracking/new" class="inline-flex">
        <ui-button variant="secondary">Track another</ui-button>
      </a>
    </div>

    @switch (state().status) {
      @case ('loading') {
        <div class="mt-8 flex flex-col gap-4">
          @for (row of [1, 2]; track row) {
            <ui-skeleton class="h-28 w-full" shape="block" />
          }
        </div>
        <p class="sr-only" role="status">Loading your tracked applications.</p>
      }

      @case ('error') {
        <ui-error-state class="mt-8" [code]="state().errorCode" (retry)="load()" />
      }

      @case ('empty') {
        <!-- §4: an empty tracking board teaches S19. -->
        <ui-empty-state
          class="mt-8"
          title="Nothing tracked yet"
          message="Applied for a bursary somewhere else? Add it here and we will watch the deadlines and chase quiet funders for you."
          actionLabel="Track an application"
          (action)="addTracked()"
        />
      }

      @case ('success') {
        <ul class="mt-8 flex flex-col gap-4">
          @for (item of tracked(); track item.id) {
            <li>
              <ui-card>
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="min-w-0">
                    <h2 class="text-lg font-semibold">{{ item.bursary.name }}</h2>
                    <p class="mt-1 text-sm text-muted-foreground">{{ item.bursary.provider }}</p>

                    <div class="mt-3 flex flex-wrap items-center gap-2">
                      <ui-status-chip [status]="item.status" />
                      <!-- Where this status came from. Never omitted (P3). -->
                      <ui-status-chip [status]="item.status_source" kind="source" />
                    </div>
                  </div>

                  @if (item.bursary.next_deadline; as deadline) {
                    <p class="text-sm text-muted-foreground">Closes {{ deadline }}</p>
                  }
                </div>

                @if (hasGoneQuiet(item)) {
                  <p class="mt-4 rounded-lg bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                    No news for a while. We will nudge them for you on day 30 — you do not need to
                    do anything.
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
export class TrackingBoardComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly store = asyncState<readonly Tracked[]>((items) => items.length === 0);

  protected readonly state = this.store.state;
  protected readonly tracked = computed(() => this.state().data ?? []);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.store.loading();
    this.api.get<Page<Tracked>>('/tracked-applications').subscribe({
      next: (page) => this.store.loaded(page.items),
      error: (error: unknown) => this.store.failed(error),
    });
  }

  protected addTracked(): void {
    void this.router.navigateByUrl('/app/tracking/new');
  }

  /** 25 days of silence, per §12.5. */
  protected hasGoneQuiet(item: Tracked): boolean {
    const last = Date.parse(item.last_activity_at);
    if (Number.isNaN(last)) {
      return false;
    }
    const days = (Date.now() - last) / 86_400_000;
    return days >= SILENCE_NUDGE_DAYS;
  }
}
