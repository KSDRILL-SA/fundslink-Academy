import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * PLACEHOLDER — replaced by the real student dashboard in TASK 6
 * (ux-screen-map.md, journey order).
 *
 * It exists only so the app shell has something to route to behind the guard,
 * making the authenticated skeleton verifiable. No data, no API call.
 */
@Component({
  selector: 'fl-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-semibold tracking-tight">Dashboard</h1>
  `,
})
export class DashboardComponent {}
