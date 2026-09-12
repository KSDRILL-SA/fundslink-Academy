import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { BadgeCheck, FileText, GraduationCap, HeartHandshake, IdCard, Wallet } from 'lucide';
import { UiButtonComponent, UiIconTileComponent, type IconNode } from 'ui';
import {
  CtaBandComponent,
  FeatureCardComponent,
  SectionComponent,
  SectionHeaderComponent,
} from '../components/section.components';
import { ORGANISATION } from '../../content/organisation';

/**
 * For students.
 *
 * The page a person reads while deciding whether they belong here. Two things
 * have to be settled before anything else: what it costs (nothing) and whether
 * they qualify — and the honest answer to the second is that a reviewer
 * decides, so the page describes who this is built for rather than publishing
 * a rule that would read as a rejection to someone who might have been funded.
 *
 * The application categories named here are the real ones from the contract
 * (`ApplicationInput.application_type`). The documents named are the ones the
 * upload step actually accepts. Nothing on this page is aspirational.
 */
@Component({
  selector: 'fl-for-students',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiButtonComponent,
    UiIconTileComponent,
    SectionComponent,
    SectionHeaderComponent,
    FeatureCardComponent,
    CtaBandComponent,
  ],
  template: `
    <fl-section>
      <div class="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <fl-section-header
            [level]="1"
            eyebrow="For students"
            headline="You belong here"
            [lead]="lead"
          />

          <div class="mt-8 flex flex-wrap gap-3">
            <a routerLink="/auth/register" class="inline-flex">
              <ui-button variant="accent" size="lg">Start my application</ui-button>
            </a>
            <a routerLink="/bursaries" class="inline-flex">
              <ui-button variant="secondary" size="lg">Browse bursaries first</ui-button>
            </a>
          </div>
        </div>

        <ul class="space-y-4">
          @for (fact of headlineFacts; track fact.label) {
            <li class="fl-surface flex items-start gap-4 p-5">
              <ui-icon-tile [icon]="fact.icon" [tone]="fact.tone" />
              <div>
                <p class="font-semibold">{{ fact.label }}</p>
                <p class="mt-1 text-sm text-muted-foreground">{{ fact.body }}</p>
              </div>
            </li>
          }
        </ul>
      </div>
    </fl-section>

    <!-- ---------- Who we are built for ---------- -->
    <fl-section tone="muted">
      <fl-section-header
        eyebrow="Who this is for"
        headline="The situations we were built to fund"
        lead="If you recognise yourself here, apply. Where an application sits outside these, a reviewer still reads it — the categories organise the work, they are not a gate."
        class="mb-12"
      />

      <ul class="grid gap-6 md:grid-cols-2">
        @for (category of categories; track category.title) {
          <li>
            <fl-feature-card
              [title]="category.title"
              [body]="category.body"
              [icon]="category.icon"
            />
          </li>
        }
      </ul>
    </fl-section>

    <!-- ---------- What you will need ---------- -->
    <fl-section>
      <div class="grid gap-12 lg:grid-cols-2">
        <div>
          <fl-section-header
            eyebrow="What to have ready"
            headline="What you will need"
            lead="Nothing you do not already have. You can start without all of it and add the rest later — your progress is saved."
          />

          <ul class="mt-8 space-y-3">
            @for (item of documents; track item) {
              <li class="flex items-start gap-3">
                <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true"></span>
                <span>{{ item }}</span>
              </li>
            }
          </ul>
        </div>

        <div>
          <fl-section-header
            eyebrow="Your information"
            headline="What happens to what you give us"
            lead="You are being asked for your identity document and your circumstances. You are owed a straight answer about where that goes."
          />

          <ul class="mt-8 space-y-3">
            @for (item of dataPromises; track item) {
              <li class="flex items-start gap-3">
                <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true"></span>
                <span>{{ item }}</span>
              </li>
            }
          </ul>

          <a
            routerLink="/privacy"
            class="mt-6 inline-flex rounded-sm font-medium text-primary underline-offset-4
                   outline-none hover:underline focus-visible:outline-[3px]
                   focus-visible:outline-offset-2 focus-visible:outline-ring"
            >Read the full privacy statement</a
          >
        </div>
      </div>
    </fl-section>

    <fl-section tone="navy">
      <fl-cta-band
        headline="Applying is free, and it takes a few minutes"
        lead="A real person reads every application — including the ones we cannot fund."
        cta="Start my application"
        route="/auth/register"
      />
    </fl-section>
  `,
})
export class ForStudentsComponent {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  protected readonly lead =
    'Applying costs nothing, a real person reads every application, and a decision we cannot fund still comes with reasons and the next doors to try. ' +
    ORGANISATION.positioning;

  protected readonly headlineFacts = [
    {
      icon: Wallet as IconNode,
      tone: 'gold' as const,
      label: 'Free, with no share taken',
      body: 'No application fee, no agent, and no cut of any funding you receive. Ever.',
    },
    {
      icon: HeartHandshake as IconNode,
      tone: 'navy' as const,
      label: 'A person decides',
      body: 'Software checks that your application is complete. It never decides whether you are funded.',
    },
    {
      icon: BadgeCheck as IconNode,
      tone: 'success' as const,
      label: 'An answer either way',
      body: 'If we cannot fund you, you get the reviewer’s reasons in their own words, and where else to try.',
    },
  ];

  /** The real application categories (contract: ApplicationInput.application_type). */
  protected readonly categories = [
    {
      icon: GraduationCap as IconNode,
      title: 'Postgraduate study',
      body: 'Honours, master’s, postgraduate diplomas and doctoral study, where funding is scarcer and often assumed to be covered.',
    },
    {
      icon: FileText as IconNode,
      title: 'Undergraduate study',
      body: 'Undergraduate applications, grouped by circumstance so that similar situations are reviewed against each other rather than against everybody.',
    },
    {
      icon: Wallet as IconNode,
      title: 'A shortfall, not the whole amount',
      body: 'A registration fee, an outstanding balance, accommodation or materials — the remaining amount that stands between you and continuing.',
    },
    {
      icon: HeartHandshake as IconNode,
      title: 'Circumstances that do not fit a form',
      body: 'If your situation does not match a category, apply anyway and tell us in your own words. A reviewer reads it.',
    },
  ];

  protected readonly documents = [
    'Your South African ID number, or your passport number if you study here on a permit.',
    'Proof of registration or an offer of admission from your institution.',
    'Your most recent academic record.',
    'Proof of the amount outstanding, where you are asking for a specific shortfall.',
    'Anything that explains your circumstances — in your own words, in the language you think in.',
  ];

  protected readonly dataPromises = [
    'Your ID number is encrypted before it is stored, and it is never shown back to you or anyone else in full.',
    'What you write about your circumstances is read by reviewers, and is never used for marketing or shared with anyone deciding something else about you.',
    'What you write is read by a reviewer to decide your application, and is never used to sell you anything or shared with anyone deciding something else about you.',
    'You can ask for a copy of everything we hold about you, correct it, or ask us to delete it.',
  ];

  constructor() {
    this.title.setTitle('For students — FundsLink Academy');
    this.meta.updateTag({
      name: 'description',
      content:
        'What FundsLink Academy funds, what you need to apply, what it costs (nothing), and exactly what happens to the information you give us.',
    });
  }
}
