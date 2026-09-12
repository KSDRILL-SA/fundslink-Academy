import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Building2, FileCheck2, Landmark, Lock, ScrollText, UserCheck } from 'lucide';
import { UiButtonComponent, UiIconTileComponent, type IconNode } from 'ui';
import {
  FeatureCardComponent,
  SectionComponent,
  SectionHeaderComponent,
} from '../components/section.components';
import { ORGANISATION } from '../../content/organisation';

/**
 * For donors and partners.
 *
 * A funder's question is not "is this a good cause" — it is "can I see what
 * happened to my money, and who is accountable". So this page describes
 * mechanisms rather than intentions: the controls that exist in the system, in
 * terms a finance or governance reader can check.
 *
 * **No amounts, no totals, no percentages, and no registration numbers.**
 * Those are facts about an organisation that is not yet registered, and a
 * number invented here would be a fabricated credential in front of exactly
 * the audience least entitled to be misled. `ORGANISATION.registration` is
 * null; the page says so in plain words and reads correctly the day it is not.
 */
@Component({
  selector: 'fl-for-donors',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiButtonComponent,
    UiIconTileComponent,
    SectionComponent,
    SectionHeaderComponent,
    FeatureCardComponent,
  ],
  template: `
    <fl-section>
      <div class="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <fl-section-header
            [level]="1"
            eyebrow="For donors and partners"
            headline="See exactly where the money goes"
            lead="FundsLink Academy is built so that every rand can be traced to a decision, and every decision to a named person who is accountable for it."
          />

          <div class="mt-8 flex flex-wrap gap-3">
            <a routerLink="/contact" class="inline-flex">
              <ui-button variant="accent" size="lg">Talk to us about funding</ui-button>
            </a>
            <a routerLink="/how-it-works" class="inline-flex">
              <ui-button variant="secondary" size="lg">See the process</ui-button>
            </a>
          </div>
        </div>

        <ul class="space-y-4">
          @for (control of controls; track control.label) {
            <li class="fl-surface flex items-start gap-4 p-5">
              <ui-icon-tile [icon]="control.icon" [tone]="control.tone" />
              <div>
                <p class="font-semibold">{{ control.label }}</p>
                <p class="mt-1 text-sm text-muted-foreground">{{ control.body }}</p>
              </div>
            </li>
          }
        </ul>
      </div>
    </fl-section>

    <!-- ---------- Governance ---------- -->
    <fl-section tone="muted">
      <fl-section-header
        eyebrow="Governance"
        headline="How decisions are controlled"
        lead="These are properties of the system itself, not policies that depend on somebody remembering them."
        class="mb-12"
      />

      <ul class="grid gap-6 md:grid-cols-3">
        @for (item of governance; track item.title) {
          <li>
            <fl-feature-card [title]="item.title" [body]="item.body" [icon]="item.icon" />
          </li>
        }
      </ul>
    </fl-section>

    <!-- ---------- Registration status ---------- -->
    <fl-section>
      <div class="mx-auto max-w-prose text-center">
        <fl-section-header
          eyebrow="Registration"
          headline="Our legal standing, stated plainly"
          [lead]="registrationLead"
          align="center"
        />

        @if (!registration) {
          <p class="fl-surface mt-8 p-5 text-left text-muted-foreground">
            We would rather show you nothing here than a number you cannot verify. When the
            registration is complete, this page will carry the NPC and PBO numbers and the section
            18A position, and you will be able to check them against the public registers yourself.
          </p>
        }

        <div class="mt-8 flex justify-center">
          <a routerLink="/contact" class="inline-flex">
            <ui-button variant="primary">Ask us anything before you give</ui-button>
          </a>
        </div>
      </div>
    </fl-section>
  `,
})
export class ForDonorsComponent {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  protected readonly registration = ORGANISATION.registration;

  protected readonly registrationLead = ORGANISATION.registration
    ? 'Our registration details are published here for you to verify.'
    : 'FundsLink Academy is a South African non-profit. Its non-profit company and public benefit organisation registrations are in progress, and no registration number is published here until they are issued.';

  protected readonly controls = [
    {
      icon: UserCheck as IconNode,
      tone: 'navy' as const,
      label: 'A person decides, and is named',
      body: 'The system physically refuses to record a funding decision made by anything other than a reviewer. No automated approval is possible.',
    },
    {
      icon: ScrollText as IconNode,
      tone: 'gold' as const,
      label: 'Money records are append-only',
      body: 'Financial entries can be added and corrected by counter-entry, never edited or deleted in place. The history is the record.',
    },
    {
      icon: FileCheck2 as IconNode,
      tone: 'success' as const,
      label: 'Every status change is evidence',
      body: 'Each movement of an application writes an event with who did it and when, in the same transaction as the change itself.',
    },
    {
      icon: Lock as IconNode,
      tone: 'neutral' as const,
      label: 'Student data is protected by design',
      body: 'Identity numbers are encrypted at rest. Counselling information is held apart from applications and can never influence a funding decision.',
    },
  ];

  protected readonly governance = [
    {
      icon: Landmark as IconNode,
      title: 'Free to the student, always',
      body: 'No application fee and no share of a student’s funding. A student never pays to reach the money you give.',
    },
    {
      icon: Building2 as IconNode,
      title: 'Conflicts are handled, not assumed away',
      body: 'A reviewer with a connection to an applicant is expected to step aside, and the record shows who decided what.',
    },
    {
      icon: FileCheck2 as IconNode,
      title: 'Reporting you can check',
      body: 'Because the underlying record is append-only and event-based, reporting to a funder is derived from the same data the decisions were made on.',
    },
  ];

  constructor() {
    this.title.setTitle('For donors and partners — FundsLink Academy');
    this.meta.updateTag({
      name: 'description',
      content:
        'How FundsLink Academy controls funding decisions: human-made and named decisions, append-only financial records, event-based audit history, and protected student data.',
    });
  }
}
