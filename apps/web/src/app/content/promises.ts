/**
 * Every promise this product makes to a person, and the thing that makes it
 * true.
 *
 * This register exists because a Founder audit found five claims the system did
 * not keep — the worst of them told to donors, and one of them ("apply and a
 * person reads it") broken by a missing API call rather than by wording. None
 * of them were dishonest when written; each became untrue as the system moved
 * underneath the copy, and nothing in the build could tell.
 *
 * So a promise is now a declared thing with a citation. `evidence` names the
 * file, migration or endpoint that keeps it, and `promises.spec.ts` fails the
 * build if that evidence stops existing. A claim whose backing is deleted takes
 * the build down instead of quietly becoming a lie.
 *
 * The rule for adding one: if a reasonable person could be disappointed by
 * discovering how it actually works, it belongs here.
 */
export interface Promise_ {
  /** What we say, in the words the product uses. */
  readonly claim: string;
  /** Where a person reads it. */
  readonly shownOn: string;
  /**
   * The thing that makes it true — a path in this repository. The test checks
   * the file exists and, where a marker is given, that the marker is still in
   * it.
   */
  readonly evidence: string;
  /** A string that must appear in the evidence file. */
  readonly marker?: string;
}

export const PROMISES: readonly Promise_[] = [
  {
    claim: 'A person makes every funding decision; software never can.',
    shownOn: 'home, how-it-works, for-donors, application status',
    evidence: 'apps/api/alembic/versions/sql/0001_schema.sql',
    // The database refuses a decision without a human actor. This is the
    // strongest promise in the product and the one with the hardest backing.
    marker: 'HUMAN_FINAL_PRINCIPLE',
  },
  {
    claim: 'Your ID number is encrypted and never shown back in full.',
    shownOn: 'for-students, privacy, profile, help',
    evidence: 'apps/api/alembic/versions/sql/0001_schema.sql',
    marker: 'id_number_enc',
  },
  {
    claim: 'Every status change is recorded with who did it and when, and cannot be rewritten.',
    shownOn: 'for-donors',
    evidence: 'apps/api/alembic/versions/sql/0001_schema.sql',
    marker: 'tg_ase_guard',
  },
  {
    claim: 'You can download everything we hold about you.',
    shownOn: 'privacy statement, data & privacy, help',
    evidence: 'apps/api/app/modules/profile/router.py',
    marker: '/data-export',
  },
  {
    claim: 'If we cannot fund you, a different reviewer can look again.',
    shownOn: 'terms, help',
    evidence: 'apps/api/app/modules/application/router.py',
    marker: '/appeal',
  },
  {
    claim: 'Applying sends your application to a person.',
    shownOn: 'apply flow, application detail',
    // The defect this register was built after: the endpoint existed and no
    // screen called it, so every application stayed a draft nobody read.
    evidence: 'apps/web/src/app/features/applications/apply-steps.component.ts',
    marker: "'/applications/{id}/submit'",
  },
  {
    claim: 'A returned application keeps its place — fix it and it goes back in the queue.',
    shownOn: 'fix list, how-it-works',
    // Resubmit lives in the eligibility module, not the application one:
    // pre-screening runs inside submit/resubmit and has no endpoint of its own.
    // The first version of this register cited the wrong file, and this gate
    // caught it — which is the point of citing rather than asserting.
    evidence: 'apps/api/app/modules/eligibility/router.py',
    marker: '/resubmit',
  },
  {
    claim: 'Matching suggests; the full list is always reachable at equal prominence.',
    shownOn: 'matches',
    evidence: 'apps/web/src/app/features/matching/matches.component.ts',
    marker: '/app/bursaries',
  },
  {
    claim: 'If a tracked application goes quiet, we check in with you.',
    shownOn: 'tracking board, track another',
    // BR-T06. It notifies the STUDENT — which is why the copy says "check in
    // with you" and never "we will chase the funder".
    evidence: 'apps/api/app/modules/tracking/jobs.py',
    marker: 'run_silence_followups',
  },
  {
    claim: 'Every notification we owe you is recorded, even before delivery is switched on.',
    shownOn: 'notifications',
    evidence: 'apps/api/app/modules/notification/worker.py',
    marker: 'notification_outbox',
  },
];
