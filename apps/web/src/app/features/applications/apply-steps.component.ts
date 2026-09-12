import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError, ApiService, type Schema } from 'data-access';
import {
  UiButtonComponent,
  UiFormFieldComponent,
  UiInputAffixComponent,
  UiInputDirective,
  UiMoneyInputDirective,
  UiSelectDirective,
  UiStepperComponent,
  presentError,
} from 'ui';
import type { ApplicationType } from './application-categories';
import { INCOME_BAND_LABELS } from './application-labels';

/**
 * S11 — Apply: guided steps.
 *
 * Multi-step beats mega-form (P8). Three short screens, each answering one
 * kind of question, with progress always visible — a form of unknown length
 * is where people stop, and "Step 2 of 3" is a promise that this ends.
 *
 * Three contract rules the screen must not undermine:
 *
 * **The amount is a decimal string, start to finish.** No `type="number"`, no
 * parseFloat, no arithmetic in the browser (handoff §4.4, DB-D29). What the
 * student typed is what the server receives.
 *
 * **The income band is not a means test.** The contract says so outright — the
 * engine only annotates it and a human decides (§5.7, D-016/D-017). So it is
 * asked plainly, `PREFER_NOT_TO_SAY` is a real answer rather than a penalty,
 * and nothing on this screen implies a threshold.
 *
 * **"I need help by" does not set priority.** It informs the reviewer;
 * priority is ADMIN_REVIEWER-only and deliberately un-gameable (D-002/D-013).
 * Implying otherwise would invite people to compete for a lane they cannot
 * reach, and teach them that honesty costs them.
 */
@Component({
  selector: 'fl-apply-steps',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiStepperComponent,
    UiFormFieldComponent,
    UiInputDirective,
    UiSelectDirective,
    UiInputAffixComponent,
    UiMoneyInputDirective,
    UiButtonComponent,
  ],
  template: `
    <ui-stepper class="max-w-2xl" [steps]="steps" [current]="step()" ariaLabel="Application progress" />

    <h1 class="mt-6 text-2xl font-semibold tracking-tight">{{ steps[step()].heading }}</h1>

    <!--
      D-007 stopped the submission. This is not an error state: the application
      is saved, one required thing is missing, and the screen says exactly what
      and where — a stop with a door in it (P2).
    -->
    @if (needsSaId()) {
      <div role="alert" class="fl-surface mt-8 max-w-2xl p-6">
        <h2 class="text-lg font-semibold">Your application is saved</h2>
        <p class="mt-2 max-w-prose text-muted-foreground">
          Before we can send it to a reviewer we need your South African ID number. Funders require
          it on every application, and it is the one thing we cannot continue without. We encrypt
          it, and we never show it back in full.
        </p>
        <p class="mt-2 max-w-prose text-muted-foreground">
          Nothing you have entered is lost — add the number and come straight back.
        </p>
        <div class="mt-6 flex flex-wrap gap-3">
          <ui-button (clicked)="addIdNumber()">Add my ID number</ui-button>
          <ui-button variant="secondary" (clicked)="openDraft()">Open my saved application</ui-button>
        </div>
      </div>
    }

    <form class="mt-8 flex max-w-2xl flex-col gap-6" [formGroup]="form" (ngSubmit)="next()">
      @if (failure(); as problem) {
        <div role="alert" class="rounded-lg border border-destructive/30 bg-destructive/8 p-4">
          <p class="font-medium text-foreground">{{ problem.title }}</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
          @if (draftId()) {
            <!-- The work survived the failure, and the student is told so. -->
            <p class="mt-3 text-sm text-muted-foreground">
              Your application is saved. You can try again, or open it from your applications.
            </p>
          }
        </div>
      }

      @switch (step()) {
        @case (0) {
          <ui-form-field
            label="Which academic year is this for?"
            hint="The year you need the funding for, not the year you started."
            [error]="errorFor('academic_year')"
            required
          >
            <select uiSelect formControlName="academic_year">
              <option value="">Choose a year…</option>
              @for (year of years; track year) {
                <option [value]="year">{{ year }}</option>
              }
            </select>
          </ui-form-field>
        }

        @case (1) {
          <ui-form-field
            label="How much do you need?"
            hint="A best estimate is fine. If you are not sure, use the amount on your fee statement."
            [error]="errorFor('requested_amount')"
            required
          >
            <ui-input-affix prefix="R">
              <input uiInput uiMoneyInput formControlName="requested_amount" />
            </ui-input-affix>
          </ui-form-field>

          <ui-form-field
            label="When do you need it by?"
            hint="This helps the reviewer understand your timing. It does not move you up a queue — a person decides that, not the form."
            optionalMarker
          >
            <input uiInput formControlName="needed_by" type="date" />
          </ui-form-field>
        }

        @case (2) {
          <ui-form-field label="Who funded your studies before this?" optionalMarker>
            <select uiSelect formControlName="prior_funder">
              <option value="">Choose one…</option>
              <option value="NSFAS">NSFAS</option>
              <option value="OTHER_BURSARY">Another bursary</option>
              <option value="SELF">Myself or my family</option>
              <option value="NONE">Nobody — this is my first funding</option>
            </select>
          </ui-form-field>

          @if (showDefundedBy()) {
            <ui-form-field
              label="Which funder stopped supporting you?"
              hint="The name is enough."
              optionalMarker
            >
              <input uiInput formControlName="defunded_by" />
            </ui-form-field>
          }

          <ui-form-field
            label="Roughly what does your household earn in a year?"
            hint="This is not a test you can fail. It gives the reviewer context, and you may choose not to say."
            optionalMarker
          >
            <!-- The bands and their figures are the contract's, translated in
                 one place (application-labels.ts). A rand figure typed into a
                 screen cannot be told apart from an invented one, which is why
                 the account-data-integrity gate refuses them here. -->
            <select uiSelect formControlName="household_income_band">
              <option value="">Choose one…</option>
              <option value="SASSA_GRANT">We receive a SASSA grant</option>
              @for (band of incomeBands; track band.value) {
                <option [value]="band.value">{{ band.label }}</option>
              }
              <option value="PREFER_NOT_TO_SAY">I would rather not say</option>
            </select>
          </ui-form-field>

          @if (isCategoryC()) {
            <!-- Only UG_CAT_C has an NSFAS outcome letter to read this off
                 (D-016). Asking anyone else is asking for something they
                 cannot know. -->
            <ui-form-field
              label="What reason did NSFAS give?"
              hint="It is on your outcome letter. If you are not sure, choose the closest one."
              optionalMarker
            >
              <select uiSelect formControlName="nsfas_decline_reason">
                <option value="">Choose one…</option>
                <option value="MEANS_INCOME">Household income was too high</option>
                <option value="DOCUMENTATION">Documents were missing or rejected</option>
                <option value="ADMINISTRATIVE">An administrative problem</option>
                <option value="ACADEMIC_NPLUS">I had studied for too many years</option>
                <option value="OTHER">Something else</option>
              </select>
            </ui-form-field>
          }
        }
      }

      <div class="mt-2 flex flex-wrap items-center gap-3">
        @if (step() > 0) {
          <ui-button type="button" variant="ghost" (clicked)="back()">Back</ui-button>
        }
        <!-- The label states what the button actually does. It used to say
             "Create my application", which was true and deeply misleading: it
             created a draft nobody would ever read. -->
        <ui-button type="submit" [loading]="submitting()">
          {{ isLastStep() ? 'Send my application for review' : 'Continue' }}
        </ui-button>
      </div>
    </form>
  `,
})
export class ApplyStepsComponent {
  /** The contract's income bands, translated once (application-labels.ts). */
  protected readonly incomeBands = Object.entries(INCOME_BAND_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly step = signal(0);
  protected readonly submitting = signal(false);
  private readonly errorCode = signal<string | null>(null);

  /** The saved application, once it exists. Nothing is lost after this point. */
  protected readonly draftId = signal<string | null>(null);
  /** D-007 stopped the submission: the work is saved, one thing is missing. */
  protected readonly needsSaId = signal(false);

  protected readonly steps = [
    { label: 'Your year', heading: 'Which year is this for?' },
    { label: 'What you need', heading: 'What would help?' },
    { label: 'Your funding history', heading: 'A little context' },
  ];

  /** The current year and the next: funding is applied for ahead, not behind. */
  protected readonly years = [new Date().getFullYear(), new Date().getFullYear() + 1].map(String);

  protected readonly applicationType = computed<ApplicationType>(() => {
    const segment = this.route.snapshot.paramMap.get('category') ?? '';
    return segment.toUpperCase() as ApplicationType;
  });

  protected readonly isCategoryC = computed(() => this.applicationType() === 'UG_CAT_C');
  protected readonly isLastStep = computed(() => this.step() === this.steps.length - 1);
  protected readonly failure = computed(() => {
    const code = this.errorCode();
    return code ? presentError(code) : null;
  });

  readonly form = this.fb.nonNullable.group({
    academic_year: ['', { validators: [Validators.required], updateOn: 'blur' }],
    // A string, and it stays one. No numeric validator, because a numeric
    // validator is the first step toward treating money as a number.
    requested_amount: ['', { validators: [Validators.required], updateOn: 'blur' }],
    needed_by: [''],
    prior_funder: [''],
    defunded_by: [''],
    household_income_band: [''],
    nsfas_decline_reason: [''],
  });

  protected readonly showDefundedBy = computed(() => true);

  protected errorFor(name: 'academic_year' | 'requested_amount'): string | null {
    const control = this.form.controls[name];
    if (!control.touched || control.valid) {
      return null;
    }
    return name === 'academic_year'
      ? 'Choose the year you need funding for.'
      : 'Tell us roughly how much you need.';
  }

  protected back(): void {
    this.step.update((current) => Math.max(0, current - 1));
  }

  protected next(): void {
    if (!this.isLastStep()) {
      // Validate only the fields on this step: marking the whole form touched
      // would show errors for questions the student has not been asked yet.
      for (const name of this.fieldsFor(this.step())) {
        this.form.controls[name].markAsTouched();
      }
      if (this.fieldsFor(this.step()).some((name) => this.form.controls[name].invalid)) {
        return;
      }
      this.step.update((current) => current + 1);
      return;
    }
    this.submit();
  }

  private fieldsFor(step: number): ('academic_year' | 'requested_amount')[] {
    if (step === 0) {
      return ['academic_year'];
    }
    if (step === 1) {
      return ['requested_amount'];
    }
    return [];
  }

  private submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.submitting.set(true);
    this.errorCode.set(null);

    const value = this.form.getRawValue();
    const body: Schema<'ApplicationInput'> = {
      application_type: this.applicationType(),
      academic_year: value.academic_year,
      // The string the student typed, unchanged. Trimmed only of whitespace.
      requested_amount: value.requested_amount.trim(),
      ...(value.needed_by ? { needed_by: value.needed_by } : {}),
      ...(value.prior_funder
        ? { prior_funder: value.prior_funder as 'NSFAS' | 'OTHER_BURSARY' | 'SELF' | 'NONE' }
        : {}),
      ...(value.defunded_by ? { defunded_by: value.defunded_by } : {}),
      ...(value.household_income_band
        ? {
            household_income_band: value.household_income_band as
              | 'SASSA_GRANT'
              | 'LTE_350K'
              | 'MISSING_MIDDLE_350_600K'
              | 'GT_600K'
              | 'PREFER_NOT_TO_SAY',
          }
        : {}),
      ...(this.isCategoryC() && value.nsfas_decline_reason
        ? {
            nsfas_decline_reason: value.nsfas_decline_reason as
              | 'MEANS_INCOME'
              | 'DOCUMENTATION'
              | 'ADMINISTRATIVE'
              | 'ACADEMIC_NPLUS'
              | 'OTHER',
          }
        : {}),
    };

    this.api.post<Schema<'Application'>>('/applications', body).subscribe({
      next: (application) => this.sendForReview(application.id),
      error: (error: unknown) => {
        this.errorCode.set(error instanceof ApiError ? error.code : null);
        this.submitting.set(false);
      },
    });
  }

  /**
   * Hand the application to a person.
   *
   * This step was missing, and its absence was the most serious defect in the
   * product: `POST /applications` only creates a DRAFT, so an application
   * finished here sat unread forever while the student believed a reviewer had
   * it. Creating and submitting are two calls because they are two facts — the
   * work is saved first, and only then offered for review, so a failure at the
   * second one cannot lose the first.
   */
  private sendForReview(applicationId: string): void {
    this.draftId.set(applicationId);

    this.api
      .post<Schema<'Application'>>('/applications/{id}/submit', undefined, {
        path: { id: applicationId },
      })
      .subscribe({
        next: () => void this.router.navigateByUrl(`/app/applications/${applicationId}`),
        error: (error: unknown) => {
          this.submitting.set(false);
          const code = error instanceof ApiError ? error.code : null;

          // D-007: the SA ID must be on file before submitting, because it is
          // what makes duplicate detection real at the moment money is at
          // stake. It is a missing step, not a failure — the application is
          // already saved, and the student is shown the way to finish it (P2).
          if (code === 'sa_id_required') {
            this.needsSaId.set(true);
            return;
          }
          this.errorCode.set(code);
        },
      });
  }

  /** Keep the work, go and add the one missing thing, come back to it. */
  protected addIdNumber(): void {
    void this.router.navigateByUrl('/app/profile');
  }

  protected openDraft(): void {
    const id = this.draftId();
    if (id) {
      void this.router.navigateByUrl(`/app/applications/${id}`);
    }
  }
}
