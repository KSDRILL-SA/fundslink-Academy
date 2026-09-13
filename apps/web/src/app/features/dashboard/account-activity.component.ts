import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, type Page, type Schema } from 'data-access';
import {
  UiButtonComponent,
  UiCardComponent,
  UiEmptyStateComponent,
  UiErrorStateComponent,
  UiIconComponent,
  UiSkeletonComponent,
} from 'ui';
import { asyncState } from '../../core/async-state';
import { describeActivity, describeActor } from './activity-wording';

type ActivityItem = Schema<'ActivityItem'>;

interface DayGroup {
  readonly key: string;
  readonly label: string;
  readonly items: readonly ActivityItem[];
}

/**
 * Account activity — everything recorded about this account, newest first.
 *
 * It exists so a student can see their account is theirs: every sign-in, every change to their
 * password or profile, every step their application took and who took it. A sign-in they do not
 * recognise is the first sign of a stolen account, and this list is where they would notice it.
 *
 * Every row comes from `GET /students/me/activity`. The server merges the audit log with the
 * application and tracker event logs, decides which actions a student is shown, filters by
 * category in the query, and never sends a reviewer's name, a reviewer's note or an audit payload.
 * This component only words, dates and groups it.
 *
 * Two uses: the dashboard shows a short `preview` with a link to the full page; the Account
 * activity page (`/app/activity`) shows everything, pages back through history, and filters.
 */
@Component({
  selector: 'fl-account-activity',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiButtonComponent,
    UiCardComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
    UiIconComponent,
    UiSkeletonComponent,
  ],
  template: `
    <ui-card class="mt-4">
      @switch (state().status) {
        @case ('error') {
          <ui-error-state [code]="state().errorCode" (retry)="load()" />
        }

        @case ('empty') {
          <ui-empty-state
            title="Nothing recorded yet"
            [message]="
              category()
                ? 'Nothing of this kind has happened on your account yet.'
                : 'Sign-ins, changes to your account and every step your application takes will appear here as they happen.'
            "
          />
        }

        @case ('success') {
          @for (group of groups(); track group.key) {
            <section [attr.aria-labelledby]="'day-' + group.key" class="[&+&]:mt-4">
              <h3 [id]="'day-' + group.key" class="fl-caption pb-1 pt-2">{{ group.label }}</h3>
              <ol class="flex flex-col">
                @for (item of group.items; track item.id) {
                  <li class="flex gap-3 border-b border-border py-3 last:border-b-0">
                    <span
                      class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                      aria-hidden="true"
                    >
                      <ui-icon [name]="wording(item).icon" size="sm" />
                    </span>
                    <div class="min-w-0 flex-1">
                      <p class="font-medium">{{ wording(item).text }}</p>
                      <p class="mt-0.5 text-sm text-muted-foreground">
                        <time class="tabular" [attr.datetime]="item.occurred_at">{{
                          clock(item.occurred_at)
                        }}</time>
                        · {{ actor(item.actor) }}
                      </p>
                    </div>
                  </li>
                }
              </ol>
            </section>
          }

          @if (preview()) {
            <div class="mt-4 flex justify-center border-t border-border pt-4">
              <a routerLink="/app/activity" class="inline-flex">
                <ui-button variant="secondary">See all account activity</ui-button>
              </a>
            </div>
          } @else if (nextCursor()) {
            <div class="mt-4 flex justify-center">
              <ui-button variant="secondary" [loading]="loadingMore()" (click)="loadMore()">
                Show earlier activity
              </ui-button>
            </div>
          }
        }

        @default {
          <div class="flex flex-col gap-4">
            @for (row of [1, 2, 3]; track row) {
              <div class="flex gap-3">
                <ui-skeleton class="h-8 w-8" shape="circle" />
                <div class="flex flex-1 flex-col gap-2">
                  <ui-skeleton class="h-4 w-2/3" />
                  <ui-skeleton class="h-3 w-1/3" />
                </div>
              </div>
            }
          </div>
          <p class="sr-only" role="status">Loading your account activity.</p>
        }
      }
    </ui-card>
  `,
})
export class AccountActivityComponent {
  private readonly api = inject(ApiService);
  private readonly store = asyncState<readonly ActivityItem[]>((items) => items.length === 0);

  /** Show only the latest entries, with a link to the full page instead of paging. */
  readonly preview = input(false);
  /** How many entries the preview shows. The full page uses the server's page size. */
  readonly previewSize = input(5);
  /** Narrow to one server category (SECURITY, APPLICATION, …); null is everything. */
  readonly category = input<string | null>(null);

  protected readonly state = this.store.state;
  protected readonly items = computed(() => this.state().data ?? []);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loadingMore = signal(false);

  protected readonly wording = describeActivity;
  protected readonly actor = describeActor;

  /** Entries under a heading per calendar day, in this device's time zone. */
  protected readonly groups = computed<readonly DayGroup[]>(() => {
    const groups: { key: string; label: string; items: ActivityItem[] }[] = [];
    for (const item of this.items()) {
      const day = new Date(item.occurred_at);
      const key = Number.isNaN(day.getTime()) ? 'unknown' : localDayKey(day);
      const last = groups.at(-1);
      if (last?.key === key) {
        last.items.push(item);
      } else {
        groups.push({ key, label: dayLabel(day, key), items: [item] });
      }
    }
    return groups;
  });

  constructor() {
    // Reload whenever the category changes — including the first render.
    effect(() => {
      this.category();
      untracked(() => this.load());
    });
  }

  protected load(): void {
    this.store.loading();
    this.nextCursor.set(null);
    this.api.get<Page<ActivityItem>>('/students/me/activity', { query: this.query() }).subscribe({
      next: (page) => {
        this.nextCursor.set(page.meta?.next_cursor ?? null);
        this.store.loaded(page.items);
      },
      error: (error: unknown) => this.store.failed(error),
    });
  }

  protected loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) {
      return;
    }
    this.loadingMore.set(true);
    this.api
      .get<Page<ActivityItem>>('/students/me/activity', { query: { ...this.query(), cursor } })
      .subscribe({
        next: (page) => {
          this.nextCursor.set(page.meta?.next_cursor ?? null);
          this.store.loaded([...this.items(), ...page.items]);
          this.loadingMore.set(false);
        },
        error: (error: unknown) => {
          this.loadingMore.set(false);
          this.store.failed(error);
        },
      });
  }

  private query(): Record<string, string | number | undefined> {
    return {
      category: this.category() ?? undefined,
      limit: this.preview() ? this.previewSize() : undefined,
    };
  }

  /** "09:04" — the day is the group heading above it. */
  protected clock(iso: string): string {
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime())
      ? ''
      : parsed.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  }
}

function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayLabel(date: Date, key: string): string {
  if (key === 'unknown') {
    return 'Date not recorded';
  }
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (key === localDayKey(today)) {
    return 'Today';
  }
  if (key === localDayKey(yesterday)) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
