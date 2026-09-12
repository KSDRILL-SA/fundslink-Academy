import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** One section of a document page. */
export interface DocSection {
  readonly id: string;
  readonly heading: string;
  /** Paragraphs, in order. */
  readonly body?: readonly string[];
  /** A list, where the content genuinely is a list rather than prose. */
  readonly bullets?: readonly string[];
  /** A quiet aside: what is not yet true, or what a reader should notice. */
  readonly note?: string;
}

/**
 * The layout every policy, help and contact page shares.
 *
 * A document page is not a marketing page with more words. Someone arriving
 * here has a question — what happens to my ID number, what do I do if I am
 * declined, who do I write to — and the job is to get them to that answer, so
 * the page is built around a contents rail rather than a narrative.
 *
 * The rail is `position: sticky` on wide screens and simply the first thing on
 * the page on narrow ones, where a floating rail would eat a third of a phone.
 * Every entry is a real in-page anchor, so a link to one section can be sent to
 * someone, and heading order stays h1 → h2 with no level skipped.
 *
 * Sections are data, not markup, so a page is a list of facts and this file is
 * the only thing that decides how a document reads.
 */
@Component({
  selector: 'fl-doc-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fl-wash">
      <div class="mx-auto max-w-[1100px] px-4 py-16 sm:py-20">
        <header class="max-w-prose">
          <p class="fl-eyebrow">{{ eyebrow() }}</p>
          <h1 class="fl-display mt-4 text-4xl sm:text-5xl">{{ title() }}</h1>
          <p class="mt-5 text-lg text-muted-foreground">{{ lead() }}</p>
          @if (updated()) {
            <p class="mt-4 text-sm text-muted-foreground">Last updated {{ updated() }}</p>
          }
        </header>

        <div class="mt-12 gap-12 lg:flex">
          <!-- The contents rail. A real navigation landmark, named, so a screen
               reader user can jump to it and out of it. -->
          <nav
            aria-label="On this page"
            class="mb-10 shrink-0 lg:sticky lg:top-24 lg:mb-0 lg:h-max lg:w-64"
          >
            <p class="text-sm font-semibold">On this page</p>
            <ul class="mt-4 space-y-1 border-l border-border">
              @for (section of sections(); track section.id) {
                <li>
                  <a
                    [href]="'#' + section.id"
                    class="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-sm
                           text-muted-foreground outline-none transition-colors
                           hover:border-accent hover:text-foreground
                           focus-visible:outline-[3px] focus-visible:outline-offset-2
                           focus-visible:outline-ring motion-reduce:transition-none"
                    >{{ section.heading }}</a
                  >
                </li>
              }
            </ul>
          </nav>

          <div class="min-w-0 flex-1 space-y-10">
            @for (section of sections(); track section.id) {
              <!-- scroll-mt keeps a jumped-to heading clear of the sticky
                   header instead of hiding it underneath. -->
              <section [id]="section.id" class="scroll-mt-24">
                <h2 class="text-2xl font-semibold tracking-tight">{{ section.heading }}</h2>

                @for (paragraph of section.body ?? []; track paragraph) {
                  <p class="mt-4 max-w-prose text-muted-foreground">{{ paragraph }}</p>
                }

                @if (section.bullets?.length) {
                  <ul class="mt-4 max-w-prose space-y-2">
                    @for (bullet of section.bullets ?? []; track bullet) {
                      <li class="flex gap-3 text-muted-foreground">
                        <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true"></span>
                        <span>{{ bullet }}</span>
                      </li>
                    }
                  </ul>
                }

                @if (section.note) {
                  <p class="fl-surface mt-5 max-w-prose p-4 text-sm text-muted-foreground">
                    {{ section.note }}
                  </p>
                }
              </section>
            }
          </div>
        </div>

        <ng-content />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class DocPageComponent {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly lead = input.required<string>();
  readonly sections = input.required<readonly DocSection[]>();
  /** A human date. Omitted rather than guessed. */
  readonly updated = input<string>('');

  protected readonly count = computed(() => this.sections().length);
}
