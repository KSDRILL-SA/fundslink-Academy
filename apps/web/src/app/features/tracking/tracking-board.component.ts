import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService, type Page, type Schema } from 'data-access';
import { Clock, LayoutList } from 'lucide';
import {
  UiButtonComponent,
  UiCardComponent,
  UiEmptyStateComponent,
  UiErrorStateComponent,
  UiSkeletonComponent,
  UiStatusChipComponent,
  UiTabsComponent,
  type IconNode,
  type TabItem,
} from 'ui';
import { asyncState } from '../../core/async-state';
import { PageHeaderComponent } from '../../shared/page-header.component';

type Tracked = Schema<'Tracked'>;

/** Days after which we tell the student we will chase the funder (§12.5). */
const SILENCE_NUDGE_DAYS = 25;

/**
 * S18 — Tracking board: applications the student made elsewhere.
 *
 * **Every status carries where it came from** (P3, §12.4). "Shortlisted" that
 * the student typed and "Shortlisted" read off an email are not the same
 * claim, and a board that renders them identically is implying a certainty the
 * platform does not have. The source badge sits beside every chip, always.
 *
 * The silence indicator is a promise, not a warning. After 25 days of nothing,
 * the screen says we will chase on day 30 — so a student watching an
 * application go quiet knows someone is doing something about it, rather than
 * wondering whether to nag a funder themselves.
 */
@Component({
  selector: 'fl-tracking-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiCardComponent,
    UiButtonComponent,
    UiStatusChipComponent,
    UiSkeletonComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
    UiTabsComponent,
    PageHeaderComponent,
  ],
  template: `
    <fl-page-header
      title="Your other applications"
      lead="Bursaries you applied for elsewhere, in one place. We will keep an eye on them with you."
      [icon]="boardIcon"
    >
      <a actions routerLink="/app/tracking/new" class="inline-flex">
        <ui-button variant="secondary">Track another</ui-button>
      </a>
    </fl-page-header>

    @switch (state().status) {
      @case ('loading') {
        <div class="mt-8 flex flex-col gap-4">
          @for (row of [1, 2]; track row) {
            <ui-skeleton class="h-28 w-full" shape="block" />
          }
        </div>
        <p class="sr-only" role="status">Loading your tracked applications.</p>
      }

      @case ('error') {
        <ui-error-state class="mt-8" [code]="state().errorCode" (retry)="load()" />
      }

      @case ('empty') {
        <!-- §4: an empty tracking board teaches S19. -->
        <ui-empty-state
          class="mt-8"
          title="Nothing tracked yet"
          message="Applied for a bursary somewhere else? Add it here and we will watch the deadlines and chase quiet funders for you."
          actionLabel="Track an application"
          (action)="addTracked()"
        />
      }

      @case ('success') {
        <!-- One board, two views of it. The tabs are real tabs (arrow keys,
             one tab stop), and each carries its count as text so "needs
             attention" is a number a student can see, not a colour. -->
        <ui-tabs
          class="mt-8 block"
          ariaLabel="Filter your tracked applications"
          [tabs]="tabs()"
          [(selected)]="filter"
        />

        <!-- One panel, two renderings of it — a single tabpanel so the ids
             stay unique and the tab actually points at something. -->
        <div [id]="panelId()" role="tabpanel" [attr.aria-labelledby]="labelId()" tabindex="0">
          <!-- Wide: a real table. Finding the one application that has gone
               quiet is a column-reading task, and cards make the reader
               re-locate the same fact in a different place on every card. -->
          <div class="fl-surface fl-table-frame mt-4 hidden overflow-x-auto md:block">
            <table class="fl-table">
            <caption class="sr-only">
              Your tracked applications, with where each status came from.
            </caption>
            <thead>
              <tr>
                <th scope="col">Bursary</th>
                <th scope="col">Status</th>
                <th scope="col">Where this came from</th>
                <th scope="col">Closes</th>
              </tr>
            </thead>
            <tbody>
              @for (item of visible(); track item.id) {
                <tr>
                  <th scope="row" class="p-4 text-left align-top font-medium">
                    {{ item.bursary.name }}
                    <span class="mt-1 block text-sm font-normal text-muted-foreground">
                      {{ item.bursary.provider }}
                    </span>
                    @if (hasGoneQuiet(item)) {
                      <span class="mt-2 block text-sm font-normal text-muted-foreground">
                        No news for a while — we nudge them on day 30.
                      </span>
                    }
                  </th>
                  <td><ui-status-chip [status]="item.status" /></td>
                  <!-- Never omitted: a status the student typed and one read off
                       an email are different claims (P3, §12.4). -->
                  <td><ui-status-chip [status]="item.status_source" kind="source" /></td>
                  <td class="text-sm text-muted-foreground">
                    {{ item.bursary.next_deadline || '—' }}
                  </td>
                </tr>
              }
            </tbody>
            </table>
          </div>

          <!-- Narrow: the same rows as cards. A table that scrolls sideways on
               a phone is a table nobody reads. -->
          <ul class="mt-4 flex flex-col gap-4 md:hidden">
          @for (item of visible(); track item.id) {
            <li>
              <ui-card>
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="min-w-0">
                    <h2 class="text-lg font-semibold">{{ item.bursary.name }}</h2>
                    <p class="mt-1 text-sm text-muted-foreground">{{ item.bursary.provider }}</p>

                    <div class="mt-3 flex flex-wrap items-center gap-2">
                      <ui-status-chip [status]="item.status" />
                      <!-- Where this status came from. Never omitted (P3). -->
                      <ui-status-chip [status]="item.status_source" kind="source" />
                    </div>
                  </div>

                  @if (item.bursary.next_deadline; as deadline) {
                    <p class="text-sm text-muted-foreground">Closes {{ deadline }}</p>
                  }
                </div>

                @if (hasGoneQuiet(item)) {
                  <p class="mt-4 rounded-lg bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                    No news for a while. We will nudge them for you on day 30 — you do not need to
                    do anything.
                  </p>
                }
                </ui-card>
              </li>
            }
          </ul>
        </div>
      }
    }
  `,
})
export class TrackingBoardComponent {
  protected readonly boardIcon = LayoutList as IconNode;
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly store = asyncState<readonly Tracked[]>((items) => items.length === 0);
  private readonly tabsRef = viewChild(UiTabsComponent);

  protected readonly state = this.store.state;
  protected readonly tracked = computed(() => this.state().data ?? []);

  /** Which view of the board is showing. Presentation only — nothing is hidden
   *  from the student that the "All" tab does not also show. */
  protected readonly filter = signal('all');

  protected readonly quiet = computed(() => this.tracked().filter((item) => this.hasGoneQuiet(item)));

  protected readonly tabs = computed<readonly TabItem[]>(() => [
    { id: 'all', label: 'All', icon: LayoutList as IconNode, count: this.tracked().length },
    { id: 'quiet', label: 'Gone quiet', icon: Clock as IconNode, count: this.quiet().length },
  ]);

  protected readonly visible = computed(() =>
    this.filter() === 'quiet' ? this.quiet() : this.tracked(),
  );

  // The tab and its panel have to point at each other, and the ids belong to
  // the tabs component so they stay unique when a screen has two tab sets.
  protected readonly panelId = computed(() => this.tabsRef()?.panelId(this.filter()) ?? null);
  protected readonly labelId = computed(() => this.tabsRef()?.tabId(this.filter()) ?? null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.store.loading();
    this.api.get<Page<Tracked>>('/tracked-applications').subscribe({
      next: (page) => this.store.loaded(page.items),
      error: (error: unknown) => this.store.failed(error),
    });
  }

  protected addTracked(): void {
    void this.router.navigateByUrl('/app/tracking/new');
  }

  /** 25 days of silence, per §12.5. */
  protected hasGoneQuiet(item: Tracked): boolean {
    const last = Date.parse(item.last_activity_at);
    if (Number.isNaN(last)) {
      return false;
    }
    const days = (Date.now() - last) / 86_400_000;
    return days >= SILENCE_NUDGE_DAYS;
  }
}
