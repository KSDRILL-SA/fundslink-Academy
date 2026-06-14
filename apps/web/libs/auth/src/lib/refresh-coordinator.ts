import { Injectable } from '@angular/core';
import { finalize, Observable, shareReplay } from 'rxjs';

/**
 * Coordinates a single in-flight token refresh across concurrent 401s (S3.15 / S7.12).
 *
 * When many requests fail with 401 at once, they must trigger EXACTLY ONE refresh — otherwise
 * the 2nd/3rd refresh presents a token the 1st already rotated, tripping reuse-detection and
 * logging the user out (AP-S3.15a). `refreshOnce` shares one refresh Observable for the whole
 * in-flight window, then resets so a later 401 starts a fresh refresh.
 */
@Injectable({ providedIn: 'root' })
export class RefreshCoordinator {
  private inFlight: Observable<string> | null = null;

  refreshOnce(refreshFn: () => Observable<string>): Observable<string> {
    if (!this.inFlight) {
      this.inFlight = refreshFn().pipe(
        shareReplay(1),
        finalize(() => {
          this.inFlight = null;
        }),
      );
    }
    return this.inFlight;
  }
}
