import {
  HttpErrorResponse,
  HttpResponse,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import {
  inject,
  provideAppInitializer,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import { AuthTokenService } from 'auth';
import { of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';

/**
 * Preview mode — a browsable FundsLink, with no backend running.
 *
 * Why this exists: the API is FastAPI + PostgreSQL, and neither runs on every
 * machine that needs to LOOK at this product — a review, a design pass, a
 * demonstration to a funder. Without it, every screen past the login form is a
 * network error and the frontend cannot be judged at all.
 *
 * Three rules keep it honest:
 *
 *   1. **It never ships.** This file is swapped in by `fileReplacements` on the
 *      development configuration only (angular.json); the production build
 *      compiles `preview-api.ts`, which is empty. Not a runtime flag — the
 *      code is simply not in the bundle (preview-api.spec.ts gates both).
 *   2. **It answers only from the contract.** Every shape below is a schema in
 *      packages/contracts/openapi.yaml. If a response here would need a field
 *      the contract does not have, that is a contract gap to raise, not a field
 *      to invent (S2.7 — the same rule the real client obeys).
 *   3. **It behaves like a network.** Responses are delayed, so skeletons and
 *      loading states are actually seen rather than skipped past, and an
 *      unknown route fails with the contract's error envelope instead of
 *      silently returning nothing.
 *
 * The fixtures describe a fictional student. That is the point of a preview:
 * no real person's application is ever rendered here.
 */

/** Enough latency that a skeleton is visible; short enough to browse briskly. */
const LATENCY_MS = 220;

const PROFILE = {
  id: 'stu_preview',
  first_name: 'Thandi',
  last_name: 'Mokoena',
  level: 'HONOURS',
  field_of_study: 'BCom Accounting',
  phone: '0821234567',
  verification_level: 'SILVER',
  created_at: '2026-02-03T08:14:00Z',
};

const APPLICATION = {
  id: 'app_preview_1',
  status: 'UNDER_REVIEW',
  application_type: 'POSTGRAD',
  academic_year: '2026',
  requested_amount: '48500.00',
  created_at: '2026-02-10T09:00:00Z',
  // The server's config-driven review date (D-002). Present only while the application waits on
  // FundsLink, exactly as the real API sends it.
  review_due_at: '2026-02-24T09:00:00Z',
  sla_breached: false,
};

const BURSARIES = [
  {
    id: 'bur_1',
    name: 'Sasol Postgraduate Bursary',
    provider: 'Sasol Foundation',
    status: 'OPEN',
    level_eligibility: ['HONOURS', 'MASTERS'],
    field_tags: ['Commerce', 'Engineering'],
    next_deadline: '2026-11-30',
  },
  {
    id: 'bur_2',
    name: 'Allan Gray Orbis Fellowship',
    provider: 'Allan Gray Orbis Foundation',
    status: 'OPEN',
    level_eligibility: ['UG'],
    field_tags: ['Commerce'],
    next_deadline: '2026-10-15',
  },
  {
    id: 'bur_3',
    name: 'NRF Honours Scholarship',
    provider: 'National Research Foundation',
    status: 'CLOSING_SOON',
    level_eligibility: ['HONOURS'],
    field_tags: ['Science'],
    next_deadline: '2026-09-30',
  },
];

const MATCHES = [
  {
    id: 'mat_1',
    bursary: BURSARIES[0],
    score: 0.91,
    mode: 'LIVE',
    reasoning_summary: 'Your field and level match, and the closing date is still open.',
    created_at: '2026-02-19T06:00:00Z',
  },
  {
    id: 'mat_2',
    bursary: BURSARIES[2],
    score: 0.78,
    mode: 'LIVE',
    reasoning_summary: 'Same level of study; the field is adjacent to yours.',
    created_at: '2026-02-19T06:00:00Z',
  },
];

const NOTIFICATIONS = [
  {
    id: 'ntf_1',
    trigger: 'APPLICATION_SUBMITTED',
    channels: ['EMAIL', 'IN_APP'],
    state: 'SENT',
    created_at: '2026-02-10T09:02:00Z',
  },
  {
    id: 'ntf_2',
    trigger: 'APPLICATION_STATUS_CHANGED',
    channels: ['EMAIL', 'IN_APP'],
    state: 'SENT',
    created_at: '2026-02-18T14:20:00Z',
  },
];

const TRACKED = [
  {
    id: 'trk_1',
    bursary: BURSARIES[1],
    status: 'SUBMITTED',
    status_source: 'SELF_REPORT',
    // Long enough ago to exercise the "gone quiet" promise (§12.5).
    last_activity_at: new Date(Date.now() - 28 * 86_400_000).toISOString(),
  },
  {
    id: 'trk_2',
    bursary: BURSARIES[2],
    status: 'SHORTLISTED',
    status_source: 'EMAIL_CAPTURE',
    last_activity_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
];

// Shaped like the real queue (#288): only statuses that wait on a person, in triage order. This
// fixture once held a RETURNED_FOR_INFO application, which the real queue never returns — preview
// mode was showing reviewers a queue the system does not have.
const QUEUE = [
  {
    ...APPLICATION,
    id: 'app_preview_1',
    status: 'APPEALED',
    priority: 'CRITICAL',
    review_due_at: '2026-02-13T09:00:00Z',
    sla_breached: true,
  },
  { ...APPLICATION, id: 'app_preview_2', status: 'UNSCREENED', priority: 'URGENT' },
  { ...APPLICATION, id: 'app_preview_3', status: 'READY_FOR_REVIEW' },
];

const page = (items: unknown[]) => ({ items, meta: { next_cursor: null } });

/** Routes, most specific first. A path is matched after the API base is cut. */
const ROUTES: ReadonlyArray<{
  method: string;
  match: RegExp;
  body: (request: HttpRequest<unknown>) => unknown;
}> = [
  { method: 'POST', match: /^\/auth\/(login|register|refresh)$/, body: () => TOKENS },
  { method: 'POST', match: /^\/auth\//, body: () => null },
  { method: 'GET', match: /^\/students\/me\/profile$/, body: () => PROFILE },
  // A PUT answers with what was sent, so saving a form shows the saved values
  // rather than snapping back to the fixture.
  {
    method: 'PUT',
    match: /^\/students\/me\/profile$/,
    body: (request) => ({ ...PROFILE, ...(request.body as object) }),
  },
  { method: 'GET', match: /^\/students\/me\/data-export$/, body: () => ({ profile: PROFILE }) },
  { method: 'GET', match: /^\/students\/me\/overview$/, body: () => STUDENT_OVERVIEW },
  { method: 'GET', match: /^\/students\/me\/activity$/, body: () => page(ACTIVITY) },
  { method: 'GET', match: /^\/admin\/overview$/, body: () => ADMIN_OVERVIEW },
  { method: 'GET', match: /^\/admin\/activity$/, body: () => page(ADMIN_ACTIVITY) },
  { method: 'POST', match: /^\/students\/me\/documents$/, body: () => DOCUMENT },
  { method: 'GET', match: /^\/admin\/applications$/, body: () => page(QUEUE) },
  // A02's own read. Preview used to answer the STUDENT endpoint for a reviewer, which is why A02
  // looked fine here while the real API returned 403 (#288).
  { method: 'GET', match: /^\/admin\/applications\/[^/]+$/, body: () => APPLICATION },
  { method: 'GET', match: /^\/applications$/, body: () => page([APPLICATION]) },
  { method: 'POST', match: /^\/applications$/, body: () => ({ ...APPLICATION, status: 'DRAFT' }) },
  { method: 'GET', match: /^\/applications\/[^/]+$/, body: () => APPLICATION },
  { method: 'POST', match: /^\/applications\/[^/]+\/resubmit$/, body: () => APPLICATION },
  { method: 'GET', match: /^\/bursaries$/, body: () => page(BURSARIES) },
  { method: 'GET', match: /^\/matches\/me$/, body: () => page(MATCHES) },
  { method: 'GET', match: /^\/notifications\/me$/, body: () => page(NOTIFICATIONS) },
  {
    method: 'PUT',
    match: /^\/notifications\/preferences$/,
    body: (request) => request.body ?? {},
  },
  { method: 'GET', match: /^\/tracked-applications$/, body: () => page(TRACKED) },
  { method: 'POST', match: /^\/tracked-applications$/, body: () => TRACKED[0] },
];

// Dashboard figures (#294). Preview only — in the product every one of these is counted by the
// server from the database; these exist so the screens can be looked at without an API.
const STUDENT_OVERVIEW = {
  generated_at: '2026-09-13T08:00:00Z',
  applications: {
    total: 1, drafts: 0, needs_your_action: 1, with_fundslink: 0, decided: 0,
    by_status: [{ status: 'RETURNED_FOR_INFO', count: 1 }],
  },
  tracking: {
    total: 3, active: 2, by_status: [{ status: 'SHORTLISTED', count: 1 }],
    next_deadline: {
      tracked_application_id: 'ta_preview', bursary_name: 'Sasol Bursary',
      due_on: '2026-09-30', deadline_type: 'APPLICATION',
    },
  },
  matches: { total: 6, last_run_at: '2026-09-10T09:00:00Z' },
  notifications: { total: 4, last_at: '2026-09-12T09:00:00Z' },
  account: {
    member_since: '2026-01-15T08:00:00Z', previous_sign_in_at: '2026-09-11T06:15:00Z',
    mfa_enabled: false,
  },
};

const ACTIVITY = [
  { id: 'ev_p1', occurred_at: '2026-09-12T10:00:00Z', category: 'APPLICATION',
    event: 'APPLICATION_STATUS_CHANGED', actor: 'FUNDSLINK', resource_id: 'app_preview',
    to_status: 'RETURNED_FOR_INFO', label: null },
  { id: 'ev_p2', occurred_at: '2026-09-11T06:15:00Z', category: 'SECURITY',
    event: 'AUTH_LOGIN_SUCCESS', actor: 'YOU', resource_id: null, to_status: null, label: null },
  { id: 'ev_p3', occurred_at: '2026-09-10T09:00:00Z', category: 'MATCHING', event: 'MATCHING_RUN',
    actor: 'YOU', resource_id: null, to_status: null, label: null },
  { id: 'ev_p4', occurred_at: '2026-09-09T12:00:00Z', category: 'TRACKING',
    event: 'TRACKER_STATUS_CHANGED', actor: 'YOU', resource_id: 'ta_preview',
    to_status: 'SHORTLISTED', label: 'Sasol Bursary' },
];

const ADMIN_OVERVIEW = {
  generated_at: '2026-09-13T08:00:00Z',
  window_days: 7,
  queue: {
    awaiting_review: 14, overdue: 2, emergency: 3, unscreened: 1, awaiting_student: 6,
    by_status: [
      { status: 'READY_FOR_REVIEW', count: 9 }, { status: 'APPEALED', count: 4 },
      { status: 'UNSCREENED', count: 1 }, { status: 'RETURNED_FOR_INFO', count: 6 },
    ],
  },
  flow: { submitted: 40, approved: 8, waitlisted: 4, not_funded: 11, median_days_to_decision: 6.5 },
  notifications: { pending: 3, failed: 1, sent: 120 },
  accounts: { registered: 31, sign_ins: 210, failed_sign_ins: 17, locked: 2 },
};

const ADMIN_ACTIVITY = [
  { id: 'al_p1', occurred_at: '2026-09-13T07:40:00Z', action: 'APPLICATION_REVIEWED',
    resource_type: 'funding_application', resource_id: 'app_preview', actor_kind: 'STAFF' },
  { id: 'al_p2', occurred_at: '2026-09-13T07:12:00Z', action: 'AUTH_LOGIN_FAILURE',
    resource_type: 'user', resource_id: null, actor_kind: 'ANONYMOUS' },
  { id: 'al_p3', occurred_at: '2026-09-13T06:58:00Z', action: 'APPLICATION_SUBMITTED',
    resource_type: 'funding_application', resource_id: 'app_preview', actor_kind: 'STUDENT' },
];

const TOKENS = {
  access_token: 'preview.access.token',
  token_type: 'bearer',
  expires_in: 900,
};

const DOCUMENT = {
  id: 'doc_preview',
  doc_type: 'PROOF_OF_REGISTRATION',
  av_status: 'CLEAN',
  created_at: '2026-02-11T07:30:00Z',
};

/**
 * The interceptor itself.
 *
 * It sits in front of every other interceptor, including auth: a preview has no
 * token to refresh and no cookie to send, and letting a 401 path run would send
 * the browser to a login screen that cannot succeed.
 */
export const previewApiInterceptor: HttpInterceptorFn = (request, next) => {
  const path = request.url.replace(/^.*\/api\/v1/, '');
  // Anything that is not an API call (a font, a chunk, an asset) is none of
  // this file's business.
  if (path === request.url) {
    return next(request);
  }

  const route = ROUTES.find((r) => r.method === request.method && r.match.test(path));
  if (!route) {
    // Loud and shaped like the real thing: preview must fail the same way the
    // product does, or the error states are never exercised.
    // An HttpErrorResponse carrying the contract's error envelope, so it
    // travels through toApiError exactly as a real 404 would.
    return throwError(
      () =>
        new HttpErrorResponse({
          status: 404,
          statusText: 'Not Found',
          url: request.url,
          error: {
            error: {
              code: 'not_found',
              message: `Preview mode has no fixture for ${request.method} ${path}.`,
              request_id: 'preview-request',
            },
          },
        }),
    ).pipe(delay(LATENCY_MS));
  }

  return of(new HttpResponse({ status: 200, body: route.body(request) })).pipe(delay(LATENCY_MS));
};

export const previewInterceptors: HttpInterceptorFn[] = [previewApiInterceptor];

/**
 * A signed-in preview session, seeded at bootstrap.
 *
 * The access token lives in memory only (S3.14), so a page reload signs you
 * out — correct in production, and unusable in a preview, where the whole
 * point is to open any screen from its URL and walk the product. Seeding the
 * in-memory token at bootstrap makes every route reachable without turning the
 * auth guard off, so the guard being wired correctly is still exercised.
 *
 * This grants a session and therefore lives only in the file that cannot ship.
 */
export const previewProviders: (Provider | EnvironmentProviders)[] = [
  provideAppInitializer(() => {
    inject(AuthTokenService).set(TOKENS.access_token);
  }),
];
