import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { Compass } from 'lucide';
import { UiButtonComponent, UiIconTileComponent, type IconNode } from 'ui';

/**
 * The page that is not there.
 *
 * This replaces `{ path: '**', redirectTo: '' }`, which was worse than it
 * looks: a silent redirect makes a broken link indistinguishable from a
 * working one that happens to land on the home page. Ten dead links lived in
 * this product behind that redirect, and nobody could see them — including the
 * build, which cannot fail on a redirect that works exactly as written.
 *
 * So a wrong address now says so, and offers the two ways out that are always
 * true: the home page, and the place a signed-in student actually wants.
 */
@Component({
  selector: 'fl-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButtonComponent, UiIconTileComponent],
  template: `
    <section class="mx-auto flex max-w-prose flex-col items-center px-4 py-24 text-center sm:py-32">
      <ui-icon-tile [icon]="icon" tone="navy" size="lg" />

      <p class="fl-eyebrow mt-6">Page not found</p>
      <h1 class="fl-display mt-4 text-4xl sm:text-5xl">This page has moved, or never existed</h1>
      <p class="mt-4 text-lg text-muted-foreground">
        Nothing is wrong with your application — only with this address. The path you tried was
        <span class="font-mono break-all">{{ attempted }}</span
        >.
      </p>

      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <a routerLink="/" class="inline-flex">
          <ui-button variant="primary">Go to the home page</ui-button>
        </a>
        <a routerLink="/app" class="inline-flex">
          <ui-button variant="secondary">Go to my dashboard</ui-button>
        </a>
      </div>
    </section>
  `,
})
export class NotFoundComponent {
  private readonly title = inject(Title);
  protected readonly icon = Compass as IconNode;

  /** Shown back to the visitor: it is usually a typo they can see and correct. */
  protected readonly attempted = inject(Router).url;

  constructor() {
    this.title.setTitle('Page not found — FundsLink Academy');
  }
}
