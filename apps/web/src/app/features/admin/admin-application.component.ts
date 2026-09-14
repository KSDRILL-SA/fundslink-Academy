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
  UiCheckboxDirective,
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
import { THEME_TAGS, type ThemeTagValue } from './theme-tags';
import { AUTHORISABLE, AuthoriseDecisionComponent } from './authorise-decision.component';
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
    AuthoriseDecisionComponent,
    ReactiveFormsModule,
    UiBadgeComponent,
    UiButtonComponent,
    UiCheckboxDirective,
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
            Conflict of interest (BR-E09 · E8).

            A reviewer who knows the applicant personally steps aside. It is recorded, it cannot be
            undone, and the application leaves this reviewer's queue for someone else's. Offered
            here, above every action, because the moment to declare it is before touching anything.
          -->
          @if (app.recused_by_me) {
            <ui-card class="mt-6">
              <h2 class="text-lg font-semibold">You stepped aside from this application</h2>
              <p class="mt-2 max-w-prose text-muted-foreground">
                You declared a conflict of interest, so another reviewer will decide it. It has left
                your queue, and the review and priority actions are not available to you here.
              </p>
            </ui-card>
          } @else {
            <ui-card class="mt-6">
              <h2 class="text-lg font-semibold">Do you know this applicant?</h2>
              <p class="mt-2 max-w-prose text-muted-foreground">
                If you know them personally, step aside before you review. Another reviewer will take
                it. This is recorded and cannot be undone.
              </p>

              @if (!recusing()) {
                <ui-button class="mt-4" variant="secondary" (clicked)="recusing.set(true)">
                  Step aside from this application
                </ui-button>
              } @else {
                <form class="mt-4 flex flex-col gap-3" [formGroup]="recusalForm" (ngSubmit)="recuse(app.id)">
                  <ui-form-field label="How you know them" [error]="recusalReasonError()" required>
                    <textarea uiInput rows="3" formControlName="reason"></textarea>
                  </ui-form-field>
                  <div class="flex flex-wrap gap-3">
                    <ui-button type="submit" [loading]="savingRecusal()">Step aside</ui-button>
                    <ui-button variant="ghost" (clicked)="recusing.set(false)">Cancel</ui-button>
                  </div>
                </form>
              }

              @if (recusalFailure(); as problem) {
                <div role="alert" class="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-4">
                  <p class="font-medium text-foreground">{{ problem.title }}</p>
                  <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
                </div>
              }
            </ui-card>
          }

          @if (!app.recused_by_me) {
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
          }

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

          @if (app.motivation && !app.recused_by_me) {
            <!--
              What this case was actually about (MASTER-SPEC §5.6, D-018).

              A case that fits no category is handled one at a time — and §5.6 promises those
              reasons are counted, so a recurring edge becomes a real funding category. The table
              and its six themes existed from the first migration and nothing wrote them, so the
              promise was stored and never kept. It sits beside the applicant's own words because
              that is what a theme describes.
            -->
            <ui-card class="mt-6">
              <h2 class="text-lg font-semibold">What is this case about?</h2>
              <p class="mt-2 max-w-prose text-muted-foreground">
                This application fits none of our categories. Recording why helps us see what keeps
                coming up — when a theme recurs often enough it becomes a category of its own, so
                the next student in this position does not have to explain from scratch.
              </p>

              @if (app.theme_tags?.length) {
                <ul class="mt-4 flex flex-wrap gap-2">
                  @for (theme of app.theme_tags; track theme) {
                    <li><ui-badge tone="neutral" [label]="themeLabel(theme)" /></li>
                  }
                </ul>
              }

              <form class="mt-5 flex flex-col gap-4" [formGroup]="themeForm" (ngSubmit)="saveThemes(app.id)">
                <fieldset class="flex flex-col gap-3">
                  <legend class="text-sm font-semibold text-muted-foreground">
                    Add a theme
                  </legend>
                  <div class="flex flex-wrap gap-x-6 gap-y-3">
                    @for (theme of themes; track theme.value) {
                      <div class="flex items-center gap-2">
                        <input
                          uiCheckbox
                          type="checkbox"
                          [id]="'theme-' + theme.value"
                          [formControlName]="theme.value"
                        />
                        <label [for]="'theme-' + theme.value" class="text-sm">
                          {{ theme.label }}
                        </label>
                      </div>
                    }
                  </div>
                </fieldset>

                <p class="text-sm text-muted-foreground">
                  A theme cannot be removed once added, and it is never shown to the student.
                </p>

                <div class="flex flex-wrap items-center gap-3">
                  <ui-button type="submit" variant="secondary" [loading]="savingThemes()" [disabled]="!pickedThemes().length">
                    Add {{ pickedThemes().length === 1 ? 'this theme' : 'these themes' }}
                  </ui-button>
                  @if (themesSaved()) {
                    <p role="status" class="text-sm font-medium text-success">Recorded.</p>
                  }
                </div>

                @if (themeFailure(); as problem) {
                  <div role="alert" class="rounded-lg border border-warning/40 bg-warning/10 p-4">
                    <p class="font-medium text-foreground">{{ problem.title }}</p>
                    <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
                  </div>
                }
              </form>
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

          @if (!app.recused_by_me) {
            <!--
              Which half of the decision is this person's (MASTER-SPEC §16.4)?

              An authorizer rules on what a reviewer proposed; a reviewer proposes and never
              approves. Showing both to everyone would mean showing every reviewer a control that
              always refuses them. The server still authorises each call — can_authorize decides what
              is rendered, never what is allowed.
            -->
            <div class="mt-10">
              @if (app.can_authorize) {
                @if (canAuthoriseNow(app.status)) {
                  <fl-authorise-decision
                    [applicationId]="app.id"
                    [status]="app.status"
                    (ruled)="load()"
                  />
                } @else {
                  <ui-card>
                    <h2 class="text-lg font-semibold">Nothing to authorise yet</h2>
                    <p class="mt-2 max-w-prose text-muted-foreground">
                      A reviewer has to propose a decision before you can rule on it. This one is
                      still with them.
                    </p>
                  </ui-card>
                }
              } @else {
                <fl-decision-compose [status]="app.status" (decided)="load()" />
              }
            </div>
          }
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

  /** BR-E09: stepping aside needs a reason; it is kept on the staff-only recusal record. */
  protected readonly recusing = signal(false);
  protected readonly savingRecusal = signal(false);
  private readonly recusalError = signal<string | null>(null);
  protected readonly recusalFailure = computed(() => {
    const code = this.recusalError();
    return code ? presentError(code) : null;
  });
  readonly recusalForm = this.fb.nonNullable.group({
    reason: ['', { validators: [Validators.required, Validators.minLength(10)], updateOn: 'blur' }],
  });

  protected recusalReasonError(): string | null {
    const control = this.recusalForm.controls.reason;
    if (!control.touched || control.valid) {
      return null;
    }
    return 'Say briefly how you know them — at least 10 characters.';
  }

  protected recuse(id: string): void {
    this.recusalForm.markAllAsTouched();
    if (this.recusalForm.invalid) {
      return;
    }
    this.savingRecusal.set(true);
    this.recusalError.set(null);
    this.api
      .post('/admin/applications/{id}/recusal', this.recusalForm.getRawValue(), { path: { id } })
      .subscribe({
        next: () => {
          this.savingRecusal.set(false);
          this.recusing.set(false);
          // Re-read: the server now says recused_by_me, and the actions go away.
          this.load();
        },
        error: (error: unknown) => {
          this.savingRecusal.set(false);
          const code = error instanceof ApiError ? error.code : null;
          if (code === 'already_recused') {
            this.load();
            return;
          }
          this.recusalError.set(code);
        },
      });
  }

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

  /** §5.6 / D-018 — the six seeded themes (lk_theme_tag), in the reviewer's words. */
  protected readonly themes = THEME_TAGS;
  protected readonly savingThemes = signal(false);
  protected readonly themesSaved = signal(false);
  private readonly themeError = signal<string | null>(null);
  protected readonly themeFailure = computed(() => {
    const code = this.themeError();
    return code ? presentError(code) : null;
  });
  readonly themeForm = this.fb.nonNullable.group(
    Object.fromEntries(THEME_TAGS.map((theme) => [theme.value, false])) as Record<
      ThemeTagValue,
      boolean
    >,
  );
  private readonly themeChoices = signal(this.themeForm.getRawValue());
  protected readonly pickedThemes = computed(() =>
    THEME_TAGS.filter((theme) => this.themeChoices()[theme.value]).map((theme) => theme.value),
  );

  protected themeLabel(value: string): string {
    return THEME_TAGS.find((theme) => theme.value === value)?.label ?? value;
  }


  protected saveThemes(id: string): void {
    const tags = this.pickedThemes();
    if (!tags.length) {
      return;
    }
    this.savingThemes.set(true);
    this.themesSaved.set(false);
    this.themeError.set(null);
    this.api
      .post<Application>('/admin/applications/{id}/themes', { tags }, { path: { id } })
      .subscribe({
        next: () => {
          this.savingThemes.set(false);
          this.themesSaved.set(true);
          this.themeForm.reset();
          // Re-read: the server decides which themes this case now carries.
          this.load();
        },
        error: (error: unknown) => {
          this.savingThemes.set(false);
          this.themeError.set(error instanceof ApiError ? error.code : null);
        },
      });
  }

  /** A second person only has something to rule on once a decision has been proposed. */
  protected canAuthoriseNow(status: string): boolean {
    return AUTHORISABLE.includes(status);
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
    this.themeForm.valueChanges.subscribe(() =>
      this.themeChoices.set(this.themeForm.getRawValue()),
    );
    // A theme already on the case is not an option — disabling the control rather than binding
    // [disabled] in the template, which reactive forms ignores. Re-enabled if a re-read ever
    // shows it gone, so the form follows the server rather than a one-way local decision.
    effect(() => {
      const existing = this.application()?.theme_tags ?? [];
      for (const theme of THEME_TAGS) {
        const control = this.themeForm.controls[theme.value];
        if (existing.includes(theme.value)) {
          control.setValue(false, { emitEvent: false });
          control.disable({ emitEvent: false });
        } else if (control.disabled) {
          control.enable({ emitEvent: false });
        }
      }
    });
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
