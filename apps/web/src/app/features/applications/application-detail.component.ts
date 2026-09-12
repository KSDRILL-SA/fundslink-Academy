import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiError, ApiService, type Schema } from 'data-access';
import {
  UiButtonComponent,
  UiCardComponent,
  UiErrorStateComponent,
  UiSkeletonComponent,
  UiStatusChipComponent,
} from 'ui';
import { asyncState } from '../../core/async-state';
import { AppealComponent } from './appeal.component';
import { DecisionComponent } from './decision.component';
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
    AppealComponent,
    DecisionComponent,
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
          } @else if (isDecided(app.status)) {
            <!--
              S16 — the decision IS the screen.

              A decision does not belong under a progress timeline. Someone who
              has just been told they are not funded should not have to read
              past a set of dots to find out why, and someone who has been
              approved should not have to hunt for the word. The timeline was
              the right shape while the answer was "not yet"; it is the wrong
              shape the moment the answer arrives.
            -->
            <fl-decision
              [status]="app.status"
              [reason]="app.decision_reason ?? null"
              [decidedAt]="app.decided_at ?? null"
              [position]="app.waitlist_position ?? null"
            />

            @if (isAppealable(app.status)) {
              <fl-appeal [applicationId]="app.id" (appealed)="load()" />
            }
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
              <!-- We say where an update WILL appear, not how it will be
                   delivered. The notification outbox is real and drives this
                   screen and the notifications list; email delivery is not
                   switched on yet (the adapter logs rather than sends), so
                   promising an email is promising something that will not
                   arrive. -->
              <p class="mt-2 text-sm text-muted-foreground">
                Reviews are done by people, in the order they arrive. Every update appears here and
                in your notifications the moment it happens.
              </p>
            </ui-card>

            <!--
              A draft is not an application anyone will read.

              Someone who left the apply flow part-way lands here, and until
              now this screen had no way to finish: the draft simply sat,
              while the dashboard told them it was "saved". Saved is not
              submitted, and only one of those gets read by a reviewer.
            -->
            @if (isDraft(app.status)) {
              <ui-card variant="highlight" class="mt-6">
                <h2 class="text-lg font-semibold">This is still a draft</h2>
                <p class="mt-2 max-w-prose text-muted-foreground">
                  Nobody has seen it yet. Send it for review and a person will read it — you can
                  still add documents afterwards.
                </p>

                @if (needsSaId()) {
                  <p role="alert" class="mt-4 max-w-prose rounded-lg bg-secondary/60 p-4">
                    We need your South African ID number before this can go to a reviewer. Funders
                    require it on every application. Nothing here is lost.
                  </p>
                }

                <div class="mt-5 flex flex-wrap gap-3">
                  @if (needsSaId()) {
                    <a routerLink="/app/profile" class="inline-flex">
                      <ui-button>Add my ID number</ui-button>
                    </a>
                  } @else {
                    <ui-button [loading]="submitting()" (clicked)="sendForReview(app.id)">
                      Send for review
                    </ui-button>
                  }
                  <a [routerLink]="['/app/applications', app.id, 'documents']" class="inline-flex">
                    <ui-button variant="secondary">Add a document first</ui-button>
                  </a>
                </div>
              </ui-card>
            }

            <!-- The appeal lives on the decision branch above (S16), where the
                 decision it answers is actually read. This branch is the
                 in-progress timeline, and there is nothing here to appeal. -->
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

  protected readonly submitting = signal(false);
  /** D-007 stopped the submission: the ID number is missing, nothing is lost. */
  protected readonly needsSaId = signal(false);

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

  protected isDraft(status: string | undefined): boolean {
    return status === 'DRAFT';
  }

  /**
   * A decision has been made, one way or the other — so S16 is the screen.
   *
   * `REJECTED_FINAL` belongs here: an appeal that was heard and refused is
   * still a decision, and the student is still owed the reasons and the doors
   * that remain open. What it does not get is another appeal button.
   */
  protected isDecided(status: string | undefined): boolean {
    return (
      status === 'APPROVED' ||
      status === 'APPROVED_WAITLISTED' ||
      status === 'REJECTED' ||
      status === 'REJECTED_FINAL'
    );
  }

  /**
   * One appeal per decision (BR-E07).
   *
   * Offered only where it can succeed. `REJECTED_FINAL` is the state after an
   * appeal has been heard and refused, and showing the form again would invite
   * someone to spend hope on a door the server will close.
   */
  protected isAppealable(status: string | undefined): boolean {
    return status === 'REJECTED';
  }

  /**
   * Hand a saved draft to a person.
   *
   * The same call the apply flow makes at its last step. It lives here too
   * because the flow is not the only way to arrive at a draft: a student who
   * closed the tab half-way, or who came back to add a document first, has to
   * be able to finish from the screen they actually land on.
   */
  protected sendForReview(id: string): void {
    this.submitting.set(true);
    this.needsSaId.set(false);

    this.api
      .post<Application>('/applications/{id}/submit', undefined, { path: { id } })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          // Re-read rather than patch the status locally: submitting moves the
          // application through the server's state machine, and the server is
          // the only thing that knows where it landed.
          this.load();
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          if (error instanceof ApiError && error.code === 'sa_id_required') {
            this.needsSaId.set(true);
            return;
          }
          this.store.failed(error);
        },
      });
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
