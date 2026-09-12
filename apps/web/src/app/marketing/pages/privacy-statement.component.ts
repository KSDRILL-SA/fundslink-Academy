import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ORGANISATION } from '../../content/organisation';
import { DocPageComponent, type DocSection } from './doc-page.component';

/**
 * The public privacy statement (POPIA).
 *
 * Distinct from S21 inside the account, which is where a signed-in student
 * *exercises* their rights. This page is what a person reads before they trust
 * us with an identity number, and it therefore describes what the system
 * actually does — encryption at rest, recorded access, the export and deletion
 * routes that exist — rather than reciting the Act.
 *
 * It says nothing about counselling. §6.4 does require that counselling data
 * never enters this schema, and it does not — because there is no counselling
 * service in the platform at all. Describing how we would protect data from a
 * service we do not offer implies the service exists.
 *
 * It deliberately publishes no retention period and names no Information
 * Officer, because neither is settled. POPIA requires the officer to be
 * *reachable*; a placeholder name would defeat the requirement while appearing
 * to satisfy it, so the section states the position and gives the address that
 * reaches it. Both are Founder decisions, and the page reads correctly the day
 * they land (see content/organisation.ts).
 */
@Component({
  selector: 'fl-privacy-statement',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DocPageComponent],
  template: `
    <fl-doc-page
      eyebrow="Privacy & POPIA"
      title="What we do with your information"
      lead="Written to be read, not to be survived. If anything here is unclear, that is our failure and we would like to hear about it."
      [sections]="sections"
    />
  `,
})
export class PrivacyStatementComponent {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  protected readonly sections: readonly DocSection[] = [
    {
      id: 'who-we-are',
      heading: 'Who is responsible',
      body: [
        `${ORGANISATION.name} is the responsible party for the personal information described here, under the Protection of Personal Information Act.`,
        'We are a South African non-profit that funds students. We do not sell advertising, we do not run a marketing business, and your information is not a product we have.',
      ],
    },
    {
      id: 'what-we-collect',
      heading: 'What we collect, and why',
      body: [
        'We ask for what a funding decision requires, and we try not to ask for more. Each of these exists for a reason we can state:',
      ],
      bullets: [
        'Your name, contact details and password — so that the account is yours and only you can reach it.',
        'Your identity or passport number — because funders must be able to confirm that the person funded is the person who applied.',
        'Your studies: institution, level, field, academic record and proof of registration — because eligibility for most funding depends on them.',
        'What you owe and to whom — because it is the amount we are being asked to cover.',
        'What you choose to tell us about your circumstances — because a reviewer decides with context, not with a score.',
      ],
    },
    {
      id: 'how-we-protect-it',
      heading: 'How it is protected',
      bullets: [
        'Your identity number is encrypted before it is stored, and is never displayed back in full — not to you, not to a reviewer, not in any export.',
        'Access is limited to the people who need it to do the work, and every change to your application is recorded with who made it and when.',
        // No counselling claim here. There is no counselling service in this
        // platform — a role exists in the permission model and nothing else —
        // and describing how we would protect data from a service we do not
        // offer implies the service. It returns when the service does.
        'Reviewers see your application. Nobody else in the organisation browses it, and every access is recorded.',
        'Information is transmitted over encrypted connections only.',
      ],
    },
    {
      id: 'who-sees-it',
      heading: 'Who sees it',
      body: [
        'Reviewers see what they need to decide your application. Where a bursary is provided by a partner funder, we share with that funder only what their decision requires, and only once you have applied to them.',
        'We use service providers to run the platform — hosting, email and error monitoring. They act on our instructions and may not use your information for their own purposes.',
      ],
      note: 'We do not sell, rent or trade personal information, and we do not share it for anyone’s marketing, including our own.',
    },
    {
      id: 'your-rights',
      heading: 'Your rights, and how to use them',
      body: [
        'POPIA gives you rights over your information. In this platform they are buttons, not a letter you have to write:',
      ],
      bullets: [
        'See and download everything we hold about you, from Data & privacy in your account.',
        'Correct anything that is wrong, from your profile.',
        'Ask us to delete your account and information. Where we must keep a record of a funding decision, we will tell you what is kept and why.',
        'Object to how we use your information, and complain to the Information Regulator of South Africa if we do not resolve it.',
      ],
    },
    {
      id: 'information-officer',
      heading: 'Information Officer',
      body: [
        `POPIA requires us to designate an Information Officer and to make them reachable. Write to ${ORGANISATION.privacyEmail} and your request goes to that person.`,
        'We publish the designated officer’s name here once the appointment is registered. We would rather name nobody than name someone who does not hold the role.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to this statement',
      body: [
        'When this statement changes in a way that affects you, we will tell you in the platform rather than quietly updating a page you have already read.',
      ],
    },
  ];

  constructor() {
    this.title.setTitle('Privacy & POPIA — FundsLink Academy');
    this.meta.updateTag({
      name: 'description',
      content:
        'What FundsLink Academy collects, why, how it is protected, who sees it, and how to exercise your rights under POPIA.',
    });
  }
}
