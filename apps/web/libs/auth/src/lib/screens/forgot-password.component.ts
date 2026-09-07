import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiButtonComponent, UiFormFieldComponent, UiInputDirective, UiSuccessStateComponent } from 'ui';

import { AuthApiService } from '../auth-api.service';

/**
 * S07a — Forgot password.
 *
 * The response is always identical whether or not the account exists (S3.30,
 * enumeration-proof) — including on error, which is why the failure path lands
 * on the same confirmation. A different message for "no such account" would
 * turn this form into a tool for discovering who has applied for funding.
 *
 * The email field previously had a placeholder and no label. A placeholder is
 * not a label: it disappears the moment someone types, and a screen reader
 * reaches an unnamed field.
 */
@Component({
  selector: 'fl-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    UiFormFieldComponent,
    UiInputDirective,
    UiButtonComponent,
    UiSuccessStateComponent,
  ],
  template: `
    <h1 class="text-2xl font-semibold tracking-tight">Reset your password</h1>

    @if (submitted()) {
      <ui-success-state
        class="mt-6"
        title="Check your inbox"
        message="If an account exists for that email, we have sent a link to set a new password. It expires in an hour."
      />
      <a
        routerLink="/auth/login"
        class="mt-6 inline-block rounded-sm font-medium text-primary underline-offset-4
               outline-none hover:underline focus-visible:outline-[3px]
               focus-visible:outline-offset-2 focus-visible:outline-ring"
        >Back to sign in</a
      >
    } @else {
      <p class="mt-1 text-muted-foreground">We will email you a link to set a new password.</p>

      <form class="mt-6 flex flex-col gap-5" [formGroup]="form" (ngSubmit)="submit()">
        <ui-form-field label="Email" [error]="emailError()" required>
          <input uiInput formControlName="email" type="email" inputmode="email" autocomplete="email" />
        </ui-form-field>

        <ui-button type="submit" [loading]="submitting()" full>Send reset link</ui-button>
      </form>

      <a
        routerLink="/auth/login"
        class="mt-6 inline-block rounded-sm text-sm text-muted-foreground underline-offset-4
               outline-none hover:underline focus-visible:outline-[3px]
               focus-visible:outline-offset-2 focus-visible:outline-ring"
        >Back to sign in</a
      >
    }
  `,
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AuthApiService);

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', { validators: [Validators.required, Validators.email], updateOn: 'blur' }],
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

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.submitting.set(true);
    // Both paths land on the same confirmation. Never reveal whether the
    // account exists (S3.30).
    this.api.forgotPassword(this.form.getRawValue().email).subscribe({
      next: () => this.submitted.set(true),
      error: () => this.submitted.set(true),
    });
  }
}
