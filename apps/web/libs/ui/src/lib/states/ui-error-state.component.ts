import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TriangleAlert } from 'lucide';
import { cn } from '../utils/cn';
import { type IconNode, UiIconComponent } from '../components/icon/ui-icon.component';
import { UiButtonComponent } from '../components/button/ui-button.component';
import { presentError } from './error-presentation';

/**
 * The error state for a data view.
 *
 * Takes the API's stable `error.code` and renders the sentence the
 * presentation table decides — never `error.message`, which is not a contract
 * and may carry server detail a student should never read (S4.12).
 *
 * `retry` only appears when the mapped code is actually retryable. Offering
 * "Try again" for a permanent failure teaches people to hammer a button that
 * cannot work, which is worse than offering nothing.
 *
 * `role="alert"` announces it once, at the moment it replaces the content.
 */
@Component({
  selector: 'ui-error-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconComponent, UiButtonComponent],
  template: `
    <div [class]="classes()" role="alert">
      <div
        class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning/15 text-warning"
      >
        <ui-icon [name]="alertIcon" size="lg" />
      </div>

      <h3 class="text-lg font-semibold text-foreground">{{ presented().title }}</h3>
      <p class="mt-2 max-w-prose-narrow text-muted-foreground">{{ presented().message }}</p>

      @if (presented().retryable) {
        <div class="mt-6">
          <ui-button variant="secondary" (clicked)="retry.emit()">Try again</ui-button>
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
export class UiErrorStateComponent {
  /** The stable `error.code` from the API response. */
  readonly code = input<string | null | undefined>(null);
  readonly class = input<string>('');

  readonly retry = output<void>();

  protected readonly alertIcon = TriangleAlert as IconNode;
  protected readonly presented = computed(() => presentError(this.code()));

  protected readonly classes = computed(() =>
    cn('flex flex-col items-center justify-center px-6 py-12 text-center', this.class()),
  );
}
