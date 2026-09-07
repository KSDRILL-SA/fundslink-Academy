import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiError } from 'data-access';
import {
  UiButtonComponent,
  UiErrorStateComponent,
  UiFormFieldComponent,
  UiInputDirective,
  UiSelectDirective,
  UiSkeletonComponent,
  UiTextareaDirective,
  presentError,
} from 'ui';
import { ProfileStore } from './profile.store';

/**
 * S09 — Profile builder.
 *
 * Filled once, reused for every application — which is the promise the home
 * page makes, so this screen has to be worth filling in. Grouped into three
 * plain sections rather than one wall of inputs (P8), each answering a
 * question a student can actually answer without looking anything up.
 *
 * **The ID number is handled differently on purpose.** It is encrypted at rest
 * and blind-indexed for uniqueness (BR-A04), and it is required before an
 * application can be submitted (D-007). Being asked for an ID number by a
 * website is exactly when a person should be suspicious — so the field says
 * why it is needed and what happens to it, rather than demanding it silently.
 *
 * The hardship narrative is optional and stays optional. Someone should not
 * have to describe the hardest thing in their life to create a profile.
 */
@Component({
  selector: 'fl-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiFormFieldComponent,
    UiInputDirective,
    UiSelectDirective,
    UiTextareaDirective,
    UiButtonComponent,
    UiSkeletonComponent,
    UiErrorStateComponent,
  ],
  template: `
    <h1 class="text-2xl font-semibold tracking-tight">Your profile</h1>
    <p class="mt-1 max-w-prose text-muted-foreground">
      Tell us about you once. Every bursary you apply for uses this — you will not retype it.
    </p>

    @switch (store.state().status) {
      @case ('loading') {
        <div class="mt-8 flex max-w-2xl flex-col gap-6">
          @for (row of [1, 2, 3, 4]; track row) {
            <div class="flex flex-col gap-2">
              <ui-skeleton class="h-4 w-28" />
              <ui-skeleton class="h-11 w-full" />
            </div>
          }
        </div>
        <p class="sr-only" role="status">Loading your profile.</p>
      }

      @case ('error') {
        <ui-error-state class="mt-8" [code]="store.state().errorCode" (retry)="store.load()" />
      }

      @default {
        <form class="mt-8 flex max-w-2xl flex-col gap-8" [formGroup]="form" (ngSubmit)="submit()">
          @if (failure(); as problem) {
            <div role="alert" class="rounded-lg border border-destructive/30 bg-destructive/8 p-4">
              <p class="font-medium text-foreground">{{ problem.title }}</p>
              <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
            </div>
          }

          <fieldset class="flex flex-col gap-5">
            <legend class="text-lg font-semibold">Who you are</legend>

            <ui-form-field label="First name" [error]="errorFor('first_name')" required>
              <input uiInput formControlName="first_name" autocomplete="given-name" />
            </ui-form-field>

            <ui-form-field label="Last name" [error]="errorFor('last_name')" required>
              <input uiInput formControlName="last_name" autocomplete="family-name" />
            </ui-form-field>

            <ui-form-field
              label="Phone number"
              hint="So we can reach you about your application. We will not use it for anything else."
              optionalMarker
            >
              <input uiInput formControlName="phone" type="tel" inputmode="tel" autocomplete="tel" />
            </ui-form-field>
          </fieldset>

          <fieldset class="flex flex-col gap-5">
            <legend class="text-lg font-semibold">What you study</legend>

            <ui-form-field label="Level of study" [error]="errorFor('level')" required>
              <select uiSelect formControlName="level">
                <option value="">Choose your level…</option>
                @for (option of levels; track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
            </ui-form-field>

            <ui-form-field
              label="Field of study"
              hint="For example: BCom Accounting, Nursing, Civil Engineering."
              [error]="errorFor('field_of_study')"
              required
            >
              <input uiInput formControlName="field_of_study" />
            </ui-form-field>
          </fieldset>

          <fieldset class="flex flex-col gap-5">
            <legend class="text-lg font-semibold">For your application</legend>

            <ui-form-field
              label="South African ID number"
              hint="Funders require this on every application. We encrypt it, we never show it back in full, and we never share it without your consent."
              optionalMarker
            >
              <input
                uiInput
                formControlName="id_number"
                inputmode="numeric"
                autocomplete="off"
                maxlength="13"
              />
            </ui-form-field>

            <ui-form-field
              label="Anything we should understand about your situation"
              hint="Optional, and in your own words. A person reads this — write in the language you think in."
              optionalMarker
            >
              <textarea uiTextarea formControlName="hardship_narrative" rows="5"></textarea>
            </ui-form-field>
          </fieldset>

          <div class="flex flex-wrap items-center gap-3">
            <ui-button type="submit" [loading]="saving()">Save profile</ui-button>
            @if (saved()) {
              <p role="status" class="text-sm font-medium text-success">Saved.</p>
            }
          </div>
        </form>
      }
    }
  `,
})
export class ProfileComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly store = inject(ProfileStore);

  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  private readonly errorCode = signal<string | null>(null);

  protected readonly failure = computed(() => {
    const code = this.errorCode();
    return code ? presentError(code) : null;
  });

  protected readonly levels = [
    { value: 'UG', label: 'Undergraduate' },
    { value: 'HONOURS', label: 'Honours' },
    { value: 'PGDIP', label: 'Postgraduate diploma' },
    { value: 'MASTERS', label: "Master's" },
    { value: 'PHD', label: 'PhD' },
  ];

  readonly form = this.fb.nonNullable.group({
    first_name: ['', { validators: [Validators.required], updateOn: 'blur' }],
    last_name: ['', { validators: [Validators.required], updateOn: 'blur' }],
    phone: [''],
    level: ['', { validators: [Validators.required], updateOn: 'blur' }],
    field_of_study: ['', { validators: [Validators.required], updateOn: 'blur' }],
    id_number: [''],
    hardship_narrative: [''],
  });

  constructor() {
    this.store.load();

    // Fill the form once the profile arrives. An existing profile is an edit,
    // not a blank form — retyping what we already hold is the fastest way to
    // make someone abandon this screen.
    effect(() => {
      const profile = this.store.profile();
      if (!profile) {
        return;
      }
      this.form.patchValue(
        {
          first_name: profile.first_name ?? '',
          last_name: profile.last_name ?? '',
          phone: profile.phone ?? '',
          level: profile.level ?? '',
          field_of_study: profile.field_of_study ?? '',
          // The API never returns the raw ID number (TAD §4.4), so this stays
          // blank on an edit. Leaving it blank means "unchanged".
          hardship_narrative: profile.hardship_narrative ?? '',
        },
        { emitEvent: false },
      );
    });
  }

  protected errorFor(name: 'first_name' | 'last_name' | 'level' | 'field_of_study'): string | null {
    const control = this.form.controls[name];
    if (!control.touched || control.valid) {
      return null;
    }
    const labels: Record<string, string> = {
      first_name: 'Enter your first name.',
      last_name: 'Enter your last name.',
      level: 'Choose your level of study.',
      field_of_study: 'Tell us what you are studying.',
    };
    return labels[name];
  }

  submit(): void {
    this.form.markAllAsTouched();
    this.saved.set(false);
    if (this.form.invalid) {
      return;
    }
    this.saving.set(true);
    this.errorCode.set(null);

    const value = this.form.getRawValue();
    this.store
      .save({
        first_name: value.first_name,
        last_name: value.last_name,
        level: value.level as 'UG' | 'HONOURS' | 'MASTERS' | 'PHD' | 'PGDIP',
        field_of_study: value.field_of_study,
        // Omit rather than send an empty string: an absent optional field and
        // one deliberately cleared are different intents.
        ...(value.phone ? { phone: value.phone } : {}),
        ...(value.id_number ? { id_number: value.id_number } : {}),
        ...(value.hardship_narrative ? { hardship_narrative: value.hardship_narrative } : {}),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.set(true);
          this.store.load();
        },
        error: (error: unknown) => {
          this.errorCode.set(error instanceof ApiError ? error.code : null);
          this.saving.set(false);
        },
      });
  }
}
