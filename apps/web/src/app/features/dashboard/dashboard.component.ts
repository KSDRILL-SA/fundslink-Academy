import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  ArrowRight,
  FilePlus2,
  FileText,
  LayoutGrid,
  Search,
  Send,
  Sparkles,
  UserRound,
} from 'lucide';
import {
  UiButtonComponent,
  UiCardComponent,
  UiEmptyStateComponent,
  UiErrorStateComponent,
  UiIconComponent,
  UiIconTileComponent,
  UiProgressRingComponent,
  UiSkeletonComponent,
  UiStatusChipComponent,
  type IconNode,
} from 'ui';
import { ApplicationsStore } from './applications.store';
import { ProfileStore } from '../profile/profile.store';

/** A quick action: one destination, one reason to go there. */
interface QuickAction {
  readonly label: string;
  readonly hint: string;
  readonly route: string;
  readonly icon: IconNode;
  readonly tone: 'gold' | 'navy' | 'success' | 'neutral';
}

/**
 * S08 — Dashboard. The student's home.
 *
 * One question answered above everything else: **what is happening with my
 * application, and what should I do next.** Everything on this screen serves
 * that, which is why there is no activity feed and no vanity statistics.
 *
 * The banner is the only place on the platform that uses the full navy-and-gold
 * atmosphere, and it earns it: this is the screen a student opens over and over
 * while waiting, often on a cheap phone, often anxious. It should feel like an
 * institution that has them, and the one figure it shows — how far along they
 * are — is derived from what has actually loaded, never decoration.
 *
 * The empty state carries the most weight here. A student arriving with no
 * application must leave knowing how to start one — §4 is explicit that an
 * empty state teaches the next screen, and this is the moment where someone
 * unsure whether they belong here decides whether to continue (P2).
 *
 * Loading is a skeleton shaped like the card it replaces, so the page does not
 * jump when content lands (§4: skeletons, not spinners).
 */
@Component({
  selector: 'fl-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiCardComponent,
    UiButtonComponent,
    UiIconComponent,
    UiIconTileComponent,
    UiProgressRingComponent,
    UiStatusChipComponent,
    UiSkeletonComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
  ],
  template: `
    <!-- ---------- Welcome banner ---------- -->
    <section
      class="fl-mesh fl-on-dark fl-glow-navy relative overflow-hidden rounded-2xl px-6 py-8 sm:px-10 sm:py-10"
      aria-labelledby="welcome-heading"
    >
      <!-- The Rising Door, doing structural work behind the greeting rather
           than sitting in a logo slot. Decorative, so it is hidden. -->
      <span
        class="fl-arch-motif -right-16 -top-24 h-72 w-72 sm:right-4"
        aria-hidden="true"
      ></span>
      <span class="fl-grid-bg absolute inset-0" aria-hidden="true"></span>

      <div class="relative flex flex-wrap items-center justify-between gap-8">
        <div class="min-w-0 max-w-xl">
          <span class="fl-eyebrow text-[hsl(43_96%_78%)]">
            <ui-icon [name]="icons.sparkle" size="sm" />
            Trusted Institution, humanised
          </span>

          <h1 id="welcome-heading" class="fl-display mt-4 text-3xl sm:text-4xl">
            {{ greeting() }}
          </h1>
          <p class="mt-3 text-base text-muted-foreground">
            Here is where your funding stands. Nothing here is decided by a machine — a person
            makes every decision about your application.
          </p>

          <div class="mt-6 flex flex-wrap items-center gap-3">
            <a routerLink="/app/applications/new" class="inline-flex">
              <ui-button variant="accent">
                {{ hasApplication() ? 'Continue my application' : 'Start my application' }}
              </ui-button>
            </a>
            <a routerLink="/app/bursaries" class="inline-flex">
              <ui-button variant="secondary">Browse bursaries</ui-button>
            </a>
          </div>
        </div>

        <!-- The journey ring. Only rendered once both requests have settled:
             a ring showing 0 of 4 while the data is still in flight would be
             a number the student has no reason to trust. -->
        @if (journeyReady()) {
          <div class="flex items-center gap-4">
            <ui-progress-ring
              [value]="stepsDone()"
              [max]="4"
              [label]="'Your journey: ' + stepsDone() + ' of 4 steps done'"
              caption="steps done"
            />
            <ul class="space-y-1.5 text-sm text-muted-foreground">
              @for (step of journey(); track step.label) {
                <li class="flex items-center gap-2">
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    [class]="step.done ? 'bg-accent' : 'bg-border'"
                    aria-hidden="true"
                  ></span>
                  <!-- "done" in words, never the gold dot alone (P3). -->
                  <span [class]="step.done ? 'font-medium text-foreground' : ''">
                    {{ step.label }}{{ step.done ? ' — done' : '' }}
                  </span>
                </li>
              }
            </ul>
          </div>
        }
      </div>
    </section>

    <!-- ---------- Quick actions ---------- -->
    <section class="mt-8" aria-labelledby="actions-heading">
      <h2 id="actions-heading" class="sr-only">Quick actions</h2>
      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        @for (action of quickActions; track action.route) {
          <li>
            <a [routerLink]="action.route" class="group block rounded-2xl outline-none">
              <ui-card variant="interactive" padding="sm" class="h-full">
                <div class="flex h-full items-center gap-3">
                  <ui-icon-tile [icon]="action.icon" [tone]="action.tone" />
                  <span class="min-w-0 flex-1">
                    <span class="block font-medium">{{ action.label }}</span>
                    <span class="block text-sm text-muted-foreground">{{ action.hint }}</span>
                  </span>
                  <ui-icon
                    [name]="icons.arrow"
                    size="sm"
                    class="shrink-0 text-muted-foreground"
                  />
                </div>
              </ui-card>
            </a>
          </li>
        }
      </ul>
    </section>

    <!-- ---------- Your application ---------- -->
    <section class="mt-8" aria-labelledby="application-heading">
      <h2 id="application-heading" class="text-lg font-semibold">Your application</h2>

      @switch (applications.state().status) {
        @case ('loading') {
          <ui-card class="mt-4">
            <div class="flex flex-col gap-3">
              <ui-skeleton class="h-4 w-24" />
              <ui-skeleton class="h-6 w-64" />
              <ui-skeleton class="h-4 w-full" />
            </div>
          </ui-card>
          <p class="sr-only" role="status">Loading your application.</p>
        }

        @case ('error') {
          <ui-card class="mt-4">
            <ui-error-state
              [code]="applications.state().errorCode"
              (retry)="applications.load()"
            />
            @if (applications.state().requestId; as id) {
              <!-- The one thing support will ask for. Selectable, and stated
                   plainly rather than buried in a console. -->
              <p class="mt-4 text-center text-sm text-muted-foreground">
                Reference for support: <span class="font-mono">{{ id }}</span>
              </p>
            }
          </ui-card>
        }

        @case ('empty') {
          <ui-card class="mt-4">
            <ui-empty-state
              title="You have not applied yet"
              message="Applying is free and takes a few minutes. You can save and come back — nothing is lost."
              [icon]="icons.apply"
              actionLabel="Start my application"
              (action)="startApplication()"
            />
          </ui-card>
        }

        @case ('success') {
          @if (applications.current(); as application) {
            <ui-card variant="highlight" padding="lg" class="mt-4">
              <div class="flex flex-wrap items-start justify-between gap-6">
                <div class="flex min-w-0 gap-4">
                  <ui-icon-tile [icon]="icons.application" tone="gold" size="lg" />
                  <div class="min-w-0">
                    <ui-status-chip [status]="application.status" />
                    <h3 class="mt-3 text-xl font-semibold tracking-tight">
                      Your funding application
                    </h3>
                    <p class="mt-2 max-w-prose text-muted-foreground">
                      {{ nextStep(application.status) }}
                    </p>
                  </div>
                </div>

                <a [routerLink]="['/app/applications', application.id]" class="inline-flex">
                  <ui-button variant="secondary">View application</ui-button>
                </a>
              </div>
            </ui-card>
          }
        }
      }
    </section>

    <!-- ---------- Your profile ---------- -->
    <section class="mt-8" aria-labelledby="profile-heading">
      <h2 id="profile-heading" class="text-lg font-semibold">Your profile</h2>

      @switch (profile.state().status) {
        @case ('loading') {
          <ui-card class="mt-4">
            <ui-skeleton class="h-4 w-48" />
          </ui-card>
        }

        @case ('empty') {
          <ui-card class="mt-4">
            <ui-empty-state
              title="Tell us about you, once"
              message="Your studies and your situation, filled in a single time. You will not retype it for every bursary."
              [icon]="icons.profile"
              actionLabel="Create my profile"
              (action)="editProfile()"
            />
          </ui-card>
        }

        @case ('error') {
          <ui-card class="mt-4">
            <ui-error-state [code]="profile.state().errorCode" (retry)="profile.load()" />
          </ui-card>
        }

        @case ('success') {
          @if (profile.profile(); as student) {
            <ui-card class="mt-4">
              <div class="flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-center gap-4">
                  <ui-icon-tile [icon]="icons.profile" tone="navy" />
                  <div>
                    <p class="font-medium">{{ student.first_name }} {{ student.last_name }}</p>
                    <p class="mt-1 text-sm text-muted-foreground">
                      {{ student.field_of_study }} · {{ levelLabel(student.level) }}
                    </p>
                  </div>
                </div>
                <a routerLink="/app/profile" class="inline-flex">
                  <ui-button variant="ghost">Edit profile</ui-button>
                </a>
              </div>
            </ui-card>
          }
        }
      }
    </section>
  `,
})
export class DashboardComponent {
  private readonly router = inject(Router);
  protected readonly applications = inject(ApplicationsStore);
  protected readonly profile = inject(ProfileStore);

  protected readonly icons = {
    apply: FilePlus2 as IconNode,
    profile: UserRound as IconNode,
    application: FileText as IconNode,
    arrow: ArrowRight as IconNode,
    sparkle: Sparkles as IconNode,
  };

  protected readonly quickActions: readonly QuickAction[] = [
    {
      label: 'My application',
      hint: 'Open where you left off',
      route: '/app/applications',
      icon: FileText as IconNode,
      tone: 'gold',
    },
    {
      label: 'Browse bursaries',
      hint: 'Funding you can apply for',
      route: '/app/bursaries',
      icon: Search as IconNode,
      tone: 'navy',
    },
    {
      label: 'Matches for you',
      hint: 'Based on your profile',
      route: '/app/matches',
      icon: LayoutGrid as IconNode,
      tone: 'success',
    },
    {
      label: 'Tracking board',
      hint: 'Everything you applied to',
      route: '/app/tracking',
      icon: Send as IconNode,
      tone: 'neutral',
    },
  ];

  protected readonly greeting = computed(() => {
    const name = this.profile.profile()?.first_name;
    // No name yet is the normal first visit, so the greeting must read
    // naturally without one rather than saying "Welcome, undefined".
    return name ? `Welcome back, ${name}` : 'Welcome';
  });

  protected readonly hasApplication = computed(() => this.applications.current() !== null);

  /** Both requests have settled, whichever way they went. */
  protected readonly journeyReady = computed(
    () =>
      this.applications.state().status !== 'loading' &&
      this.profile.state().status !== 'loading',
  );

  /**
   * The four steps of the journey, each derived from data already on screen.
   *
   * Nothing here re-implements a server rule: "submitted" means the server is
   * no longer calling it a draft, and "decided" means the server has moved it
   * to a terminal status. An unrecognised status counts as neither, so a new
   * backend status can never make this claim something untrue about a student.
   */
  protected readonly journey = computed(() => {
    const application = this.applications.current();
    const status = application?.status ?? '';
    return [
      { label: 'Profile created', done: this.profile.profile() !== null },
      { label: 'Application started', done: application !== null },
      { label: 'Submitted for review', done: application !== null && status !== 'DRAFT' },
      { label: 'Decision made', done: DECIDED.has(status) },
    ];
  });

  protected readonly stepsDone = computed(
    () => this.journey().filter((step) => step.done).length,
  );

  constructor() {
    this.applications.load();
    this.profile.load();
  }

  /**
   * What the student should do or expect next.
   *
   * Presentation only — the server owns the lifecycle. An unrecognised status
   * falls back to a true, unalarming sentence rather than a blank space,
   * because the backend can add a status before this bundle is redeployed.
   */
  protected nextStep(status: string): string {
    switch (status) {
      case 'DRAFT':
        return 'Your application is saved as a draft. Pick up where you left off whenever you are ready.';
      case 'SUBMITTED':
      case 'PRE_SCREENING':
        return 'We are checking that everything we need is here. This step cannot approve or decline you — only a person can do that.';
      case 'RETURNED_FOR_INFO':
        return 'A few small things need your attention before this goes back in the queue.';
      case 'READY_FOR_REVIEW':
      case 'UNDER_REVIEW':
        return 'Your application is with a reviewer. We will let you know as soon as there is a decision.';
      case 'APPROVED':
        return 'Your funding was approved. Open your application for the details.';
      default:
        return 'Open your application to see where it stands.';
    }
  }

  protected levelLabel(level: string): string {
    const labels: Record<string, string> = {
      UG: 'Undergraduate',
      HONOURS: 'Honours',
      MASTERS: "Master's",
      PHD: 'PhD',
      PGDIP: 'Postgraduate diploma',
    };
    return labels[level] ?? level;
  }

  protected startApplication(): void {
    void this.router.navigateByUrl('/app/applications/new');
  }

  protected editProfile(): void {
    void this.router.navigateByUrl('/app/profile');
  }
}

/** Terminal statuses — a person has ruled, one way or the other. */
const DECIDED = new Set(['APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED']);
