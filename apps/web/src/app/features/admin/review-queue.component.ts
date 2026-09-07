import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, type Page, type Schema } from 'data-access';
import {
  UiBadgeComponent,
  UiCardComponent,
  UiEmptyStateComponent,
  UiErrorStateComponent,
  UiSkeletonComponent,
  UiStatusChipComponent,
} from 'ui';
import { asyncState } from '../../core/async-state';

type Application = Schema<'Application'>;

/**
 * A01 — Review queue.
 *
 * Priority is shown because a reviewer needs it to triage, and it is
 * deliberately read-only here: only `ADMIN_REVIEWER`+ may raise it, students
 * cannot request it, and the anti-gaming rule (D-002/D-013) is only real if
 * the queue does not become a place to nudge it.
 *
 * Every row is an application from a person who is waiting. The queue shows
 * how long they have been waiting, because a list sorted only by status makes
 * it easy to leave someone at the bottom indefinitely.
 */
@Component({
  selector: 'fl-review-queue',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiCardComponent,
    UiStatusChipComponent,
    UiBadgeComponent,
    UiSkeletonComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
  ],
  template: `
    <h1 class="text-2xl font-semibold tracking-tight">Review queue</h1>
    <p class="mt-2 max-w-prose text-muted-foreground">
      Applications waiting for a person. Every decision here is final for someone.
    </p>

    @switch (state().status) {
      @case ('loading') {
        <div class="mt-8 flex flex-col gap-3">
          @for (row of [1, 2, 3, 4]; track row) {
            <ui-skeleton class="h-20 w-full" shape="block" />
          }
        </div>
        <p class="sr-only" role="status">Loading the review queue.</p>
      }

      @case ('error') {
        <ui-error-state class="mt-8" [code]="state().errorCode" (retry)="load()" />
      }

      @case ('empty') {
        <ui-empty-state
          class="mt-8"
          title="Nothing waiting"
          message="The queue is clear. Anything new will appear here as it arrives."
        />
      }

      @case ('success') {
        <ul class="mt-8 flex flex-col gap-3">
          @for (application of applications(); track application.id) {
            <li>
              <ui-card variant="interactive" padding="sm">
                <div class="flex flex-wrap items-center justify-between gap-4">
                  <div class="min-w-0">
                    <a
                      [routerLink]="['/app/admin/applications', application.id]"
                      class="rounded-sm font-medium underline-offset-4 outline-none hover:underline
                             focus-visible:outline-[3px] focus-visible:outline-offset-2
                             focus-visible:outline-ring"
                    >
                      {{ application.application_type }} · {{ application.academic_year }}
                    </a>
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                      <ui-status-chip [status]="application.status" />
                      @if (application.priority && application.priority !== 'NORMAL') {
                        <!-- Read-only. Raising it is ADMIN_REVIEWER+ only (D-002). -->
                        <ui-badge
                          tone="warning"
                          [label]="priorityLabel(application.priority)"
                        />
                      }
                    </div>
                  </div>

                  <p class="text-sm text-muted-foreground">
                    Waiting {{ waitingDays(application) }} days
                  </p>
                </div>
              </ui-card>
            </li>
          }
        </ul>
      }
    }
  `,
})
export class ReviewQueueComponent {
  private readonly api = inject(ApiService);
  private readonly store = asyncState<readonly Application[]>((items) => items.length === 0);

  protected readonly state = this.store.state;
  protected readonly applications = computed(() => this.state().data ?? []);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.store.loading();
    this.api
      .get<Page<Application>>('/admin/applications', { query: { status: 'READY_FOR_REVIEW' } })
      .subscribe({
        next: (page) => this.store.loaded(page.items),
        error: (error: unknown) => this.store.failed(error),
      });
  }

  protected priorityLabel(priority: string): string {
    return priority === 'CRITICAL' ? 'Critical' : 'Urgent';
  }

  protected waitingDays(application: Application): number {
    const created = Date.parse(application.created_at);
    if (Number.isNaN(created)) {
      return 0;
    }
    return Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
  }
}
