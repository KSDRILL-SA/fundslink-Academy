import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiError, ApiService, type Schema } from 'data-access';
import { FileUp } from 'lucide';
import {
  UiButtonComponent,
  UiFormFieldComponent,
  UiInputDirective,
  UiSelectDirective,
  UiSuccessStateComponent,
  presentError,
  type IconNode,
} from 'ui';
import { PageHeaderComponent } from '../../shared/page-header.component';

/** What the server accepts (ST-2.4). Stated here only to fail early and kindly. */
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
const MAX_BYTES = 5 * 1024 * 1024;

export const DOCUMENT_TYPES = [
  { value: 'ID_DOCUMENT', label: 'ID document' },
  { value: 'PROOF_OF_REGISTRATION', label: 'Proof of registration' },
  { value: 'ACADEMIC_TRANSCRIPT', label: 'Academic transcript' },
  { value: 'FEE_STATEMENT', label: 'Fee statement' },
  { value: 'NSFAS_OUTCOME_LETTER', label: 'NSFAS outcome letter' },
  { value: 'PROOF_OF_INCOME', label: 'Proof of income' },
] as const;

/**
 * S13 — Documents upload.
 *
 * **The server is the authority, always.** It does magic-byte validation, EXIF
 * stripping and an AV scan (ST-2.4). Nothing here decides a file is safe — the
 * client checks only the two things it can honestly know before uploading, so
 * that someone on metered data is not made to send 8 MB before being told no.
 *
 * A rejection here is never phrased as the student's mistake. "That file's a
 * bit big — try under 5 MB" is the design's own wording, and the difference
 * between that and "invalid file" is whether someone tries again.
 */
@Component({
  selector: 'fl-documents',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiFormFieldComponent,
    UiInputDirective,
    UiSelectDirective,
    UiButtonComponent,
    UiSuccessStateComponent,
    PageHeaderComponent,
  ],
  template: `
    <fl-page-header
      title="Add your documents"
      lead="A photo from your phone is fine, as long as the text is readable. PDF, JPG or PNG, up to 5 MB each."
      [icon]="documentIcon"
    />

    <form class="mt-8 flex max-w-2xl flex-col gap-6" (submit)="upload($event)">
      @if (problem(); as message) {
        <div role="alert" class="rounded-lg border border-warning/40 bg-warning/10 p-4">
          <p class="font-medium text-foreground">{{ message.title }}</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ message.message }}</p>
        </div>
      }

      <ui-form-field label="What is this document?" required>
        <select uiSelect [value]="docType()" (change)="onTypeChange($event)">
          <option value="">Choose one…</option>
          @for (type of documentTypes; track type.value) {
            <option [value]="type.value">{{ type.label }}</option>
          }
        </select>
      </ui-form-field>

      <ui-form-field
        label="Choose a file"
        hint="Make sure the whole page is in the picture and the writing is readable."
        required
      >
        <!-- uiInput so the id, aria-describedby and aria-invalid come from
             the field. Hard-coding an id here left the field's <label for=...>
             pointing at nothing, and axe caught it as an unlabelled control. -->
        <input
          uiInput
          type="file"
          [accept]="acceptAttr"
          class="h-auto p-2 file:mr-3 file:rounded-md file:border-0 file:bg-secondary
                 file:px-3 file:py-2 file:text-sm file:font-medium"
          (change)="onFileChange($event)"
        />
      </ui-form-field>

      <div class="flex flex-wrap items-center gap-3">
        <ui-button type="submit" [loading]="uploading()" [disabled]="!canUpload()">
          Upload document
        </ui-button>
      </div>

      @if (uploaded().length) {
        <ui-success-state
          title="Uploaded"
          [message]="uploadedMessage()"
        />
      }
    </form>
  `,
})
export class DocumentsComponent {
  protected readonly documentIcon = FileUp as IconNode;
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly documentTypes = DOCUMENT_TYPES;
  protected readonly acceptAttr = ACCEPTED_TYPES.join(',');

  protected readonly docType = signal('');
  protected readonly file = signal<File | null>(null);
  protected readonly uploading = signal(false);
  protected readonly uploaded = signal<string[]>([]);
  private readonly errorCode = signal<string | null>(null);

  protected readonly problem = computed(() => {
    const code = this.errorCode();
    return code ? presentError(code) : null;
  });

  protected readonly canUpload = computed(() => Boolean(this.docType() && this.file()));

  protected readonly uploadedMessage = computed(
    () => `${this.uploaded().length} document(s) added to your application.`,
  );

  protected onTypeChange(event: Event): void {
    this.docType.set((event.target as HTMLSelectElement).value);
  }

  protected onFileChange(event: Event): void {
    const chosen = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.file.set(chosen);
    this.errorCode.set(null);
    if (!chosen) {
      return;
    }
    // The two things the browser can honestly know before uploading. Checking
    // them here saves someone on metered data from sending a file that was
    // never going to be accepted — it does not make the file safe, and the
    // server checks everything again regardless.
    if (chosen.size === 0) {
      this.errorCode.set('empty_file');
      return;
    }
    if (chosen.size > MAX_BYTES) {
      this.errorCode.set('payload_too_large');
      return;
    }
    if (!ACCEPTED_TYPES.includes(chosen.type as (typeof ACCEPTED_TYPES)[number])) {
      // The declared type only. A magic-byte check is the server's job and
      // cannot be done reliably here.
      this.errorCode.set('unsupported_media_type');
    }
  }

  protected upload(event: Event): void {
    event.preventDefault();
    const chosen = this.file();
    if (!chosen || !this.docType() || this.errorCode()) {
      return;
    }
    this.uploading.set(true);

    const body = new FormData();
    body.append('doc_type', this.docType());
    body.append('file', chosen);
    const applicationId = this.route.snapshot.paramMap.get('id');
    if (applicationId) {
      body.append('application_id', applicationId);
    }

    this.api.post<Schema<'Document'>>('/students/me/documents', body).subscribe({
      next: () => {
        this.uploaded.update((list) => [...list, chosen.name]);
        this.file.set(null);
        this.docType.set('');
        this.uploading.set(false);
      },
      error: (error: unknown) => {
        this.errorCode.set(error instanceof ApiError ? error.code : null);
        this.uploading.set(false);
      },
    });
  }
}
