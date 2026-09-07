import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  UiButtonComponent,
  UiFormFieldComponent,
  UiInputDirective,
  UiSkeletonComponent,
  UiSuccessStateComponent,
} from 'ui';

import { AuthApiService } from '../auth-api.service';

/**
 * S06 — Verify email.
 *
 * Consumes a single-use `?token=` link, and offers a resend form otherwise —
 * because the common arrival here is not a click on the link but a student who
 * closed the tab, or whose email client mangled it (P2: never a dead end).
 *
 * An expired link is stated as a fact with a remedy, not as a failure. Links
 * expire by design, and someone arriving a day late has done nothing wrong.
 */
@Component({
  selector: 'fl-verify-email',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    UiFormFieldComponent,
    UiInputDirective,
    UiButtonComponent,
    UiSuccessStateComponent,
    UiSkeletonComponent,
  ],
  template: `
    <h1 class="text-2xl font-semibold tracking-tight">Verify your email</h1>

    @switch (state()) {
      @case ('verifying') {
        <!-- A skeleton, not a spinner: it reserves the space the result will
             occupy, so nothing jumps when it arrives (§4). -->
        <div class="mt-6 flex flex-col gap-3">
          <ui-skeleton class="h-5 w-48" />
          <ui-skeleton class="h-4 w-full" />
        </div>
        <p class="sr-only" role="status">Verifying your email address.</p>
      }

      @case ('verified') {
        <ui-success-state
          class="mt-6"
          title="Your email is verified"
          message="That is the last of the admin. Sign in and let us find you funding."
        />
        <a
          routerLink="/auth/login"
          class="mt-6 inline-block rounded-sm font-medium text-primary underline-offset-4
                 outline-none hover:underline focus-visible:outline-[3px]
                 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >Continue to sign in</a
        >
      }

      @default {
        @if (state() === 'error') {
          <p class="mt-4 text-muted-foreground">
            That link has expired or has already been used. Links are single-use for your
            security — here is a fresh one.
          </p>
        } @else {
          <p class="mt-1 text-muted-foreground">
            We sent you a link. Did not arrive? Send another one.
          </p>
        }

        @if (resent()) {
          <ui-success-state
            class="mt-6"
            title="Sent"
            message="If that email is registered with us, a new link is on its way."
          />
        } @else {
          <form class="mt-6 flex flex-col gap-5" [formGroup]="resendForm" (ngSubmit)="resend()">
            <ui-form-field label="Email" [error]="emailError()" required>
              <input
                uiInput
                formControlName="email"
                type="email"
                inputmode="email"
                autocomplete="email"
              />
            </ui-form-field>
            <ui-button type="submit" full>Send a new link</ui-button>
          </form>
        }
      }
    }
  `,
})
export class VerifyEmailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AuthApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly state = signal<'idle' | 'verifying' | 'verified' | 'error'>('idle');
  protected readonly resent = signal(false);

  readonly resendForm = this.fb.nonNullable.group({
    email: ['', { validators: [Validators.required, Validators.email], updateOn: 'blur' }],
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

  protected emailError(): string | null {
    const control = this.resendForm.controls.email;
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required')
      ? 'Enter your email address.'
      : 'Enter a valid email address.';
  }

  resend(): void {
    this.resendForm.markAllAsTouched();
    if (this.resendForm.invalid) {
      return;
    }
    // Enumeration-proof: the same confirmation either way, so this form cannot
    // be used to discover who has registered (S3.30).
    this.api.resendVerification(this.resendForm.getRawValue().email).subscribe({
      next: () => this.resent.set(true),
      error: () => this.resent.set(true),
    });
  }
}
