import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError, ApiService, type Schema } from 'data-access';
import {
  UiButtonComponent,
  UiCardComponent,
  UiFormFieldComponent,
  UiSuccessStateComponent,
  UiTextareaDirective,
  presentError,
} from 'ui';

type Application = Schema<'Application'>;

/** The contract's floor: `new_information` has minLength 20 (BR-E07). */
const MIN_INFORMATION = 20;

/**
 * Ask for one more look.
 *
 * `POST /applications/{id}/appeal` was implemented, the Terms page promised it,
 * and the only way to use it was to write to a mailbox and hope. BR-E07 is
 * specific: **one appeal per decision, with new information, reviewed by a
 * different person.** All three of those are the server's rules, and this
 * screen states them before asking rather than after refusing.
 *
 * The honesty that matters here is about what an appeal is for. It is not a
 * second opinion on the same facts — a reviewer who read everything and said
 * no is not going to say yes to the same application — so the field asks for
 * what has *changed* or what was *missed*. Inviting someone to re-argue an
 * unchanged case would waste the one appeal they get.
 */
@Component({
  selector: 'fl-appeal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiCardComponent,
    UiButtonComponent,
    UiFormFieldComponent,
    UiTextareaDirective,
    UiSuccessStateComponent,
  ],
  template: `
    @if (lodged()) {
      <ui-success-state
        class="mt-6"
        title="Your appeal is in"
        message="A different reviewer will look at your application with what you have added. You will see the outcome here."
      />
    } @else {
      <ui-card class="mt-6">
        <h2 class="text-lg font-semibold">Ask us to look again</h2>
        <p class="mt-2 max-w-prose text-muted-foreground">
          If something was missing, wrong, or has changed since you applied, tell us and a
          <strong class="font-medium text-foreground">different reviewer</strong> will read your
          application again. You have one appeal, so it is worth taking a moment over.
        </p>
        <p class="mt-2 max-w-prose text-sm text-muted-foreground">
          An appeal is not a second opinion on the same information — it is for what we did not know
          the first time.
        </p>

        <form class="mt-6 flex flex-col gap-5" [formGroup]="form" (ngSubmit)="submit()">
          @if (failure(); as problem) {
            <div role="alert" class="rounded-lg border border-warning/40 bg-warning/10 p-4">
              <p class="font-medium text-foreground">{{ problem.title }}</p>
              <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
            </div>
          }

          <ui-form-field
            label="What is new, or what did we miss?"
            hint="In your own words, in the language you think in. A person reads this."
            [error]="informationError()"
            required
          >
            <textarea uiTextarea formControlName="new_information" rows="6"></textarea>
          </ui-form-field>

          <div>
            <ui-button type="submit" [loading]="submitting()">Send my appeal</ui-button>
          </div>
        </form>
      </ui-card>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class AppealComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);

  readonly applicationId = input.required<string>();
  readonly appealed = output<Application>();

  protected readonly submitting = signal(false);
  protected readonly lodged = signal(false);
  private readonly errorCode = signal<string | null>(null);

  protected readonly failure = computed(() => {
    const code = this.errorCode();
    return code ? presentError(code) : null;
  });

  readonly form = this.fb.nonNullable.group({
    new_information: [
      '',
      { validators: [Validators.required, Validators.minLength(MIN_INFORMATION)], updateOn: 'blur' },
    ],
  });

  protected informationError(): string | null {
    const control = this.form.controls.new_information;
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('minlength')
      ? 'Tell us a little more — a sentence at least, so the reviewer has something to work with.'
      : 'Tell us what is new.';
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.submitting.set(true);
    this.errorCode.set(null);

    this.api
      .post<Application>('/applications/{id}/appeal', this.form.getRawValue(), {
        path: { id: this.applicationId() },
      })
      .subscribe({
        next: (application) => {
          this.submitting.set(false);
          this.lodged.set(true);
          this.appealed.emit(application);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          // A 409 is "you have already appealed this decision" (BR-E07: one per
          // decision). The presentation table turns that into words a person
          // can act on rather than a status code.
          this.errorCode.set(error instanceof ApiError ? error.code : null);
        },
      });
  }
}
