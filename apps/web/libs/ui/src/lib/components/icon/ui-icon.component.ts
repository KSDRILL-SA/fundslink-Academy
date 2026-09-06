import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../../utils/cn';

/**
 * A Lucide icon node: `[tagName, attributes]` pairs, exactly as the `lucide`
 * package ships them. Importing icons individually keeps the bundle to the
 * icons actually used.
 */
export type IconNode = readonly [string, Record<string, string | number>][];

/** Icon sizes as tokens, not arbitrary numbers (design-system.md §6). */
export type IconSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<IconSize, number> = { sm: 16, md: 20, lg: 24 };

/**
 * Renders a Lucide icon.
 *
 * We render Lucide's icon data rather than using `lucide-angular`, which peers
 * on Angular 13-21 and cannot install on 22. This is also the better outcome:
 * the geometry still comes from Lucide (never hand-copied paths), and only the
 * icons actually imported reach the bundle.
 *
 * Icons are decorative by default — `aria-hidden`, with meaning carried by
 * adjacent text. Pass `label` only when the icon is the *sole* carrier of
 * meaning, which turns it into `role="img"` with an accessible name.
 * Colour is inherited via `currentColor`, so an icon is themed by its context
 * and never needs a colour of its own.
 */
@Component({
  selector: 'ui-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      [attr.width]="px()"
      [attr.height]="px()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      [class]="classes()"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      [attr.aria-hidden]="label() ? null : 'true'"
      [attr.focusable]="false"
    >
      @for (node of name(); track $index) {
        <ng-container>
          @switch (node[0]) {
            @case ('path') {
              <svg:path [attr.d]="asText(node[1]['d'])" />
            }
            @case ('circle') {
              <svg:circle
                [attr.cx]="asText(node[1]['cx'])"
                [attr.cy]="asText(node[1]['cy'])"
                [attr.r]="asText(node[1]['r'])"
              />
            }
            @case ('line') {
              <svg:line
                [attr.x1]="asText(node[1]['x1'])"
                [attr.y1]="asText(node[1]['y1'])"
                [attr.x2]="asText(node[1]['x2'])"
                [attr.y2]="asText(node[1]['y2'])"
              />
            }
            @case ('rect') {
              <svg:rect
                [attr.x]="asText(node[1]['x'])"
                [attr.y]="asText(node[1]['y'])"
                [attr.width]="asText(node[1]['width'])"
                [attr.height]="asText(node[1]['height'])"
                [attr.rx]="asText(node[1]['rx'])"
                [attr.ry]="asText(node[1]['ry'])"
              />
            }
            @case ('polyline') {
              <svg:polyline [attr.points]="asText(node[1]['points'])" />
            }
            @case ('polygon') {
              <svg:polygon [attr.points]="asText(node[1]['points'])" />
            }
            @case ('ellipse') {
              <svg:ellipse
                [attr.cx]="asText(node[1]['cx'])"
                [attr.cy]="asText(node[1]['cy'])"
                [attr.rx]="asText(node[1]['rx'])"
                [attr.ry]="asText(node[1]['ry'])"
              />
            }
          }
        </ng-container>
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      line-height: 0;
    }
  `,
})
export class UiIconComponent {
  /** The icon data, imported from `lucide` (e.g. `import { Check } from 'lucide'`). */
  readonly name = input.required<IconNode>();
  readonly size = input<IconSize>('md');
  /** Set only when the icon alone carries the meaning; otherwise leave it decorative. */
  readonly label = input<string>('');
  readonly class = input<string>('');

  protected readonly px = computed(() => SIZE_PX[this.size()]);

  /** Lucide draws at 24px; thinner strokes at small sizes keep the weight even. */
  protected readonly strokeWidth = computed(() => (this.size() === 'sm' ? 2 : 1.75));

  protected readonly classes = computed(() => cn(this.class()));

  protected asText(value: string | number | undefined): string | null {
    return value === undefined ? null : String(value);
  }
}
