import {
  Bell,
  FileText,
  FolderUp,
  KeyRound,
  LayoutGrid,
  LogIn,
  LogOut,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Download,
  MailCheck,
} from 'lucide';
import { APPLICATION_STATUS_PRESENTATION, humanise, presentStatus, type IconNode } from 'ui';

/**
 * The words for an account-activity entry. Words only.
 *
 * WHAT happened, WHEN and WHO did it all come from the server (`listMyActivity`), which also
 * decides which audit actions a student is shown at all. This table only turns a stable event code
 * into a sentence a student reads — the same split as the status chips (S4.12: no business logic
 * in components).
 *
 * An event this build has never seen still renders: the server can add one before the web app is
 * redeployed, and a timeline with a blank row is worse than one with a plain fallback.
 */
export interface ActivityEntry {
  readonly event: string;
  readonly actor: string;
  readonly to_status?: string | null;
  readonly label?: string | null;
}

interface Wording {
  readonly text: string;
  readonly icon: IconNode;
}

const AUDIT_WORDING: Readonly<Record<string, Wording>> = {
  AUTH_LOGIN_SUCCESS: { text: 'You signed in', icon: LogIn as IconNode },
  AUTH_LOGOUT: { text: 'You signed out', icon: LogOut as IconNode },
  AUTH_PASSWORD_CHANGED: { text: 'You changed your password', icon: KeyRound as IconNode },
  AUTH_PASSWORD_RESET: { text: 'Your password was reset', icon: KeyRound as IconNode },
  AUTH_MFA_ACTIVATED: { text: 'You turned on two-step verification', icon: ShieldCheck as IconNode },
  AUTH_MFA_DISABLED: { text: 'You turned off two-step verification', icon: ShieldAlert as IconNode },
  AUTH_MFA_RECOVERY_REGENERATED: {
    text: 'You replaced your recovery codes',
    icon: KeyRound as IconNode,
  },
  AUTH_EMAIL_VERIFIED: { text: 'You confirmed your email address', icon: MailCheck as IconNode },
  // A refresh token was replayed: the platform ended every session to protect the account.
  AUTH_TOKEN_REUSE_DETECTED: {
    text: 'We signed you out everywhere to keep your account safe',
    icon: ShieldAlert as IconNode,
  },
  AUTH_REGISTER: { text: 'You created your account', icon: UserRound as IconNode },
  PROFILE_CREATED: { text: 'You set up your profile', icon: UserRound as IconNode },
  PROFILE_UPDATED: { text: 'You updated your profile', icon: UserRound as IconNode },
  NOTIFICATION_PREFERENCES_UPDATED: {
    text: 'You changed how we contact you',
    icon: Bell as IconNode,
  },
  DATA_EXPORTED: { text: 'You downloaded a copy of your data', icon: Download as IconNode },
  DOCUMENT_UPLOADED: { text: 'You uploaded a document', icon: FolderUp as IconNode },
  APPLICATION_CREATED: { text: 'You started a funding application', icon: FileText as IconNode },
  MATCHING_RUN: { text: 'You looked for bursaries that match you', icon: LayoutGrid as IconNode },
};

/** What a student reported, or we captured, about a bursary they track (lk_tracked_status). */
const TRACKED_STATUS_WORDS: Readonly<Record<string, string>> = {
  REGISTERED: 'added to your tracking board',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'being reviewed',
  SHORTLISTED: 'shortlisted',
  INTERVIEW: 'interview',
  APPROVED: 'approved',
  REJECTED: 'not funded',
  NO_RESPONSE: 'no response',
  WITHDRAWN: 'withdrawn',
};

export function describeActivity(entry: ActivityEntry): Wording {
  if (entry.event === 'APPLICATION_STATUS_CHANGED') {
    const status = presentStatus(entry.to_status, APPLICATION_STATUS_PRESENTATION);
    return { text: `Your application: ${status.label}`, icon: status.icon };
  }
  if (entry.event === 'TRACKER_STATUS_CHANGED') {
    const words = entry.to_status
      ? (TRACKED_STATUS_WORDS[entry.to_status] ?? humanise(entry.to_status).toLowerCase())
      : 'updated';
    return { text: `${entry.label ?? 'A bursary you track'}: ${words}`, icon: Send as IconNode };
  }
  return AUDIT_WORDING[entry.event] ?? { text: humanise(entry.event), icon: FileText as IconNode };
}

/** "by you" / "by FundsLink" — never a reviewer's name; the server does not send one. */
export function describeActor(actor: string): string {
  return actor === 'YOU' ? 'By you' : 'By FundsLink';
}
