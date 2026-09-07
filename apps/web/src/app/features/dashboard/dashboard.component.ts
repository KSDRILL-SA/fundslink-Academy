import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FilePlus2, UserRound } from 'lucide';
import {
  UiButtonComponent,
  UiCardComponent,
  UiEmptyStateComponent,
  UiErrorStateComponent,
  UiSkeletonComponent,
  UiStatusChipComponent,
  type IconNode,
} from 'ui';
import { ApplicationsStore } from './applications.store';
import { ProfileStore } from '../profile/profile.store';

/**
 * S08 — Dashboard. The student's home.
 *
 * One question answered above everything else: **what is happening with my
 * application, and what should I do next.** Everything on this screen serves
 * that, which is why there is no activity feed and no statistics.
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
    UiStatusChipComponent,
    UiSkeletonComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
  ],
  template: `
    <h1 class="text-2xl font-semibold tracking-tight">
      {{ greeting() }}
    </h1>
    <p class="mt-1 text-muted-foreground">Here is where your funding stands.</p>

    <!-- ---------- Your application ---------- -->
    <section class="mt-8" aria-labelledby="application-heading">
      <h2 id="application-heading" class="sr-only">Your application</h2>

      @switch (applications.state().status) {
        @case ('loading') {
          <ui-card>
            <div class="flex flex-col gap-3">
              <ui-skeleton class="h-4 w-24" />
              <ui-skeleton class="h-6 w-64" />
              <ui-skeleton class="h-4 w-full" />
            </div>
          </ui-card>
          <p class="sr-only" role="status">Loading your application.</p>
        }

        @case ('error') {
          <ui-card>
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
          <ui-card>
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
            <ui-card>
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0">
                  <ui-status-chip [status]="application.status" />
                  <h3 class="mt-3 text-xl font-semibold">Your funding application</h3>
                  <p class="mt-2 text-muted-foreground">{{ nextStep(application.status) }}</p>
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
                <div>
                  <p class="font-medium">{{ student.first_name }} {{ student.last_name }}</p>
                  <p class="mt-1 text-sm text-muted-foreground">
                    {{ student.field_of_study }} · {{ levelLabel(student.level) }}
                  </p>
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
  };

  protected readonly greeting = computed(() => {
    const name = this.profile.profile()?.first_name;
    // No name yet is the normal first visit, so the greeting must read
    // naturally without one rather than saying "Welcome, undefined".
    return name ? `Welcome back, ${name}` : 'Welcome';
  });

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
