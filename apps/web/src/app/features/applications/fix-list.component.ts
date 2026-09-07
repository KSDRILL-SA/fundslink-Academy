import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiError, ApiService, type Schema } from 'data-access';
import { CircleCheck, Info } from 'lucide';
import {
  UiButtonComponent,
  UiCardComponent,
  UiIconComponent,
  presentError,
  type IconNode,
} from 'ui';

type Application = Schema<'Application'>;

/**
 * S15 — Returned for information: the fix list. The P4 flagship.
 *
 * This screen decides whether being asked for more feels like help or like
 * failure, and the design is unusually specific about it because the
 * difference is the difference between a student finishing and a student
 * giving up.
 *
 * **A return is not a rejection.** The colour language is amber and
 * informational, entirely separate from decline — never red, never error
 * iconography, and the word "rejected" appears nowhere. Those are not style
 * preferences; they are the screen's whole purpose, and tests enforce them.
 *
 * The header counts the work and says it is small: "Almost there — 3 small
 * things and you're back in the queue." Each item says what is needed AND why,
 * because "proof of registration" is a demand and "so the university can
 * confirm you are enrolled this year" is a reason — and people do things for
 * reasons.
 *
 * At the third cycle the tone changes rather than repeating: if someone has
 * been round this loop three times, the form is not working for them and a
 * person should call (BR-E04).
 */
@Component({
  selector: 'fl-fix-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiCardComponent, UiButtonComponent, UiIconComponent],
  template: `
    <div class="flex items-start gap-3">
      <span class="mt-1 text-warning">
        <ui-icon [name]="infoIcon" size="lg" />
      </span>
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          Almost there — {{ itemCount() }} {{ itemCount() === 1 ? 'small thing' : 'small things' }}
          and you're back in the queue.
        </h1>
        <p class="mt-2 max-w-prose text-muted-foreground">
          Nothing is wrong with your application. We just need a little more before a reviewer can
          look at it properly.
        </p>
      </div>
    </div>

    <ui-card class="mt-8 max-w-2xl" variant="highlight">
      <ul class="flex flex-col gap-6">
        @for (item of items(); track item; let i = $index) {
          <li class="flex items-start gap-3">
            <input
              type="checkbox"
              [id]="'fix-' + i"
              class="mt-1 h-5 w-5 shrink-0 rounded-sm border-input outline-none
                     [accent-color:hsl(var(--accent))]
                     focus-visible:outline-[3px] focus-visible:outline-offset-2
                     focus-visible:outline-ring"
              [checked]="done().has(i)"
              (change)="toggle(i)"
            />
            <label [for]="'fix-' + i" class="min-w-0">
              <span class="font-medium">{{ item }}</span>
              <span class="mt-1 block text-sm text-muted-foreground">{{ reasonFor(item) }}</span>
            </label>
          </li>
        }
      </ul>

      <div class="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <a [routerLink]="['/app/applications', application().id, 'documents']" class="inline-flex">
          <ui-button variant="secondary">Add a document</ui-button>
        </a>

        <ui-button
          variant="accent"
          [disabled]="!allDone()"
          [loading]="submitting()"
          (clicked)="resubmit()"
        >
          Send it back
        </ui-button>

        @if (!allDone()) {
          <p class="text-sm text-muted-foreground">
            Tick each one as you sort it, then send it back.
          </p>
        }
      </div>

      @if (failure(); as problem) {
        <div role="alert" class="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-4">
          <p class="font-medium text-foreground">{{ problem.title }}</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ problem.message }}</p>
        </div>
      }
    </ui-card>

    @if (needsOutreach()) {
      <!-- Third time round. The form is not working for this person, and
           repeating the same list a fourth time would be the platform failing
           them quietly (BR-E04). -->
      <ui-card class="mt-6 max-w-2xl">
        <h2 class="text-lg font-semibold">Struggling with these?</h2>
        <p class="mt-2 max-w-prose text-muted-foreground">
          This is the third time we have asked, which usually means our form is the problem and not
          you. Leave your number and we will call and sort it out together.
        </p>
        <a routerLink="/app/notifications" class="mt-4 inline-flex">
          <ui-button variant="secondary">Ask us to call</ui-button>
        </a>
      </ui-card>
    }
  `,
})
export class FixListComponent {
  private readonly api = inject(ApiService);

  readonly application = input.required<Application>();
  readonly resubmitted = output<void>();

  protected readonly infoIcon = Info as IconNode;
  protected readonly checkIcon = CircleCheck as IconNode;

  protected readonly done = signal(new Set<number>());
  protected readonly submitting = signal(false);
  private readonly errorCode = signal<string | null>(null);

  protected readonly items = computed(() => this.application().pre_screen?.fix_list ?? []);
  protected readonly itemCount = computed(() => this.items().length);
  protected readonly allDone = computed(
    () => this.itemCount() > 0 && this.done().size === this.itemCount(),
  );
  /** Cycle 3 or beyond (BR-E04). */
  protected readonly needsOutreach = computed(
    () => (this.application().pre_screen?.cycle_no ?? 1) >= 3,
  );
  protected readonly failure = computed(() => {
    const code = this.errorCode();
    return code ? presentError(code) : null;
  });

  protected toggle(index: number): void {
    this.done.update((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  /**
   * Why we need it, in one sentence.
   *
   * "Proof of registration" is a demand; "so the university can confirm you
   * are enrolled this year" is a reason, and people do things for reasons.
   * The server supplies the fix-list lines; this adds the why where it can
   * recognise one, and stays quiet rather than guessing where it cannot.
   */
  protected reasonFor(item: string): string {
    const text = item.toLowerCase();
    if (text.includes('registration')) {
      return 'So we can confirm with your institution that you are enrolled this year.';
    }
    if (text.includes('id')) {
      return 'Funders require an ID number on every application they receive.';
    }
    if (text.includes('transcript') || text.includes('academic')) {
      return 'Reviewers use it to understand your progress, not to judge a single result.';
    }
    if (text.includes('fee') || text.includes('statement')) {
      return 'It tells us the exact amount outstanding, so we ask for the right amount.';
    }
    if (text.includes('income') || text.includes('payslip')) {
      return 'It gives the reviewer context. It is not a threshold you have to clear.';
    }
    if (text.includes('expired')) {
      return 'The one on file has passed its date, so a current copy is needed.';
    }
    if (text.includes('nsfas') || text.includes('outcome')) {
      return 'The reason on the letter tells us which kind of gap you fell through.';
    }
    return '';
  }

  protected resubmit(): void {
    if (!this.allDone()) {
      return;
    }
    this.submitting.set(true);
    this.errorCode.set(null);

    this.api
      .post<Application>('/applications/{id}/resubmit', undefined, {
        path: { id: this.application().id },
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.resubmitted.emit();
        },
        error: (error: unknown) => {
          this.errorCode.set(error instanceof ApiError ? error.code : null);
          this.submitting.set(false);
        },
      });
  }
}
