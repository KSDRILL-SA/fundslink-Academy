import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { cn, UiButtonComponent, UiIconTileComponent, type IconNode } from 'ui';

/**
 * The marketing section toolkit (marketing-site.md §5).
 *
 * These are page-composition pieces, not general primitives, so they live in
 * the marketing feature rather than in `libs/ui` — a "CTA band" is a marketing
 * idea, and putting it in the shared library would invite the application to
 * grow marketing furniture (frontend-structure.md §3).
 *
 * They exist so every marketing page is assembled from the same vocabulary:
 * consistent rhythm, consistent heading levels, consistent spacing. The
 * premium here is restraint and whitespace, not decoration (§1).
 */

/** A full-width band with the shared vertical rhythm and a centred container. */
@Component({
  selector: 'fl-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [class]="classes()">
      <div class="mx-auto max-w-[1200px] px-4">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class SectionComponent {
  /** `muted` for alternating bands; `navy` for the closing call to action. */
  readonly tone = input<'default' | 'muted' | 'navy'>('default');
  readonly class = input<string>('');

  protected readonly classes = computed(() =>
    cn(
      'py-20 sm:py-24',
      // `muted` gets the warm wash rather than a flat grey: an alternating
      // band should read as a change of light, not a change of paint.
      this.tone() === 'muted' ? 'fl-wash' : '',
      // The navy band keeps its light-on-dark treatment in both themes: it is
      // a deliberate inversion, not a surface that follows the theme. fl-on-dark
      // re-points the tokens so shared components inside it theme themselves.
      this.tone() === 'navy' ? 'fl-mesh fl-on-dark relative overflow-hidden' : '',
      this.class(),
    ),
  );
}

/**
 * Eyebrow + headline + lead.
 *
 * `level` exists because heading order is not styling. A page has exactly one
 * `h1` (§7); every section below it is an `h2`, and a card inside a section is
 * an `h3`. Screen-reader users navigate by that structure, and skipping a
 * level turns the page outline into nonsense.
 */
@Component({
  selector: 'fl-section-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()">
      @if (eyebrow()) {
        <p [class]="align() === 'center' ? 'flex justify-center' : ''">
          <span class="fl-eyebrow font-semibold uppercase tracking-wider">{{ eyebrow() }}</span>
        </p>
      }

      @if (level() === 1) {
        <h1 class="fl-display mt-4 text-4xl sm:text-5xl">{{ headline() }}</h1>
      } @else {
        <h2 class="fl-display mt-4 text-3xl sm:text-4xl">{{ headline() }}</h2>
      }

      @if (lead()) {
        <p class="mt-4 max-w-prose text-lg text-muted-foreground">{{ lead() }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class SectionHeaderComponent {
  readonly eyebrow = input<string>('');
  readonly headline = input.required<string>();
  readonly lead = input<string>('');
  readonly level = input<1 | 2>(2);
  readonly align = input<'start' | 'center'>('start');
  readonly class = input<string>('');

  protected readonly classes = computed(() =>
    cn(this.align() === 'center' ? 'mx-auto max-w-prose text-center' : '', this.class()),
  );
}

/** Icon + title + copy. The card in "how it works" and in feature grids. */
@Component({
  selector: 'fl-feature-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconTileComponent],
  template: `
    <div class="fl-surface fl-surface-interactive flex h-full flex-col p-6">
      @if (icon(); as node) {
        <ui-icon-tile [icon]="node" tone="gold" size="lg" class="mb-5" />
      }
      @if (step()) {
        <p class="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {{ step() }}
        </p>
      }
      <h3 class="text-xl font-semibold tracking-tight">{{ title() }}</h3>
      <p class="mt-3 text-muted-foreground">{{ body() }}</p>
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class FeatureCardComponent {
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  readonly icon = input<IconNode | null>(null);
  /** "Step 1" and the like, for ordered sequences. */
  readonly step = input<string>('');
}

/**
 * The closing call to action.
 *
 * One primary action, gold. §1 allows exactly one primary action per view —
 * a band offering three equal choices is a band that gets none of them taken.
 */
@Component({
  selector: 'fl-cta-band',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButtonComponent],
  template: `
    <div class="mx-auto max-w-prose text-center">
      <h2 class="fl-display text-3xl sm:text-4xl">{{ headline() }}</h2>
      @if (lead()) {
        <p class="mt-4 text-lg text-muted-foreground">{{ lead() }}</p>
      }
      <div class="mt-8 flex justify-center">
        <a [routerLink]="route()" class="inline-flex">
          <ui-button variant="accent" size="lg">{{ cta() }}</ui-button>
        </a>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class CtaBandComponent {
  readonly headline = input.required<string>();
  readonly lead = input<string>('');
  readonly cta = input.required<string>();
  readonly route = input.required<string>();
}
