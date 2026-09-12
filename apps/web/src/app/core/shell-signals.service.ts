import { Injectable, computed, signal } from '@angular/core';

/**
 * The two facts the shell header shows about the person using it.
 *
 * A shell must not fetch. It composes chrome (navigation-and-shells.md §1), and
 * a header that opened its own `/students/me/profile` and `/notifications/me`
 * calls would duplicate requests the screens already make, on every route in
 * the app, including the ones that do not need them.
 *
 * So the direction is inverted: the screens that already hold this data publish
 * it here, and the header reads it. Nothing here is authoritative and nothing
 * here is security-relevant — it is a display name and a count. Both start
 * empty, and the header renders correctly when they stay that way.
 */
@Injectable({ providedIn: 'root' })
export class ShellSignalsService {
  private readonly name = signal('');
  private readonly notices = signal(0);

  /** The signed-in person's name, or '' before any screen has published one. */
  readonly displayName = this.name.asReadonly();

  /**
   * How many notifications are in the student's feed.
   *
   * Deliberately NOT "unread". `Notification.state` in the contract is an open
   * string with no read/unread meaning (openapi.yaml §Notification), so a badge
   * claiming "3 unread" would be a number this system cannot actually know.
   * The header says what is true — how many are waiting — until the contract
   * carries a read state. Never negative, so it cannot render "-1".
   */
  readonly noticeCount = computed(() => Math.max(0, this.notices()));

  setDisplayName(value: string): void {
    this.name.set(value.trim());
  }

  setNoticeCount(value: number): void {
    this.notices.set(Number.isFinite(value) ? Math.trunc(value) : 0);
  }
}
