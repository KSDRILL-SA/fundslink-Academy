import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Compass, HeartHandshake, Scale, UserCheck } from 'lucide';
import { UiButtonComponent, UiIconTileComponent, type IconNode } from 'ui';
import {
  CtaBandComponent,
  SectionComponent,
  SectionHeaderComponent,
} from '../components/section.components';
import { ORGANISATION } from '../../content/organisation';

/**
 * About.
 *
 * Written to answer the only question this page is really asked: *who is
 * behind this, and why should I trust them with my identity document.*
 *
 * It makes no claim about size, history or amounts raised — this organisation
 * is new, and a new organisation that describes itself as established is the
 * first warning sign a careful person looks for. What it can honestly offer is
 * its principles and the mechanisms that enforce them, which is what is here.
 */
@Component({
  selector: 'fl-about',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiButtonComponent,
    UiIconTileComponent,
    SectionComponent,
    SectionHeaderComponent,
    CtaBandComponent,
  ],
  template: `
    <fl-section>
      <div class="mx-auto max-w-prose">
        <fl-section-header
          [level]="1"
          eyebrow="About us"
          headline="A trusted institution, humanised"
          [lead]="positioning"
        />

        <div class="mt-8 space-y-5 text-lg text-muted-foreground">
          @for (paragraph of story; track paragraph) {
            <p>{{ paragraph }}</p>
          }
        </div>
      </div>
    </fl-section>

    <!-- ---------- Principles ---------- -->
    <fl-section tone="muted">
      <fl-section-header
        eyebrow="What we hold to"
        headline="Four principles, and what each one costs us"
        lead="A principle that costs nothing to keep is a slogan. Each of these constrains what we are allowed to build."
        class="mb-12"
      />

      <ul class="grid gap-6 md:grid-cols-2">
        @for (principle of principles; track principle.title) {
          <li class="fl-surface h-full p-6">
            <ui-icon-tile [icon]="principle.icon" [tone]="principle.tone" size="lg" />
            <h3 class="mt-5 text-xl font-semibold tracking-tight">{{ principle.title }}</h3>
            <p class="mt-3 text-muted-foreground">{{ principle.body }}</p>
            <p class="mt-4 text-sm font-medium">{{ principle.cost }}</p>
          </li>
        }
      </ul>
    </fl-section>

    <!-- ---------- Where we are today ---------- -->
    <fl-section>
      <div class="mx-auto max-w-prose">
        <fl-section-header
          eyebrow="Where we are today"
          headline="What is true right now"
          lead="We would rather be plain about the stage we are at than describe an organisation we have not built yet."
        />

        <ul class="mt-8 space-y-3">
          @for (item of today; track item) {
            <li class="flex items-start gap-3">
              <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true"></span>
              <span class="text-muted-foreground">{{ item }}</span>
            </li>
          }
        </ul>

        <div class="mt-8 flex flex-wrap gap-3">
          <a routerLink="/how-it-works" class="inline-flex">
            <ui-button variant="secondary">See how it works</ui-button>
          </a>
          <a routerLink="/contact" class="inline-flex">
            <ui-button variant="ghost">Contact us</ui-button>
          </a>
        </div>
      </div>
    </fl-section>

    <fl-section tone="navy">
      <fl-cta-band
        headline="If you are a student, start here"
        lead="Applying is free, and a person reads every application."
        cta="Start my application"
        route="/auth/register"
      />
    </fl-section>
  `,
})
export class AboutComponent {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  protected readonly positioning = ORGANISATION.positioning;

  protected readonly story = [
    'A student can hold a place at a university and still not be able to take it. The funding they have covers most of what they owe, or covered it last year, or covers tuition but not the registration fee standing between them and the lecture hall. The amount left is often small next to the cost of losing the year.',
    'FundsLink Academy exists to close that remaining amount. We work alongside the funders a student already has — national schemes, bursars, institutions and their own families — and fund what those do not reach. We are not a replacement for any of them, and we do not ask a student to choose between us.',
    'The second thing we set out to change is how it feels to ask. Applying for financial help usually means explaining yourself into a form, waiting without news, and receiving a decision with no reasons attached. Every part of this platform was built against that experience.',
  ];

  protected readonly principles = [
    {
      icon: UserCheck as IconNode,
      tone: 'navy' as const,
      title: 'A person decides',
      body: 'Software organises the work, checks that an application is complete and puts it in front of a reviewer. It never approves or declines anyone.',
      cost: 'It costs us speed. We accept that a person reading carefully is slower than a rule.',
    },
    {
      icon: HeartHandshake as IconNode,
      tone: 'gold' as const,
      title: 'Dignity either way',
      body: 'A student who is not funded is told why, in the reviewer’s own words, with the next places worth trying. We never use the word “rejected” about a person.',
      cost: 'It costs reviewer time on exactly the applications that bring us nothing.',
    },
    {
      icon: Scale as IconNode,
      tone: 'success' as const,
      title: 'Free, with no share taken',
      body: 'No application fee, no agent, and no percentage of what a student receives.',
      cost: 'It means we fund our own operations from donors rather than from students.',
    },
    {
      icon: Compass as IconNode,
      tone: 'neutral' as const,
      title: 'Honest about what we do not know',
      body: 'We publish what is true today and leave the rest blank rather than filling it with numbers that sound better.',
      cost: 'It costs us a more impressive-looking website.',
    },
  ];

  protected readonly today = [
    'FundsLink Academy is a South African non-profit, newly established.',
    'Registration as a non-profit company and public benefit organisation is in progress. No registration number is published until it is issued.',
    'The platform is being built in the open, against published standards, with every funding decision made by a person.',
    'Applying is free to students now, and will remain free.',
  ];

  constructor() {
    this.title.setTitle('About — FundsLink Academy');
    this.meta.updateTag({
      name: 'description',
      content:
        'Who FundsLink Academy is, the four principles it holds to, what each principle costs, and exactly where the organisation stands today.',
    });
  }
}
