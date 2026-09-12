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

const QUEUE = [
  { ...APPLICATION, id: 'app_preview_1', status: 'READY_FOR_REVIEW' },
  { ...APPLICATION, id: 'app_preview_2', status: 'UNDER_REVIEW' },
  { ...APPLICATION, id: 'app_preview_3', status: 'RETURNED_FOR_INFO' },
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
  { method: 'POST', match: /^\/students\/me\/documents$/, body: () => DOCUMENT },
  { method: 'GET', match: /^\/admin\/applications$/, body: () => page(QUEUE) },
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
