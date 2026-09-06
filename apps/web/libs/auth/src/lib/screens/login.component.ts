import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../auth.service';

/** S05 — Login. The access token returns in memory (S3.14); the refresh cookie is set by the
 *  server. mfa_code is shown only when the server reports a privileged account needs it. */
@Component({
    selector: 'fl-login',
    imports: [ReactiveFormsModule, RouterLink],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
    <section class="mx-auto max-w-sm p-6">
      <h1 class="text-2xl font-semibold text-slate-900">Welcome back</h1>
      <p class="mt-1 text-sm text-slate-500">Sign in to continue your funding journey.</p>

      <form class="mt-6 space-y-4" [formGroup]="form" (ngSubmit)="submit()">
        <label class="block">
          <span class="text-sm font-medium text-slate-700">Email</span>
          <input formControlName="email" type="email" autocomplete="email"
                 class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label class="block">
          <span class="text-sm font-medium text-slate-700">Password</span>
          <input formControlName="password" type="password" autocomplete="current-password"
                 class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label class="block">
          <span class="text-sm font-medium text-slate-700">Authenticator code (if required)</span>
          <input formControlName="mfa_code" inputmode="numeric" autocomplete="one-time-code"
                 class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>

        @if (error()) {
          <p role="alert" class="text-sm text-red-600">{{ error() }}</p>
        }

        <button type="submit" [disabled]="submitting() || form.invalid"
                class="w-full rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-50">
          {{ submitting() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <p class="mt-4 text-sm text-slate-500">
        New here? <a routerLink="/auth/register" class="font-medium text-primary">Create an account</a>
      </p>
    </section>
  `
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    mfa_code: [''],
  });

  submit(): void {
    if (this.form.invalid) {
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const { email, password, mfa_code } = this.form.getRawValue();
    this.auth.login({ email, password, mfa_code: mfa_code || undefined }).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (err) => {
        this.error.set(err?.error?.error?.message ?? 'Could not sign in. Please try again.');
        this.submitting.set(false);
      },
    });
  }
}
