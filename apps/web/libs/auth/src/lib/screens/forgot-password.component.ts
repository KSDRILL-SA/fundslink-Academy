import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthApiService } from '../auth-api.service';

/** S07a — Forgot password. The response is always the same (enumeration-proof, S3.30). */
@Component({
  selector: 'fl-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="mx-auto max-w-sm p-6">
      <h1 class="text-2xl font-semibold text-slate-900">Reset your password</h1>
      @if (submitted()) {
        <p class="mt-4 text-slate-600">
          If an account exists for that email, we've sent a reset link. Check your inbox.
        </p>
        <a routerLink="/login" class="mt-4 inline-block font-medium text-blue-700">Back to sign in</a>
      } @else {
        <p class="mt-1 text-sm text-slate-500">We'll email you a link to set a new password.</p>
        <form class="mt-6 space-y-4" [formGroup]="form" (ngSubmit)="submit()">
          <input formControlName="email" type="email" autocomplete="email" placeholder="you@university.ac.za"
                 class="w-full rounded-lg border border-slate-300 px-3 py-2" />
          <button type="submit" [disabled]="form.invalid || submitting()"
                  class="w-full rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-50">
            {{ submitting() ? 'Sending…' : 'Send reset link' }}
          </button>
        </form>
      }
    </section>
  `,
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AuthApiService);

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) {
      return;
    }
    this.submitting.set(true);
    // Always land on the same confirmation (never reveal whether the account exists).
    this.api.forgotPassword(this.form.getRawValue().email).subscribe({
      next: () => this.submitted.set(true),
      error: () => this.submitted.set(true),
    });
  }
}
