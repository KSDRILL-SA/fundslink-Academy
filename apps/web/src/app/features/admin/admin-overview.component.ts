import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, type Page, type Schema } from 'data-access';
import {
  Activity,
  ClipboardList,
  Gauge,
  Inbox,
  ShieldAlert,
  Timer,
  TriangleAlert,
  UserPlus,
} from 'lucide';
import {
  UiButtonComponent,
  UiCardComponent,
  UiEmptyStateComponent,
  UiErrorStateComponent,
  UiSkeletonComponent,
  UiStatComponent,
  UiStatusChipComponent,
  humanise,
  type IconNode,
} from 'ui';
import { asyncState } from '../../core/async-state';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { THEME_TAGS } from './theme-tags';

type AdminOverview = Schema<'AdminOverview'>;
type AdminActivityItem = Schema<'AdminActivityItem'>;
type ThemeClusters = Schema<'ThemeClusters'>;

/**
 * A00 — Operations overview. The first screen for the people running the review.
 *
 * Every figure is counted by the server from the database when the page asks (`adminGetOverview`):
 * how much is waiting on a person, how much of it is past the SLA in the config table, emergencies,
 * applications waiting without a pre-screen (S8.51), what was decided over the chosen window and
 * how long it took, whether notifications are reaching students, and what sign-in failures and
 * lockouts look like. Nothing on this screen is a literal or a sample.
 *
 * The window is the viewer's choice, not a business rule — one of the three the contract allows.
 *
 * System activity (`adminListActivity`) is the audit log reduced to what monitoring needs: what
 * happened, to what, and what kind of actor did it. No audit payload and no names — the log can
 * hold email addresses, and naming who did something is an investigation, not a dashboard.
 */
@Component({
  selector: 'fl-admin-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiButtonComponent,
    UiCardComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
    UiSkeletonComponent,
    UiStatComponent,
    UiStatusChipComponent,
    PageHeaderComponent,
  ],
  template: `
    <fl-page-header
      eyebrow="Admin"
      title="Operations overview"
      lead="Live figures from the database. Every number here is counted when you open the page."
      [icon]="icons.gauge"
    >
      <a actions routerLink="/app/admin/queue" class="inline-flex">
        <ui-button variant="primary">Open the review queue</ui-button>
      </a>
    </fl-page-header>

    <fieldset class="mt-6 flex flex-wrap items-center gap-2">
      <legend class="mb-2 text-sm font-medium text-muted-foreground">Reporting window</legend>
      @for (option of windows; track option) {
        <label
          class="fl-surface inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm
                 has-[:checked]:bg-primary has-[:checked]:text-primary-foreground
                 has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2
                 has-[:focus-visible]:outline-ring"
        >
          <input
            type="radio"
            name="window"
            class="sr-only"
            [value]="option"
            [checked]="days() === option"
            (change)="choose(option)"
          />
          Last {{ option }} days
        </label>
      }
    </fieldset>

    @switch (state().status) {
      @case ('error') {
        <ui-error-state class="mt-8" [code]="state().errorCode" (retry)="load()" />
      }

      @case ('success') {
        @if (figures(); as f) {
          <section class="mt-8" aria-labelledby="queue-heading">
            <h2 id="queue-heading" class="text-lg font-semibold">The queue, right now</h2>
            <ul class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <li>
                <ui-stat label="Waiting for a reviewer" [value]="n(f.queue.awaiting_review)"
                         [hint]="n(f.queue.awaiting_student) + ' waiting on the student'"
                         [icon]="icons.queue" tone="navy" />
              </li>
              <li>
                <ui-stat label="Past the review SLA" [value]="n(f.queue.overdue)"
                         hint="Against the SLA days in config" [icon]="icons.overdue"
                         [tone]="f.queue.overdue > 0 ? 'warning' : 'success'" />
              </li>
              <li>
                <ui-stat label="Urgent or critical" [value]="n(f.queue.emergency)"
                         hint="Shorter emergency SLA applies" [icon]="icons.alert" tone="gold" />
              </li>
              <li>
                <ui-stat label="Without a pre-screen" [value]="n(f.queue.unscreened)"
                         hint="Reviewed by a person without the engine" [icon]="icons.activity"
                         tone="neutral" />
              </li>
            </ul>

            @if (f.queue.by_status.length) {
              <ul class="mt-4 flex flex-wrap gap-2" aria-label="Waiting, by status">
                @for (row of f.queue.by_status; track row.status) {
                  <li class="fl-surface inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3">
                    <ui-status-chip [status]="row.status" />
                    <span class="tabular text-sm font-medium">{{ n(row.count) }}</span>
                  </li>
                }
              </ul>
            }
          </section>

          <section class="mt-8" aria-labelledby="flow-heading">
            <h2 id="flow-heading" class="text-lg font-semibold">Last {{ f.window_days }} days</h2>
            <ul class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <li>
                <ui-stat label="Submitted" [value]="n(f.flow.submitted)"
                         [hint]="decisionsHint(f)" [icon]="icons.inbox" tone="navy" />
              </li>
              <li>
                <ui-stat label="Median days to a decision" [value]="median(f)"
                         hint="From submission, resubmission or appeal" [icon]="icons.timer"
                         tone="gold" />
              </li>
              <li>
                <ui-stat label="Notifications failing" [value]="n(f.notifications.failed)"
                         [hint]="n(f.notifications.pending) + ' queued · ' + n(f.notifications.sent) + ' sent'"
                         [icon]="icons.inbox"
                         [tone]="f.notifications.failed > 0 ? 'warning' : 'success'" />
              </li>
              <li>
                <ui-stat label="New accounts" [value]="n(f.accounts.registered)"
                         [hint]="n(f.accounts.sign_ins) + ' sign-ins · ' + n(f.accounts.failed_sign_ins) + ' failed · ' + n(f.accounts.locked) + ' locked'"
                         [icon]="f.accounts.locked > 0 ? icons.shield : icons.userPlus"
                         [tone]="f.accounts.locked > 0 ? 'warning' : 'neutral'" />
              </li>
            </ul>
            <p class="mt-3 text-sm text-muted-foreground">
              Counted at <time class="tabular" [attr.datetime]="f.generated_at">{{ time(f.generated_at) }}</time>.
            </p>
          </section>
        }
      }

      @default {
        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          @for (tile of [1, 2, 3, 4, 5, 6, 7, 8]; track tile) {
            <ui-skeleton class="h-32 w-full" shape="block" />
          }
        </div>
        <p class="sr-only" role="status">Loading the operations overview.</p>
      }
    }

    <!--
      The quarterly theme report (MASTER-SPEC §5.6, D-018).

      A case that fits no funding category is handled one at a time, and §5.6 promises the reasons
      are counted so a recurring edge becomes a category of its own. It belongs on the screen the
      people running the review already open, not in a query someone has to remember to run — the
      whole failure this closes was a promise nobody could see.
    -->
    <section class="mt-10" aria-labelledby="themes-heading">
      <h2 id="themes-heading" class="text-lg font-semibold">What the categories keep missing</h2>
      <ui-card class="mt-4">
        @switch (themes().status) {
          @case ('error') {
            <ui-error-state [code]="themes().errorCode" (retry)="loadThemes()" />
          }
          @case ('empty') {
            <ui-empty-state
              title="No themes recorded yet"
              message="When a reviewer records what an out-of-category case was about, the count appears here."
            />
          }
          @case ('success') {
            @if (themeReport(); as report) {
              <p class="max-w-prose text-muted-foreground">
                {{ n(report.tagged_applications) }}
                {{ report.tagged_applications === 1 ? 'case' : 'cases' }} outside our categories
                {{ report.tagged_applications === 1 ? 'was' : 'were' }} given a theme in the last
                {{ report.window_days }} days. A theme that keeps recurring is a category waiting
                to exist.
              </p>
              <ul class="mt-4 flex flex-col gap-3">
                @for (theme of report.themes; track theme.tag) {
                  <li class="flex items-center gap-3">
                    <span class="min-w-0 flex-1 truncate">{{ themeLabel(theme.tag) }}</span>
                    <span
                      class="h-2 rounded-full bg-primary/70"
                      [style.width.%]="share(theme.applications, report)"
                      aria-hidden="true"
                    ></span>
                    <span class="w-16 shrink-0 text-right tabular-nums font-medium">
                      {{ n(theme.applications) }}
                    </span>
                  </li>
                }
              </ul>
            }
          }
          @default {
            <ui-skeleton class="h-24 w-full" shape="block" />
            <p class="sr-only" role="status">Loading the theme report.</p>
          }
        }
      </ui-card>
    </section>

    <section class="mt-10" aria-labelledby="system-activity-heading">
      <h2 id="system-activity-heading" class="text-lg font-semibold">System activity</h2>
      <ui-card class="mt-4">
        @switch (activity().status) {
          @case ('error') {
            <ui-error-state [code]="activity().errorCode" (retry)="loadActivity()" />
          }
          @case ('empty') {
            <ui-empty-state title="Nothing recorded yet"
                            message="Every sign-in, application step and change will appear here." />
          }
          @case ('success') {
            <div class="overflow-x-auto">
              <table class="fl-table">
                <caption class="sr-only">Recent system activity, newest first</caption>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">What happened</th>
                    <th scope="col">Record</th>
                    <th scope="col">Done by</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of activityItems(); track item.id) {
                    <tr>
                      <td class="tabular whitespace-nowrap text-sm">
                        <time [attr.datetime]="item.occurred_at">{{ time(item.occurred_at) }}</time>
                      </td>
                      <td>{{ action(item.action) }}</td>
                      <td class="text-sm text-muted-foreground">{{ resource(item.resource_type) }}</td>
                      <td class="text-sm">{{ actorKind(item.actor_kind) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (activityCursor()) {
              <div class="mt-4 flex justify-center">
                <ui-button variant="secondary" [loading]="loadingMore()" (click)="moreActivity()">
                  Show earlier activity
                </ui-button>
              </div>
            }
          }
          @default {
            <div class="flex flex-col gap-3">
              @for (row of [1, 2, 3, 4]; track row) {
                <ui-skeleton class="h-5 w-full" />
              }
            </div>
          }
        }
      </ui-card>
    </section>
  `,
})
export class AdminOverviewComponent {
  private readonly api = inject(ApiService);
  private readonly store = asyncState<AdminOverview>();
  private readonly activityStore = asyncState<readonly AdminActivityItem[]>(
    (items) => items.length === 0,
  );

  /** The reporting windows the contract allows (adminGetOverview.days). */
  protected readonly windows = [7, 30, 90] as const;
  protected readonly days = signal<number>(this.windows[0]);

  protected readonly state = this.store.state;
  protected readonly figures = computed(() => this.state().data);
  protected readonly activity = this.activityStore.state;
  protected readonly activityItems = computed(() => this.activity().data ?? []);
  protected readonly activityCursor = signal<string | null>(null);
  private readonly themeStore = asyncState<ThemeClusters | null>(
    (report) => !report || report.themes.length === 0,
  );
  protected readonly themes = this.themeStore.state;
  protected readonly themeReport = computed(() => this.themes().data ?? null);
  protected readonly loadingMore = signal(false);

  protected readonly icons = {
    gauge: Gauge as IconNode,
    queue: ClipboardList as IconNode,
    overdue: Timer as IconNode,
    alert: TriangleAlert as IconNode,
    activity: Activity as IconNode,
    inbox: Inbox as IconNode,
    timer: Timer as IconNode,
    shield: ShieldAlert as IconNode,
    userPlus: UserPlus as IconNode,
  };

  constructor() {
    this.load();
    this.loadActivity();
    this.loadThemes();
  }

  protected loadThemes(): void {
    this.themeStore.loading();
    this.api.get<ThemeClusters>('/admin/themes').subscribe({
      next: (report) => this.themeStore.loaded(report),
      error: (error: unknown) => this.themeStore.failed(error),
    });
  }

  protected themeLabel(tag: string): string {
    return THEME_TAGS.find((theme) => theme.value === tag)?.label ?? humanise(tag);
  }

  /** Bar width relative to the most common theme, so the shape reads at a glance. Never zero —
   *  a theme with a real count must still be visible. */
  protected share(applications: number, report: ThemeClusters): number {
    const top = Math.max(...report.themes.map((theme) => theme.applications), 1);
    return Math.max(6, Math.round((applications / top) * 100));
  }

  protected choose(days: number): void {
    this.days.set(days);
    this.load();
  }

  protected load(): void {
    this.store.loading();
    this.api
      .get<AdminOverview>('/admin/overview', { query: { days: this.days() } })
      .subscribe({
        next: (overview) => this.store.loaded(overview),
        error: (error: unknown) => this.store.failed(error),
      });
  }

  protected loadActivity(): void {
    this.activityStore.loading();
    this.api.get<Page<AdminActivityItem>>('/admin/activity').subscribe({
      next: (page) => {
        this.activityCursor.set(page.meta?.next_cursor ?? null);
        this.activityStore.loaded(page.items);
      },
      error: (error: unknown) => this.activityStore.failed(error),
    });
  }

  protected moreActivity(): void {
    const cursor = this.activityCursor();
    if (!cursor || this.loadingMore()) {
      return;
    }
    this.loadingMore.set(true);
    this.api.get<Page<AdminActivityItem>>('/admin/activity', { query: { cursor } }).subscribe({
      next: (page) => {
        this.activityCursor.set(page.meta?.next_cursor ?? null);
        this.activityStore.loaded([...this.activityItems(), ...page.items]);
        this.loadingMore.set(false);
      },
      error: (error: unknown) => {
        this.loadingMore.set(false);
        this.activityStore.failed(error);
      },
    });
  }

  protected n(value: number): string {
    return value.toLocaleString('en-ZA');
  }

  protected median(f: AdminOverview): string {
    const days = f.flow.median_days_to_decision;
    return days === null || days === undefined ? 'No decisions' : days.toLocaleString('en-ZA');
  }

  protected decisionsHint(f: AdminOverview): string {
    const { approved, waitlisted, not_funded } = f.flow;
    return `${this.n(approved)} approved · ${this.n(waitlisted)} waitlisted · ${this.n(not_funded)} not funded`;
  }

  /** Audit codes are stable identifiers, not prose; staff read them as plain words. */
  protected action(code: string): string {
    return humanise(code.replace(/^AUTH_/, ''));
  }

  protected resource(type: string): string {
    return humanise(type);
  }

  protected actorKind(kind: string): string {
    switch (kind) {
      case 'STUDENT':
        return 'A student';
      case 'STAFF':
        return 'Staff';
      case 'SYSTEM':
        return 'The system';
      case 'ANONYMOUS':
        return 'Not signed in';
      default:
        return humanise(kind);
    }
  }

  protected time(iso: string): string {
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime())
      ? ''
      : parsed.toLocaleString('en-ZA', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
  }
}
