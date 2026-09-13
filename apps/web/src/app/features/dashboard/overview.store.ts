import { Injectable, computed, inject } from '@angular/core';
import { ApiService, type Schema } from 'data-access';
import { asyncState } from '../../core/async-state';

export type StudentOverview = Schema<'StudentOverview'>;

/**
 * The student's dashboard figures (`GET /students/me/overview`).
 *
 * Every number is counted by the server from the database at request time, and every grouping —
 * what "waiting on FundsLink" or "decided" means — is the server's, taken from the same lists the
 * review SLA and the state machine use. The dashboard does not count or classify anything itself.
 */
@Injectable({ providedIn: 'root' })
export class OverviewStore {
  private readonly api = inject(ApiService);
  private readonly store = asyncState<StudentOverview>();

  readonly state = this.store.state;
  readonly overview = computed(() => this.state().data);

  load(): void {
    this.store.loading();
    this.api.get<StudentOverview>('/students/me/overview').subscribe({
      next: (overview) => this.store.loaded(overview),
      error: (error: unknown) => this.store.failed(error),
    });
  }
}
