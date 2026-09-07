import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiError, ApiService, type Schema } from 'data-access';
import {
  UiButtonComponent,
  UiFormFieldComponent,
  UiInputDirective,
  presentError,
} from 'ui';

/**
 * S19 — Register a tracked application.
 *
 * The student applied somewhere else and wants us to watch it with them. Two
 * fields, because anything longer than that competes with the thing they
 * actually came to do.
 *
 * `already_tracked` is not an error in any meaningful sense — it means the
 * student already did this. The screen says so and moves them along rather
 * than making them feel they got something wrong.
 */
@Component({
  selector: 'fl-register-tracked',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, UiFormFieldComponent, UiInputDirective, UiButtonComponent],
  template: `
    <h1 class="text-2xl font-semibold tracking-tight">Track another application</h1>
    <p class="mt-2 max-w-prose text-muted-foreground">
      Tell us which bursary you applied for and we will watch the deadline, and chase them if they
      go quiet.
    </p>

    <form class="mt-8 flex max-w-2xl flex-col gap-6" [formGroup]="form" (ngSubmit)="submit()">
      @if (failure(); as problem) {
        <div role="alert" class="rounded-lg border border-warning/40 bg-warning/10 p-4">
          <p class="font-medium text-foreground">{{ problem.title }}</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
        </div>
      }

      <ui-form-field
        label="Which bursary?"
        hint="Pick it from the list you were browsing, or paste the reference you were given."
        [error]="bursaryError()"
        required
      >
        <input uiInput formControlName="external_bursary_id" />
      </ui-form-field>

      <ui-form-field label="When did you apply?" optionalMarker>
        <input uiInput formControlName="applied_on" type="date" />
      </ui-form-field>

      <div>
        <ui-button type="submit" [loading]="submitting()">Start tracking it</ui-button>
      </div>
    </form>
  `,
})
export class RegisterTrackedComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  private readonly errorCode = signal<string | null>(null);

  protected readonly failure = computed(() => {
    const code = this.errorCode();
    return code ? presentError(code) : null;
  });

  readonly form = this.fb.nonNullable.group({
    external_bursary_id: ['', { validators: [Validators.required], updateOn: 'blur' }],
    applied_on: [''],
  });

  protected bursaryError(): string | null {
    const control = this.form.controls.external_bursary_id;
    return control.touched && control.invalid ? 'Tell us which bursary this is.' : null;
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.submitting.set(true);
    this.errorCode.set(null);

    const value = this.form.getRawValue();
    const body: Schema<'TrackedInput'> = {
      external_bursary_id: value.external_bursary_id,
      ...(value.applied_on ? { applied_on: value.applied_on } : {}),
    };

    this.api.post<Schema<'Tracked'>>('/tracked-applications', body).subscribe({
      next: () => void this.router.navigateByUrl('/app/tracking'),
      error: (error: unknown) => {
        this.errorCode.set(error instanceof ApiError ? error.code : null);
        this.submitting.set(false);
      },
    });
  }
}
