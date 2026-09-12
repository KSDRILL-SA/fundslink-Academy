import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiError, ApiService } from 'data-access';
import { ShieldCheck } from 'lucide';
import {
  UiButtonComponent,
  UiCardComponent,
  UiSuccessStateComponent,
  presentError,
  type IconNode,
} from 'ui';
import { PageHeaderComponent } from '../../shared/page-header.component';

/**
 * S21 — Data and privacy. POPIA self-service (MASTER-SPEC §15.6).
 *
 * This is a right, not a settings page, and it is written that way: what we
 * hold, what a student can ask for, and who to ask. Someone exercising a data
 * right is usually already uneasy, and a screen full of toggles would make
 * them hunt for the one thing they came for.
 *
 * **The export is a file they keep, not JSON on a screen.** A wall of raw data
 * in a browser is technically a disclosure and practically useless — it cannot
 * be forwarded to a lawyer, kept, or read on a phone. It downloads.
 *
 * Two things are never in it, and the screen says so rather than leaving it to
 * be assumed: the raw ID number (TAD §4.4 — we hold it encrypted and cannot
 * show it back), and anything from counselling (§6.4 — that data never enters
 * this schema at all).
 */
@Component({
  selector: 'fl-privacy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiCardComponent, UiButtonComponent, UiSuccessStateComponent, PageHeaderComponent],
  template: `
    <fl-page-header
      eyebrow="Data & privacy"
      title="Your data"
      lead="Under POPIA this information is yours. Here is what we hold and how to get a copy of it."
      [icon]="shieldIcon"
      tone="success"
    />

    <ui-card class="mt-8 max-w-2xl">
      <h2 class="text-lg font-semibold">Get a copy of everything</h2>
      <p class="mt-2 max-w-prose text-muted-foreground">
        We will put together everything on your account — your profile, your applications, the
        documents you uploaded and the decisions made — and download it as a file you can keep.
      </p>

      <div class="mt-6 flex flex-wrap items-center gap-3">
        <ui-button [loading]="exporting()" (clicked)="exportData()">Download my data</ui-button>
      </div>

      @if (downloaded()) {
        <ui-success-state
          class="mt-4"
          title="Your file is downloading"
          message="Keep it somewhere safe — it contains personal information about you."
        />
      }

      @if (failure(); as problem) {
        <div role="alert" class="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-4">
          <p class="font-medium text-foreground">{{ problem.title }}</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
        </div>
      }
    </ui-card>

    <ui-card class="mt-6 max-w-2xl">
      <h2 class="text-lg font-semibold">What is not in it</h2>
      <ul class="mt-3 flex list-disc flex-col gap-2 pl-5 text-muted-foreground">
        <li>
          <span class="font-medium text-foreground">Your ID number in full.</span>
          We store it encrypted so that not even we can read it back — the export shows only that we
          hold one.
        </li>
        <li>
          <span class="font-medium text-foreground">Anything you discussed with a counsellor.</span>
          That is kept completely separately from your application and is never part of a funding
          decision.
        </li>
      </ul>
    </ui-card>

    <ui-card class="mt-6 max-w-2xl">
      <h2 class="text-lg font-semibold">Your other rights</h2>
      <p class="mt-2 max-w-prose text-muted-foreground">
        You can ask us to correct something that is wrong, or to delete your account. Deleting is
        permanent and will end any application in progress, so we do it by request rather than with
        a button you could press by accident.
      </p>
      <p class="mt-4 text-muted-foreground">
        Our Information Officer handles these requests —
        <a
          href="mailto:privacy@fundslink.academy"
          class="rounded-sm text-primary underline underline-offset-4 outline-none
                 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring"
          >privacy&#64;fundslink.academy</a
        >.
      </p>
    </ui-card>
  `,
})
export class PrivacyComponent {
  protected readonly shieldIcon = ShieldCheck as IconNode;
  private readonly api = inject(ApiService);
  private readonly document = inject(DOCUMENT);

  protected readonly exporting = signal(false);
  protected readonly downloaded = signal(false);
  private readonly errorCode = signal<string | null>(null);

  protected readonly failure = computed(() => {
    const code = this.errorCode();
    return code ? presentError(code) : null;
  });

  protected exportData(): void {
    this.exporting.set(true);
    this.downloaded.set(false);
    this.errorCode.set(null);

    this.api.get<Record<string, unknown>>('/students/me/data-export').subscribe({
      next: (bundle) => {
        this.save(bundle);
        this.exporting.set(false);
        this.downloaded.set(true);
      },
      error: (error: unknown) => {
        this.errorCode.set(error instanceof ApiError ? error.code : null);
        this.exporting.set(false);
      },
    });
  }

  /**
   * Hand the bundle over as a file.
   *
   * The object URL is revoked immediately after the click: it points at
   * personal data held in memory, and leaving it alive means anything that can
   * read the page can fetch it for as long as the tab is open.
   */
  private save(bundle: Record<string, unknown>): void {
    const view = this.document.defaultView;
    if (!view) {
      return;
    }
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = view.URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = 'fundslink-my-data.json';
    link.click();
    view.URL.revokeObjectURL(url);
  }
}
