import { signal, type Signal } from '@angular/core';
import { ApiError } from 'data-access';

/**
 * The shape every data view reads from.
 *
 * `ux-screen-map.md` §4 requires loading, empty, error and success on every
 * screen — "no exceptions". Making them one explicit union rather than three
 * loose booleans means a template cannot accidentally render two at once, and
 * cannot silently render none: the `@switch` has to handle each case, so a
 * forgotten state is a visible gap rather than a blank screen.
 *
 * `empty` is a first-class status rather than "success with a zero-length
 * array". A student with no applications yet is not a degenerate success case
 * — it is the screen where they most need to be told what to do next (P2).
 */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export interface AsyncState<T> {
  readonly status: AsyncStatus;
  readonly data: T | null;
  /** The stable contract code. Screens branch on this, never on a message. */
  readonly errorCode: string | null;
  /** What a student quotes to support when they contact us. */
  readonly requestId: string | null;
}

export const IDLE: AsyncState<never> = {
  status: 'idle',
  data: null,
  errorCode: null,
  requestId: null,
};

/**
 * A writable async state with the transitions spelled out.
 *
 * `isEmpty` decides what "nothing to show" means for this particular view —
 * an empty list, a null profile — because only the caller knows.
 */
export function asyncState<T>(isEmpty: (value: T) => boolean = () => false) {
  const state = signal<AsyncState<T>>(IDLE as AsyncState<T>);

  return {
    state: state.asReadonly() as Signal<AsyncState<T>>,

    /** Keep the previous data while reloading, so the screen does not blank out. */
    loading(): void {
      state.update((current) => ({ ...current, status: 'loading', errorCode: null }));
    },

    loaded(value: T): void {
      state.set({
        status: isEmpty(value) ? 'empty' : 'success',
        data: value,
        errorCode: null,
        requestId: null,
      });
    },

    failed(error: unknown): void {
      const api = error instanceof ApiError ? error : null;
      state.set({
        status: 'error',
        // The previous data is dropped: showing stale content beside an error
        // leaves someone unsure which part of the screen is true.
        data: null,
        errorCode: api?.code ?? null,
        requestId: api?.requestId ?? null,
      });
    },
  };
}
