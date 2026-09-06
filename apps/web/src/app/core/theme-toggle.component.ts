import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Monitor, Moon, Sun } from 'lucide';
import { UiIconComponent, type IconNode } from 'ui';
import { ThemeService, type ThemePreference } from './theme.service';

/**
 * Cycles light → dark → system.
 *
 * Lives in the app rather than in libs/ui because it depends on ThemeService,
 * and libs/ui is presentation-only — it takes inputs and emits outputs, never
 * injects application services (frontend-structure.md §3).
 *
 * "System" is offered as a real third state rather than being the hidden
 * default behind a two-way switch: a student who has set their phone to dark
 * for the evening should get a dark app without touching this, and should be
 * able to get back to that after trying the other two.
 *
 * The button announces the current state, not the next one. "Switch to dark"
 * is ambiguous about what is true right now; a screen-reader user needs the
 * state, and the tooltip carries the action.
 */
@Component({
  selector: 'fl-theme-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconComponent],
  template: `
    <button
      type="button"
      class="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground
             outline-none hover:text-foreground focus-visible:outline-[3px]
             focus-visible:outline-offset-2 focus-visible:outline-ring"
      [attr.aria-label]="label()"
      [attr.title]="label()"
      (click)="cycle()"
    >
      <ui-icon [name]="icon()" size="md" />
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class ThemeToggleComponent {
  private readonly theme = inject(ThemeService);

  private static readonly ORDER: readonly ThemePreference[] = ['light', 'dark', 'system'];

  protected readonly icon = computed<IconNode>(() => {
    switch (this.theme.preference()) {
      case 'light':
        return Sun as IconNode;
      case 'dark':
        return Moon as IconNode;
      default:
        return Monitor as IconNode;
    }
  });

  protected readonly label = computed(() => {
    switch (this.theme.preference()) {
      case 'light':
        return 'Theme: light. Change theme.';
      case 'dark':
        return 'Theme: dark. Change theme.';
      default:
        return 'Theme: match my device. Change theme.';
    }
  });

  protected cycle(): void {
    const order = ThemeToggleComponent.ORDER;
    const next = order[(order.indexOf(this.theme.preference()) + 1) % order.length];
    this.theme.set(next);
  }
}
