/**
 * `error.code` -> what the person reading it should see and do.
 *
 * The API's `error.code` is the stable contract; `error.message` is not, and
 * branching on it is forbidden (S4.12, and the Stage 04 handoff §4.3). This
 * table is the single place those codes become human sentences, so the same
 * failure reads the same way everywhere in the product.
 *
 * Three rules hold for every entry:
 *
 * 1. **Say what to do next.** An error with no recovery path is a dead end,
 *    and a dead end in a funding application is someone giving up (P2).
 * 2. **Never blame the person.** These are students under financial pressure;
 *    "we couldn't" beats "you didn't" every time.
 * 3. **Never leak internals.** No stack traces, no raw server text, no ids.
 *    An unknown code degrades to a safe, honest sentence rather than echoing
 *    whatever the server said.
 *
 * Source of truth for the codes: docs/architecture/error-codes.md (29 codes).
 */
export interface ErrorPresentation {
  /** A short heading — plain, not alarming. */
  readonly title: string;
  /** What happened and what to do about it, in one or two sentences. */
  readonly message: string;
  /** Whether retrying the same action could plausibly succeed. */
  readonly retryable: boolean;
}

export const ERROR_PRESENTATION: Readonly<Record<string, ErrorPresentation>> = {
  // --- Session & access -----------------------------------------------------
  unauthorized: {
    title: 'Please sign in again',
    message: 'Your session has ended. Sign in and we will bring you straight back here.',
    retryable: false,
  },
  invalid_credentials: {
    title: "That didn't match",
    message: 'The email or password is incorrect. Check them and try again.',
    retryable: true,
  },
  invalid_token: {
    title: 'That link has expired',
    message: 'Links expire for your security. Request a new one and it will work straight away.',
    retryable: false,
  },
  mfa_required: {
    title: 'One more step',
    message: 'Enter the code from your authenticator app to continue.',
    retryable: false,
  },
  mfa_invalid_code: {
    title: "That code didn't work",
    message: 'Codes change every 30 seconds. Wait for the next one and enter it.',
    retryable: true,
  },
  mfa_not_enrolled: {
    title: 'Set up your authenticator first',
    message: 'This action needs two-factor authentication. Set it up in your security settings.',
    retryable: false,
  },
  forbidden: {
    title: "You don't have access to this",
    message: 'Your account cannot open this page. If that seems wrong, contact support.',
    retryable: false,
  },
  password_breached: {
    title: 'Choose a different password',
    message:
      'This password has appeared in a public data breach, so it is not safe to use. Pick another one.',
    retryable: false,
  },
  email_taken: {
    title: 'That email is already registered',
    message: 'Sign in instead, or reset your password if you have forgotten it.',
    retryable: false,
  },
  rate_limited: {
    title: 'Too many attempts',
    message: 'Give it a minute, then try again.',
    retryable: true,
  },

  // --- Profile --------------------------------------------------------------
  profile_not_found: {
    title: 'No profile yet',
    message: 'Create your profile and you can start applying.',
    retryable: false,
  },
  profile_required: {
    title: 'Finish your profile first',
    message: 'We need a few details about you before this step.',
    retryable: false,
  },
  id_number_taken: {
    title: 'That ID number is already registered',
    message:
      'An account already exists with this ID number. Sign in to it, or contact support if this is not you.',
    retryable: false,
  },
  invalid_notification_trigger: {
    title: "We couldn't save those preferences",
    message: 'Reload the page and choose them again.',
    retryable: true,
  },
  invalid_consent_purpose: {
    title: "We couldn't save that preference",
    message: 'Reload the page and set it again.',
    retryable: true,
  },
  // FastAPI's schema-validation failure. It reached students as the generic
  // "Something went wrong on our side — this wasn't you", which was wrong in
  // both directions: it blamed the system for an email the validator refuses,
  // and it offered no way forward. The cause can genuinely be either side, so
  // the copy names the form without accusing the person (rule 2).
  validation_error: {
    title: "Something in the form wasn't accepted",
    message: 'Check the details you entered — an email address is the usual one — and try again.',
    retryable: true,
  },
  sa_id_required: {
    title: 'Add your ID number to submit',
    message:
      'Funders require an ID number on every application. Add yours to your profile and submit again.',
    retryable: false,
  },

  // --- Applications ---------------------------------------------------------
  application_not_found: {
    title: "We couldn't find that application",
    message: 'It may have been removed. Go back to your applications to see the current list.',
    retryable: false,
  },
  application_already_active: {
    title: 'You already have an application this year',
    message:
      'You can have one active application per academic year. Open the existing one to continue it.',
    retryable: false,
  },
  invalid_transition: {
    title: "That step isn't available right now",
    message: 'The application has moved on since this page loaded. Reload to see where it is.',
    retryable: true,
  },
  invalid_application: {
    title: "We couldn't attach that",
    message: 'The document does not belong to this application. Try uploading it again.',
    retryable: true,
  },
  invalid_document: {
    title: "We couldn't accept that document",
    message: 'Check you picked the right document type, then upload it again.',
    retryable: true,
  },
  empty_file: {
    title: 'That file was empty',
    message: 'The file has no content. Check it opens on your device, then upload it again.',
    retryable: true,
  },
  unsupported_media_type: {
    title: "We can't read that file type",
    message: 'Upload a PDF, JPG or PNG and we will take it from there.',
    retryable: true,
  },
  payload_too_large: {
    title: "That file's a bit big",
    message: 'Try one under 5 MB — a photo taken on a phone usually needs to be reduced first.',
    retryable: true,
  },
  mfa_required_for_role: {
    title: 'Two-step sign-in stays on for this account',
    message:
      'Accounts that review applications or handle money must keep two-step sign-in. You can replace your recovery codes instead.',
    retryable: false,
  },
  already_recused: {
    title: 'You have already stepped aside',
    message: 'Another reviewer will take this application. There is nothing more to do here.',
    retryable: false,
  },
  reviewer_recused: {
    title: 'You stepped aside from this application',
    message: 'Because you declared a conflict of interest, another reviewer must decide it.',
    retryable: false,
  },
  appeal_exists: {
    title: 'You have already appealed this',
    message: 'One appeal per decision. Open your application to see how it is going.',
    retryable: false,
  },
  two_person_rule: {
    title: 'A second person has to authorise this',
    message:
      'You proposed this decision, so someone else signs it off. That is how every funding decision is made here.',
    retryable: false,
  },
  appeal_reviewer_conflict: {
    title: 'This appeal needs a different reviewer',
    message:
      'You made the original decision, so someone else hears the appeal against it. It stays in the queue for them.',
    retryable: false,
  },
  human_final_required: {
    title: 'This decision needs a person',
    message:
      'Final decisions are always made by a member of our team, never automatically. Someone will review it.',
    retryable: false,
  },

  // --- Matching & tracking --------------------------------------------------
  bursary_not_found: {
    title: "We couldn't find that bursary",
    message: 'It may have closed. Browse the current list to find others you can apply to.',
    retryable: false,
  },
  already_tracked: {
    title: 'That one is already on your tracker',
    message: 'Open your tracked applications to see it.',
    retryable: false,
  },
  tracked_not_found: {
    title: "We couldn't find that tracked application",
    message: 'It may have been removed. Go back to your tracker for the current list.',
    retryable: false,
  },
};

/**
 * The fallback. Deliberately vague about the cause and specific about the
 * remedy — an unknown code means we do not know what happened, and inventing
 * a cause would be a lie told to someone who is already anxious.
 */
export const UNKNOWN_ERROR: ErrorPresentation = {
  title: 'Something went wrong on our side',
  message: "This wasn't you. Try again in a moment — if it keeps happening, contact support.",
  retryable: true,
};

export function presentError(code: string | null | undefined): ErrorPresentation {
  if (!code) {
    return UNKNOWN_ERROR;
  }
  return ERROR_PRESENTATION[code] ?? UNKNOWN_ERROR;
}
