import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { UiIconComponent } from 'ui';
import { APPLICATION_CATEGORIES, type ApplicationCategory } from './application-categories';

/**
 * S10 — Apply: category picker.
 *
 * Route honestly, without jargon. The student is not choosing a "funding
 * stream", they are recognising their own situation in a sentence — so each
 * card is written as something a person would actually say about themselves,
 * and the internal `application_type` never appears on screen.
 *
 * All five cards are one grid at one size. Category D sits in it as an equal
 * (§5.6), not as a link below. The students most likely to need that door are
 * the least likely to push on a footnote.
 *
 * Each card is a real `<button>` in a list. A clickable `<div>` here would be
 * invisible to a keyboard and unreadable to a screen reader, on the screen
 * that decides whether someone can apply at all.
 */
@Component({
  selector: 'fl-category-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconComponent],
  template: `
    <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">
      Which of these sounds like you?
    </h1>
    <p class="mt-2 max-w-prose text-muted-foreground">
      Pick the one that fits best. You can change it later, and if none of them fit, the last one
      is for you.
    </p>

    <ul class="mt-8 grid gap-4 md:grid-cols-2">
      @for (category of categories; track category.type) {
        <li>
          <button
            type="button"
            class="group flex h-full w-full flex-col items-start rounded-lg border border-border
                   bg-card p-6 text-left text-card-foreground shadow-sm outline-none
                   transition-[box-shadow,transform,border-color] duration-200 ease-out
                   hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md
                   focus-visible:outline-[3px] focus-visible:outline-offset-2
                   focus-visible:outline-ring
                   motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            (click)="choose(category)"
          >
            <span
              class="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-accent/15
                     text-accent-foreground dark:text-accent"
            >
              <ui-icon [name]="category.icon" size="md" />
            </span>
            <span class="text-lg font-semibold">{{ category.title }}</span>
            <span class="mt-2 text-muted-foreground">{{ category.body }}</span>
          </button>
        </li>
      }
    </ul>

    <p class="mt-8 max-w-prose text-sm text-muted-foreground">
      Not sure? Choose the closest one. A person reads every application, and we will ask if
      something does not add up.
    </p>
  `,
})
export class CategoryPickerComponent {
  private readonly router = inject(Router);

  protected readonly categories = APPLICATION_CATEGORIES;

  protected choose(category: ApplicationCategory): void {
    // Category D goes to its own screen, where the whole point is space to
    // explain. The other four go to the guided steps (S11).
    const target =
      category.type === 'OTHER'
        ? '/app/applications/new/explain'
        : `/app/applications/new/${category.type.toLowerCase()}`;
    void this.router.navigateByUrl(target);
  }
}
