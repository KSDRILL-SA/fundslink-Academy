import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from 'data-access';
import {
  UiButtonComponent,
  UiCheckboxDirective,
  UiFormFieldComponent,
  UiInputDirective,
  UiPasswordFieldComponent,
  presentError,
} from 'ui';

import { AuthService } from '../auth.service';

/**
 * S04 — Register.
 *
 * Consents are recorded server-side as ConsentRecord rows (BR-A05). The
 * password policy is enforced authoritatively by the API (S3.32) — the rule
 * shown here is guidance so someone learns it before submitting, not a second
 * source of truth.
 *
 * The tone is P1: a capable adult starting something, not an applicant being
 * screened. The page says what this costs (nothing) because that is the first
 * question a student actually has.
 */
@Component({
  selector: 'fl-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    UiFormFieldComponent,
    UiInputDirective,
    UiCheckboxDirective,
    UiPasswordFieldComponent,
    UiButtonComponent,
  ],
  template: `
    <h1 class="text-2xl font-semibold tracking-tight">Create your account</h1>
    <p class="mt-1 text-muted-foreground">
      Free to apply, and a person reads every application.
    </p>

    <form class="mt-6 flex flex-col gap-5" [formGroup]="form" (ngSubmit)="submit()">
      @if (failure(); as problem) {
        <div role="alert" class="rounded-lg border border-destructive/30 bg-destructive/8 p-4">
          <p class="font-medium text-foreground">{{ problem.title }}</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
        </div>
      }

      <ui-form-field label="Email" [error]="emailError()" required>
        <input uiInput formControlName="email" type="email" inputmode="email" autocomplete="email" />
      </ui-form-field>

      <ui-form-field
        label="Password"
        hint="At least 10 characters. A phrase you will remember beats a short password you will not."
        [error]="passwordError()"
        required
      >
        <ui-password-field>
          <input uiInput formControlName="password" type="password" autocomplete="new-password" />
        </ui-password-field>
      </ui-form-field>

      <div class="flex items-start gap-3">
        <input uiCheckbox id="consent" type="checkbox" formControlName="consent" class="mt-1" />
        <label for="consent" class="text-sm text-muted-foreground">
          I accept the
          <a
            routerLink="/terms"
            class="rounded-sm text-primary underline underline-offset-4 outline-none
                   focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring"
            >Terms of Service</a
          >
          and
          <a
            routerLink="/privacy"
            class="rounded-sm text-primary underline underline-offset-4 outline-none
                   focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring"
            >Privacy Policy</a
          >.
        </label>
      </div>
      @if (consentError()) {
        <p role="alert" class="-mt-3 text-sm font-medium text-destructive">{{ consentError() }}</p>
      }

      <ui-button type="submit" [loading]="submitting()" full>Create account</ui-button>
    </form>

    <p class="mt-6 text-sm text-muted-foreground">
      Already have an account?
      <a
        routerLink="/auth/login"
        class="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline
               focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring"
        >Sign in</a
      >
    </p>
  `,
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  private readonly errorCode = signal<string | null>(null);

  protected readonly failure = computed(() => {
    const code = this.errorCode();
    return code ? presentError(code) : null;
  });

  readonly form = this.fb.nonNullable.group({
    email: ['', { validators: [Validators.required, Validators.email], updateOn: 'blur' }],
    password: [
      '',
      { validators: [Validators.required, Validators.minLength(10)], updateOn: 'blur' },
    ],
    consent: [false, [Validators.requiredTrue]],
  });

  protected emailError(): string | null {
    const control = this.form.controls.email;
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required')
      ? 'Enter your email address.'
      : 'Enter a valid email address.';
  }

  protected passwordError(): string | null {
    const control = this.form.controls.password;
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required')
      ? 'Choose a password.'
      : 'Use at least 10 characters.';
  }

  protected consentError(): string | null {
    const control = this.form.controls.consent;
    return control.touched && control.invalid
      ? 'You need to accept the terms to create an account.'
      : null;
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.submitting.set(true);
    this.errorCode.set(null);

    const { email, password } = this.form.getRawValue();
    this.auth
      .register({
        email,
        password,
        // The consent purpose and wording version are what BR-A05 records; the
        // checkbox is the evidence, these are the terms it was given under.
        //
        // TWO purposes, because the checkbox names two documents. The screen
        // previously sent a single invented 'TERMS_AND_PRIVACY', which the API
        // has never accepted — registration failed for everyone (#254). The
        // contract now enumerates the seeded set, so a wrong value here is a
        // compile error rather than a 422 nobody sees until a real request.
        consents: [
          { purpose: 'TERMS_OF_SERVICE', wording_version: 'v1' },
          { purpose: 'PRIVACY_POLICY', wording_version: 'v1' },
        ],
      })
      .subscribe({
        next: () => void this.router.navigateByUrl('/auth/verify-email'),
        error: (error: unknown) => {
          this.errorCode.set(error instanceof ApiError ? error.code : null);
          this.submitting.set(false);
        },
      });
  }
}
