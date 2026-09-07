import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiError } from 'data-access';
import {
  UiButtonComponent,
  UiErrorStateComponent,
  UiFormFieldComponent,
  UiInputDirective,
  UiPasswordFieldComponent,
  UiSuccessStateComponent,
  presentError,
} from 'ui';

import { AuthApiService } from '../auth-api.service';

/**
 * S07b — Reset password.
 *
 * Consumes the single-use `?token=` link; the API revokes every session on
 * success, which is why the next step is signing in again rather than being
 * dropped into the app.
 *
 * A missing token is not an error message in red — it is a state with a way
 * out (P2). Someone who opened a truncated link from an email client needs a
 * new link, not a diagnosis.
 */
@Component({
  selector: 'fl-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    UiFormFieldComponent,
    UiInputDirective,
    UiPasswordFieldComponent,
    UiButtonComponent,
    UiSuccessStateComponent,
    UiErrorStateComponent,
  ],
  template: `
    <h1 class="text-2xl font-semibold tracking-tight">Choose a new password</h1>

    @if (done()) {
      <ui-success-state
        class="mt-6"
        title="Your password is set"
        message="For your security we signed you out everywhere. Sign in with your new password."
      />
      <a
        routerLink="/auth/login"
        class="mt-6 inline-block rounded-sm font-medium text-primary underline-offset-4
               outline-none hover:underline focus-visible:outline-[3px]
               focus-visible:outline-offset-2 focus-visible:outline-ring"
        >Sign in</a
      >
    } @else if (!token) {
      <!-- Not a red wall: a state with a way out (P2). -->
      <ui-error-state class="mt-4" code="invalid_token" />
      <div class="text-center">
        <a
          routerLink="/auth/forgot-password"
          class="inline-block rounded-sm font-medium text-primary underline-offset-4
                 outline-none hover:underline focus-visible:outline-[3px]
                 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >Send me a new link</a
        >
      </div>
    } @else {
      <form class="mt-6 flex flex-col gap-5" [formGroup]="form" (ngSubmit)="submit()">
        @if (failure(); as problem) {
          <div role="alert" class="rounded-lg border border-destructive/30 bg-destructive/8 p-4">
            <p class="font-medium text-foreground">{{ problem.title }}</p>
            <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
          </div>
        }

        <ui-form-field
          label="New password"
          hint="At least 10 characters. A phrase you will remember beats a short password you will not."
          [error]="passwordError()"
          required
        >
          <ui-password-field>
            <input uiInput formControlName="password" type="password" autocomplete="new-password" />
          </ui-password-field>
        </ui-form-field>

        <ui-button type="submit" [loading]="submitting()" full>Set new password</ui-button>
      </form>
    }
  `,
})
export class ResetPasswordComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AuthApiService);

  readonly token = this.route.snapshot.queryParamMap.get('token');
  protected readonly submitting = signal(false);
  protected readonly done = signal(false);
  private readonly errorCode = signal<string | null>(null);

  protected readonly failure = computed(() => {
    const code = this.errorCode();
    return code ? presentError(code) : null;
  });

  readonly form = this.fb.nonNullable.group({
    password: [
      '',
      { validators: [Validators.required, Validators.minLength(10)], updateOn: 'blur' },
    ],
  });

  protected passwordError(): string | null {
    const control = this.form.controls.password;
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required') ? 'Choose a password.' : 'Use at least 10 characters.';
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.token) {
      return;
    }
    this.submitting.set(true);
    this.errorCode.set(null);

    this.api.resetPassword(this.token, this.form.getRawValue().password).subscribe({
      next: () => this.done.set(true),
      error: (error: unknown) => {
        // The stable code, never the server's message (S4.12).
        this.errorCode.set(error instanceof ApiError ? error.code : null);
        this.submitting.set(false);
      },
    });
  }
}
