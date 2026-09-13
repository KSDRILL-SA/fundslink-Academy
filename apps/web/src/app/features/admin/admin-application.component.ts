import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiError, ApiService, type Schema } from 'data-access';
import {
  UiBadgeComponent,
  UiButtonComponent,
  UiCardComponent,
  UiErrorStateComponent,
  UiFormFieldComponent,
  UiInputDirective,
  UiSelectDirective,
  UiSkeletonComponent,
  UiStatusChipComponent,
  presentError,
} from 'ui';
import { asyncState } from '../../core/async-state';
import { APPLICATION_TYPE_LABELS } from '../applications/application-labels';
import { DecisionComposeComponent } from './decision-compose.component';

type Application = Schema<'Application'>;

/**
 * A02 — Application detail, with the pre-screen report.
 *
 * **The annotations are guidance for a human, never a verdict** (§5.7, D-010).
 * The engine flags things worth a second look; it does not decide, and it must
 * not be presented in a way that invites a tired reviewer to treat a flag as an
 * instruction. So they are headed as things to check, worded as observations,
 * and sit beside the applicant's own words rather than above them.
 *
 * The motivation is shown in full and first for Category D. Someone wrote it
 * expecting a person to read every word, and that promise is kept here or
 * nowhere.
 */
@Component({
  selector: 'fl-admin-application',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiCardComponent,
    UiStatusChipComponent,
    UiSkeletonComponent,
    UiErrorStateComponent,
    DecisionComposeComponent,
    ReactiveFormsModule,
    UiBadgeComponent,
    UiButtonComponent,
    UiFormFieldComponent,
    UiInputDirective,
    UiSelectDirective,
  ],
  template: `
    <!-- A reviewer finishes one application and goes to the next. This screen had no way back to
         the queue except the browser's own button. -->
    <a
      routerLink="/app/admin/queue"
      class="mb-5 inline-flex items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground
             underline-offset-4 outline-none hover:text-foreground hover:underline
             focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span aria-hidden="true">←</span> Back to the review queue
    </a>

    @switch (state().status) {
      @case ('loading') {
        <div class="flex flex-col gap-4">
          <ui-skeleton class="h-6 w-48" />
          <ui-skeleton class="h-40 w-full" shape="block" />
        </div>
        <p class="sr-only" role="status">Loading the application.</p>
      }

      @case ('error') {
        <ui-error-state [code]="state().errorCode" (retry)="load()" />
      }

      @default {
        @if (application(); as app) {
          <h1 class="text-2xl font-semibold tracking-tight">
            {{ typeLabel(app.application_type) }} · {{ app.academic_year }}
          </h1>
          <div class="mt-3 flex flex-wrap items-center gap-3">
            <ui-status-chip [status]="app.status" />
            @if (app.priority && app.priority !== 'NORMAL') {
              <ui-badge tone="warning" [label]="priorityLabel(app.priority)" />
            }
          </div>

          <!--
            Triage.

            The set-priority endpoint was implemented and no screen called
            it, so nobody could actually triage the queue. It
            lives here rather than on the queue itself, deliberately: D-002/D-013
            make raising priority an ADMIN_REVIEWER+ act with a reason, and a
            control on a list is a control used without reading the application.
            Students never see or request this — they describe urgency in their
            own words and a person decides.
          -->
          <ui-card class="mt-6">
            <h2 class="text-lg font-semibold">Triage priority</h2>
            <p class="mt-2 max-w-prose text-muted-foreground">
              Raising this moves the application up the queue for everyone. It is recorded against
              your name with the reason you give.
            </p>

            <form class="mt-5 flex flex-wrap items-end gap-3" [formGroup]="priorityForm" (ngSubmit)="savePriority(app.id)">
              <ui-form-field class="min-w-44" label="Priority" required>
                <select uiSelect formControlName="priority">
                  <option value="NORMAL">Normal</option>
                  <option value="URGENT">Urgent</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </ui-form-field>

              <ui-form-field class="min-w-72 flex-1" label="Why" [error]="priorityNoteError()" required>
                <input uiInput formControlName="note" />
              </ui-form-field>

              <ui-button type="submit" [loading]="savingPriority()">Set priority</ui-button>
            </form>

            @if (priorityFailure(); as problem) {
              <div role="alert" class="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-4">
                <p class="font-medium text-foreground">{{ problem.title }}</p>
                <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
              </div>
            }
            @if (prioritySaved()) {
              <p role="status" class="mt-4 text-sm font-medium text-success">Priority updated.</p>
            }
          </ui-card>

          @if (app.motivation; as motivation) {
            <!-- Category D. Someone wrote this expecting a person to read every
                 word (§5.6). It goes first, and in full. -->
            <ui-card class="mt-8">
              <h2 class="text-lg font-semibold">In the applicant's own words</h2>

              <div class="mt-4 flex flex-col gap-6">
                @if (motivation.situation) {
                  <div>
                    <h3 class="text-sm font-semibold text-muted-foreground">Their situation</h3>
                    <p class="mt-1 max-w-prose whitespace-pre-line">{{ motivation.situation }}</p>
                  </div>
                }
                @if (motivation.why_not_categories) {
                  <div>
                    <h3 class="text-sm font-semibold text-muted-foreground">
                      Why the categories did not fit
                    </h3>
                    <p class="mt-1 max-w-prose whitespace-pre-line">
                      {{ motivation.why_not_categories }}
                    </p>
                  </div>
                }
                @if (motivation.support_needed) {
                  <div>
                    <h3 class="text-sm font-semibold text-muted-foreground">What would help</h3>
                    <p class="mt-1 max-w-prose whitespace-pre-line">
                      {{ motivation.support_needed }}
                    </p>
                  </div>
                }
              </div>
            </ui-card>
          }

          @if (annotations().length) {
            <ui-card class="mt-6">
              <h2 class="text-lg font-semibold">Worth checking</h2>
              <!-- The framing is the safeguard. An annotation is an observation
                   for a person to verify, not a recommendation to act on
                   (§5.7, D-010). -->
              <p class="mt-2 max-w-prose text-muted-foreground">
                Things the pre-screen noticed. They are observations for you to verify — none of
                them is a decision, and none of them should be treated as one.
              </p>
              <ul class="mt-4 flex list-disc flex-col gap-2 pl-5">
                @for (annotation of annotations(); track annotation) {
                  <li>{{ annotation }}</li>
                }
              </ul>
            </ui-card>
          }

          <div class="mt-10">
            <fl-decision-compose />
          </div>
        }
      }
    }
  `,
})
export class AdminApplicationComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly store = asyncState<Application | null>((value) => value === null);
  private readonly compose = viewChild(DecisionComposeComponent);

  protected readonly state = this.store.state;
  protected readonly application = computed(() => this.state().data ?? null);
  protected readonly annotations = computed(
    () => this.application()?.pre_screen?.annotations ?? [],
  );

  private readonly fb = inject(FormBuilder);
  protected readonly savingPriority = signal(false);
  protected readonly prioritySaved = signal(false);
  private readonly priorityError = signal<string | null>(null);
  protected readonly priorityFailure = computed(() => {
    const code = this.priorityError();
    return code ? presentError(code) : null;
  });

  /**
   * A reason is required, not optional.
   *
   * The contract allows `note` to be absent. Requiring it here is a deliberate
   * tightening: raising priority moves one student ahead of others, and a
   * change of order that nobody has to justify is exactly the pressure point
   * D-002/D-013 exist to protect.
   */
  readonly priorityForm = this.fb.nonNullable.group({
    priority: ['NORMAL', { validators: [Validators.required] }],
    note: ['', { validators: [Validators.required, Validators.minLength(8)], updateOn: 'blur' }],
  });

  protected priorityNoteError(): string | null {
    const control = this.priorityForm.controls.note;
    if (!control.touched || control.valid) {
      return null;
    }
    return 'Say why — this is recorded against your name.';
  }

  /** The same words the queue and the student use — never the internal category code. */
  protected typeLabel(type: string): string {
    return APPLICATION_TYPE_LABELS[type] ?? 'Funding application';
  }

  protected priorityLabel(priority: string): string {
    return priority === 'CRITICAL' ? 'Critical' : 'Urgent';
  }

  protected savePriority(id: string): void {
    this.priorityForm.markAllAsTouched();
    if (this.priorityForm.invalid) {
      return;
    }
    this.savingPriority.set(true);
    this.prioritySaved.set(false);
    this.priorityError.set(null);

    this.api
      .post<Application>('/admin/applications/{id}/priority', this.priorityForm.getRawValue(), {
        path: { id },
      })
      .subscribe({
        next: () => {
          this.savingPriority.set(false);
          this.prioritySaved.set(true);
          // Re-read: priority is shown beside the status, and the server is
          // what decides whether the change was permitted.
          this.load();
        },
        error: (error: unknown) => {
          this.savingPriority.set(false);
          // A 403 here is the anti-gaming rule doing its job — only
          // ADMIN_REVIEWER+ may raise it (D-002).
          this.priorityError.set(error instanceof ApiError ? error.code : null);
        },
      });
  }

  constructor() {
    this.load();
    // Hand the id to the compose form once it exists.
    effect(() => {
      const id = this.application()?.id;
      const compose = this.compose();
      if (id && compose) {
        compose.applicationId.set(id);
      }
    });
  }

  protected load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    this.store.loading();
    // The reviewer's own endpoint. This called the STUDENT endpoint, which is ownership-scoped and
    // returns 403 to a reviewer — so A02 only ever rendered against dev preview fixtures (#288).
    this.api.get<Application>('/admin/applications/{id}', { path: { id } }).subscribe({
      next: (application) => this.store.loaded(application),
      error: (error: unknown) => this.store.failed(error),
    });
  }
}
