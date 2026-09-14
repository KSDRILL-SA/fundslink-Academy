import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError, ApiService, type Schema } from 'data-access';
import {
  UiButtonComponent,
  UiCardComponent,
  UiCheckboxDirective,
  UiFormFieldComponent,
  UiSelectDirective,
  UiTextareaDirective,
  presentError,
} from 'ui';
import { MINIMUM_REASON_WORDS, countWords } from './decision-compose.component';

/** What a second person may do, and from which status the transition table allows it (BR-S04). */
const CHOICES = [
  {
    value: 'APPROVED',
    label: 'Approve — fund this student',
    from: ['APPROVED_PROPOSED', 'APPROVED_WAITLISTED'],
  },
  {
    value: 'APPROVED_WAITLISTED',
    label: 'Approve, but waitlist until funding is available',
    from: ['APPROVED_PROPOSED'],
  },
  {
    value: 'REJECTED',
    label: 'Do not approve',
    from: ['APPROVED_PROPOSED'],
  },
] as const;

/** The statuses where a second person has something to rule on at all. */
export const AUTHORISABLE = ['APPROVED_PROPOSED', 'APPROVED_WAITLISTED'];

/**
 * A02 — the authorise step. The second half of a funding decision (MASTER-SPEC §16.4, BR-S05).
 *
 * A reviewer proposes; a different person holding APPLICATION_AUTHORIZE rules on the proposal
 * here. Until this existed the lifecycle stopped at APPROVED_PROPOSED, so **no student could be
 * funded through the product** — the status, the permission and the transition all existed and
 * nothing joined them up.
 *
 * Two rules are the server's and are not duplicated as client-side gates, because a gate the
 * client owns is a gate that can be bypassed: the caller must hold the permission, and the caller
 * must not be the person who proposed the decision. Both come back as plain refusals the reviewer
 * can read. What this screen does own is the thing a server cannot enforce — that a student who
 * is turned down at the last step gets the same considered message as one turned down at the
 * first (§5.8), so a refusal here carries the same 40-word floor as the compose screen.
 */
@Component({
  selector: 'fl-authorise-decision',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiCardComponent,
    UiFormFieldComponent,
    UiSelectDirective,
    UiTextareaDirective,
    UiCheckboxDirective,
    UiButtonComponent,
  ],
  template: `
    <ui-card variant="highlight">
      <h2 class="text-lg font-semibold">
        {{ waitlisted() ? 'Release this waitlisted student' : 'Authorise this decision' }}
      </h2>
      <p class="mt-2 max-w-prose text-muted-foreground">
        @if (waitlisted()) {
          This student was approved and is waiting for funding. Releasing them makes the approval
          real. It is recorded against your name with the reason you give.
        } @else {
          A reviewer has proposed this decision. You are the second person it needs: nothing is
          approved, waitlisted or refused until you say so, and you cannot authorise a decision you
          proposed yourself.
        }
      </p>

      <form class="mt-6 flex flex-col gap-6" [formGroup]="form" (ngSubmit)="submit()">
        @if (failure(); as problem) {
          <div role="alert" class="rounded-lg border border-destructive/30 bg-destructive/8 p-4">
            <p class="font-medium text-foreground">{{ problem.title }}</p>
            <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
          </div>
        }

        <ui-form-field label="Your ruling" required>
          <select uiSelect formControlName="decision">
            <option value="">Choose…</option>
            @for (choice of choices(); track choice.value) {
              <option [value]="choice.value">{{ choice.label }}</option>
            }
          </select>
        </ui-form-field>

        <ui-form-field
          [label]="isDecline() ? 'Your message to the student' : 'Why'"
          [hint]="reasonHint()"
          [error]="reasonError()"
          required
        >
          <textarea uiTextarea formControlName="reason" [rows]="isDecline() ? 8 : 3"></textarea>
        </ui-form-field>

        @if (isDecline()) {
          <p
            class="text-sm"
            [class.text-muted-foreground]="hasEnoughWords()"
            [class.text-warning]="!hasEnoughWords()"
          >
            @if (hasEnoughWords()) {
              {{ wordCount() }} words.
            } @else {
              {{ wordCount() }} words — {{ wordsRemaining() }} more before this can be sent.
            }
          </p>

          <div class="flex items-start gap-3">
            <input
              uiCheckbox
              type="checkbox"
              [id]="confirmId"
              formControlName="next_step_confirmed"
              class="mt-1"
            />
            <label [for]="confirmId" class="text-sm">
              I confirm this message offers a concrete next step.
            </label>
          </div>
        }

        <div class="flex flex-wrap items-center gap-3">
          <ui-button type="submit" [loading]="submitting()" [disabled]="!canSubmit()">
            {{ submitLabel() }}
          </ui-button>
          @if (!canSubmit()) {
            <p class="text-sm text-muted-foreground">{{ blockedReason() }}</p>
          }
        </div>
      </form>
    </ui-card>
  `,
})
export class AuthoriseDecisionComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);

  readonly applicationId = input.required<string>();
  readonly status = input.required<string>();
  /** The application changed; the detail screen re-reads it from the server. */
  readonly ruled = output<void>();

  protected readonly confirmId = 'authorise-next-step-confirmed';
  protected readonly submitting = signal(false);
  private readonly errorCode = signal<string | null>(null);
  protected readonly failure = computed(() => {
    const code = this.errorCode();
    return code ? presentError(code) : null;
  });

  readonly form = this.fb.nonNullable.group({
    decision: ['', [Validators.required]],
    reason: ['', [Validators.required, Validators.minLength(10)]],
    next_step_confirmed: [false],
  });

  private readonly value = signal(this.form.getRawValue());

  constructor() {
    this.form.valueChanges.subscribe(() => this.value.set(this.form.getRawValue()));
  }

  protected readonly waitlisted = computed(() => this.status() === 'APPROVED_WAITLISTED');
  /** Only the rulings the transition table allows from here — never an option that 409s. */
  protected readonly choices = computed(() =>
    CHOICES.filter((choice) => (choice.from as readonly string[]).includes(this.status())),
  );
  protected readonly isDecline = computed(() => this.value().decision === 'REJECTED');
  protected readonly wordCount = computed(() => countWords(this.value().reason));
  protected readonly hasEnoughWords = computed(() => this.wordCount() >= MINIMUM_REASON_WORDS);
  protected readonly wordsRemaining = computed(() =>
    Math.max(0, MINIMUM_REASON_WORDS - this.wordCount()),
  );

  protected readonly submitLabel = computed(() => {
    switch (this.value().decision) {
      case 'APPROVED':
        return this.waitlisted() ? 'Release and fund' : 'Approve and fund';
      case 'APPROVED_WAITLISTED':
        return 'Approve and waitlist';
      case 'REJECTED':
        return 'Do not approve';
      default:
        return 'Record ruling';
    }
  });

  protected reasonHint(): string {
    return this.isDecline()
      ? 'At least 40 words. Give them the reasons, and at least one door that is still open.'
      : 'The student reads this as the reason for the outcome.';
  }

  protected readonly canSubmit = computed(() => {
    const value = this.value();
    if (!value.decision || value.reason.trim().length < 10) {
      return false;
    }
    if (!this.isDecline()) {
      return true;
    }
    return this.hasEnoughWords() && value.next_step_confirmed;
  });

  protected blockedReason(): string {
    const value = this.value();
    if (!value.decision) {
      return 'Choose a ruling first.';
    }
    if (value.reason.trim().length < 10) {
      return 'Say why — the student reads this.';
    }
    if (this.isDecline() && !this.hasEnoughWords()) {
      return `${this.wordsRemaining()} more words needed.`;
    }
    if (this.isDecline() && !value.next_step_confirmed) {
      return 'Confirm the message offers a next step.';
    }
    return '';
  }

  protected reasonError(): string | null {
    const control = this.form.controls.reason;
    if (!control.touched) {
      return null;
    }
    if (this.isDecline() && !this.hasEnoughWords()) {
      return 'A student turned down at the last step needs the reasons in your own words — at least 40 of them.';
    }
    return control.valid ? null : 'Say why — this is recorded against your name.';
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (!this.canSubmit()) {
      return;
    }
    this.submitting.set(true);
    this.errorCode.set(null);
    const value = this.form.getRawValue();

    this.api
      .post<Schema<'Application'>>(
        '/admin/applications/{id}/authorize',
        { decision: value.decision, reason: value.reason },
        { path: { id: this.applicationId() } },
      )
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.form.reset();
          this.ruled.emit();
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          // `two_person_rule` and `forbidden` both land here: the server owns both rules, and the
          // reviewer is told plainly rather than shown a control that silently does nothing.
          this.errorCode.set(error instanceof ApiError ? error.code : null);
        },
      });
  }
}
