import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
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

/** The floor, from ux-screen-map.md §3 (A03). Not a suggestion. */
export const MINIMUM_REASON_WORDS = 40;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** The ordinary review path. Approval is proposed, never granted — a second person authorises
 *  it through the authorise step (MASTER-SPEC §16.4). */
const REVIEW_CHOICES = [
  { value: 'UNDER_REVIEW', label: 'Move to under review' },
  { value: 'INTERVIEW_SCHEDULED', label: 'Schedule an interview' },
  { value: 'APPROVED_PROPOSED', label: 'Propose approval' },
  { value: 'REJECTED', label: 'Decline' },
] as const;

/** Ruling on an appeal (BR-E07). REJECTED_FINAL is reachable from APPEALED and nowhere else. */
const APPEAL_CHOICES = [
  { value: 'APPROVED_PROPOSED', label: 'Overturn — propose approval' },
  { value: 'REJECTED_FINAL', label: 'Uphold the original decision' },
] as const;

const REASON_CATEGORIES = [
  { value: 'FUNDS_EXHAUSTED', label: 'Funds for this intake are committed' },
  { value: 'ELIGIBILITY_MISMATCH', label: 'Does not meet this bursary’s criteria' },
  { value: 'STRONGER_APPLICANTS', label: 'Stronger applications in the same pool' },
  { value: 'REDIRECT_NSFAS', label: 'Should apply to NSFAS first' },
  { value: 'INCOMPLETE_AFTER_RETURNS', label: 'Still incomplete after several returns' },
] as const;

/**
 * A03 — Decision compose. The screen where the kind rejection is enforced.
 *
 * Every promise this platform makes a declined student — the plain first line,
 * the human reason, the doors left open — depends on a reviewer being unable
 * to send a two-word decline at four on a Friday. §3 is explicit that this is
 * **enforced at the compose screen, not hoped for**, and that is what this
 * component is for.
 *
 * A rejection cannot be submitted without all three of:
 *   a reason category,
 *   at least 40 words of the reviewer's own text,
 *   a ticked confirmation that the message offers a concrete next step.
 *
 * The word count is live and states how many are left, because a hard floor
 * discovered only on submit is a rule that trains people to resent it. And the
 * count is shown for the reviewer's benefit, not as a target — the guidance
 * beside it asks for the reasons and the next step, which is what makes 40
 * words happen naturally.
 *
 * §5.8 forbids citing the applicant's language or writing quality. That is a
 * judgement no UI can enforce, so it is stated on the screen where the
 * reviewer is writing rather than left in a document they read once.
 */
@Component({
  selector: 'fl-decision-compose',
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
    <h1 class="text-2xl font-semibold tracking-tight">Record a decision</h1>

    <form class="mt-8 flex max-w-2xl flex-col gap-6" [formGroup]="form" (ngSubmit)="submit()">
      @if (failure(); as problem) {
        <div role="alert" class="rounded-lg border border-destructive/30 bg-destructive/8 p-4">
          <p class="font-medium text-foreground">{{ problem.title }}</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
        </div>
      }

      @if (isAppeal()) {
        <!-- BR-E07. The student brought new information; this is the ruling on it. A different
             reviewer from the one who decided originally — the server refuses otherwise. -->
        <div class="rounded-lg border border-border bg-secondary/50 p-4">
          <p class="font-medium">You are hearing an appeal</p>
          <p class="mt-1 max-w-prose text-sm text-muted-foreground">
            This student was declined and has appealed with new information. Overturning it
            proposes approval, which a second person then authorises. Upholding it ends the
            matter — there is no further appeal after this.
          </p>
        </div>
      }

      <ui-form-field label="Decision" required>
        <select uiSelect formControlName="decision">
          <option value="">Choose…</option>
          @for (choice of choices(); track choice.value) {
            <option [value]="choice.value">{{ choice.label }}</option>
          }
        </select>
      </ui-form-field>

      @if (isDecline()) {
        <ui-card variant="highlight">
          <h2 class="text-lg font-semibold">This message goes to the student</h2>
          <p class="mt-2 max-w-prose text-muted-foreground">
            They will read it as the reason they were not funded. Say what happened, and say what
            they can do next. Do not comment on their writing or their language — that is never a
            reason, and it is never ours to raise.
          </p>

          <div class="mt-6 flex flex-col gap-6">
            <ui-form-field label="Why was this declined?" required>
              <select uiSelect formControlName="reason_category">
                <option value="">Choose…</option>
                @for (reason of reasonCategories; track reason.value) {
                  <option [value]="reason.value">{{ reason.label }}</option>
                }
              </select>
            </ui-form-field>

            <ui-form-field
              label="Your message to the student"
              hint="At least 40 words. Give them the reasons, and at least one door that is still open."
              [error]="reasonError()"
              required
            >
              <textarea uiTextarea formControlName="note" rows="8"></textarea>
            </ui-form-field>

            <p class="text-sm" [class.text-muted-foreground]="hasEnoughWords()" [class.text-warning]="!hasEnoughWords()">
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
          </div>
        </ui-card>
      }

      <div class="flex flex-wrap items-center gap-3">
        <ui-button type="submit" [loading]="submitting()" [disabled]="!canSubmit()">
          Record decision
        </ui-button>

        @if (isDecline() && !canSubmit()) {
          <p class="text-sm text-muted-foreground">{{ blockedReason() }}</p>
        }
      </div>
    </form>
  `,
})
export class DecisionComposeComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);

  /** The application being decided. Supplied by the route in A02. */
  readonly applicationId = signal('');
  /** Its current status — an appealed application is ruled on, not reviewed afresh (BR-E07). */
  readonly status = input('');
  /** The application changed; the detail screen re-reads it from the server. */
  readonly decided = output<void>();

  protected readonly reasonCategories = REASON_CATEGORIES;
  protected readonly confirmId = 'decision-next-step-confirmed';
  protected readonly submitting = signal(false);
  private readonly errorCode = signal<string | null>(null);

  protected readonly failure = computed(() => {
    const code = this.errorCode();
    return code ? presentError(code) : null;
  });

  readonly form = this.fb.nonNullable.group({
    decision: ['', [Validators.required]],
    reason_category: [''],
    note: [''],
    next_step_confirmed: [false],
  });

  private readonly value = signal(this.form.getRawValue());

  constructor() {
    this.form.valueChanges.subscribe(() => this.value.set(this.form.getRawValue()));
  }

  protected readonly isAppeal = computed(() => this.status() === 'APPEALED');
  /** Only what the transition table allows from here, so no choice can 409 (BR-S04). */
  protected readonly choices = computed(() =>
    this.isAppeal() ? APPEAL_CHOICES : REVIEW_CHOICES,
  );
  /**
   * Upholding an appeal is a decline too — the student reads it as the end of the road, so it
   * carries the same floor. Leaving REJECTED_FINAL out would have made the kindest-possible
   * refusal optional at exactly the point it matters most.
   */
  protected readonly isDecline = computed(
    () => this.value().decision === 'REJECTED' || this.value().decision === 'REJECTED_FINAL',
  );
  protected readonly wordCount = computed(() => countWords(this.value().note));
  protected readonly hasEnoughWords = computed(() => this.wordCount() >= MINIMUM_REASON_WORDS);
  protected readonly wordsRemaining = computed(() =>
    Math.max(0, MINIMUM_REASON_WORDS - this.wordCount()),
  );

  /**
   * The refusal. All three conditions, or the button does not work.
   *
   * Deliberately a hard gate rather than a warning: a warning is a thing a
   * tired reviewer clicks past, and the student on the other end of that click
   * gets a decline with no reason.
   */
  protected readonly canSubmit = computed(() => {
    const value = this.value();
    if (!value.decision) {
      return false;
    }
    if (!this.isDecline()) {
      return true;
    }
    return Boolean(value.reason_category) && this.hasEnoughWords() && value.next_step_confirmed;
  });

  protected blockedReason(): string {
    const value = this.value();
    if (!value.reason_category) {
      return 'Choose a reason category first.';
    }
    if (!this.hasEnoughWords()) {
      return `${this.wordsRemaining()} more words needed.`;
    }
    if (!value.next_step_confirmed) {
      return 'Confirm the message offers a next step.';
    }
    return '';
  }

  protected reasonError(): string | null {
    const control = this.form.controls.note;
    if (!control.touched || this.hasEnoughWords()) {
      return null;
    }
    return 'A declined student needs the reasons in your own words — at least 40 of them.';
  }

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    this.submitting.set(true);
    this.errorCode.set(null);

    const value = this.form.getRawValue();
    this.api
      .post<Schema<'Application'>>(
        '/admin/applications/{id}/review',
        {
          decision: value.decision,
          ...(this.isDecline() ? { note: value.note } : {}),
        },
        { path: { id: this.applicationId() } },
      )
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.decided.emit();
        },
        error: (error: unknown) => {
          this.errorCode.set(error instanceof ApiError ? error.code : null);
          this.submitting.set(false);
        },
      });
  }
}
