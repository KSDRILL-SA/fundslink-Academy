import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, type Page, type Schema } from 'data-access';
import { ClipboardList } from 'lucide';
import {
  UiBadgeComponent,
  UiButtonComponent,
  UiCardComponent,
  UiEmptyStateComponent,
  UiErrorStateComponent,
  UiSkeletonComponent,
  UiStatusChipComponent,
  type IconNode,
} from 'ui';
import { asyncState } from '../../core/async-state';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { APPLICATION_TYPE_LABELS } from '../applications/application-labels';

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
 * when each review is DUE, and the server orders it for triage — highest
 * priority, then soonest due, then soonest need, then longest wait — because a
 * list sorted by arrival lets an emergency sit at the bottom indefinitely.
 */
@Component({
  selector: 'fl-review-queue',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    UiButtonComponent,
    UiCardComponent,
    UiStatusChipComponent,
    UiBadgeComponent,
    UiSkeletonComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
    PageHeaderComponent,
  ],
  template: `
    <fl-page-header
      eyebrow="Admin"
      title="Review queue"
      backRoute="/app/admin"
      backLabel="Operations overview"
      lead="Applications waiting for a person. Every decision here is final for someone."
      [icon]="queueIcon"
    >
      <p actions class="fl-surface px-4 py-2 text-sm">
        <span class="text-muted-foreground">Waiting</span>
        <span class="tabular ml-2 font-semibold">{{ applications().length }}</span>
      </p>
    </fl-page-header>

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
        <!-- A queue is the table case: a reviewer scans one column — when a
             review is due — across every row, and cards force them to re-find
             that date in a different place on each one. -->
        <div class="fl-surface fl-table-frame mt-8 hidden overflow-x-auto md:block">
          <table class="fl-table">
            <!-- The order is the SERVER's (D-002 / D-013) and is described here
                 exactly: this caption once said "oldest wait first" while the
                 list was newest first. -->
            <caption class="sr-only">
              Applications waiting on a reviewer, in triage order: highest priority first, then the
              soonest review due date, then the soonest need, then the longest wait.
            </caption>
            <thead>
              <tr>
                <th scope="col">Application</th>
                <th scope="col">Status</th>
                <th scope="col">Priority</th>
                <th scope="col">Review due</th>
              </tr>
            </thead>
            <tbody>
              @for (application of applications(); track application.id) {
                <tr>
                  <th scope="row" class="p-4 text-left align-top font-medium">
                    <a
                      [routerLink]="['/app/admin/applications', application.id]"
                      class="rounded-sm underline-offset-4 outline-none hover:underline
                             focus-visible:outline-[3px] focus-visible:outline-offset-2
                             focus-visible:outline-ring"
                    >
                      {{ typeLabel(application.application_type) }}
                    </a>
                    <span class="mt-1 block text-sm font-normal text-muted-foreground">
                      {{ application.academic_year }}
                    </span>
                  </th>
                  <td><ui-status-chip [status]="application.status" /></td>
                  <td>
                    @if (application.priority && application.priority !== 'NORMAL') {
                      <!-- Read-only. Raising it is ADMIN_REVIEWER+ only (D-002). -->
                      <ui-badge tone="warning" [label]="priorityLabel(application.priority)" />
                    } @else {
                      <span class="text-sm text-muted-foreground">Normal</span>
                    }
                  </td>
                  <td class="tabular text-sm">
                    <ng-container
                      [ngTemplateOutlet]="due"
                      [ngTemplateOutletContext]="{ $implicit: application }"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Narrow screens keep the cards. A reviewer on a phone is still a
             reviewer, and a sideways-scrolling table is unusable there. -->
        <ul class="mt-8 flex flex-col gap-3 md:hidden">
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
                      {{ typeLabel(application.application_type) }} ·
                      {{ application.academic_year }}
                    </a>
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                      <ui-status-chip [status]="application.status" />
                      @if (application.priority && application.priority !== 'NORMAL') {
                        <ui-badge tone="warning" [label]="priorityLabel(application.priority)" />
                      }
                    </div>
                  </div>

                  <p class="tabular text-sm">
                    <ng-container
                      [ngTemplateOutlet]="due"
                      [ngTemplateOutletContext]="{ $implicit: application }"
                    />
                  </p>
                </div>
              </ui-card>
            </li>
          }
        </ul>

        @if (nextCursor()) {
          <!-- The queue is paged by the server. It used to fetch the first page
               only, so an application past the twentieth was unreachable. -->
          <div class="mt-6 flex justify-center">
            <ui-button variant="secondary" [loading]="loadingMore()" (click)="loadMore()">
              Show more applications
            </ui-button>
          </div>
        }
      }
    }

    <!-- When a review is due, from the SERVER's review_due_at and sla_breached
         (config-driven SLA, D-002). Dates only: no arithmetic against this
         device's clock, which is how "Waiting N days" used to be computed —
         from when the draft was created, not when it reached us. Overdue says
         so in words, never by colour alone (P3). -->
    <ng-template #due let-application>
      @if (application.review_due_at) {
        @if (application.sla_breached) {
          <ui-badge tone="warning" [label]="'Overdue — was due ' + dueDate(application.review_due_at)" />
        } @else {
          <span>Due {{ dueDate(application.review_due_at) }}</span>
        }
      } @else {
        <span class="text-muted-foreground">No review owed</span>
      }
    </ng-template>
  `,
})
export class ReviewQueueComponent {
  private readonly api = inject(ApiService);
  private readonly store = asyncState<readonly Application[]>((items) => items.length === 0);

  protected readonly state = this.store.state;
  protected readonly applications = computed(() => this.state().data ?? []);
  protected readonly queueIcon = ClipboardList as IconNode;

  /** Category codes are internal; a reviewer reads the same words a student does. */
  protected typeLabel(type: string): string {
    return APPLICATION_TYPE_LABELS[type] ?? 'Funding application';
  }

  constructor() {
    this.load();
  }

  /**
   * The review queue — every application whose next step is a person's.
   *
   * No status filter, on purpose. This used to request READY_FOR_REVIEW only, so UNSCREENED
   * applications (the pre-screen engine was down, S8.51) and APPEALED ones (BR-E07) never appeared
   * on the one screen reviewers use, and would have waited forever. The server now defines the
   * queue and its order (#288).
   */
  protected load(): void {
    this.store.loading();
    this.api.get<Page<Application>>('/admin/applications').subscribe({
      next: (page) => {
        this.nextCursor.set(page.meta?.next_cursor ?? null);
        this.store.loaded(page.items);
      },
      error: (error: unknown) => this.store.failed(error),
    });
  }

  protected loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) {
      return;
    }
    this.loadingMore.set(true);
    this.api.get<Page<Application>>('/admin/applications', { query: { cursor } }).subscribe({
      next: (page) => {
        this.nextCursor.set(page.meta?.next_cursor ?? null);
        this.store.loaded([...this.applications(), ...page.items]);
        this.loadingMore.set(false);
      },
      error: (error: unknown) => {
        // Keep what is already on screen; a failed "more" must not blank the queue.
        this.loadingMore.set(false);
        this.store.failed(error);
      },
    });
  }

  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loadingMore = signal(false);

  /** "17 September 2026" — the server's date, formatted, never recomputed from this clock. */
  protected dueDate(iso: string): string {
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime())
      ? ''
      : parsed.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  protected priorityLabel(priority: string): string {
    return priority === 'CRITICAL' ? 'Critical' : 'Urgent';
  }

}
