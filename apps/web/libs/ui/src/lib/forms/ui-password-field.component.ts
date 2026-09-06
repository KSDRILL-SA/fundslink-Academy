import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  contentChild,
  signal,
} from '@angular/core';
import { Eye, EyeOff } from 'lucide';
import { type IconNode, UiIconComponent } from '../components/icon/ui-icon.component';
import { UiInputDirective } from './ui-control.directives';

/**
 * Wraps a password input with a show/hide toggle (§2).
 *
 * Revealing a password is an accessibility and accuracy feature, not a
 * security hole: people mistype long passwords on phone keyboards constantly,
 * and the alternative is a failed sign-in they cannot diagnose. Nothing is
 * logged or transmitted differently — only the input's `type` changes.
 *
 * The toggle is a real `<button type="button">`, so it is reachable by
 * keyboard and cannot submit the form by accident. It reports state through
 * `aria-pressed` rather than by changing its label, so a screen-reader user
 * hears the toggle's state instead of guessing from an icon.
 *
 * The projected input is left as a native `<input>` — autofill and password
 * managers depend on it being one, and both matter more than any styling a
 * wrapper component could add.
 */
@Component({
  selector: 'ui-password-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconComponent],
  template: `
    <div class="relative flex items-center">
      <ng-content />

      <button
        type="button"
        class="absolute right-1 inline-flex h-9 w-9 items-center justify-center rounded-md
               text-muted-foreground outline-none hover:text-foreground
               focus-visible:outline-[3px] focus-visible:outline-offset-2
               focus-visible:outline-ring"
        [attr.aria-pressed]="revealed()"
        [attr.aria-label]="revealed() ? 'Hide password' : 'Show password'"
        (click)="toggle()"
      >
        <ui-icon [name]="revealed() ? eyeOff : eye" size="md" />
      </button>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class UiPasswordFieldComponent {
  private readonly control = contentChild(UiInputDirective, { read: ElementRef });

  protected readonly revealed = signal(false);
  protected readonly eye = Eye as IconNode;
  protected readonly eyeOff = EyeOff as IconNode;

  protected toggle(): void {
    const input = this.control()?.nativeElement as HTMLInputElement | undefined;
    if (!input) {
      return;
    }
    const next = !this.revealed();
    this.revealed.set(next);
    input.type = next ? 'text' : 'password';
    // Focus returns to the field: someone who reveals a password is almost
    // always about to keep typing, and leaving focus on the toggle means the
    // next keystroke does nothing.
    input.focus();
  }
}
