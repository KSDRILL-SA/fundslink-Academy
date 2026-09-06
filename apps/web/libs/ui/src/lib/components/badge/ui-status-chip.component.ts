import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UiBadgeComponent } from './ui-badge.component';
import {
  APPLICATION_STATUS_PRESENTATION,
  STATUS_SOURCE_PRESENTATION,
  presentStatus,
} from './status-presentation';

/**
 * Renders an application status, or the source a tracked status came from.
 *
 * Takes the raw status string the API returns and renders the presentation the
 * table decides — so every screen shows the same word, tone and icon for the
 * same status, and the kind-rejection language cannot drift screen by screen.
 *
 * An unrecognised status renders as a readable neutral chip rather than
 * throwing or rendering blank: the backend may add a status before this
 * bundle is redeployed, and a student must not meet a crash because of it.
 */
@Component({
  selector: 'ui-status-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiBadgeComponent],
  template: `
    <ui-badge [label]="presented().label" [tone]="presented().tone" [icon]="presented().icon" />
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class UiStatusChipComponent {
  /** The raw value from the API, e.g. `RETURNED_FOR_INFO` or `SELF_REPORT`. */
  readonly status = input.required<string | null | undefined>();
  /** `application` for a lifecycle status; `source` for a tracked-status origin badge. */
  readonly kind = input<'application' | 'source'>('application');

  protected readonly presented = computed(() =>
    presentStatus(
      this.status(),
      this.kind() === 'source' ? STATUS_SOURCE_PRESENTATION : APPLICATION_STATUS_PRESENTATION,
    ),
  );
}
