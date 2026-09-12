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
 * **There is no photograph yet, and this build does not invent one.** §3.1
 * asks for a real, dignified photograph of a South African student, and
 * explicitly rejects stock imagery. So the hero is composed to look finished
 * without a photo — the scrim over a navy field — and takes one the moment the
 * Founder supplies it, through `--hero-image`. Nothing about the layout
 * changes when it arrives; the scrim was always the thing carrying contrast.
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
      <!-- The scrim. Anchors the copy side and lets the image side breathe;
           with no image it simply reads as the brand's navy field. -->
      <div class="fl-hero-scrim absolute inset-0 -z-10" aria-hidden="true"></div>

      <!-- Atmosphere, in pure CSS: a faint engineering grid and the arch of the
           Rising Door. No image, no canvas, nothing to download — this page is
           opened on cheap phones over expensive data (P6). -->
      <span class="fl-grid-bg absolute inset-0 -z-10" aria-hidden="true"></span>
      <span
        class="fl-arch-motif left-1/2 top-10 hidden h-[38rem] w-[38rem] -translate-x-1/2 lg:block"
        aria-hidden="true"
      ></span>

      <div class="mx-auto grid max-w-[1200px] gap-16 px-4 py-24 sm:py-32 lg:grid-cols-[1.05fr_1fr]">
        <div class="max-w-2xl">
          <span class="fl-eyebrow border-[hsl(38_92%_50%/0.4)] text-[hsl(43_96%_78%)]">
            <span class="h-1.5 w-1.5 rounded-full bg-[hsl(38_92%_60%)]" aria-hidden="true"></span>
            Non-profit · South Africa
          </span>

          <!-- The one h1 on the page (§7). The gold sits on the half of the
               sentence that carries the hope — the promise, not the problem. -->
          <h1 class="fl-display mt-6 text-5xl text-[hsl(210_40%_98%)] sm:text-7xl">
            Past the cracks,<br />
            <span class="fl-text-gold">into your future.</span>
          </h1>

          <p class="mt-7 max-w-prose text-lg text-[hsl(210_40%_92%)] sm:text-xl">
            {{ positioning }} Free to apply, reviewed by a person, and built to treat you with
            dignity either way.
          </p>

          <!-- The "I am a…" gateway. One primary action in gold; the others
               are real destinations, deliberately subordinate (§3.1). -->
          <div class="mt-10">
            <p id="gateway-label" class="text-sm font-medium text-[hsl(210_40%_88%)]">I am a…</p>
            <nav aria-labelledby="gateway-label" class="mt-3 flex flex-wrap items-center gap-3">
              <a routerLink="/auth/register" class="inline-flex">
                <ui-button variant="accent" size="lg">Student — apply</ui-button>
              </a>
              <a routerLink="/for-donors" class="inline-flex">
                <ui-button variant="secondary" size="lg">Donor — give</ui-button>
              </a>
              <a routerLink="/for-donors" class="inline-flex">
                <ui-button variant="secondary" size="lg">Partner with us</ui-button>
              </a>
            </nav>

            <a
              routerLink="/bursaries"
              class="mt-6 inline-flex items-center gap-2 rounded-sm text-[hsl(210_40%_92%)]
                     underline-offset-4 outline-none hover:underline
                     focus-visible:outline-[3px] focus-visible:outline-offset-2
                     focus-visible:outline-[hsl(38_92%_60%)]"
            >
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
        <div class="relative hidden self-center lg:block" aria-hidden="true">
          <div class="fl-hero-mock fl-on-dark space-y-4 rounded-2xl p-6">
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

            <div class="rounded-xl border border-border bg-[hsl(222_45%_17%)] p-4">
              <p class="text-sm text-muted-foreground">Reviewed by</p>
              <p class="mt-1 text-sm font-medium text-foreground">
                A person — never an algorithm
              </p>
            </div>
          </div>

          <!-- A second, smaller card: depth without a screenshot. It clips the
               corner of the card above rather than sitting on its content. -->
          <div class="fl-hero-mock absolute -bottom-20 -left-12 w-52 rounded-2xl p-4">
            <p class="text-xs text-[hsl(213_32%_80%)]">Matches for you</p>
            <p class="mt-1 text-2xl font-semibold text-[hsl(210_40%_98%)] tabular">7</p>
            <p class="mt-1 text-xs text-[hsl(213_32%_80%)]">bursaries you fit</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= TRUST BAND ================= -->
    <!-- Three things that are true today. No vanity metrics, and no numbers we
         cannot stand behind (§3.2). -->
    <fl-section tone="muted" class="!py-14">
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
    <fl-section>
      <fl-section-header
        eyebrow="How it works"
        headline="Three steps, and a person at the end of them"
        lead="No agents, no fees, no guessing. You tell us about you once, and we do the finding."
        align="center"
        class="mb-14"
      />

      <ol class="grid gap-6 md:grid-cols-3">
        @for (item of steps; track item.title; let i = $index) {
          <li uiReveal [uiRevealDelay]="i * 50">
            <fl-feature-card
              [step]="'Step ' + (i + 1)"
              [title]="item.title"
              [body]="item.body"
              [icon]="item.icon"
            />
          </li>
        }
      </ol>

      <div class="mt-10 text-center">
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
    </fl-section>

    <!-- ================= TWO DOORS ================= -->
    <fl-section tone="muted">
      <div class="grid gap-6 md:grid-cols-2">
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
            body="See exactly where the money goes. Non-profit governance, POPIA-compliant handling of student data, and decisions made by people who are accountable for them."
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
       — the picture reads and the text stays AA. With no image supplied it
       resolves to the brand navy, which is why the hero looks finished today
       and simply gains depth when a photograph arrives.

       --hero-image is the seam: set it to an image-set() or url() and the
       layout does not change. */
    .fl-hero {
      background-color: hsl(222 47% 11%);
      background-image: var(--hero-image, none);
      background-size: cover;
      background-position: center right;
    }

    /* The floating product cards. Glass over the hero's navy, with a two-layer
       shadow and a top highlight — the same physics as a real card, at a
       larger elevation because these are floating above the page.

       Literal colours on purpose: Angular namespaces CSS custom properties
       inside a component styles block, so a design token referenced here
       would be a different variable than the one the global sheet defines. */
    .fl-hero-mock {
      background: hsl(222 45% 14% / 0.88);
      border: 1px solid hsl(213 25% 45% / 0.45);
      backdrop-filter: saturate(160%) blur(14px);
      -webkit-backdrop-filter: saturate(160%) blur(14px);
      box-shadow:
        inset 0 1px 0 0 hsl(0 0% 100% / 0.08),
        0 40px 80px -32px hsl(0 0% 0% / 0.8);
    }

    .fl-hero-scrim {
      background:
        radial-gradient(60% 80% at 85% 20%, hsl(38 92% 50% / 0.14) 0%, transparent 70%),
        linear-gradient(
          105deg,
          hsl(222 47% 11% / 0.96) 0%,
          hsl(222 47% 11% / 0.9) 45%,
          hsl(222 47% 11% / 0.55) 75%,
          hsl(222 47% 11% / 0.35) 100%
        );
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
