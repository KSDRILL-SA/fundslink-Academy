import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthApiService } from '../auth-api.service';

/** S07b — Reset password. Consumes the `?token=` link; the API revokes all sessions on success. */
@Component({
  selector: 'fl-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="mx-auto max-w-sm p-6">
      <h1 class="text-2xl font-semibold text-slate-900">Choose a new password</h1>
      @if (done()) {
        <p class="mt-4 text-green-700">Your password has been reset.</p>
        <a routerLink="/login" class="mt-4 inline-block font-medium text-blue-700">Sign in</a>
      } @else if (!token) {
        <p class="mt-4 text-red-600">This reset link is missing or malformed.</p>
      } @else {
        <form class="mt-6 space-y-4" [formGroup]="form" (ngSubmit)="submit()">
          <input formControlName="password" type="password" autocomplete="new-password"
                 placeholder="New password"
                 class="w-full rounded-lg border border-slate-300 px-3 py-2" />
          <span class="block text-xs text-slate-400">At least 10 characters, mixed case, a number and a symbol.</span>
          @if (error()) { <p role="alert" class="text-sm text-red-600">{{ error() }}</p> }
          <button type="submit" [disabled]="form.invalid || submitting()"
                  class="w-full rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-50">
            {{ submitting() ? 'Saving…' : 'Set new password' }}
          </button>
        </form>
      }
    </section>
  `,
})
export class ResetPasswordComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AuthApiService);

  readonly token = this.route.snapshot.queryParamMap.get('token');
  readonly submitting = signal(false);
  readonly done = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(10)]],
  });

  submit(): void {
    if (this.form.invalid || !this.token) {
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.api.resetPassword(this.token, this.form.getRawValue().password).subscribe({
      next: () => this.done.set(true),
      error: (err) => {
        this.error.set(err?.error?.error?.message ?? 'Could not reset your password.');
        this.submitting.set(false);
      },
    });
  }
}
