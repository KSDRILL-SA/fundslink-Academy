import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError, ApiService, type Schema } from 'data-access';
import {
  UiButtonComponent,
  UiFormFieldComponent,
  UiSelectDirective,
  presentError,
} from 'ui';

type Tracked = Schema<'Tracked'>;

/**
 * The statuses a student can report about their own application.
 *
 * `lk_tracked_status` in the seeds (0002_seeds.sql) — every code the database
 * accepts, in the order an application actually moves. `REGISTERED` is absent
 * because it is the state a tracked application starts in, and offering
 * someone the status they already have is offering them nothing.
 */
const REPORTABLE: readonly { value: string; label: string }[] = [
  { value: 'SUBMITTED', label: 'I have submitted it' },
  { value: 'UNDER_REVIEW', label: 'They are reviewing it' },
  { value: 'SHORTLISTED', label: 'I have been shortlisted' },
  { value: 'INTERVIEW', label: 'I have an interview' },
  { value: 'APPROVED', label: 'I was approved' },
  { value: 'REJECTED', label: 'I was not funded' },
  { value: 'NO_RESPONSE', label: 'They never responded' },
  { value: 'WITHDRAWN', label: 'I withdrew it' },
];

/**
 * Tell us what happened with an application you are tracking.
 *
 * The tracking board is a board about status, and until now it could not
 * record one: `POST /tracked-applications/{id}/status` was implemented and
 * nothing in the product called it. A student could watch a row say
 * "Submitted" for four months while they had already been to an interview.
 *
 * **Everything reported here is `SELF_REPORT`** (BR-T03/T04), and the board
 * shows that source beside the status, always. That is the whole integrity of
 * this feature: what a student told us and what we read off a funder's email
 * are different claims, and merging them would make the board look more certain
 * than it is.
 *
 * Rendered inline on the row rather than on a screen of its own — this is a
 * thirty-second correction, and sending someone to another page to make it is
 * how a board goes stale.
 */
@Component({
  selector: 'fl-update-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, UiFormFieldComponent, UiSelectDirective, UiButtonComponent],
  template: `
    @if (!open()) {
      <ui-button variant="ghost" size="sm" (clicked)="open.set(true)">
        Update status
      </ui-button>
    } @else {
      <form class="flex flex-wrap items-end gap-3" [formGroup]="form" (ngSubmit)="save()">
        <ui-form-field
          class="min-w-56"
          label="What has happened?"
          hint="This is recorded as your own report, and shown that way."
          required
        >
          <select uiSelect formControlName="to_status">
            <option value="">Choose…</option>
            @for (option of options; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </ui-form-field>

        <ui-button type="submit" size="sm" [loading]="saving()">Save</ui-button>
        <ui-button type="button" variant="ghost" size="sm" (clicked)="cancel()">Cancel</ui-button>
      </form>

      @if (failure(); as problem) {
        <div role="alert" class="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <p class="text-sm font-medium text-foreground">{{ problem.title }}</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class UpdateStatusComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);

  readonly trackedId = input.required<string>();
  /** The board re-reads rather than patching a row it did not compute. */
  readonly updated = output<Tracked>();

  protected readonly options = REPORTABLE;
  protected readonly open = signal(false);
  protected readonly saving = signal(false);
  private readonly errorCode = signal<string | null>(null);

  protected readonly failure = computed(() => {
    const code = this.errorCode();
    return code ? presentError(code) : null;
  });

  readonly form = this.fb.nonNullable.group({
    // Commits on change: this control is a dropdown and the choice is the act.
    to_status: ['', { validators: [Validators.required] }],
  });

  protected cancel(): void {
    this.open.set(false);
    this.errorCode.set(null);
    this.form.reset();
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.saving.set(true);
    this.errorCode.set(null);

    this.api
      .post<Tracked>('/tracked-applications/{id}/status', this.form.getRawValue(), {
        path: { id: this.trackedId() },
      })
      .subscribe({
        next: (tracked) => {
          this.saving.set(false);
          this.cancel();
          this.updated.emit(tracked);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          // A 409 here is the transition table refusing the move — the server
          // owns which status may follow which (BR-T04), and the student is
          // told rather than left wondering why nothing happened.
          this.errorCode.set(error instanceof ApiError ? error.code : null);
        },
      });
  }
}
