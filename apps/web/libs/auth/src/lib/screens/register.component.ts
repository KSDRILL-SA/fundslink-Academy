import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../auth.service';

/** S04 — Register. Consents are recorded server-side as ConsentRecord rows (BR-A05). Password
 *  policy is validated authoritatively by the API (S3.32); this is UX-only pre-validation. */
@Component({
    selector: 'fl-register',
    imports: [ReactiveFormsModule, RouterLink],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
    <section class="mx-auto max-w-sm p-6">
      <h1 class="text-2xl font-semibold text-slate-900">Create your account</h1>
      <p class="mt-1 text-sm text-slate-500">Funding that sees you. Let's begin.</p>

      <form class="mt-6 space-y-4" [formGroup]="form" (ngSubmit)="submit()">
        <label class="block">
          <span class="text-sm font-medium text-slate-700">Email</span>
          <input formControlName="email" type="email" autocomplete="email"
                 class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label class="block">
          <span class="text-sm font-medium text-slate-700">Password</span>
          <input formControlName="password" type="password" autocomplete="new-password"
                 class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          <span class="mt-1 block text-xs text-slate-400">At least 10 characters, with a mix of cases, a number and a symbol.</span>
        </label>
        <label class="flex items-start gap-2">
          <input formControlName="consent" type="checkbox" class="mt-1" />
          <span class="text-sm text-slate-600">I accept the Terms of Service and Privacy Policy.</span>
        </label>

        @if (error()) {
          <p role="alert" class="text-sm text-red-600">{{ error() }}</p>
        }

        <button type="submit" [disabled]="submitting() || form.invalid"
                class="w-full rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-50">
          {{ submitting() ? 'Creating…' : 'Create account' }}
        </button>
      </form>

      <p class="mt-4 text-sm text-slate-500">
        Already have an account? <a routerLink="/login" class="font-medium text-blue-700">Sign in</a>
      </p>
    </section>
  `
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(10)]],
    consent: [false, [Validators.requiredTrue]],
  });

  submit(): void {
    if (this.form.invalid) {
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth
      .register({
        email,
        password,
        consents: [
          { purpose: 'TERMS_OF_SERVICE', wording_version: 'v1' },
          { purpose: 'PRIVACY_POLICY', wording_version: 'v1' },
        ],
      })
      .subscribe({
        next: () => this.router.navigateByUrl('/'),
        error: (err) => {
          this.error.set(err?.error?.error?.message ?? 'Could not create your account.');
          this.submitting.set(false);
        },
      });
  }
}
