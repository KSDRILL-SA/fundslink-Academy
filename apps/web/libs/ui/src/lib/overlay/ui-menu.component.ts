import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { cn } from '../utils/cn';
import { type IconNode, UiIconComponent } from '../components/icon/ui-icon.component';

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconNode;
  /** A destination. Mutually exclusive with an action. */
  readonly route?: string;
  /** A description under the label, where the label alone is not enough. */
  readonly hint?: string;
  /** Sets it apart: sign out, or anything that ends something. */
  readonly danger?: boolean;
  /** A divider above this item. */
  readonly separated?: boolean;
}

let nextId = 0;

/**
 * A menu, built to the WAI-ARIA menu button pattern.
 *
 * Written because this product had nowhere to put "Sign out" — the header had
 * a logo, a nav rail and an avatar that linked to a page, and the session could
 * not be ended from anywhere in the application. A menu is the conventional
 * answer, and a badly built one is a well-known trap: a div that opens on click
 * and cannot be closed with a key, does not return focus, and is invisible to
 * anyone not using a mouse.
 *
 * So the keyboard model is the whole point:
 *   - the trigger carries `aria-haspopup` and `aria-expanded`;
 *   - Enter, Space or Down-arrow open it with the first item focused, and
 *     Up-arrow opens it with the last;
 *   - arrows move, Home and End jump, Escape closes and returns focus to the
 *     trigger — which is what stops a keyboard user being stranded;
 *   - a click anywhere else closes it, and so does moving focus out entirely,
 *     because Tab out is a decision to leave.
 *
 * Items are data rather than projected content: a menu whose items are markup
 * is a menu where the next caller forgets `role="menuitem"`, and the pattern
 * only works when every part of it is present.
 */
@Component({
  selector: 'ui-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiIconComponent],
  template: `
    <div class="relative">
      <button
        #trigger
        type="button"
        [id]="triggerId"
        [attr.aria-haspopup]="'menu'"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="open() ? menuId : null"
        [attr.aria-label]="ariaLabel()"
        [class]="triggerClasses()"
        (click)="toggle()"
        (keydown)="onTriggerKeydown($event)"
      >
        <ng-content />
      </button>

      @if (open()) {
        <div
          [id]="menuId"
          role="menu"
          [attr.aria-labelledby]="triggerId"
          class="fl-surface absolute right-0 z-50 mt-2 w-64 overflow-hidden p-1.5 text-left"
        >
          @for (item of items(); track item.id; let i = $index) {
            @if (item.separated) {
              <div class="my-1.5 h-px bg-border" role="separator"></div>
            }

            @if (item.route) {
              <a
                #entry
                role="menuitem"
                tabindex="-1"
                [routerLink]="item.route"
                [class]="itemClasses(item)"
                (click)="close(false)"
                (keydown)="onItemKeydown($event, i)"
              >
                @if (item.icon; as glyph) {
                  <ui-icon [name]="glyph" size="sm" />
                }
                <span class="min-w-0">
                  <span class="block truncate">{{ item.label }}</span>
                  @if (item.hint) {
                    <span class="block truncate text-xs text-muted-foreground">{{ item.hint }}</span>
                  }
                </span>
              </a>
            } @else {
              <button
                #entry
                type="button"
                role="menuitem"
                tabindex="-1"
                [class]="itemClasses(item)"
                (click)="choose(item)"
                (keydown)="onItemKeydown($event, i)"
              >
                @if (item.icon; as glyph) {
                  <ui-icon [name]="glyph" size="sm" />
                }
                <span class="min-w-0">
                  <span class="block truncate">{{ item.label }}</span>
                  @if (item.hint) {
                    <span class="block truncate text-xs text-muted-foreground">{{ item.hint }}</span>
                  }
                </span>
              </button>
            }
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-block;
    }
  `,
})
export class UiMenuComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly document = inject(DOCUMENT);
  private readonly uid = nextId++;

  readonly items = input.required<readonly MenuItem[]>();
  readonly ariaLabel = input.required<string>();
  readonly triggerClass = input<string>('');

  /** An item without a route was chosen. */
  readonly selected = output<MenuItem>();

  protected readonly open = signal(false);
  protected readonly triggerId = `ui-menu-trigger-${this.uid}`;
  protected readonly menuId = `ui-menu-${this.uid}`;

  private readonly entries = viewChildren<ElementRef<HTMLElement>>('entry');
  private readonly triggerRef = viewChildren<ElementRef<HTMLElement>>('trigger');

  protected triggerClasses(): string {
    return cn(
      'inline-flex items-center rounded-full outline-none',
      'focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring',
      this.triggerClass(),
    );
  }

  protected itemClasses(item: MenuItem): string {
    return cn(
      'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm outline-none',
      'transition-colors hover:bg-secondary focus:bg-secondary motion-reduce:transition-none',
      item.danger ? 'text-destructive' : 'text-foreground',
    );
  }

  protected toggle(): void {
    this.open() ? this.close(true) : this.openWith(0);
  }

  protected choose(item: MenuItem): void {
    this.close(true);
    this.selected.emit(item);
  }

  /**
   * Close, and put focus back where the user left it.
   *
   * `restoreFocus` is false when the menu closed because the user navigated —
   * pulling focus back to the trigger of a menu on a page they have just left
   * is disorienting, and the router has its own focus handling.
   */
  protected close(restoreFocus: boolean): void {
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    if (restoreFocus) {
      this.triggerRef()[0]?.nativeElement.focus();
    }
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openWith(0);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.openWith(-1);
    }
  }

  protected onItemKeydown(event: KeyboardEvent, index: number): void {
    const all = this.entries();
    const last = all.length - 1;
    let next: number | null = null;

    switch (event.key) {
      case 'ArrowDown':
        next = index === last ? 0 : index + 1;
        break;
      case 'ArrowUp':
        next = index === 0 ? last : index - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      case 'Escape':
        event.preventDefault();
        this.close(true);
        return;
      case 'Tab':
        // Tabbing out is a decision to leave; the menu should not follow.
        this.close(false);
        return;
      default:
        return;
    }

    event.preventDefault();
    all[next]?.nativeElement.focus();
  }

  /** Open and move focus onto an item, which is what makes it operable at all. */
  private openWith(index: number): void {
    this.open.set(true);
    // The items do not exist until the view updates, so focus lands on the next
    // frame rather than in this one.
    this.document.defaultView?.requestAnimationFrame(() => {
      const all = this.entries();
      const target = index === -1 ? all[all.length - 1] : all[index];
      target?.nativeElement.focus();
    });
  }

  /** A click outside is a dismissal. Focus stays where the user clicked. */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) {
      return;
    }
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close(false);
    }
  }

  /** Escape closes from anywhere inside, including the trigger. */
  @HostListener('keydown.escape')
  protected onEscape(): void {
    this.close(true);
  }
}
