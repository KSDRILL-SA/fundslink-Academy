import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ApiService, type Page, type Schema } from 'data-access';
import { CalendarDays, GraduationCap } from 'lucide';
import {
  UiBadgeComponent,
  UiButtonComponent,
  UiCardComponent,
  UiEmptyStateComponent,
  UiErrorStateComponent,
  UiIconTileComponent,
  UiSkeletonComponent,
  type IconNode,
} from 'ui';
import { asyncState } from '../../core/async-state';

type Bursary = Schema<'Bursary'>;

/**
 * S03 — Browse bursaries. Public, no login required (§1).
 *
 * This screen is the other half of BR-M02: matching may suggest, but the full
 * list must always be reachable at equal prominence — including by someone who
 * has not signed up and is deciding whether this platform is worth their time.
 *
 * It is routed twice, to the same component: publicly under the marketing
 * shell, and inside the app shell so the matching screens' promise resolves.
 * One implementation, so the public list and the in-app list can never quietly
 * differ.
 *
 * Pagination is cursor-based (handoff §4.4). An offset page shifts under you
 * when a bursary is added, which means seeing one twice or missing one — and a
 * missed bursary here is a missed chance at funding.
 */
@Component({
  selector: 'fl-bursaries',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiCardComponent,
    UiButtonComponent,
    UiSkeletonComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
    UiIconTileComponent,
    UiBadgeComponent,
  ],
  template: `
    <div class="mx-auto max-w-[1000px] px-4 py-10">
      <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Every bursary we know of</h1>
      <p class="mt-2 max-w-prose text-muted-foreground">
        The full list, open to everyone — you do not need an account to look. Apply to anything here
        that fits you.
      </p>

      @switch (state().status) {
        @case ('loading') {
          <div class="mt-8 flex flex-col gap-4">
            @for (row of [1, 2, 3, 4]; track row) {
              <ui-skeleton class="h-24 w-full" shape="block" />
            }
          </div>
          <p class="sr-only" role="status">Loading bursaries.</p>
        }

        @case ('error') {
          <ui-error-state class="mt-8" [code]="state().errorCode" (retry)="load()" />
        }

        @case ('empty') {
          <ui-empty-state
            class="mt-8"
            title="No bursaries listed right now"
            message="Intakes open through the year. Create an account and we will tell you the moment something suits you."
          />
        }

        @case ('success') {
          <ul class="mt-8 flex flex-col gap-4">
            @for (bursary of bursaries(); track bursary.id) {
              <li>
                <ui-card variant="interactive">
                  <div class="flex flex-wrap items-start justify-between gap-4">
                    <ui-icon-tile [icon]="bursaryIcon" tone="gold" size="lg" class="mt-1" />

                    <div class="min-w-0 flex-1">
                      <h2 class="text-lg font-semibold tracking-tight">
                        @if (bursary.source_url) {
                          <a
                            [href]="bursary.source_url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="rounded-sm underline-offset-4 outline-none hover:underline
                                   focus-visible:outline-[3px] focus-visible:outline-offset-2
                                   focus-visible:outline-ring"
                          >
                            {{ bursary.name }}
                            <span class="sr-only">(opens on the funder's own site)</span>
                          </a>
                        } @else {
                          {{ bursary.name }}
                        }
                      </h2>
                      <p class="mt-1 text-sm text-muted-foreground">{{ bursary.provider }}</p>

                      <div class="mt-4 flex flex-wrap items-center gap-2">
                        @for (tag of bursary.field_tags ?? []; track tag) {
                          <ui-badge tone="outline" [label]="tag" />
                        }
                      </div>
                    </div>

                    @if (bursary.next_deadline; as deadline) {
                      <ui-badge tone="neutral" [icon]="calendarIcon" [label]="'Closes ' + deadline" />
                    }
                  </div>
                </ui-card>
              </li>
            }
          </ul>

          @if (nextCursor()) {
            <div class="mt-8 flex justify-center">
              <ui-button variant="secondary" [loading]="loadingMore()" (clicked)="loadMore()">
                Show more
              </ui-button>
            </div>
          }
        }
      }
    </div>
  `,
})
export class BursariesComponent {
  private readonly api = inject(ApiService);
  private readonly store = asyncState<readonly Bursary[]>((items) => items.length === 0);
  private cursor: string | null = null;

  protected readonly state = this.store.state;
  protected readonly bursaryIcon = GraduationCap as IconNode;
  protected readonly calendarIcon = CalendarDays as IconNode;
  protected readonly bursaries = computed(() => this.state().data ?? []);
  protected readonly loadingMore = computed(() => false);
  protected readonly nextCursor = computed(() => this.cursor !== null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.store.loading();
    this.api.get<Page<Bursary>>('/bursaries').subscribe({
      next: (page) => {
        this.cursor = page.meta.next_cursor ?? null;
        this.store.loaded(page.items);
      },
      error: (error: unknown) => this.store.failed(error),
    });
  }

  /** Cursor pagination — append, never re-fetch a shifting offset page. */
  protected loadMore(): void {
    if (!this.cursor) {
      return;
    }
    const existing = this.bursaries();
    this.api.get<Page<Bursary>>('/bursaries', { query: { cursor: this.cursor } }).subscribe({
      next: (page) => {
        this.cursor = page.meta.next_cursor ?? null;
        this.store.loaded([...existing, ...page.items]);
      },
      error: (error: unknown) => this.store.failed(error),
    });
  }
}
