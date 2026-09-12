import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiError, ApiService, type Schema } from 'data-access';
import {
  UiButtonComponent,
  UiFormFieldComponent,
  UiSelectDirective,
  UiTextareaDirective,
  presentError,
} from 'ui';
import {
  EMPTY_DRAFT,
  SA_LANGUAGES,
  clearDraft,
  readDraft,
  writeDraft,
  type MotivationDraft,
} from './motivation-draft';

/**
 * S12 — OTHER motivation (Category D).
 *
 * The door for everyone the four categories do not describe. §5.6 is explicit
 * that this is a first-class path, and this screen is where that promise is
 * either kept or quietly broken.
 *
 * **The promise line is verbatim from MASTER-SPEC §5.6.** It is not copy to be
 * tightened later — it is the commitment the platform makes to someone about
 * to write something difficult, and a test pins it character for character.
 *
 * Three questions rather than one open box, each with a real example. A blank
 * textarea labelled "motivation" is the hardest thing to answer on a form; a
 * question you can picture answering is not (P8).
 *
 * Drafts save to the device on every change. Someone typing this on a phone,
 * on data, must not lose it to a dropped connection or a reaped tab (P6).
 */
@Component({
  selector: 'fl-motivation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiFormFieldComponent,
    UiTextareaDirective,
    UiSelectDirective,
    UiButtonComponent,
  ],
  template: `
    <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Tell us in your own words</h1>

    <!-- Verbatim, MASTER-SPEC §5.6. Do not paraphrase. -->
    <blockquote
      class="mt-6 max-w-prose border-l-4 border-l-accent bg-secondary/40 py-4 pl-5 pr-4 text-lg"
    >
      If your story doesn't fit our forms, our forms are incomplete — not your story. Tell us. A
      human will read every word.
    </blockquote>

    <form class="mt-8 flex max-w-2xl flex-col gap-8" [formGroup]="form" (ngSubmit)="submit()">
      @if (failure(); as problem) {
        <div role="alert" class="rounded-lg border border-destructive/30 bg-destructive/8 p-4">
          <p class="font-medium text-foreground">{{ problem.title }}</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
        </div>
      }

      <ui-form-field
        label="Write in the language you think in"
        hint="A person reads this. They do not need it in English."
      >
        <select uiSelect formControlName="language">
          @for (language of languages; track language.value) {
            <option [value]="language.value">{{ language.label }}</option>
          }
        </select>
      </ui-form-field>

      <ui-form-field
        label="What is your situation?"
        hint="For example: I am the first in my family at university, my mother lost her job in March, and my registration is on hold."
        [error]="errorFor('situation')"
        required
      >
        <textarea uiTextarea formControlName="situation" rows="6"></textarea>
      </ui-form-field>

      <ui-form-field
        label="Why did none of the other options fit?"
        hint="For example: I was never registered with NSFAS because my father's payslip put us just over the line, but he has since passed away."
        [error]="errorFor('why_not_categories')"
        required
      >
        <textarea uiTextarea formControlName="why_not_categories" rows="5"></textarea>
      </ui-form-field>

      <ui-form-field
        label="What would help?"
        hint="For example: the fees still outstanding on my account, so that I can register for my final year."
        [error]="errorFor('support_needed')"
        required
      >
        <textarea uiTextarea formControlName="support_needed" rows="4"></textarea>
      </ui-form-field>

      <div class="flex flex-wrap items-center gap-4">
        <ui-button type="submit" [loading]="submitting()">Continue</ui-button>
        @if (draftSaved()) {
          <p role="status" class="text-sm text-muted-foreground">
            Saved on this device. You can close this and come back.
          </p>
        }
      </div>
    </form>
  `,
})
export class MotivationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage;

  protected readonly languages = SA_LANGUAGES;
  protected readonly submitting = signal(false);
  protected readonly draftSaved = signal(false);
  private readonly errorCode = signal<string | null>(null);

  protected readonly failure = computed(() => {
    const code = this.errorCode();
    return code ? presentError(code) : null;
  });

  readonly form = this.fb.nonNullable.group({
    language: [EMPTY_DRAFT.language],
    situation: ['', { validators: [Validators.required], updateOn: 'blur' }],
    why_not_categories: ['', { validators: [Validators.required], updateOn: 'blur' }],
    support_needed: ['', { validators: [Validators.required], updateOn: 'blur' }],
  });

  constructor() {
    this.form.patchValue(readDraft(this.storage), { emitEvent: false });

    this.form.valueChanges.subscribe(() => {
      writeDraft(this.storage, this.form.getRawValue() as MotivationDraft);
      this.draftSaved.set(true);
    });
  }

  protected errorFor(
    name: 'situation' | 'why_not_categories' | 'support_needed',
  ): string | null {
    const control = this.form.controls[name];
    if (!control.touched || control.valid) {
      return null;
    }
    // Never "this field is required" — say what is missing, in the same voice
    // as the question that asked for it.
    const prompts: Record<string, string> = {
      situation: 'Tell us what is happening, even briefly.',
      why_not_categories: 'A sentence on why the other options did not fit is enough.',
      support_needed: 'Tell us what would actually help.',
    };
    return prompts[name];
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.submitting.set(true);
    this.errorCode.set(null);

    const value = this.form.getRawValue();
    const body: Schema<'ApplicationInput'> = {
      application_type: 'OTHER',
      academic_year: String(new Date().getFullYear()),
      motivation: {
        situation: value.situation,
        why_not_categories: value.why_not_categories,
        support_needed: value.support_needed,
        language: value.language,
      },
    };

    this.api.post<Schema<'Application'>>('/applications', body).subscribe({
      next: (application) => {
        // Only once the server has it. Clearing on submit would lose the text
        // if the request failed on the way.
        clearDraft(this.storage);
        void this.router.navigateByUrl(`/app/applications/${application.id}`);
      },
      error: (error: unknown) => {
        this.errorCode.set(error instanceof ApiError ? error.code : null);
        this.submitting.set(false);
      },
    });
  }
}
