import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../utils/cn';
import { type IconNode, UiIconComponent } from '../components/icon/ui-icon.component';

export type IconTileTone = 'gold' | 'navy' | 'success' | 'warning' | 'neutral';
export type IconTileSize = 'sm' | 'md' | 'lg';

const TILE: Record<IconTileSize, string> = { sm: 'h-9 w-9', md: 'h-11 w-11', lg: 'h-14 w-14' };

/**
 * An icon in a designed tile.
 *
 * An icon is never left floating on a surface. It sits in a tinted tile with an
 * inner ring and the same top highlight as a card (styles/surfaces.css) — the
 * difference between "an icon" and "a designed icon", and much of why an
 * interface stops looking like a wireframe.
 *
 * Tone carries meaning consistently: gold for hope and action, navy for the
 * institution, success and warning for state. The tile is always decorative —
 * the text beside it carries the meaning — so it stays hidden from assistive
 * technology.
 */
@Component({
  selector: 'ui-icon-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconComponent],
  template: `
    <span [class]="classes()" aria-hidden="true">
      <ui-icon [name]="icon()" [size]="size()" />
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class UiIconTileComponent {
  readonly icon = input.required<IconNode>();
  readonly tone = input<IconTileTone>('gold');
  readonly size = input<IconTileSize>('md');
  readonly class = input<string>('');

  protected readonly classes = computed(() =>
    cn('fl-icon-tile', `fl-icon-tile--${this.tone()}`, TILE[this.size()], this.class()),
  );
}
