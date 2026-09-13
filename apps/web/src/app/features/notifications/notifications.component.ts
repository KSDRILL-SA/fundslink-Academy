import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiError, ApiService, type Page, type Schema } from 'data-access';
import { Bell } from 'lucide';
import {
  UiButtonComponent,
  UiCardComponent,
  UiCheckboxDirective,
  UiEmptyStateComponent,
  UiErrorStateComponent,
  UiSkeletonComponent,
  presentError,
  type IconNode,
} from 'ui';
import { asyncState } from '../../core/async-state';
import { ShellSignalsService } from '../../core/shell-signals.service';
import { PageHeaderComponent } from '../../shared/page-header.component';

type Notification = Schema<'Notification'>;

/**
 * The moments we would write to a student about, in the order they happen.
 *
 * `triggers` are the codes the server actually sends (`lk_notify_trigger`); a row can cover more
 * than one, because a student thinks "when there is a decision", not "approved" and "declined"
 * separately. Two rows used to name codes that do not exist — `APPLICATION_REVIEWED` and
 * `DEADLINE_REMINDER` — so those choices were saved and never applied (#298). A test now reads the
 * migrations and fails if any code here is not a real trigger.
 */
export const PREFERENCE_ROWS: readonly { readonly triggers: readonly string[]; readonly label: string }[] = [
  { triggers: ['APPLICATION_SUBMITTED'], label: 'When your application is received' },
  {
    triggers: ['APPLICATION_RETURNED_FOR_INFO', 'APPLICATION_RETURN_REMINDER'],
    label: 'When we need something more from you, and a reminder before the date',
  },
  { triggers: ['APPLICATION_STATUS_CHANGED'], label: 'When your application moves along' },
  { triggers: ['INTERVIEW_SCHEDULED'], label: 'When an interview is scheduled' },
  { triggers: ['DECISION_APPROVED', 'DECISION_REJECTED'], label: 'When there is a decision' },
  { triggers: ['TRACKED_DEADLINE_REMINDER'], label: 'Before a deadline on a bursary you track' },
  { triggers: ['TRACKED_FOLLOW_UP'], label: 'When a bursary you track has gone quiet' },
];

/** What each message in the history was about, in a student's words. */
export const TRIGGER_WORDS: Readonly<Record<string, string>> = {
  APPLICATION_SUBMITTED: 'We received your application',
  APPLICATION_RETURNED_FOR_INFO: 'We need something more from you',
  APPLICATION_RETURN_REMINDER: 'A reminder that we need something from you',
  APPLICATION_STATUS_CHANGED: 'Your application moved along',
  INTERVIEW_SCHEDULED: 'An interview was scheduled',
  DECISION_APPROVED: 'A decision on your application',
  DECISION_REJECTED: 'A decision on your application',
  TRACKED_DEADLINE_REMINDER: 'A deadline is coming up on a bursary you track',
  TRACKED_FOLLOW_UP: 'A bursary you track has gone quiet',
  ACCOUNT_VERIFICATION: 'Confirm your email address',
};

/** Delivery state (`notification_outbox.state`), said plainly. Nothing claims "sent" that was not. */
const STATE_WORDS: Readonly<Record<string, string>> = {
  PENDING: 'Waiting to send',
  SENDING: 'Sending',
  SENT: 'Sent',
  DEAD: 'We could not deliver this one',
};

/**
 * S20 — Notifications and preferences.
 *
 * **The consent rule is stated, not silently enforced** (D-019, BR-N03). SMS
 * needs marketing consent; email and in-app are transactional and cannot be
 * switched off, because they are how a student finds out their application
 * needs attention. Someone who turns SMS on and finds it off again with no
 * explanation experiences the platform as arbitrary — and arbitrary is the
 * opposite of what a funding platform can afford to feel like.
 *
 * So the two are presented differently: the transactional channel is stated as
 * a fact about how this works, rather than offered as a toggle that does
 * nothing.
 */
@Component({
  selector: 'fl-notifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiCardComponent,
    UiButtonComponent,
    UiCheckboxDirective,
    UiSkeletonComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
    PageHeaderComponent,
  ],
  template: `
    <fl-page-header
      title="Notifications"
      lead="What we have told you, and how you would like us to reach you."
      [icon]="bellIcon"
    />

    <section class="mt-8" aria-labelledby="prefs-heading">
      <h2 id="prefs-heading" class="text-lg font-semibold">How we reach you</h2>

      <ui-card class="mt-4">
        <p class="max-w-prose text-muted-foreground">
          Every update about your own application is recorded here — that is how you find out
          something needs your attention, so it is not something we switch off.
          <strong class="font-medium text-foreground">Text messages are optional</strong>, and only
          go out if you have agreed to them.
        </p>

        <!--
          Said out loud rather than left for a student to discover by waiting.
          The outbox and the worker are real; the email and SMS providers are
          not wired yet, so anyone relying on an email would be relying on
          nothing. This paragraph comes out the day delivery is switched on.
        -->
        <p class="mt-3 max-w-prose rounded-lg bg-secondary/60 p-4 text-sm text-muted-foreground">
          <span class="font-medium text-foreground">While we are setting up:</span>
          email and text delivery are not switched on yet, so please check this page for updates.
          We will tell you here as soon as they are.
        </p>

        <ul class="mt-6 flex flex-col gap-4">
          @for (row of rows; track row.label) {
            <li class="flex items-start gap-3">
              <input
                uiCheckbox
                type="checkbox"
                [id]="'sms-' + row.triggers[0]"
                class="mt-1"
                [checked]="smsEnabled().has(row.triggers[0])"
                [disabled]="!prefsLoaded()"
                (change)="toggleSms(row.triggers[0])"
              />
              <label [for]="'sms-' + row.triggers[0]">
                <span class="font-medium">{{ row.label }}</span>
                <span class="mt-1 block text-sm text-muted-foreground">
                  Email always. Tick to get a text as well.
                </span>
              </label>
            </li>
          }
        </ul>

        <div class="mt-6 flex flex-wrap items-center gap-3">
          <!-- Not before the saved choices have loaded: saving an empty form would wipe them. -->
          <ui-button [loading]="saving()" [disabled]="!prefsLoaded()" (clicked)="save()">
            Save preferences
          </ui-button>
          @if (saved()) {
            <p role="status" class="text-sm font-medium text-success">Saved.</p>
          }
        </div>

        @if (prefsFailed()) {
          <div role="alert" class="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-4">
            <p class="font-medium text-foreground">We could not load your saved choices</p>
            <p class="mt-1 text-sm text-muted-foreground">
              Nothing has changed. Reload the page to try again before changing them.
            </p>
          </div>
        }

        @if (failure(); as problem) {
          <div role="alert" class="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-4">
            <p class="font-medium text-foreground">{{ problem.title }}</p>
            <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
          </div>
        }
      </ui-card>
    </section>

    <section class="mt-10" aria-labelledby="history-heading">
      <h2 id="history-heading" class="text-lg font-semibold">What we have sent you</h2>

      @switch (state().status) {
        @case ('loading') {
          <div class="mt-4 flex flex-col gap-3">
            @for (row of [1, 2, 3]; track row) {
              <ui-skeleton class="h-16 w-full" shape="block" />
            }
          </div>
        }

        @case ('error') {
          <ui-error-state class="mt-4" [code]="state().errorCode" (retry)="load()" />
        }

        @case ('empty') {
          <ui-empty-state
            class="mt-4"
            title="Nothing sent yet"
            message="When something happens with your application it will show up here, as well as in your inbox."
          />
        }

        @case ('success') {
          <ul class="mt-4 flex flex-col gap-3">
            @for (item of notifications(); track item.id) {
              <li>
                <ui-card padding="sm">
                  <p class="font-medium">{{ readable(item.trigger) }}</p>
                  <p class="mt-1 text-sm text-muted-foreground">{{ sentVia(item) }}</p>
                </ui-card>
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
})
export class NotificationsComponent {
  protected readonly bellIcon = Bell as IconNode;
  private readonly api = inject(ApiService);
  private readonly shell = inject(ShellSignalsService);
  private readonly store = asyncState<readonly Notification[]>((items) => items.length === 0);

  protected readonly rows = PREFERENCE_ROWS;
  protected readonly prefsLoaded = signal(false);
  protected readonly prefsFailed = signal(false);
  protected readonly state = this.store.state;
  protected readonly notifications = computed(() => this.state().data ?? []);
  protected readonly smsEnabled = signal(new Set<string>());
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  private readonly errorCode = signal<string | null>(null);

  protected readonly failure = computed(() => {
    const code = this.errorCode();
    return code ? presentError(code) : null;
  });

  constructor() {
    this.load();
    this.loadPreferences();
  }

  /** The student's saved choices. A row is ticked when SMS is on for it. */
  private loadPreferences(): void {
    this.api.get<Schema<'Preferences'>>('/notifications/preferences').subscribe({
      next: (prefs) => {
        const saved = prefs.per_trigger ?? {};
        this.smsEnabled.set(
          new Set(
            PREFERENCE_ROWS.filter((row) =>
              row.triggers.some((trigger) => saved[trigger]?.includes('SMS')),
            ).map((row) => row.triggers[0]),
          ),
        );
        this.prefsLoaded.set(true);
      },
      error: () => this.prefsFailed.set(true),
    });
  }

  protected load(): void {
    this.store.loading();
    this.api.get<Page<Notification>>('/notifications/me').subscribe({
      next: (page) => {
        this.store.loaded(page.items);
        this.shell.setNoticeCount(page.items.length);
      },
      error: (error: unknown) => this.store.failed(error),
    });
  }

  protected toggleSms(trigger: string): void {
    this.saved.set(false);
    this.smsEnabled.update((current) => {
      const next = new Set(current);
      if (next.has(trigger)) {
        next.delete(trigger);
      } else {
        next.add(trigger);
      }
      return next;
    });
  }

  protected save(): void {
    this.saving.set(true);
    this.errorCode.set(null);

    // EMAIL and IN_APP are always present: they are transactional and not the
    // student's to switch off (D-019). SMS is added only where asked for.
    const per_trigger: Record<string, ('EMAIL' | 'SMS' | 'IN_APP')[]> = {};
    for (const row of PREFERENCE_ROWS) {
      const channels: ('EMAIL' | 'SMS' | 'IN_APP')[] = this.smsEnabled().has(row.triggers[0])
        ? ['EMAIL', 'IN_APP', 'SMS']
        : ['EMAIL', 'IN_APP'];
      for (const trigger of row.triggers) {
        per_trigger[trigger] = channels;
      }
    }

    this.api.put<Schema<'Preferences'>>('/notifications/preferences', { per_trigger }).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
      },
      error: (error: unknown) => {
        this.errorCode.set(error instanceof ApiError ? error.code : null);
        this.saving.set(false);
      },
    });
  }

  /** Trigger keys are internal. A student should never meet SCREAMING_SNAKE. */
  protected readable(trigger: string): string {
    const known = TRIGGER_WORDS[trigger];
    if (known) {
      return known;
    }
    const words = trigger.toLowerCase().replace(/_/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  /** "13 September 2026, 10:44 · Waiting to send". It printed the raw timestamp, and said
   *  "sent by email" for messages that had not been sent. */
  protected sentVia(item: Notification): string {
    const when = new Date(item.created_at);
    const date = Number.isNaN(when.getTime())
      ? ''
      : when.toLocaleString('en-ZA', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
    const state = STATE_WORDS[item.state] ?? 'Status unknown';
    return date ? `${date} · ${state}` : state;
  }
}
