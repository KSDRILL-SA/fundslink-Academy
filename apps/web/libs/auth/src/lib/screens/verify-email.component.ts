import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthApiService } from '../auth-api.service';

/** S06 — Verify email. Consumes a `?token=` single-use link; offers a resend form otherwise. */
@Component({
    selector: 'fl-verify-email',
    imports: [ReactiveFormsModule, RouterLink],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
    <section class="mx-auto max-w-sm p-6">
      <h1 class="text-2xl font-semibold text-slate-900">Verify your email</h1>

      @switch (state()) {
        @case ('verifying') { <p class="mt-4 text-slate-600">Verifying…</p> }
        @case ('verified') {
          <p class="mt-4 text-green-700">Your email is verified.</p>
          <a routerLink="/auth/login" class="mt-4 inline-block font-medium text-primary">Continue to sign in</a>
        }
        @default {
          @if (state() === 'error') {
            <p role="alert" class="mt-4 text-red-600">That link is invalid or has expired.</p>
          }
          <p class="mt-2 text-sm text-slate-500">Need a new link?</p>
          <form class="mt-3 space-y-3" [formGroup]="resendForm" (ngSubmit)="resend()">
            <input formControlName="email" type="email" placeholder="you@university.ac.za"
                   class="w-full rounded-lg border border-slate-300 px-3 py-2" />
            <button type="submit" [disabled]="resendForm.invalid || resent()"
                    class="w-full rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-50">
              {{ resent() ? 'Sent — check your inbox' : 'Resend verification' }}
            </button>
          </form>
        }
      }
    </section>
  `
})
export class VerifyEmailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AuthApiService);
  private readonly fb = inject(FormBuilder);

  readonly state = signal<'idle' | 'verifying' | 'verified' | 'error'>('idle');
  readonly resent = signal(false);
  readonly resendForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.state.set('verifying');
      this.api.verifyEmail(token).subscribe({
        next: () => this.state.set('verified'),
        error: () => this.state.set('error'),
      });
    }
  }

  resend(): void {
    if (this.resendForm.invalid) {
      return;
    }
    // Enumeration-proof: always show success regardless of the server's (always-202) outcome.
    this.api.resendVerification(this.resendForm.getRawValue().email).subscribe({
      next: () => this.resent.set(true),
      error: () => this.resent.set(true),
    });
  }
}
