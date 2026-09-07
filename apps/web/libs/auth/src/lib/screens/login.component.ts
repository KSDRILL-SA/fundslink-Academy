import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from 'data-access';
import {
  UiButtonComponent,
  UiFormFieldComponent,
  UiInputDirective,
  UiPasswordFieldComponent,
  presentError,
} from 'ui';

import { AuthService } from '../auth.service';

/**
 * S05 — Login.
 *
 * The access token returns in memory only (S3.14); the refresh token is an
 * HttpOnly cookie this code never sees.
 *
 * **The authenticator field is hidden until the server asks for it.** Showing
 * it to everyone means every student meets a field for a device they do not
 * have, on the screen where they are already least confident — MFA is required
 * of privileged accounts (ST-2.1), not of students. The server says so with
 * `mfa_required`, and the screen reacts to that code.
 *
 * Errors are rendered from the stable `error.code` through the presentation
 * table, never from `error.message` (S4.12).
 */
@Component({
  selector: 'fl-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    UiFormFieldComponent,
    UiInputDirective,
    UiPasswordFieldComponent,
    UiButtonComponent,
  ],
  template: `
    <h1 class="text-2xl font-semibold tracking-tight">Welcome back</h1>
    <p class="mt-1 text-muted-foreground">Sign in to continue your funding journey.</p>

    <form class="mt-6 flex flex-col gap-5" [formGroup]="form" (ngSubmit)="submit()">
      @if (failure(); as problem) {
        <div role="alert" class="rounded-lg border border-destructive/30 bg-destructive/8 p-4">
          <p class="font-medium text-foreground">{{ problem.title }}</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
        </div>
      }

      <ui-form-field label="Email" [error]="fieldError('email')" required>
        <input uiInput formControlName="email" type="email" inputmode="email" autocomplete="email" />
      </ui-form-field>

      <ui-form-field label="Password" [error]="fieldError('password')" required>
        <ui-password-field>
          <input uiInput formControlName="password" type="password" autocomplete="current-password" />
        </ui-password-field>
      </ui-form-field>

      @if (mfaRequired()) {
        <ui-form-field
          label="Authenticator code"
          hint="Open your authenticator app and enter the 6-digit code."
        >
          <input
            uiInput
            formControlName="mfa_code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
          />
        </ui-form-field>
      }

      <ui-button type="submit" [loading]="submitting()" full>Sign in</ui-button>
    </form>

    <div class="mt-6 flex flex-col gap-2 text-sm">
      <a
        routerLink="/auth/forgot-password"
        class="rounded-sm text-muted-foreground underline-offset-4 outline-none hover:underline
               focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring"
        >Forgot your password?</a
      >
      <p class="text-muted-foreground">
        New here?
        <a
          routerLink="/auth/register"
          class="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline
                 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring"
          >Create an account</a
        >
      </p>
    </div>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  private readonly errorCode = signal<string | null>(null);

  /** The server asked for a second factor; only then does the field appear. */
  protected readonly mfaRequired = computed(() =>
    ['mfa_required', 'mfa_invalid_code'].includes(this.errorCode() ?? ''),
  );

  protected readonly failure = computed(() => {
    const code = this.errorCode();
    return code ? presentError(code) : null;
  });

  readonly form = this.fb.nonNullable.group({
    // Validated on blur, not on every keystroke: telling someone their email
    // is wrong after two characters is scolding them for not having finished.
    email: ['', { validators: [Validators.required, Validators.email], updateOn: 'blur' }],
    password: ['', { validators: [Validators.required], updateOn: 'blur' }],
    mfa_code: [''],
  });

  protected fieldError(name: 'email' | 'password'): string | null {
    const control = this.form.controls[name];
    if (!control.touched || control.valid) {
      return null;
    }
    if (control.hasError('required')) {
      return name === 'email' ? 'Enter your email address.' : 'Enter your password.';
    }
    return 'Enter a valid email address.';
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.submitting.set(true);
    this.errorCode.set(null);

    const { email, password, mfa_code } = this.form.getRawValue();
    this.auth.login({ email, password, mfa_code: mfa_code || undefined }).subscribe({
      // Into the application, not back to the marketing site.
      next: () => void this.router.navigateByUrl('/app'),
      error: (error: unknown) => {
        this.errorCode.set(error instanceof ApiError ? error.code : null);
        this.submitting.set(false);
      },
    });
  }
}
