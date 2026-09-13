import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import {
  ArrowRight,
  BadgeCheck,
  FileText,
  HeartHandshake,
  Lock,
  Search,
  UserCheck,
  UserRound,
} from 'lucide';
import {
  UiButtonComponent,
  UiIconComponent,
  UiIconTileComponent,
  UiRevealDirective,
  type IconNode,
} from 'ui';
import {
  CtaBandComponent,
  FeatureCardComponent,
  SectionComponent,
  SectionHeaderComponent,
} from './components/section.components';
import { ORGANISATION } from '../content/organisation';

/**
 * The marketing home page (marketing-site.md §3).
 *
 * The hero is the three-second handshake, and the design's rule for it is that
 * text must never fight the image: a navy gradient scrim anchors the copy on
 * one side while the image breathes on the other, so the picture reads AND the
 * text keeps AA contrast.
 *
 * **The image is art-directed, and it is not a photograph of our students.**
 * §3.1 asked for a real, dignified photograph of a South African student. The
 * Founder (L4, 2026-09-13) supplied a generated image of the SETTING instead —
 * two students seen from behind, walking up the steps of a university building
 * into an open, lit doorway at sunset — with no identifiable face. It may never
 * be captioned, quoted, or described as a FundsLink beneficiary: that would be
 * fabricating people, which this page refuses everywhere else (§3.5 below).
 * The alt text describes the scene and claims nothing about who they are.
 *
 * It is two crops, not one image cropped by CSS: a landscape for wide screens
 * (subject on the right, where the scrim is lightest) and a portrait for phones
 * (subject in the top third, quiet steps below for the copy). Each ships as
 * AVIF with a WebP fallback at two widths — 17.5 kB on a phone, 51 kB at the
 * largest desktop size — because this page is opened on cheap phones over
 * expensive data (P6). The navy field stays underneath, so the hero is never
 * blank while the image loads, and the scrim still carries the text contrast.
 *
 * Two further sections of §3 are deliberately absent, for the same reason:
 * §3.5 (impact / voices) needs REAL, CONSENTED student stories — inventing
 * testimonials for a bursary platform would be fabricating people — and §8's
 * NPC/PBO/§18A numbers are marked "once live" in the design itself. Trust copy
 * that is true today is here; a registration number is not guessed at.
 */
@Component({
  selector: 'fl-marketing-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiButtonComponent,
    UiIconComponent,
    UiIconTileComponent,
    UiRevealDirective,
    SectionComponent,
    SectionHeaderComponent,
    FeatureCardComponent,
    CtaBandComponent,
  ],
  template: `
    <!-- ================= HERO ================= -->
    <section class="fl-hero relative isolate overflow-hidden">
      <!-- The hero image: art direction by viewport, format by browser support,
           width by screen density. One element, so it is the LCP candidate and
           the browser can fetch it early; width/height reserve its box (no CLS).
           See the component doc for what this image is — and is not. -->
      <picture class="absolute inset-0 -z-20">
        <source
          media="(max-width: 767px)"
          type="image/avif"
          srcset="images/hero/hero-mobile-640.avif 640w, images/hero/hero-mobile-1024.avif 1024w"
          sizes="100vw"
        />
        <source
          media="(max-width: 767px)"
          type="image/webp"
          srcset="images/hero/hero-mobile-640.webp 640w, images/hero/hero-mobile-1024.webp 1024w"
          sizes="100vw"
        />
        <source
          type="image/avif"
          srcset="images/hero/hero-desktop-960.avif 960w, images/hero/hero-desktop-1536.avif 1536w"
          sizes="100vw"
        />
        <source
          type="image/webp"
          srcset="images/hero/hero-desktop-960.webp 960w, images/hero/hero-desktop-1536.webp 1536w"
          sizes="100vw"
        />
        <img
          class="fl-hero-image h-full w-full object-cover"
          src="images/hero/hero-desktop-960.webp"
          width="1536"
          height="1024"
          alt="Two students walk up the steps of a university building toward an open, lit doorway at sunset."
          fetchpriority="high"
          loading="eager"
          decoding="async"
        />
      </picture>

      <!-- The scrim. Anchors the copy side so text keeps AA contrast over the
           image, and lets the image side breathe. -->
      <div class="fl-hero-scrim absolute inset-0 -z-10" aria-hidden="true"></div>

      <!-- Atmosphere, in pure CSS: a faint engineering grid and the arch of the
           Rising Door. -->
      <span class="fl-grid-bg absolute inset-0 -z-10" aria-hidden="true"></span>
      <span
        class="fl-arch-motif left-1/2 top-10 hidden h-[38rem] w-[38rem] -translate-x-1/2 lg:block"
        aria-hidden="true"
      ></span>

      <!-- 12 columns, split 6/6 with the mock bleeding past the container on
           the right. An even two-column grid centres everything and reads as a
           template; an asymmetric one reads as a composition. -->
      <div
        class="fl-container fl-on-dark grid items-center gap-x-12 gap-y-16 py-20 sm:py-24
               lg:grid-cols-12 lg:py-28"
      >
        <div class="lg:col-span-6 xl:col-span-6">
          <span class="fl-eyebrow border-[hsl(38_92%_50%/0.4)] text-[hsl(43_96%_78%)]">
            <span class="h-1.5 w-1.5 rounded-full bg-[hsl(38_92%_60%)]" aria-hidden="true"></span>
            Non-profit · South Africa
          </span>

          <!-- The one h1 on the page (§7). The gold sits on the half of the
               sentence that carries the hope — the promise, not the problem. -->
          <h1 class="fl-display mt-7 text-[2.75rem] text-[hsl(210_40%_98%)] sm:text-6xl xl:text-7xl">
            Past the cracks,<br />
            <span class="fl-text-gold">into your future.</span>
          </h1>

          <p class="fl-lead mt-7 max-w-[34rem] text-[hsl(213_40%_88%)]">
            {{ positioning }} Free to apply, reviewed by a person, and built to treat you with
            dignity either way.
          </p>

          <!--
            The "I am a…" gateway (§3.1).

            One primary action, not three. The first pass put three
            equally-weighted buttons in a row, which is the surest way to have
            none of them taken — and two of those three were for people who are
            not the main audience of this page. The student's action keeps the
            gold; the other two audiences are named, addressed and subordinate.
          -->
          <div class="mt-10">
            <p id="gateway-label" class="fl-caption text-[hsl(213_32%_78%)]">I am a…</p>
            <nav aria-labelledby="gateway-label" class="mt-4">
              <a routerLink="/auth/register" class="inline-flex">
                <ui-button variant="accent" size="lg">Student — apply</ui-button>
              </a>

              <div class="mt-5 flex flex-wrap items-center gap-x-7 gap-y-3">
                <a [routerLink]="'/for-donors'" [class]="quietLink">
                  Donor — give
                  <ui-icon [name]="icons.arrow" size="sm" />
                </a>
                <a [routerLink]="'/for-donors'" [class]="quietLink">
                  Partner with us
                  <ui-icon [name]="icons.arrow" size="sm" />
                </a>
              </div>
            </nav>

            <a routerLink="/bursaries" [class]="'mt-7 ' + quietLink">
              <ui-icon [name]="icons.search" size="sm" />
              Just browsing? See the bursaries
            </a>
          </div>
        </div>

        <!-- The product, shown rather than described: the real status card a
             student sees, built from the same tokens as the real one so it can
             never drift into marketing fiction.

             Entirely decorative — every claim it makes is stated in text
             elsewhere on the page — so it is hidden from assistive technology
             rather than read out as a fake application. Drawn in HTML and CSS,
             so it costs no bytes and stays sharp on any screen. -->
        <div class="relative hidden lg:col-span-6 lg:block" aria-hidden="true">
          <!-- A light source above-left, so the card is tilted INTO the page
               rather than sitting flat on it. Transform only, and removed
               entirely under reduced motion. -->
          <div class="fl-hero-tilt">
            <div class="fl-hero-mock space-y-4 rounded-2xl p-6">
            <div class="flex items-center justify-between">
              <span class="fl-eyebrow border-[hsl(38_92%_50%/0.4)] text-[hsl(43_96%_78%)]">
                Application · 2026
              </span>
              <span class="text-sm text-muted-foreground">FL-2026-0418</span>
            </div>

            <p class="text-xl font-semibold text-foreground">Your funding application</p>

            <div class="space-y-3">
              @for (row of mockSteps; track row.label) {
                <div class="flex items-center gap-3">
                  <span
                    class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                    [class]="
                      row.done
                        ? 'bg-[hsl(38_92%_55%)] text-[hsl(222_47%_11%)]'
                        : 'border border-border text-muted-foreground'
                    "
                    >{{ row.done ? '✓' : row.n }}</span
                  >
                  <span class="flex-1 text-sm text-foreground">{{ row.label }}</span>
                  <span class="text-xs text-muted-foreground">{{ row.when }}</span>
                </div>
              }
            </div>

              <!-- The card's own footer, in two columns.

                   The matches figure used to be a card floating outside this
                   one. It clashed: the tilt throws the outer corners across
                   the gutter, so a position that looks clear in the markup
                   crowds the headline on the page — and it did so differently
                   at every width, which is the kind of fragility a hero should
                   never carry. Inside the card it cannot collide with anything
                   and it reads as part of the product, which is the point. -->
              <div class="grid grid-cols-2 gap-3 border-t border-border pt-4">
                <div>
                  <p class="text-xs text-muted-foreground">Reviewed by</p>
                  <p class="mt-1 text-sm font-medium text-foreground">
                    A person — never an algorithm
                  </p>
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">Matches for you</p>
                  <p class="mt-1 text-sm font-medium text-foreground">
                    <span class="tabular">7</span> bursaries you fit
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </section>

    <!-- ================= TRUST BAND ================= -->
    <!-- Three things that are true today. No vanity metrics, and no numbers we
         cannot stand behind (§3.2). -->
    <!-- Tight on purpose: this band is a reassurance strip under the hero, not
         a section of its own. Giving it the full rhythm made it read as three
         paragraphs nobody asked for. -->
    <fl-section tone="muted" class="!py-10">
      <ul class="grid gap-4 sm:grid-cols-3">
        @for (point of trustPoints; track point.title; let i = $index) {
          <li class="fl-surface flex items-start gap-4 p-5" uiReveal [uiRevealDelay]="i * 40">
            <ui-icon-tile [icon]="point.icon" [tone]="point.tone" />
            <div class="min-w-0">
              <p class="font-semibold">{{ point.title }}</p>
              <p class="mt-1 text-sm text-muted-foreground">{{ point.body }}</p>
            </div>
          </li>
        }
      </ul>
    </fl-section>

    <!-- ================= HOW IT WORKS ================= -->
    <!-- A journey, drawn as one: three numbered nodes on a single line, rather
         than three separate cards that happen to be in a row. The line is what
         says "this is a sequence you will walk", before a word is read. -->
    <fl-section density="lead">
      <div class="flex flex-wrap items-end justify-between gap-6">
        <fl-section-header
          eyebrow="How it works"
          headline="Three steps, and a person at the end of them"
          lead="No agents, no fees, no guessing. You tell us about you once, and we do the finding."
          class="max-w-2xl"
        />

        <a
          routerLink="/how-it-works"
          class="inline-flex items-center gap-2 rounded-sm font-medium text-primary
                 underline-offset-4 outline-none hover:underline focus-visible:outline-[3px]
                 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          See the full journey
          <ui-icon [name]="icons.arrow" size="sm" />
        </a>
      </div>

      <ol class="fl-journey mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
        @for (item of steps; track item.title; let i = $index) {
          <li class="fl-journey-step relative" uiReveal [uiRevealDelay]="i * 60">
            <div class="relative flex items-center gap-4">
              <span class="fl-journey-node tabular">{{ i + 1 }}</span>
              <ui-icon-tile [icon]="item.icon" tone="gold" />
            </div>
            <h3 class="mt-6 text-xl font-semibold tracking-tight">{{ item.title }}</h3>
            <p class="mt-3 max-w-prose text-muted-foreground">{{ item.body }}</p>
          </li>
        }
      </ol>
    </fl-section>

    <!-- ================= TWO DOORS ================= -->
    <!-- Not two equal halves. The student door is wider, because this page is
         read by far more students than donors, and a layout that treats both
         audiences identically is a layout that has not decided anything. -->
    <fl-section tone="muted">
      <div class="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div uiReveal>
          <fl-feature-card
            title="For students"
            body="You belong here. Applying is free, and a real person reads every application — including the ones we cannot fund. A no from us comes with the reasons and the next doors to try."
            [icon]="icons.student"
          >
            <a
              routerLink="/for-students"
              class="mt-6 inline-flex items-center gap-2 rounded-sm font-medium text-primary
                     underline-offset-4 outline-none hover:underline focus-visible:outline-[3px]
                     focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              What you will need
              <ui-icon [name]="icons.arrow" size="sm" />
            </a>
          </fl-feature-card>
        </div>

        <div uiReveal [uiRevealDelay]="60">
          <fl-feature-card
            title="For donors and partners"
            body="See exactly how every decision was made. Non-profit governance, POPIA-compliant handling of student data, and decisions made by people who are accountable for them on a record that cannot be quietly rewritten."
            [icon]="icons.donor"
          >
            <a
              routerLink="/for-donors"
              class="mt-6 inline-flex items-center gap-2 rounded-sm font-medium text-primary
                     underline-offset-4 outline-none hover:underline focus-visible:outline-[3px]
                     focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              How funding works
              <ui-icon [name]="icons.arrow" size="sm" />
            </a>
          </fl-feature-card>
        </div>
      </div>
    </fl-section>

    <!-- ================= FINAL CTA ================= -->
    <fl-section tone="navy">
      <fl-cta-band
        headline="Ready? It takes a few minutes."
        lead="Start your profile today. You can finish the application later — your progress is saved."
        cta="Start my application"
        route="/auth/register"
      />
    </fl-section>
  `,
  styles: `
    :host {
      display: block;
    }

    /* The hero composition.

       The scrim is a gradient over the image side rather than a flat overlay,
       so the copy sits in a high-contrast zone while the far side stays clear
       — the picture reads and the text stays AA.

       The navy background stays: it is what shows while the image loads, so
       the hero is never white. */
    .fl-hero {
      background-color: hsl(222 47% 11%);
    }

    /* Keep the people in view.

       Wide screens anchor right. The floating application card sits over the
       middle-right of the hero, and at a hero this height no crop clears it:
       anchoring to the bottom was tried and left two heads peeking over the
       card's edge. So the card became glass instead (.fl-hero-mock) — the
       students walk up the steps BEHIND the application, visible through it.

       Phones anchor LEFT and top: the portrait crop is wider than a phone, and
       taking the spare width from the left moves the students out from under
       the headline, which on a phone runs the full width of the screen. */
    .fl-hero-image {
      object-position: right center;
    }
    @media (max-width: 767px) {
      .fl-hero-image {
        object-position: left top;
      }
    }

    /* The floating product cards. Glass over the hero's navy, with a two-layer
       shadow and a top highlight — the same physics as a real card, at a
       larger elevation because these are floating above the page.

       Literal colours on purpose: Angular namespaces CSS custom properties
       inside a component styles block, so a design token referenced here
       would be a different variable than the one the global sheet defines. */
    .fl-hero-mock {
      /* Glass over the photograph, so the students behind the card show through
         it rather than disappearing behind an opaque panel. The card's own text
         is measured over whatever the blur produces, by the same contrast spec
         as the rest of the hero — the alpha is only as low as that allows. */
      background: hsl(222 45% 14% / 0.66);
      border: 1px solid hsl(213 25% 45% / 0.45);
      backdrop-filter: saturate(150%) blur(20px);
      -webkit-backdrop-filter: saturate(150%) blur(20px);
      box-shadow:
        inset 0 1px 0 0 hsl(0 0% 100% / 0.08),
        0 40px 80px -32px hsl(0 0% 0% / 0.8);
    }

    /* The tilt. A card lying perfectly flat on a page reads as a diagram; a
       few degrees of rotation with a lifted right edge reads as an object on a
       desk. Perspective is on the wrapper so the child keeps crisp text. */
    .fl-hero-tilt {
      transform: perspective(1600px) rotateY(-7deg) rotateX(2deg) rotate(-1.2deg);
      transform-style: preserve-3d;
      position: relative;
    }

    /* Nobody should be shown a rotated interface if they have asked for less
       motion — the tilt is static, but it is still a spatial effect, and it
       makes the mock harder to read for some people. */
    @media (prefers-reduced-motion: reduce) {
      .fl-hero-tilt {
        transform: none;
      }
    }

    /* The scrim is tuned against MEASURED contrast, not by eye:
       e2e/hero-contrast.spec.ts samples the real pixels behind every line of
       hero text at four screen sizes and requires WCAG AA. Change a stop here
       and that spec is what tells you whether you are still allowed to.

       Wide screens: the copy never goes past ~46% of the width, so the stops
       that protect it (0–45%) are unchanged, and the right-hand side — image
       only — opens up so the photograph actually reads. */
    .fl-hero-scrim {
      background:
        radial-gradient(60% 80% at 85% 20%, hsl(38 92% 50% / 0.14) 0%, transparent 70%),
        linear-gradient(
          105deg,
          hsl(222 47% 11% / 0.96) 0%,
          hsl(222 47% 11% / 0.9) 45%,
          hsl(222 47% 11% / 0.5) 70%,
          hsl(222 47% 11% / 0.15) 100%
        );
    }

    /* Phones: the copy runs the full width of the screen, including over the
       lit doorway, so a left-to-right fade would leave the right-hand end of
       every line unprotected. Here the scrim is top-to-bottom instead: lighter
       over the image at the top, deepening through the text. */
    @media (max-width: 767px) {
      .fl-hero-scrim {
        background:
          radial-gradient(90% 40% at 80% 8%, hsl(38 92% 50% / 0.12) 0%, transparent 70%),
          linear-gradient(
            180deg,
            hsl(222 47% 11% / 0.35) 0%,
            hsl(222 47% 11% / 0.72) 22%,
            hsl(222 47% 11% / 0.88) 42%,
            hsl(222 47% 11% / 0.94) 100%
          );
      }
    }
  `,
})
export class MarketingHomeComponent {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  /**
   * The positioning line, from content/organisation.ts.
   *
   * It used to name the national scheme's "gap" here. That reads as a
   * comparison — and a student, a university or a partner could fairly take it
   * as this platform setting itself against NSFAS, which it never was. What is
   * true is simpler and says more: we fund what other funding does not reach.
   */
  protected readonly positioning = ORGANISATION.positioning;

  /**
   * A quiet link on the navy hero: readable, clearly interactive, and
   * deliberately not a button. Three buttons of equal weight was the problem.
   */
  protected readonly quietLink =
    'inline-flex items-center gap-2 rounded-sm font-medium text-[hsl(213_40%_88%)] ' +
    'underline-offset-4 outline-none transition-colors hover:text-[hsl(43_96%_72%)] ' +
    'hover:underline focus-visible:outline-[3px] focus-visible:outline-offset-2 ' +
    'focus-visible:outline-[hsl(38_92%_60%)] motion-reduce:transition-none';

  protected readonly icons = {
    search: Search as IconNode,
    // An arrow, because the link says "see the full journey" — the handshake
    // that used to sit here read as a different action entirely.
    arrow: ArrowRight as IconNode,
    student: UserRound as IconNode,
    donor: HeartHandshake as IconNode,
  };

  /** The rows inside the decorative product card. Illustration, not data. */
  protected readonly mockSteps = [
    { n: '1', label: 'Profile created', when: 'Mon', done: true },
    { n: '2', label: 'Application submitted', when: 'Tue', done: true },
    { n: '3', label: 'With a reviewer', when: 'now', done: false },
    { n: '4', label: 'Decision, with reasons', when: '', done: false },
  ];

  protected readonly trustPoints = [
    {
      icon: UserCheck as IconNode,
      tone: 'navy' as const,
      title: 'A person reviews every application',
      body: 'Software helps us find you a match. It never decides your funding.',
    },
    {
      icon: Lock as IconNode,
      tone: 'success' as const,
      title: 'Built for POPIA',
      body: 'Your ID number is encrypted, your data is yours, and you can ask for all of it.',
    },
    {
      icon: BadgeCheck as IconNode,
      tone: 'gold' as const,
      title: 'Non-profit, free to students',
      body: 'No application fee, no agent, no cut of your funding. Ever.',
    },
  ];

  protected readonly steps = [
    {
      icon: UserRound as IconNode,
      title: 'Tell us about you, once',
      body: 'Your studies, your situation, your documents. You will not retype it for every bursary.',
    },
    {
      icon: FileText as IconNode,
      title: 'Apply in a few minutes',
      body: 'Short steps, saved as you go. If something is missing we ask for it — we do not just say no.',
    },
    {
      icon: Search as IconNode,
      title: 'Get matched, and decided by a human',
      body: 'We surface the bursaries you actually fit, and a reviewer makes the call with reasons attached.',
    },
  ];

  constructor() {
    this.title.setTitle('FundsLink Academy — funding for South African students');
    // One description, written for a person reading a search result rather
    // than for a keyword count.
    const description =
      'A South African non-profit helping students whose studies are not fully covered to find, apply for and track bursary funding. Free to apply, and every decision is made by a person.';
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: 'FundsLink Academy' });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
  }
}
