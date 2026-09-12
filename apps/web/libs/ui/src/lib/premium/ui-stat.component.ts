import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type IconNode } from '../components/icon/ui-icon.component';
import { type IconTileTone, UiIconTileComponent } from './ui-icon-tile.component';

/**
 * A single figure, presented as the most important thing on its card.
 *
 * The value is large, tabular and never animated — a number that counts up on
 * load is theatre, and on a funding platform the numbers belong to someone.
 * It is always a string: money arrives as a decimal string and is rendered
 * exactly as received (handoff §4.4).
 */
@Component({
  selector: 'ui-stat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconTileComponent],
  template: `
    <div class="fl-surface flex h-full flex-col gap-4 p-5">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-medium text-muted-foreground">{{ label() }}</p>
        @if (icon(); as glyph) {
          <ui-icon-tile [icon]="glyph" [tone]="tone()" size="sm" />
        }
      </div>
      <p class="tabular text-3xl font-semibold tracking-tight">{{ value() }}</p>
      @if (hint()) {
        <p class="text-sm text-muted-foreground">{{ hint() }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class UiStatComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input<string>('');
  readonly icon = input<IconNode | null>(null);
  readonly tone = input<IconTileTone>('navy');
}
