import { Injectable, computed, inject } from '@angular/core';
import { ApiService, type Page, type Schema } from 'data-access';
import { asyncState } from '../../core/async-state';

export type Application = Schema<'Application'>;

/**
 * Server state for the student's applications (frontend-structure.md §5).
 *
 * Pagination is cursor-based, never offset (handoff §4.4) — an offset page
 * shifts under you when a row is added, which on a queue means seeing the same
 * application twice or missing one entirely.
 */
@Injectable({ providedIn: 'root' })
export class ApplicationsStore {
  private readonly api = inject(ApiService);
  private readonly store = asyncState<readonly Application[]>((items) => items.length === 0);

  readonly state = this.store.state;
  readonly applications = computed(() => this.state().data ?? []);

  /** The one the dashboard leads with: a student has at most one active per year (D-004). */
  readonly current = computed(() => this.applications()[0] ?? null);

  load(): void {
    this.store.loading();
    this.api.get<Page<Application>>('/applications').subscribe({
      next: (page) => this.store.loaded(page.items),
      error: (error: unknown) => this.store.failed(error),
    });
  }
}
