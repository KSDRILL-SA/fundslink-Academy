import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError, ApiService } from 'data-access';
import { KeyRound, ShieldCheck } from 'lucide';
import {
  UiButtonComponent,
  UiCardComponent,
  UiFormFieldComponent,
  UiInputDirective,
  UiPasswordFieldComponent,
  UiSuccessStateComponent,
  presentError,
  type IconNode,
} from 'ui';
import { PageHeaderComponent } from '../../shared/page-header.component';

/** What the server returns once, at enrolment. */
interface MfaEnrolment {
  readonly secret: string;
  readonly provisioning_uri: string;
  readonly recovery_codes: string[];
}

/**
 * Account and security.
 *
 * Built because two implemented capabilities had no button anywhere in this
 * product: `POST /auth/change-password` and the MFA pair
 * (`/auth/mfa/enroll` + `/auth/mfa/activate`). A person who believes someone
 * knows their password could not change it, and staff who are *required* to
 * carry a second factor had no way to set one up.
 *
 * Two rules shape this screen.
 *
 * **The server is the authority on password strength** (S3.32). There is no
 * client-side meter: a meter that disagrees with the server teaches the wrong
 * rule and then rejects the password it just called strong. The minimum length
 * is stated because the contract states it; everything else is the server's
 * answer, rendered through the error presentation table.
 *
 * **Recovery codes are shown exactly once, and the screen says so before they
 * appear.** They are the only way back into an account whose second factor is
 * lost, and a person who scrolls past them without understanding that has been
 * set up to be locked out.
 */
@Component({
  selector: 'fl-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiCardComponent,
    UiButtonComponent,
    UiFormFieldComponent,
    UiInputDirective,
    UiPasswordFieldComponent,
    UiSuccessStateComponent,
    PageHeaderComponent,
  ],
  template: `
    <fl-page-header
      eyebrow="Account"
      title="Account & security"
      lead="Your password and your second factor. Nothing here changes your application."
      [icon]="shieldIcon"
      tone="navy"
    />

    <!-- ---------- Password ---------- -->
    <ui-card class="mt-8 max-w-2xl">
      <h2 class="text-lg font-semibold">Change your password</h2>
      <p class="mt-2 max-w-prose text-muted-foreground">
        You will stay signed in on this device. If you think someone else knows your password,
        change it now and then sign out everywhere else by signing out here.
      </p>

      <form class="mt-6 flex flex-col gap-5" [formGroup]="passwordForm" (ngSubmit)="changePassword()">
        @if (passwordFailure(); as problem) {
          <div role="alert" class="rounded-lg border border-destructive/30 bg-destructive/8 p-4">
            <p class="font-medium text-foreground">{{ problem.title }}</p>
            <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
          </div>
        }

        <ui-form-field label="Your current password" required>
          <ui-password-field formControlName="current_password" autocomplete="current-password" />
        </ui-form-field>

        <!-- The 10-character floor is the contract's (ChangePasswordRequest).
             Everything else about strength is the server's judgement (S3.32). -->
        <ui-form-field
          label="Your new password"
          hint="At least 10 characters. A phrase you will remember beats a short password with symbols in it."
          [error]="newPasswordError()"
          required
        >
          <ui-password-field formControlName="new_password" autocomplete="new-password" />
        </ui-form-field>

        <div class="flex flex-wrap items-center gap-3">
          <ui-button type="submit" [loading]="changingPassword()">Change password</ui-button>
          @if (passwordChanged()) {
            <p role="status" class="text-sm font-medium text-success">
              Your password has been changed.
            </p>
          }
        </div>
      </form>
    </ui-card>

    <!-- ---------- Two-factor ---------- -->
    <ui-card class="mt-6 max-w-2xl">
      <h2 class="text-lg font-semibold">Two-step sign-in</h2>
      <p class="mt-2 max-w-prose text-muted-foreground">
        A code from an app on your phone, on top of your password. Reviewers and anyone who can see
        student information are required to use it; everyone else is welcome to.
      </p>

      @if (!enrolment()) {
        @if (enrolFailure(); as problem) {
          <div role="alert" class="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-4">
            <p class="font-medium text-foreground">{{ problem.title }}</p>
            <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
          </div>
        }
        <div class="mt-5">
          <ui-button variant="secondary" [loading]="enrolling()" (clicked)="startEnrolment()">
            Set up two-step sign-in
          </ui-button>
        </div>
      } @else {
        <div class="mt-5 flex flex-col gap-5">
          <div>
            <p class="font-medium">1. Add this to your authenticator app</p>
            <p class="mt-1 text-sm text-muted-foreground">
              Type this key into the app, or open the link it belongs to.
            </p>
            <!-- Selectable, in a monospace face, because it is copied by hand
                 as often as it is scanned. -->
            <p class="tabular mt-2 select-all break-all rounded-lg bg-secondary p-3 font-mono text-sm">
              {{ enrolment()?.secret }}
            </p>
          </div>

          <div>
            <p class="font-medium">2. Keep these recovery codes</p>
            <p class="mt-1 text-sm text-muted-foreground">
              They are shown once and never again. Each one signs you in if you lose your phone —
              store them somewhere other than that phone.
            </p>
            <ul class="mt-2 grid gap-1 rounded-lg bg-secondary p-3 font-mono text-sm sm:grid-cols-2">
              @for (code of enrolment()?.recovery_codes ?? []; track code) {
                <li class="select-all">{{ code }}</li>
              }
            </ul>
          </div>

          <form class="flex flex-col gap-4" [formGroup]="mfaForm" (ngSubmit)="activate()">
            @if (activateFailure(); as problem) {
              <div role="alert" class="rounded-lg border border-destructive/30 bg-destructive/8 p-4">
                <p class="font-medium text-foreground">{{ problem.title }}</p>
                <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
              </div>
            }

            <ui-form-field
              label="3. Enter the six-digit code from the app"
              hint="This confirms the app and your account agree before we switch it on."
              required
            >
              <input
                uiInput
                formControlName="code"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
              />
            </ui-form-field>

            <div>
              <ui-button type="submit" [loading]="activating()">Turn on two-step sign-in</ui-button>
            </div>
          </form>
        </div>
      }

      @if (mfaActive()) {
        <ui-success-state
          class="mt-4"
          title="Two-step sign-in is on"
          message="You will be asked for a code from your app the next time you sign in."
        />
      }
    </ui-card>
  `,
})
export class AccountComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);

  protected readonly shieldIcon = ShieldCheck as IconNode;
  protected readonly keyIcon = KeyRound as IconNode;

  protected readonly changingPassword = signal(false);
  protected readonly passwordChanged = signal(false);
  private readonly passwordError = signal<string | null>(null);

  protected readonly enrolling = signal(false);
  protected readonly enrolment = signal<MfaEnrolment | null>(null);
  private readonly enrolError = signal<string | null>(null);

  protected readonly activating = signal(false);
  protected readonly mfaActive = signal(false);
  private readonly activateError = signal<string | null>(null);

  protected readonly passwordFailure = computed(() => present(this.passwordError()));
  protected readonly enrolFailure = computed(() => present(this.enrolError()));
  protected readonly activateFailure = computed(() => present(this.activateError()));

  readonly passwordForm = this.fb.nonNullable.group({
    current_password: ['', { validators: [Validators.required], updateOn: 'blur' }],
    // The contract's floor (min_length=10). The server decides everything else.
    new_password: [
      '',
      { validators: [Validators.required, Validators.minLength(10)], updateOn: 'blur' },
    ],
  });

  readonly mfaForm = this.fb.nonNullable.group({
    code: ['', { validators: [Validators.required], updateOn: 'blur' }],
  });

  protected newPasswordError(): string | null {
    const control = this.passwordForm.controls.new_password;
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('minlength')
      ? 'Use at least 10 characters.'
      : 'Choose a new password.';
  }

  protected changePassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) {
      return;
    }
    this.changingPassword.set(true);
    this.passwordChanged.set(false);
    this.passwordError.set(null);

    this.api.post<void>('/auth/change-password', this.passwordForm.getRawValue()).subscribe({
      next: () => {
        this.changingPassword.set(false);
        this.passwordChanged.set(true);
        // Never leave a password sitting in a form after it has been used.
        this.passwordForm.reset();
      },
      error: (error: unknown) => {
        this.changingPassword.set(false);
        this.passwordError.set(error instanceof ApiError ? error.code : null);
      },
    });
  }

  protected startEnrolment(): void {
    this.enrolling.set(true);
    this.enrolError.set(null);

    this.api.post<MfaEnrolment>('/auth/mfa/enroll').subscribe({
      next: (enrolment) => {
        this.enrolling.set(false);
        this.enrolment.set(enrolment);
      },
      error: (error: unknown) => {
        this.enrolling.set(false);
        this.enrolError.set(error instanceof ApiError ? error.code : null);
      },
    });
  }

  protected activate(): void {
    this.mfaForm.markAllAsTouched();
    if (this.mfaForm.invalid) {
      return;
    }
    this.activating.set(true);
    this.activateError.set(null);

    this.api.post<void>('/auth/mfa/activate', this.mfaForm.getRawValue()).subscribe({
      next: () => {
        this.activating.set(false);
        this.mfaActive.set(true);
        // The secret and the codes leave the screen the moment they are no
        // longer needed. They were shown once; they do not linger in the DOM.
        this.enrolment.set(null);
        this.mfaForm.reset();
      },
      error: (error: unknown) => {
        this.activating.set(false);
        this.activateError.set(error instanceof ApiError ? error.code : null);
      },
    });
  }
}

function present(code: string | null) {
  return code ? presentError(code) : null;
}
