import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CircleCheckBig } from 'lucide';
import { cn } from '../utils/cn';
import { type IconNode, UiIconComponent } from '../components/icon/ui-icon.component';

/**
 * A brief, warm confirmation (component-library.md §7).
 *
 * Dignified, not gimmicky — no confetti on a platform where the next screen
 * may be a decline. `aria-live="polite"` announces it without stealing focus,
 * so a keyboard user is told what happened but is not thrown out of wherever
 * they were.
 */
@Component({
  selector: 'ui-success-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconComponent],
  template: `
    <div [class]="classes()" aria-live="polite">
      <span class="text-success">
        <ui-icon [name]="checkIcon" size="md" />
      </span>
      <div>
        <p class="font-medium text-foreground">{{ title() }}</p>
        @if (message()) {
          <p class="mt-1 text-sm text-muted-foreground">{{ message() }}</p>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class UiSuccessStateComponent {
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly class = input<string>('');

  protected readonly checkIcon = CircleCheckBig as IconNode;

  protected readonly classes = computed(() =>
    cn(
      'flex items-start gap-3 rounded-lg border border-success/25 bg-success/8 px-4 py-3',
      this.class(),
    ),
  );
}
