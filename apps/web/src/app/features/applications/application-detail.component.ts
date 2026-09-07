import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, type Schema } from 'data-access';
import {
  UiButtonComponent,
  UiCardComponent,
  UiErrorStateComponent,
  UiSkeletonComponent,
  UiStatusChipComponent,
} from 'ui';
import { asyncState } from '../../core/async-state';
import { FixListComponent } from './fix-list.component';

type Application = Schema<'Application'>;

/** The journey, in the order a student walks it. */
const TIMELINE = [
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'PRE_SCREENING', label: 'Checking your details' },
  { key: 'READY_FOR_REVIEW', label: 'With a reviewer' },
  { key: 'DECIDED', label: 'Decision' },
] as const;

const STAGE_INDEX: Readonly<Record<string, number>> = {
  DRAFT: 0,
  SUBMITTED: 0,
  PRE_SCREENING: 1,
  UNSCREENED: 1,
  RETURNED_FOR_INFO: 1,
  RESUBMITTED: 1,
  READY_FOR_REVIEW: 2,
  UNDER_REVIEW: 2,
  INTERVIEW_SCHEDULED: 2,
  INTERVIEWED: 2,
  APPROVED_PROPOSED: 3,
  APPROVED: 3,
  APPROVED_WAITLISTED: 3,
  REJECTED: 3,
  REJECTED_FINAL: 3,
  WITHDRAWN: 3,
};

/**
 * S14 — Application status. One card, one truth.
 *
 * The timeline says where the application is; the sentence below it says what
 * that means. Both matter — a progress bar with no explanation leaves someone
 * refreshing a page trying to read meaning into a dot.
 *
 * **The Human-Final Principle is shown, not hidden** (P5, §5.8). During
 * pre-screening, at the exact moment a student is most likely to believe a
 * machine is deciding their funding, the screen says outright that it cannot.
 *
 * When the application has been returned for information, this screen hands
 * over entirely to the fix list (S15) — a return is a task, not a status to
 * contemplate, and burying the list under a timeline would make someone hunt
 * for the thing they need to do.
 */
@Component({
  selector: 'fl-application-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiCardComponent,
    UiStatusChipComponent,
    UiSkeletonComponent,
    UiErrorStateComponent,
    UiButtonComponent,
    FixListComponent,
  ],
  template: `
    @switch (state().status) {
      @case ('loading') {
        <div class="flex flex-col gap-4">
          <ui-skeleton class="h-6 w-40" />
          <ui-skeleton class="h-32 w-full" shape="block" />
        </div>
        <p class="sr-only" role="status">Loading your application.</p>
      }

      @case ('error') {
        <ui-error-state [code]="state().errorCode" (retry)="load()" />
      }

      @default {
        @if (application(); as app) {
          @if (isReturned(app)) {
            <!-- A return is a task, not a status. The list is the screen. -->
            <fl-fix-list [application]="app" (resubmitted)="load()" />
          } @else {
            <h1 class="text-2xl font-semibold tracking-tight">Your application</h1>

            <ui-card class="mt-6">
              <ui-status-chip [status]="app.status" />

              <p class="mt-4 max-w-prose text-lg">{{ plainMeaning(app.status) }}</p>

              @if (isPreScreening(app.status)) {
                <!-- P5 / §5.8 — stated where it is most needed, not buried. -->
                <p
                  class="mt-4 max-w-prose rounded-lg border-l-4 border-l-accent bg-secondary/40 py-3 pl-4 pr-3"
                >
                  Our system is checking that everything we need is here — it cannot approve or
                  decline you. Only a person can do that.
                </p>
              }

              <ol class="mt-8 flex flex-col gap-0" aria-label="Application progress">
                @for (stage of timeline; track stage.key; let i = $index) {
                  <li class="flex gap-4">
                    <div class="flex flex-col items-center">
                      <span
                        [class]="dotClasses(i, app.status)"
                        aria-hidden="true"
                      ></span>
                      @if (i < timeline.length - 1) {
                        <span
                          class="w-0.5 flex-1 bg-border"
                          [class.bg-accent]="i < stageIndex(app.status)"
                          aria-hidden="true"
                        ></span>
                      }
                    </div>
                    <div class="pb-8">
                      <p
                        class="font-medium"
                        [class.text-muted-foreground]="i > stageIndex(app.status)"
                        [attr.aria-current]="i === stageIndex(app.status) ? 'step' : null"
                      >
                        {{ stage.label }}
                        @if (i === stageIndex(app.status)) {
                          <span class="sr-only">(current step)</span>
                        }
                      </p>
                    </div>
                  </li>
                }
              </ol>

              <!-- The SLA, stated honestly rather than implied. E12 makes this
                   config-driven; until the config endpoint is contracted, the
                   screen says what it can defend. -->
              <p class="mt-2 text-sm text-muted-foreground">
                Reviews are done by people, in the order they arrive. We will email you the moment
                there is a decision.
              </p>
            </ui-card>

            <div class="mt-6 flex flex-wrap gap-3">
              <a [routerLink]="['/app/applications', app.id, 'documents']" class="inline-flex">
                <ui-button variant="secondary">Add a document</ui-button>
              </a>
            </div>
          }
        }
      }
    }
  `,
})
export class ApplicationDetailComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly store = asyncState<Application | null>((value) => value === null);

  protected readonly state = this.store.state;
  protected readonly application = computed(() => this.state().data ?? null);
  protected readonly timeline = TIMELINE;

  constructor() {
    this.load();
  }

  protected load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    this.store.loading();
    this.api.get<Application>('/applications/{id}', { path: { id } }).subscribe({
      next: (application) => this.store.loaded(application),
      error: (error: unknown) => this.store.failed(error),
    });
  }

  protected isReturned(app: Application): boolean {
    return app.status === 'RETURNED_FOR_INFO';
  }

  protected isPreScreening(status: string | undefined): boolean {
    return status === 'PRE_SCREENING' || status === 'SUBMITTED';
  }

  protected stageIndex(status: string | undefined): number {
    return STAGE_INDEX[status ?? ''] ?? 0;
  }

  protected dotClasses(index: number, status: string | undefined): string {
    const current = this.stageIndex(status);
    if (index < current) {
      return 'mt-1 h-3 w-3 rounded-full bg-accent';
    }
    if (index === current) {
      return 'mt-1 h-3 w-3 rounded-full bg-accent ring-4 ring-accent/25';
    }
    return 'mt-1 h-3 w-3 rounded-full bg-border';
  }

  /** What the status means, in words a person would use. */
  protected plainMeaning(status: string | undefined): string {
    switch (status) {
      case 'DRAFT':
        return 'This is saved as a draft. Nothing has been sent yet.';
      case 'SUBMITTED':
      case 'PRE_SCREENING':
        return 'We have your application and we are checking it over.';
      case 'UNSCREENED':
        return 'We have your application. The automatic check could not run, so a person will look at it directly.';
      case 'RESUBMITTED':
        return 'Thank you — your updates are in and your application is back in the queue.';
      case 'READY_FOR_REVIEW':
      case 'UNDER_REVIEW':
        return 'A reviewer has your application. This is the part that takes the longest, and it is the part a person does.';
      case 'INTERVIEW_SCHEDULED':
        return 'You have an interview scheduled. Details are in your email.';
      case 'APPROVED':
        return 'Your funding was approved.';
      default:
        return 'Here is where your application stands.';
    }
  }
}
