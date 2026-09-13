import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShieldCheck } from 'lucide';
import { UiIconComponent, type IconNode } from 'ui';
import type { StudentOverview } from './overview.store';

/**
 * The one security fact worth putting in front of someone: the sign-in before this one, and
 * whether two-step verification is on. If they do not recognise the sign-in, they know where to go.
 * Both come from the server's overview (`getMyOverview`); nothing here is inferred on the device.
 */
@Component({
  selector: 'fl-security-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiIconComponent],
  template: `
    <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <ui-icon [name]="icon" size="sm" />
      @if (account().previous_sign_in_at; as previous) {
        <span>
          Previous sign-in:
          <time class="tabular" [attr.datetime]="previous">{{ dateTime(previous) }}</time>.
        </span>
        <span>
          Not you?
          <a routerLink="/app/account" class="font-medium text-foreground underline underline-offset-4">
            Change your password now</a>.
        </span>
      } @else {
        <span>This is the first sign-in we have recorded for your account.</span>
      }
      <span>Two-step verification is {{ account().mfa_enabled ? 'on' : 'off' }}.</span>
    </p>
  `,
})
export class SecuritySummaryComponent {
  readonly account = input.required<StudentOverview['account']>();

  protected readonly icon = ShieldCheck as IconNode;

  protected dateTime(iso: string): string {
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime())
      ? ''
      : parsed.toLocaleString('en-ZA', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  }
}
