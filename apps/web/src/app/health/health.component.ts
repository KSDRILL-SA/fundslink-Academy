import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Liveness route for the Angular shell (mirror of the API /healthz).
 * Standalone + OnPush per S4.52 / S4.53. No business logic.
 */
@Component({
  selector: 'app-health',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="health">
      <h1>FundsLink Academy</h1>
      <p>status: ok</p>
    </main>
  `,
  styles: [
    `
      .health {
        font-family: system-ui, sans-serif;
        padding: 2rem;
      }
    `,
  ],
})
export class HealthComponent {}
