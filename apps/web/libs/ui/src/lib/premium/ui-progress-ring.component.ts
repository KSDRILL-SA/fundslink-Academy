import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * A circular progress indicator for a known, finite process.
 *
 * `role="progressbar"` with real `aria-valuenow`, so a screen reader hears the
 * position rather than nothing — a drawn circle alone would be decoration
 * pretending to be information. The arc moves via stroke-dashoffset, a
 * paint-only property, and not at all under reduced motion.
 */
@Component({
  selector: 'ui-progress-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="relative inline-flex items-center justify-center"
      role="progressbar"
      [attr.aria-valuenow]="value()"
      aria-valuemin="0"
      [attr.aria-valuemax]="max()"
      [attr.aria-label]="label()"
      [style.width.px]="size()"
      [style.height.px]="size()"
    >
      <svg
        [attr.width]="size()"
        [attr.height]="size()"
        [attr.viewBox]="viewBox()"
        class="-rotate-90"
        aria-hidden="true"
      >
        <circle
          [attr.cx]="center()"
          [attr.cy]="center()"
          [attr.r]="radius()"
          fill="none"
          stroke="hsl(var(--border))"
          [attr.stroke-width]="stroke()"
        />
        <circle
          [attr.cx]="center()"
          [attr.cy]="center()"
          [attr.r]="radius()"
          fill="none"
          stroke="hsl(var(--accent))"
          [attr.stroke-width]="stroke()"
          stroke-linecap="round"
          [attr.stroke-dasharray]="circumference()"
          [attr.stroke-dashoffset]="offset()"
          class="transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
        />
      </svg>
      <span class="absolute text-center" aria-hidden="true">
        <span class="tabular block text-xl font-semibold">{{ value() }}/{{ max() }}</span>
        @if (caption()) {
          <span class="block text-xs text-muted-foreground">{{ caption() }}</span>
        }
      </span>
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class UiProgressRingComponent {
  readonly value = input.required<number>();
  readonly max = input<number>(100);
  readonly label = input.required<string>();
  readonly caption = input<string>('');
  readonly size = input<number>(112);
  readonly stroke = input<number>(9);

  protected readonly center = computed(() => this.size() / 2);
  protected readonly radius = computed(() => (this.size() - this.stroke()) / 2);
  protected readonly viewBox = computed(() => `0 0 ${this.size()} ${this.size()}`);
  protected readonly circumference = computed(() => 2 * Math.PI * this.radius());
  protected readonly offset = computed(() => {
    const ratio = Math.min(1, Math.max(0, this.value() / (this.max() || 1)));
    return this.circumference() * (1 - ratio);
  });
}
