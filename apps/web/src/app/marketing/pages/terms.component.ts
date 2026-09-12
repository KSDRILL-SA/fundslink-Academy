import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ORGANISATION } from '../../content/organisation';
import { DocPageComponent, type DocSection } from './doc-page.component';

/**
 * Terms of use.
 *
 * Written in plain language on purpose. A student agreeing to terms they cannot
 * read has not agreed to anything meaningful, and this platform's whole claim
 * is that it treats people as people.
 *
 * These describe the service as it actually behaves and commit us to what we
 * already do. They deliberately contain **no clause we cannot honour and no
 * promise about funding**, because the only honest statement about an outcome
 * is that a reviewer decides.
 *
 * ⚠️ These terms have not been through legal review. They are the Founder's
 * (L4) to ratify, and the PR flags it: this is the one page on the site where
 * "good enough for now" is a decision someone must take deliberately rather
 * than inherit from an engineer.
 */
@Component({
  selector: 'fl-terms',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DocPageComponent],
  template: `
    <fl-doc-page
      eyebrow="Terms"
      title="Terms of use"
      lead="The agreement between you and us, in the fewest words that still say what we mean."
      [sections]="sections"
    />
  `,
})
export class TermsComponent {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  protected readonly sections: readonly DocSection[] = [
    {
      id: 'what-this-is',
      heading: 'What this service is',
      body: [
        `${ORGANISATION.name} helps students in South Africa find, apply for and track bursary funding, and funds some applications itself.`,
        'Using the platform means agreeing to what is on this page. If you do not agree with something here, please tell us rather than simply leaving — we would rather fix it.',
      ],
    },
    {
      id: 'what-it-costs',
      heading: 'What it costs you',
      body: [
        'Nothing. There is no application fee, no subscription, and we take no share of any funding you receive. If anyone asks you to pay to apply through FundsLink Academy, they are not us — tell us immediately.',
      ],
    },
    {
      id: 'your-account',
      heading: 'Your account',
      bullets: [
        'The account is yours. Do not share your password, and tell us if you think someone else has reached it.',
        'You must be the person you say you are. Applying in someone else’s name is the one thing that ends an account permanently.',
        'You can close your account at any time from Data & privacy.',
      ],
    },
    {
      id: 'accuracy',
      heading: 'Being accurate',
      body: [
        'What you tell us has to be true to the best of your knowledge. Funding decisions are made on it, and a place funded on false information is a place taken from someone who needed it.',
        'If something you told us changes — your registration, your amount outstanding, your contact details — update it. An honest mistake corrected is not held against you.',
      ],
    },
    {
      id: 'decisions',
      heading: 'Decisions about funding',
      body: [
        'Applying does not guarantee funding. Demand is greater than what we hold, and a reviewer decides each application on its own facts.',
        'Every decision is made by a person, not by software. If we cannot fund you, we tell you why and where else to try.',
        'If you believe a decision was made on wrong information, write to us and a different reviewer will look again.',
      ],
    },
    {
      id: 'other-bursaries',
      heading: 'Bursaries listed from other funders',
      body: [
        'Some bursaries shown here are offered by other organisations. We list them so you can find them; we do not control their terms, their deadlines or their decisions, and applying to them is between you and them.',
        'We try to keep those listings correct. Where a funder’s own page and ours disagree, theirs is the one that counts.',
      ],
    },
    {
      id: 'acceptable-use',
      heading: 'Using the platform fairly',
      bullets: [
        'Do not attempt to reach another person’s account or information.',
        'Do not upload anything harmful, or anything you do not have the right to share.',
        'Do not use the platform to harass anyone, including our reviewers.',
      ],
    },
    {
      id: 'availability',
      heading: 'Availability',
      body: [
        'We aim to keep the platform available and your work saved, and we will tell you when it is down rather than leaving you guessing. We cannot promise it will never be unavailable.',
        'Where a deadline falls while we are down, tell us — we will not hold our outage against your application.',
      ],
    },
    {
      id: 'privacy',
      heading: 'Your information',
      body: [
        'How we handle personal information is set out in the privacy statement, and it forms part of these terms.',
      ],
    },
    {
      id: 'changes-and-law',
      heading: 'Changes, and the law that applies',
      body: [
        'When these terms change in a way that affects you, we will tell you in the platform before the change takes effect.',
        'These terms are governed by the law of the Republic of South Africa.',
      ],
    },
  ];

  constructor() {
    this.title.setTitle('Terms of use — FundsLink Academy');
    this.meta.updateTag({
      name: 'description',
      content:
        'The terms of using FundsLink Academy: free to students, accurate information, decisions made by people, and how we handle changes and availability.',
    });
  }
}
