import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { History } from 'lucide';
import { type IconNode } from 'ui';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { AccountActivityComponent } from './account-activity.component';
import { OverviewStore } from './overview.store';
import { SecuritySummaryComponent } from './security-summary.component';

/** The server's categories (contract `ActivityItem.category`), in the words a student reads. */
const FILTERS: readonly { value: string | null; label: string }[] = [
  { value: null, label: 'Everything' },
  { value: 'SECURITY', label: 'Sign-ins & security' },
  { value: 'APPLICATION', label: 'Applications' },
  { value: 'ACCOUNT', label: 'Account & profile' },
  { value: 'DOCUMENTS', label: 'Documents' },
  { value: 'TRACKING', label: 'Tracking' },
  { value: 'MATCHING', label: 'Matches' },
  { value: 'PRIVACY', label: 'Privacy' },
];

/**
 * S08a — Account activity. The whole history of the account, on a page of its own.
 *
 * The dashboard shows the latest few entries; this is where a student goes to look properly —
 * back through everything, narrowed to one kind (every sign-in, say, when something feels wrong).
 * The filter is the URL (`?category=SECURITY`), so a support conversation can send someone
 * straight to the view that matters, and Back undoes a filter rather than leaving the page.
 */
@Component({
  selector: 'fl-activity-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, AccountActivityComponent, SecuritySummaryComponent],
  template: `
    <fl-page-header
      eyebrow="Your account"
      title="Account activity"
      lead="Everything recorded about your account, newest first: sign-ins, changes you made, and every step your applications took — and whether you or FundsLink took it."
      [icon]="icon"
      backRoute="/app"
      backLabel="Dashboard"
    />

    @if (overview.overview(); as figures) {
      <div class="mt-4">
        <fl-security-summary [account]="figures.account" />
      </div>
    }

    <fieldset class="mt-6">
      <legend class="mb-2 text-sm font-medium text-muted-foreground">Show</legend>
      <div class="flex flex-wrap gap-2">
        @for (filter of filters; track filter.label) {
          <label
            class="fl-surface inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm
                   has-[:checked]:bg-primary has-[:checked]:text-primary-foreground
                   has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2
                   has-[:focus-visible]:outline-ring"
          >
            <input
              type="radio"
              name="activity-filter"
              class="sr-only"
              [checked]="category() === filter.value"
              (change)="choose(filter.value)"
            />
            {{ filter.label }}
          </label>
        }
      </div>
    </fieldset>

    <fl-account-activity [category]="category()" />
  `,
})
export class ActivityPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly overview = inject(OverviewStore);

  protected readonly icon = History as IconNode;
  protected readonly filters = FILTERS;

  private readonly params = toSignal(this.route.queryParamMap);

  /** Only a category the contract knows; anything else in the URL means everything. */
  protected readonly category = computed(() => {
    const wanted = this.params()?.get('category') ?? null;
    return FILTERS.some((f) => f.value === wanted) ? wanted : null;
  });

  constructor() {
    if (this.overview.state().status !== 'success') {
      this.overview.load();
    }
  }

  protected choose(value: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: value },
      queryParamsHandling: 'merge',
    });
  }
}
