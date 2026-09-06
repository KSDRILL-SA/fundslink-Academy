import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { cn } from '../utils/cn';
import { type IconNode, UiIconComponent } from '../components/icon/ui-icon.component';
import { UiButtonComponent } from '../components/button/ui-button.component';

/**
 * The empty state — never a dead end (P2).
 *
 * An empty list is the moment a student is most likely to leave. The rule from
 * component-library.md §7 is a friendly line, something to look at, and
 * **exactly one** action: not zero, which strands them, and not a menu, which
 * makes them choose while they are already unsure what to do.
 *
 * The action is deliberately a single optional input rather than a projected
 * slot, so "one way out" is the shape of the component and not a convention
 * each screen has to remember.
 */
@Component({
  selector: 'ui-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconComponent, UiButtonComponent],
  template: `
    <div [class]="classes()">
      @if (icon(); as node) {
        <div
          class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground"
        >
          <ui-icon [name]="node" size="lg" />
        </div>
      }

      <h3 class="text-lg font-semibold text-foreground">{{ title() }}</h3>

      @if (message()) {
        <p class="mt-2 max-w-prose-narrow text-muted-foreground">{{ message() }}</p>
      }

      @if (actionLabel()) {
        <div class="mt-6">
          <ui-button variant="accent" (clicked)="action.emit()">{{ actionLabel() }}</ui-button>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class UiEmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly icon = input<IconNode | null>(null);
  /** The one way forward. Omit only when there genuinely is nothing to do here. */
  readonly actionLabel = input<string>('');
  readonly class = input<string>('');

  readonly action = output<void>();

  protected readonly classes = computed(() =>
    cn('flex flex-col items-center justify-center px-6 py-12 text-center', this.class()),
  );
}
