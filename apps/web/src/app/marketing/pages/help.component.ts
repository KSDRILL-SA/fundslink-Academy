import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { UiButtonComponent } from 'ui';
import { ORGANISATION } from '../../content/organisation';

/** One answered question. */
interface HelpItem {
  readonly question: string;
  readonly answer: readonly string[];
}

interface HelpGroup {
  readonly id: string;
  readonly title: string;
  readonly items: readonly HelpItem[];
}

/**
 * Help.
 *
 * Every answer here describes something the system actually does. Where the
 * answer depends on a figure we have not set — how long a review takes — the
 * question is answered honestly rather than filled with a number that would
 * become a broken promise the first time it is missed.
 *
 * Built on `<details>` / `<summary>`, which is a real disclosure widget in
 * every browser: keyboard operable, announced correctly, and open-able by the
 * browser's own find-in-page. A hand-built accordion here would be worse in
 * every one of those ways and would need JavaScript to be worse.
 */
@Component({
  selector: 'fl-help',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButtonComponent],
  template: `
    <div class="fl-wash">
      <div class="mx-auto max-w-[1100px] px-4 py-16 sm:py-20">
        <header class="max-w-prose">
          <p class="fl-eyebrow">Help</p>
          <h1 class="fl-display mt-4 text-4xl sm:text-5xl">Questions people actually ask</h1>
          <p class="mt-5 text-lg text-muted-foreground">
            If your question is not here, write to us. A person answers.
          </p>
        </header>

        <div class="mt-12 space-y-12">
          @for (group of groups; track group.id) {
            <section [id]="group.id" class="scroll-mt-24">
              <h2 class="text-2xl font-semibold tracking-tight">{{ group.title }}</h2>

              <div class="mt-5 space-y-3">
                @for (item of group.items; track item.question) {
                  <details class="fl-surface group p-0">
                    <summary
                      class="flex cursor-pointer list-none items-center justify-between gap-4 p-5
                             font-medium outline-none focus-visible:outline-[3px]
                             focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {{ item.question }}
                      <!-- Rotates with the disclosure state; the state itself
                           is carried by the element, not by this glyph. -->
                      <span
                        class="shrink-0 text-muted-foreground transition-transform
                               group-open:rotate-45 motion-reduce:transition-none"
                        aria-hidden="true"
                        >+</span
                      >
                    </summary>
                    <div class="space-y-3 px-5 pb-5 text-muted-foreground">
                      @for (paragraph of item.answer; track paragraph) {
                        <p class="max-w-prose">{{ paragraph }}</p>
                      }
                    </div>
                  </details>
                }
              </div>
            </section>
          }
        </div>

        <div class="fl-surface mt-14 flex flex-wrap items-center justify-between gap-6 p-6">
          <div>
            <p class="text-lg font-semibold">Still stuck?</p>
            <p class="mt-1 text-muted-foreground">
              Write to {{ email }} and tell us what happened. If you saw an error, include the
              reference it showed you — it takes us straight to what went wrong.
            </p>
          </div>
          <a routerLink="/contact" class="inline-flex">
            <ui-button variant="primary">Contact us</ui-button>
          </a>
        </div>
      </div>
    </div>
  `,
})
export class HelpComponent {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  protected readonly email = ORGANISATION.generalEmail;

  protected readonly groups: readonly HelpGroup[] = [
    {
      id: 'applying',
      title: 'Applying',
      items: [
        {
          question: 'What does it cost to apply?',
          answer: [
            'Nothing, ever. There is no application fee, no subscription, and we take no share of funding you receive.',
          ],
        },
        {
          question: 'Can I save and come back?',
          answer: [
            'Yes. Every step saves as you go, and an unsubmitted application stays a draft until you are ready. Nothing is lost by closing the page.',
          ],
        },
        {
          question: 'What if I do not have all my documents yet?',
          answer: [
            'Start anyway. You can add documents later, and if something is missing when a reviewer needs it, we come back and ask you for it rather than declining you for it.',
          ],
        },
        {
          question: 'Can I apply for more than one thing?',
          answer: [
            'You hold one FundsLink application per academic year. You can also track bursaries you have applied for elsewhere, so everything you are waiting on sits in one place.',
          ],
        },
      ],
    },
    {
      id: 'while-you-wait',
      title: 'While you wait',
      items: [
        {
          question: 'How long does a decision take?',
          answer: [
            'We do not publish a number we cannot keep. What we can tell you is that your application shows exactly where it is at every moment — checking, waiting on you, or with a reviewer — and that we tell you when it moves rather than leaving you to check.',
            'When our review time is set, it will be published here and shown on your application.',
          ],
        },
        {
          question: 'Does a computer decide whether I am funded?',
          answer: [
            'No. Software checks that an application is complete and readable, and puts it in front of a person. The system physically refuses to record a funding decision that was not made by a reviewer.',
          ],
        },
        {
          question: 'My application says “Needs more information”. What now?',
          answer: [
            'Open it and you will see exactly what is missing, in plain words. Fix it and it goes back into the queue — your place is held while you do.',
          ],
        },
      ],
    },
    {
      id: 'decisions',
      title: 'Decisions',
      items: [
        {
          question: 'What happens if you cannot fund me?',
          answer: [
            'You are told why, in the reviewer’s own words, and pointed to the next places worth trying. We do not send a one-line decline, and we do not use the word “rejected” about a person.',
          ],
        },
        {
          question: 'Can a decision be looked at again?',
          answer: [
            'If you believe a decision was made on wrong information, write to us and a different reviewer will look at it again.',
          ],
        },
      ],
    },
    {
      id: 'account-and-data',
      title: 'Your account and your information',
      items: [
        {
          question: 'Why do you need my ID number?',
          answer: [
            'Funders must be able to confirm that the person funded is the person who applied. It is encrypted before it is stored and is never shown back in full — not to you, not to a reviewer, not in an export.',
          ],
        },
        {
          question: 'Can I get a copy of everything you hold about me?',
          answer: [
            'Yes, from Data & privacy in your account. You can download it, correct it, or ask us to delete your account.',
          ],
        },
        {
          question: 'Is what I tell a counsellor part of my application?',
          answer: [
            'No. Counselling information is stored apart from your application, is not visible to reviewers, and can never affect a funding decision.',
          ],
        },
      ],
    },
  ];

  constructor() {
    this.title.setTitle('Help — FundsLink Academy');
    this.meta.updateTag({
      name: 'description',
      content:
        'Answers about applying to FundsLink Academy: what it costs, saving your progress, what each status means, how decisions are made, and your rights over your information.',
    });
  }
}
