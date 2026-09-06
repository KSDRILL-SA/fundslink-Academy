import {
  CircleCheck,
  CircleCheckBig,
  CircleDashed,
  CircleX,
  Clock,
  FileText,
  Hourglass,
  Info,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Users,
} from 'lucide';
import type { BadgeTone } from './ui-badge.component';
import type { IconNode } from '../icon/ui-icon.component';

/**
 * How a status LOOKS. Not what it means, and not what may follow it.
 *
 * The backend owns the lifecycle: which transitions are legal, what a status
 * implies, who may cause one (S4.12 — no business logic in components). This
 * table only decides the words, the tone and the icon a student sees, which is
 * a presentation concern and belongs here rather than being re-derived in
 * every screen that renders a status.
 *
 * The status keys are the values the API actually emits, taken from the
 * application state machine and the 0002 seeds — not invented.
 */
export interface StatusPresentation {
  readonly label: string;
  readonly tone: BadgeTone;
  readonly icon: IconNode;
}

/**
 * Two rules in this table are product law, not taste, and must not be
 * "tidied up" by a later engineer:
 *
 * 1. **Amber, never red, for RETURNED_FOR_INFO** — and the label says what to
 *    do, not what went wrong. A returned application is the platform asking
 *    for help, not a failure (P4, and the amber-never-red rule on S15).
 *
 * 2. **A declined outcome is never `danger`** and never uses the word
 *    "rejected". A harsh red badge saying REJECTED on a student who did not
 *    get funding turns a funding decision into a verdict on them. Neutral tone,
 *    honest words, door left open (§6 — "never harsh red on the student";
 *    "rejected" is a forbidden word on the decision screen).
 */
export const APPLICATION_STATUS_PRESENTATION: Readonly<Record<string, StatusPresentation>> = {
  DRAFT: { label: 'Draft', tone: 'neutral', icon: FileText as IconNode },
  SUBMITTED: { label: 'Submitted', tone: 'info', icon: Clock as IconNode },
  PRE_SCREENING: { label: 'Checking your details', tone: 'info', icon: Search as IconNode },
  UNSCREENED: { label: 'Awaiting screening', tone: 'neutral', icon: CircleDashed as IconNode },
  READY_FOR_REVIEW: { label: 'Ready for review', tone: 'info', icon: Hourglass as IconNode },
  UNDER_REVIEW: { label: 'Under review', tone: 'info', icon: Search as IconNode },

  // Amber. Help, not failure.
  RETURNED_FOR_INFO: {
    label: 'Needs more information',
    tone: 'warning',
    icon: Info as IconNode,
  },
  RESUBMITTED: { label: 'Resubmitted', tone: 'info', icon: RefreshCw as IconNode },

  INTERVIEW_SCHEDULED: { label: 'Interview scheduled', tone: 'accent', icon: Clock as IconNode },
  INTERVIEWED: { label: 'Interviewed', tone: 'info', icon: CircleCheck as IconNode },

  APPROVED_PROPOSED: {
    label: 'Approval proposed',
    tone: 'accent',
    icon: CircleCheck as IconNode,
  },
  APPROVED: { label: 'Approved', tone: 'success', icon: CircleCheckBig as IconNode },
  APPROVED_WAITLISTED: { label: 'Waitlisted', tone: 'accent', icon: Hourglass as IconNode },

  // Neutral, never danger. No use of the word "rejected".
  REJECTED: { label: 'Not funded this time', tone: 'neutral', icon: CircleDashed as IconNode },
  REJECTED_FINAL: { label: 'Not funded', tone: 'neutral', icon: CircleDashed as IconNode },

  APPEALED: { label: 'Appeal submitted', tone: 'info', icon: MessageSquare as IconNode },
  WITHDRAWN: { label: 'Withdrawn', tone: 'neutral', icon: CircleX as IconNode },
};

/**
 * Where a tracked status came from (P3 freshness label, MASTER-SPEC §12.4).
 * The API enumerates exactly these three in `status_source`.
 */
export const STATUS_SOURCE_PRESENTATION: Readonly<Record<string, StatusPresentation>> = {
  SELF_REPORT: { label: 'You reported', tone: 'outline', icon: MessageSquare as IconNode },
  EMAIL_CAPTURE: { label: 'From email', tone: 'outline', icon: Mail as IconNode },
  PARTNER_API: { label: 'From partner', tone: 'outline', icon: Users as IconNode },
};

/**
 * Shown when the API sends a status this build has not seen.
 *
 * The backend can add a status without the frontend being redeployed, and a
 * student must never see a crash or a blank chip because of it. Degrading to a
 * readable, neutral chip is the only acceptable failure here — it says
 * something true and unalarming rather than nothing at all.
 */
export function presentStatus(
  status: string | null | undefined,
  table: Readonly<Record<string, StatusPresentation>> = APPLICATION_STATUS_PRESENTATION,
): StatusPresentation {
  if (!status) {
    return { label: 'Unknown', tone: 'neutral', icon: CircleDashed as IconNode };
  }
  return (
    table[status] ?? {
      label: humanise(status),
      tone: 'neutral',
      icon: CircleDashed as IconNode,
    }
  );
}

/** `READY_FOR_REVIEW` -> `Ready for review`. A fallback, never a substitute for the table. */
export function humanise(status: string): string {
  const words = status.toLowerCase().replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
