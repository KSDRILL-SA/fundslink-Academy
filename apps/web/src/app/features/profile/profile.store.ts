import { Injectable, computed, inject } from '@angular/core';
import { ApiService, type Schema } from 'data-access';
import { asyncState } from '../../core/async-state';
import { ShellSignalsService } from '../../core/shell-signals.service';

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
  private readonly shell = inject(ShellSignalsService);
  // A profile that has never been created reads as empty, not as an error:
  // "you have not started yet" is a beginning, not a failure (P2).
  private readonly store = asyncState<StudentProfile | null>((value) => value === null);

  readonly state = this.store.state;
  readonly profile = computed(() => this.state().data ?? null);

  load(): void {
    this.store.loading();
    this.api.get<StudentProfile>('/students/me/profile').subscribe({
      next: (profile) => {
        this.store.loaded(profile);
        // The shell header greets the person by name once we know it — the
        // profile request that already happened is the only source (§1).
        // A 200 with an empty body is the "no profile yet" case and must not
        // be dereferenced: the state is empty, and the header stays anonymous.
        if (profile) {
          this.shell.setDisplayName(`${profile.first_name} ${profile.last_name}`);
        }
      },
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
