import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  model,
  viewChildren,
} from '@angular/core';
import { cn } from '../utils/cn';
import { type IconNode, UiIconComponent } from '../components/icon/ui-icon.component';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconNode;
  /** A small count. Rendered as text, never colour alone. */
  readonly count?: number;
}

let nextId = 0;

/**
 * Page tabs, built to the WAI-ARIA tabs pattern — not a row of styled links.
 *
 * The difference matters to anyone not using a mouse. Real tabs are ONE tab
 * stop: Tab enters the tab list, arrow keys move between tabs, Home and End
 * jump to the ends, and Tab again moves into the panel. A row of links makes a
 * keyboard user walk every tab to reach the content below it.
 *
 * Selection follows focus (automatic activation), which is the right choice
 * when switching tabs is cheap — as it is here, where panels are already
 * rendered by the parent.
 *
 * The visual is a segmented pill control: the active tab is a raised surface
 * inside a sunken track, which reads as "one of these" at a glance.
 */
@Component({
  selector: 'ui-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconComponent],
  template: `
    <div
      role="tablist"
      [attr.aria-label]="ariaLabel()"
      class="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-secondary p-1
             shadow-[inset_0_1px_2px_0_hsl(222_47%_11%/0.08)]"
    >
      @for (tab of tabs(); track tab.id; let i = $index) {
        <button
          #tabButton
          type="button"
          role="tab"
          [id]="tabId(tab.id)"
          [attr.aria-selected]="tab.id === selected()"
          [attr.aria-controls]="panelId(tab.id)"
          [attr.tabindex]="tab.id === selected() ? 0 : -1"
          [class]="tabClasses(tab.id)"
          (click)="select(tab.id)"
          (keydown)="onKeydown($event, i)"
        >
          @if (tab.icon; as glyph) {
            <ui-icon [name]="glyph" size="sm" />
          }
          <span>{{ tab.label }}</span>
          @if (tab.count !== undefined) {
            <span
              class="tabular rounded-full bg-background/80 px-1.5 text-xs font-semibold text-muted-foreground"
              >{{ tab.count }}</span
            >
          }
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      max-width: 100%;
    }
  `,
})
export class UiTabsComponent {
  private readonly uid = `ui-tabs-${nextId++}`;
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  readonly tabs = input.required<readonly TabItem[]>();
  readonly ariaLabel = input.required<string>();
  /** The selected tab id. Two-way bindable: `[(selected)]="tab"`. */
  readonly selected = model.required<string>();

  /** For the panel the parent renders: `[attr.aria-labelledby]="tabs.tabId(id)"`. */
  tabId(id: string): string {
    return `${this.uid}-tab-${id}`;
  }

  /** For the panel the parent renders: `[id]="tabs.panelId(id)"`. */
  panelId(id: string): string {
    return `${this.uid}-panel-${id}`;
  }

  protected tabClasses(id: string): string {
    const active = id === this.selected();
    return cn(
      'inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-medium',
      'outline-none transition-[background-color,color,box-shadow] duration-150',
      'focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-ring',
      'motion-reduce:transition-none',
      active
        ? 'bg-card text-foreground shadow-[var(--surface-highlight),0_1px_3px_0_hsl(222_47%_11%/0.12)]'
        : 'text-muted-foreground hover:text-foreground',
    );
  }

  protected select(id: string): void {
    this.selected.set(id);
  }

  /** Arrow keys, Home and End — the WAI-ARIA tabs keyboard model. */
  protected onKeydown(event: KeyboardEvent, index: number): void {
    const count = this.tabs().length;
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
        next = (index + 1) % count;
        break;
      case 'ArrowLeft':
        next = (index - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
    }
    if (next === null) {
      return;
    }
    event.preventDefault();
    this.select(this.tabs()[next].id);
    this.buttons()[next]?.nativeElement.focus();
  }
}
