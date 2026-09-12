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

/** The moments we would write to a student about, in the order they happen. */
const TRIGGERS = [
  { key: 'APPLICATION_SUBMITTED', label: 'When your application is received' },
  { key: 'APPLICATION_RETURNED_FOR_INFO', label: 'When we need something more from you' },
  { key: 'APPLICATION_STATUS_CHANGED', label: 'When your application moves along' },
  { key: 'APPLICATION_REVIEWED', label: 'When there is a decision' },
  { key: 'DEADLINE_REMINDER', label: 'Before a bursary deadline closes' },
] as const;

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
          @for (trigger of triggers; track trigger.key) {
            <li class="flex items-start gap-3">
              <input
                uiCheckbox
                type="checkbox"
                [id]="'sms-' + trigger.key"
                class="mt-1"
                [checked]="smsEnabled().has(trigger.key)"
                (change)="toggleSms(trigger.key)"
              />
              <label [for]="'sms-' + trigger.key">
                <span class="font-medium">{{ trigger.label }}</span>
                <span class="mt-1 block text-sm text-muted-foreground">
                  Email always. Tick to get a text as well.
                </span>
              </label>
            </li>
          }
        </ul>

        <div class="mt-6 flex flex-wrap items-center gap-3">
          <ui-button [loading]="saving()" (clicked)="save()">Save preferences</ui-button>
          @if (saved()) {
            <p role="status" class="text-sm font-medium text-success">Saved.</p>
          }
        </div>

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

  protected readonly triggers = TRIGGERS;
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
    for (const trigger of TRIGGERS) {
      per_trigger[trigger.key] = this.smsEnabled().has(trigger.key)
        ? ['EMAIL', 'IN_APP', 'SMS']
        : ['EMAIL', 'IN_APP'];
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
    const known = TRIGGERS.find((t) => t.key === trigger);
    if (known) {
      return known.label;
    }
    const words = trigger.toLowerCase().replace(/_/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  protected sentVia(item: Notification): string {
    const channels = item.channels.map((channel) => channel.toLowerCase()).join(', ');
    return `${item.created_at} · sent by ${channels}`;
  }
}
