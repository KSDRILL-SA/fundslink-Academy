import { ChangeDetectionStrategy, Component, computed, effect, inject, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService, type Schema } from 'data-access';
import {
  UiCardComponent,
  UiErrorStateComponent,
  UiSkeletonComponent,
  UiStatusChipComponent,
} from 'ui';
import { asyncState } from '../../core/async-state';
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
    UiCardComponent,
    UiStatusChipComponent,
    UiSkeletonComponent,
    UiErrorStateComponent,
    DecisionComposeComponent,
  ],
  template: `
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
            {{ app.application_type }} · {{ app.academic_year }}
          </h1>
          <div class="mt-3">
            <ui-status-chip [status]="app.status" />
          </div>

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
    this.api.get<Application>('/applications/{id}', { path: { id } }).subscribe({
      next: (application) => this.store.loaded(application),
      error: (error: unknown) => this.store.failed(error),
    });
  }
}
