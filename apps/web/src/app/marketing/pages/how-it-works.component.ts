import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { FileText, MessageSquareText, Search, ShieldCheck, UserRound } from 'lucide';
import { UiButtonComponent, UiIconTileComponent, type IconNode } from 'ui';
import {
  CtaBandComponent,
  FeatureCardComponent,
  SectionComponent,
  SectionHeaderComponent,
} from '../components/section.components';

/**
 * S02 — How it works.
 *
 * The promise of this page is sequence: a student should leave knowing exactly
 * what happens, in what order, and where a person enters the process. That is
 * the anxious question behind every application, and the answer is the product's
 * central commitment — software organises the work, a person makes the decision
 * (MASTER-SPEC §5.8, P5).
 *
 * The statuses named here are the real ones from the application state machine,
 * in the order they occur. Nothing on this page describes a step the system
 * does not actually perform.
 */
@Component({
  selector: 'fl-how-it-works',
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
      <fl-section-header
        [level]="1"
        eyebrow="How it works"
        headline="Four steps, and a person at the end of them"
        lead="No agent, no fee, and no algorithm deciding your funding. Here is the whole process, in the order you will meet it."
        align="center"
        class="mb-16"
      />

      <ol class="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        @for (step of steps; track step.title; let i = $index) {
          <li>
            <fl-feature-card
              [step]="'Step ' + (i + 1)"
              [title]="step.title"
              [body]="step.body"
              [icon]="step.icon"
            />
          </li>
        }
      </ol>
    </fl-section>

    <!-- ---------- What the statuses mean ---------- -->
    <fl-section tone="muted">
      <fl-section-header
        eyebrow="While you wait"
        headline="What each status actually means"
        lead="These are the words you will see on your application, and what is happening behind each one."
        class="mb-12"
      />

      <ul class="grid gap-4 md:grid-cols-2">
        @for (status of statuses; track status.label) {
          <li class="fl-surface flex gap-4 p-5">
            <ui-icon-tile [icon]="status.icon" [tone]="status.tone" />
            <div class="min-w-0">
              <p class="font-semibold">{{ status.label }}</p>
              <p class="mt-1 text-sm text-muted-foreground">{{ status.meaning }}</p>
            </div>
          </li>
        }
      </ul>
    </fl-section>

    <!-- ---------- What we never do ---------- -->
    <fl-section>
      <div class="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <fl-section-header
            eyebrow="Our side of it"
            headline="What we will never do"
            lead="Commitments are only worth writing down if they are specific enough to be broken."
          />

          <div class="mt-8">
            <a routerLink="/auth/register" class="inline-flex">
              <ui-button variant="accent" size="lg">Start my application</ui-button>
            </a>
          </div>
        </div>

        <ul class="space-y-4">
          @for (promise of promises; track promise) {
            <li class="fl-surface flex items-start gap-4 p-5">
              <ui-icon-tile [icon]="shieldIcon" tone="navy" size="sm" />
              <p>{{ promise }}</p>
            </li>
          }
        </ul>
      </div>
    </fl-section>

    <fl-section tone="navy">
      <fl-cta-band
        headline="Ready when you are"
        lead="Applying is free and takes a few minutes. You can save and come back — nothing is lost."
        cta="Start my application"
        route="/auth/register"
      />
    </fl-section>
  `,
})
export class HowItWorksComponent {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  protected readonly shieldIcon = ShieldCheck as IconNode;

  protected readonly steps = [
    {
      icon: UserRound as IconNode,
      title: 'Tell us about you, once',
      body: 'Your studies, your situation and your documents, filled in a single time. You will not retype any of it for a second bursary.',
    },
    {
      icon: FileText as IconNode,
      title: 'Apply in a few minutes',
      body: 'Short steps, saved as you go. If something is missing we come back and ask for it — we do not simply decline you for it.',
    },
    {
      icon: Search as IconNode,
      title: 'We check, then a reviewer reads it',
      body: 'An automated check looks only for missing or unreadable information. It cannot approve or decline anyone; it hands a complete application to a person.',
    },
    {
      icon: MessageSquareText as IconNode,
      title: 'A decision, with reasons',
      body: 'A reviewer makes the call and writes the reasons in their own words. If we cannot fund you, you are told why and where else to try.',
    },
  ];

  /** The real statuses from the application state machine, in order. */
  protected readonly statuses = [
    {
      icon: FileText as IconNode,
      tone: 'neutral' as const,
      label: 'Draft',
      meaning: 'Saved and yours. Nothing has been submitted and nobody has read it yet.',
    },
    {
      icon: Search as IconNode,
      tone: 'navy' as const,
      label: 'Checking your details',
      meaning: 'We are confirming that everything we need is present and readable. This step cannot approve or decline you.',
    },
    {
      icon: MessageSquareText as IconNode,
      tone: 'warning' as const,
      label: 'Needs more information',
      meaning: 'Something is missing or unclear. You will see exactly what, and your place in the queue is held while you fix it.',
    },
    {
      icon: UserRound as IconNode,
      tone: 'navy' as const,
      label: 'With a reviewer',
      meaning: 'A person is reading your application. This is where the decision is made — by them, not by the system.',
    },
    {
      icon: ShieldCheck as IconNode,
      tone: 'success' as const,
      label: 'Approved',
      meaning: 'Funding has been approved. Your application shows the details and what happens next.',
    },
    {
      icon: MessageSquareText as IconNode,
      tone: 'neutral' as const,
      label: 'Not funded this time',
      meaning: 'We could not fund this application. You are given the reviewer’s reasons and the next doors worth trying.',
    },
  ];

  protected readonly promises = [
    'We will never charge a student to apply, and we will never take a share of funding you receive.',
    'We will never let software approve or decline an application. A named person is accountable for every decision.',
    'We will never sell, rent or share your personal information for marketing.',
    'We will never decline you for a missing document without asking you for it first.',
    'We will never tell you “no” without telling you why.',
  ];

  constructor() {
    this.title.setTitle('How it works — FundsLink Academy');
    this.meta.updateTag({
      name: 'description',
      content:
        'The full FundsLink Academy process: one profile, a short application, an automated completeness check, and a decision made and explained by a person.',
    });
  }
}
