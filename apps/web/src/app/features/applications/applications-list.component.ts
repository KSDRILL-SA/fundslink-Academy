import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CalendarDays, FilePlus2, FileText } from 'lucide';
import {
  UiButtonComponent,
  UiCardComponent,
  UiEmptyStateComponent,
  UiErrorStateComponent,
  UiIconTileComponent,
  UiSkeletonComponent,
  UiStatusChipComponent,
  type IconNode,
} from 'ui';
import { ApplicationsStore } from '../dashboard/applications.store';
import { APPLICATION_TYPE_LABELS } from './application-labels';
import { formatRands } from '../../shared/money';
import { PageHeaderComponent } from '../../shared/page-header.component';

/**
 * The student's applications, in one list.
 *
 * This screen existed as a destination before it existed as a page: the app
 * navigation and the dashboard both linked to `/app/applications`, no route
 * matched, and the wildcard redirect sent the student back to the marketing
 * home page — silently, which is the worst way for navigation to fail. The
 * route-integrity test added alongside this component is what stops that class
 * of defect returning (doctrine L5).
 *
 * Everything rendered here comes from `GET /applications`. There is no sample
 * row, no placeholder figure and no status invented on the client: an
 * unrecognised status still renders, through the shared chip, as itself.
 *
 * One application per academic year is the norm (D-004), so this is usually a
 * short list — which is why it is cards rather than a table. The table
 * treatment belongs where a student is scanning a column across many rows.
 */
@Component({
  selector: 'fl-applications-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiCardComponent,
    UiButtonComponent,
    UiIconTileComponent,
    UiStatusChipComponent,
    UiSkeletonComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
    PageHeaderComponent,
  ],
  template: `
    <fl-page-header
      title="Your applications"
      lead="Every application you have made through FundsLink, and where each one stands."
      [icon]="icons.application"
      tone="gold"
    >
      <a actions routerLink="/app/applications/new" class="inline-flex">
        <ui-button variant="accent">Start an application</ui-button>
      </a>
    </fl-page-header>

    @switch (store.state().status) {
      @case ('loading') {
        <div class="mt-8 flex flex-col gap-4">
          @for (row of [1, 2]; track row) {
            <ui-skeleton class="h-32 w-full" shape="block" />
          }
        </div>
        <p class="sr-only" role="status">Loading your applications.</p>
      }

      @case ('error') {
        <ui-error-state class="mt-8" [code]="store.state().errorCode" (retry)="store.load()" />
        @if (store.state().requestId; as id) {
          <p class="mt-4 text-center text-sm text-muted-foreground">
            Reference for support: <span class="font-mono">{{ id }}</span>
          </p>
        }
      }

      @case ('empty') {
        <ui-empty-state
          class="mt-8"
          title="You have not applied yet"
          message="Applying is free and takes a few minutes. You can save and come back — nothing is lost."
          [icon]="icons.apply"
          actionLabel="Start my application"
          (action)="start()"
        />
      }

      @case ('success') {
        <ul class="mt-8 flex flex-col gap-4">
          @for (application of store.applications(); track application.id) {
            <li>
              <ui-card variant="interactive" padding="lg">
                <div class="flex flex-wrap items-start justify-between gap-6">
                  <div class="flex min-w-0 gap-4">
                    <ui-icon-tile [icon]="icons.application" tone="gold" size="lg" class="mt-1" />

                    <div class="min-w-0">
                      <ui-status-chip [status]="application.status" />
                      <h2 class="mt-3 text-lg font-semibold tracking-tight">
                        {{ typeLabel(application.application_type) }} · {{
                          application.academic_year
                        }}
                      </h2>

                      <dl class="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                        @if (application.requested_amount; as amount) {
                          <div>
                            <dt class="text-muted-foreground">Amount requested</dt>
                            <!-- Grouped by rewriting the string, never by
                                 parsing it: money stays a decimal string end
                                 to end (handoff §4.4, DB-D29). -->
                            <dd class="tabular font-medium">{{ money(amount) }}</dd>
                          </div>
                        }
                        <div>
                          <dt class="text-muted-foreground">Started</dt>
                          <dd class="tabular font-medium">{{ date(application.created_at) }}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <a [routerLink]="['/app/applications', application.id]" class="inline-flex">
                    <ui-button variant="secondary">Open</ui-button>
                  </a>
                </div>
              </ui-card>
            </li>
          }
        </ul>
      }
    }
  `,
})
export class ApplicationsListComponent {
  private readonly router = inject(Router);
  protected readonly store = inject(ApplicationsStore);

  protected readonly icons = {
    apply: FilePlus2 as IconNode,
    application: FileText as IconNode,
    calendar: CalendarDays as IconNode,
  };

  constructor() {
    this.store.load();
  }

  protected start(): void {
    void this.router.navigateByUrl('/app/applications/new');
  }

  /**
   * Category codes are internal. An unknown one renders as itself rather than
   * as a blank, because the backend can add a category before this bundle is
   * redeployed.
   */
  protected typeLabel(type: string): string {
    return APPLICATION_TYPE_LABELS[type] ?? 'Funding application';
  }

  /** The amount, grouped for reading. Still the server's exact digits. */
  protected money(amount: string): string {
    return formatRands(amount);
  }

  /** A date a person reads, from the ISO timestamp the API returns. */
  protected date(iso: string): string {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      return '—';
    }
    return parsed.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
