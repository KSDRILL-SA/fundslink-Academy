import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { HeartHandshake, LifeBuoy, Mail, ShieldCheck } from 'lucide';
import { UiButtonComponent, UiIconTileComponent, type IconNode } from 'ui';
import { ORGANISATION } from '../../content/organisation';

/** One way to reach us, and what it is for. */
interface Channel {
  readonly icon: IconNode;
  readonly tone: 'gold' | 'navy' | 'success' | 'neutral';
  readonly title: string;
  readonly body: string;
  readonly email: string;
}

/**
 * Contact.
 *
 * Deliberately **not a contact form**. A form here would collect a name, an
 * email and a message from people who are often mid-crisis, store them in a
 * place designed for neither, and give the sender nothing they can keep. An
 * address they write to from their own mailbox leaves them holding the record
 * of what they said and when — which matters most to the person with the least
 * power in the exchange.
 *
 * The addresses come from `content/organisation.ts`, where they are marked as
 * placeholders for the Founder to confirm before launch.
 */
@Component({
  selector: 'fl-contact',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButtonComponent, UiIconTileComponent],
  template: `
    <div class="fl-wash">
      <div class="mx-auto max-w-[1100px] px-4 py-16 sm:py-20">
        <header class="max-w-prose">
          <p class="fl-eyebrow">Contact</p>
          <h1 class="fl-display mt-4 text-4xl sm:text-5xl">Talk to a person</h1>
          <p class="mt-5 text-lg text-muted-foreground">
            There is no ticket number and no bot on the other end of these. Write in whichever
            South African language you think in — we will answer in it where we can.
          </p>
        </header>

        <ul class="mt-12 grid gap-4 md:grid-cols-2">
          @for (channel of channels; track channel.title) {
            <li class="fl-surface fl-surface-interactive h-full p-6">
              <ui-icon-tile [icon]="channel.icon" [tone]="channel.tone" size="lg" />
              <h2 class="mt-5 text-xl font-semibold tracking-tight">{{ channel.title }}</h2>
              <p class="mt-2 text-muted-foreground">{{ channel.body }}</p>
              <a
                [href]="'mailto:' + channel.email"
                class="mt-4 inline-flex rounded-sm font-medium text-primary underline-offset-4
                       outline-none hover:underline focus-visible:outline-[3px]
                       focus-visible:outline-offset-2 focus-visible:outline-ring"
                >{{ channel.email }}</a
              >
            </li>
          }
        </ul>

        <!-- What to include. Written because the single thing that most slows
             an answer down is a message we cannot place. -->
        <section class="fl-surface mt-10 p-6">
          <h2 class="text-xl font-semibold tracking-tight">What to tell us</h2>
          <ul class="mt-4 space-y-2">
            @for (item of whatToInclude; track item) {
              <li class="flex items-start gap-3 text-muted-foreground">
                <span
                  class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                  aria-hidden="true"
                ></span>
                <span>{{ item }}</span>
              </li>
            }
          </ul>
        </section>

        <div class="mt-10 flex flex-wrap items-center gap-3">
          <a routerLink="/help" class="inline-flex">
            <ui-button variant="secondary">Check the help page first</ui-button>
          </a>
          <a routerLink="/privacy" class="inline-flex">
            <ui-button variant="ghost">How we handle your information</ui-button>
          </a>
        </div>
      </div>
    </div>
  `,
})
export class ContactComponent {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  protected readonly channels: readonly Channel[] = [
    {
      icon: LifeBuoy as IconNode,
      tone: 'gold',
      title: 'Help with an application',
      body: 'Something is stuck, unclear, or did not work the way this site says it should.',
      email: ORGANISATION.generalEmail,
    },
    {
      icon: ShieldCheck as IconNode,
      tone: 'navy',
      title: 'Your information and POPIA',
      body: 'Access, correction, deletion, or anything you want to raise with our Information Officer.',
      email: ORGANISATION.privacyEmail,
    },
    {
      icon: HeartHandshake as IconNode,
      tone: 'success',
      title: 'Funding and partnerships',
      body: 'You want to fund students through us, or bring bursaries you administer onto the platform.',
      email: ORGANISATION.generalEmail,
    },
    {
      icon: Mail as IconNode,
      tone: 'neutral',
      title: 'Anything else',
      body: 'Press, a correction to something we have published, or a question that fits nowhere above.',
      email: ORGANISATION.generalEmail,
    },
  ];

  protected readonly whatToInclude = [
    'The email address on your account — it is how we find you without asking for anything sensitive.',
    'What you were trying to do, and what happened instead.',
    'The reference shown on any error message. It takes us straight to the exact request that failed.',
    'Never send us your password. Nobody here will ever ask you for it.',
  ];

  constructor() {
    this.title.setTitle('Contact — FundsLink Academy');
    this.meta.updateTag({
      name: 'description',
      content:
        'How to reach FundsLink Academy: help with an application, POPIA and privacy requests, funding and partnerships, and what to include so we can answer quickly.',
    });
  }
}
