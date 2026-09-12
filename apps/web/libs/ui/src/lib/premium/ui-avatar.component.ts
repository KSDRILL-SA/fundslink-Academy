import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../utils/cn';

const SIZE = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' } as const;

/**
 * A person's avatar, with initials when there is no photo (component-library.md §8).
 *
 * Initials on navy rather than a generic silhouette: a silhouette says "unknown
 * user", initials say "you". The full name is the accessible name, so the
 * initials are never read out letter by letter.
 */
@Component({
  selector: 'ui-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()" role="img" [attr.aria-label]="name() || 'Your account'">
      @if (src()) {
        <img [src]="src()" alt="" class="h-full w-full rounded-full object-cover" />
      } @else {
        <span aria-hidden="true">{{ initials() }}</span>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class UiAvatarComponent {
  readonly name = input<string>('');
  readonly src = input<string>('');
  readonly size = input<keyof typeof SIZE>('md');

  protected readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return 'FL';
    }
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  });

  protected readonly classes = computed(() =>
    cn(
      'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
      'bg-[linear-gradient(145deg,hsl(222_47%_30%),hsl(222_47%_16%))] text-[hsl(210_40%_98%)]',
      'shadow-sm ring-2 ring-background',
      SIZE[this.size()],
    ),
  );
}
