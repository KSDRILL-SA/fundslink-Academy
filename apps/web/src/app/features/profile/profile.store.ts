import { Injectable, computed, inject } from '@angular/core';
import { ApiService, type Schema } from 'data-access';
import { asyncState } from '../../core/async-state';

export type StudentProfile = Schema<'StudentProfile'>;
export type StudentProfileInput = Schema<'StudentProfileInput'>;

/**
 * Server state for the student's profile (frontend-structure.md §5).
 *
 * A thin signal wrapper over the generated client — it holds no business rule.
 * Whether a profile is complete enough to apply is the server's judgement
 * (`profile_required`, `sa_id_required`), not something re-derived here where
 * it would drift from the API the moment either changes (S4.12).
 */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly api = inject(ApiService);
  // A profile that has never been created reads as empty, not as an error:
  // "you have not started yet" is a beginning, not a failure (P2).
  private readonly store = asyncState<StudentProfile | null>((value) => value === null);

  readonly state = this.store.state;
  readonly profile = computed(() => this.state().data ?? null);

  load(): void {
    this.store.loading();
    this.api.get<StudentProfile>('/students/me/profile').subscribe({
      next: (profile) => this.store.loaded(profile),
      error: (error: unknown) => {
        // 404 here means "no profile yet", which is a normal starting state
        // for every new student — not something to show an error screen for.
        if (isNotFound(error)) {
          this.store.loaded(null);
          return;
        }
        this.store.failed(error);
      },
    });
  }

  save(input: StudentProfileInput) {
    return this.api.put<StudentProfile>('/students/me/profile', input);
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'profile_not_found'
  );
}
