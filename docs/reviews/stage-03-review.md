# STAGE 03 REVIEW — DEEP ANALYSIS REPORT

**Reviewer:** Engineer 02 (Claude Code, L3, independent reviewer)
**Date:** 2026-06-19
**Stage:** 03 — BACKEND MODULES (six, dependency order; one module = one PR = gate check)
**Gate:** G3 (+ post-G3 eligibility-policy pass + Stage-03 hardening pass, both Founder-approved L4)
**Handoff Reviewed:** docs/process/handoff-s03-s04.md (dated 2026-06-15, with §2b/§2c addenda 06-18/06-19)
**Challenge Framework:** .ksdrill/workflow/ai-review-challenge-framework.md § Stage 03

> Method note: where possible I **executed** the gates against the *current* tree (2026-06-19) rather
> than trusting the handoff's pasted output (2026-06-15, which predates the eligibility + hardening
> passes). The DB-bound suite cannot run on this Windows build host (Postgres won't launch — UCRT),
> so test *execution* evidence rests on CI, as the handoff itself states.

---

## REPOSITORY VERIFICATION — gates re-run locally (current tree)

| Gate | Command | Result (my run, 2026-06-19) |
|------|---------|------------------------------|
| Lint | `ruff check .` | **All checks passed!** |
| Layering (router→service→repo) | `lint-imports` | **1 kept, 0 broken** (114 files, 379 deps analyzed) |
| Permission deny-by-default (S3.21) | `permission_lint.py` | **OK — 32 business routes declare a posture** |
| Contract-first (S2.7) | `contract_diff.py` | **OK — 32 implemented ops match openapi.yaml** (exit 0) |
| Store isolation (S5.3) | `store_isolation_lint.py` | **OK — 1 Mongo model, no money field; Redis keys allowlisted** |
| Test collection | `pytest --collect-only` | **330 tests collected** (≥ the 315 the handoff cited) |
| Test execution | `pytest -q` | **NOT RUNNABLE LOCALLY** — fixtures connect to PG at setup; host PG won't launch. CI is system of record (handoff: 315 passed, 94% cov). |

**Migrations:** `0001 → 0017` present and ordered (0015 matching_config, 0016 eligibility_signals,
0017 eligibility_rulesets_v2). **Modules:** all six present, each with `router/service/repository`
+ domain files (profile: documents/storage; application: state_machine; eligibility: rule_engine;
matching: spend/stores/reasoning/integrity; tracking: jobs; notification: channels/worker).

**The four static gates I re-ran are GREEN on the current head — superseding the handoff's older
pasted evidence and confirming no drift after the eligibility/hardening passes.** CI `api` job is
green on `main` (latest code-touching run: H8 / PR #136, success).

### Pipeline demo (G3 FINAL) — inspected, real
`tests/pipeline/test_g3_pipeline_demo.py` does exactly what the brief mandates, via API only:
seed student → apply → submit (no docs) → `RETURNED_FOR_INFO` + fix-list → upload NSFAS outcome →
resubmit → `READY_FOR_REVIEW` → reviewer `UNDER_REVIEW`→`APPROVED_PROPOSED`; then the other three
decision paths; then asserts the **SYSTEM principal cannot reach `APPROVED`** — the `fn_human_final`
DB trigger raises `HUMAN_FINAL_PRINCIPLE` (BR-E03 / §5.8). A second test closes the loop
match→track→notify. This is a genuine end-to-end gate, not a prose claim.

### Atomicity (BR-N01 / S3.33) — verified in code
`application/service.py::submit_application` runs under `set_system_context` and writes the status
event, the `notification_outbox` row, the `audit_log` row, **and** the eligibility pre-screen in the
**same transaction** (module docstring + single session, no intermediate commit). The core
"status change + outbox + audit in ONE transaction" guarantee holds at the code level.

### Store isolation (S5.3) — verified in code
`matching/reasoning.py::MatchReasoning` (the only Beanie model) carries `score` (a 0–1 ratio),
`summary`, `tags` — **no monetary field**. The CI guard inspects `MONGO_MODELS` and fails the build
if a money field appears. `match_result` carries no amount; funding stays on
`funding_application.requested_amount` (NUMERIC, PG). The `test_cross_store.py` / `test_store_isolation.py`
tests exist (S7.15). Clean.

### Idempotent re-runs — verified (resolved a suspicion)
I suspected repeated `POST /matches/run` would accumulate duplicate matches. It does **not**:
`MatchResultRepository.insert` uses `ON CONFLICT (student_profile_id, external_bursary_id,
model_version) DO UPDATE SET score, mode` (uq_match). Re-runs refresh. *(One edge — see LOW-1.)*

---

## FINDINGS

### BLOCKING FINDINGS
**None.** Every G3 checklist item is genuinely satisfied: contract-diff exact (32 ops), permission
posture on every route, store-isolation real, cross-user suites present, the headless pipeline demo
exercises all four decision paths plus the Human-Final DB rejection. The static gates pass on the
current tree under my own execution.

---

### HIGH-RISK FINDINGS

**Finding 1 — Matching advertises an async/queued contract but runs fully synchronously**
- **Severity:** HIGH
- **Location:** `apps/api/app/modules/matching/service.py::MatchingService.run` (+ router 202)
- **Evidence:**
  - The endpoint returns **HTTP 202** with body `JobAccepted(job_id=cuid(), status="QUEUED")`.
  - But `run()` performs **all** work inline before returning: quota check → spend breaker → score
    every candidate → upsert profile/bursary embeddings → insert every `match_result` → write every
    MongoDB reasoning doc → audit. By the time 202 returns, the matches already exist (which is why
    `test_g3_end_to_end…` can `POST /matches/run` → 202 then **immediately** `GET /matches/me` and
    find results).
  - `job_id=cuid()` is a **throwaway** — there is no job table, no job resource, nothing to poll.
    `status="QUEUED"` is hard-coded and untrue (the work is already done).
- **Why it matters:**
  - **The design intent is unmet.** TAD §6 and stress-test **ST-1.2** call for *queued* matching
    precisely so the embedding/scoring/cross-store cost does **not** run in the web request path.
    Here it does. Under load (or once "LIVE" is a real paid embedding model rather than today's
    local heuristic), every `/matches/run` ties up a request worker for the full scoring cost — the
    exact latency/cost-amplification the 202-queue pattern exists to prevent.
  - **The contract misrepresents behavior.** A frontend told `202 / QUEUED` may build a polling/job
    UX against a job that never existed; or worse, assume results aren't ready when they already are.
- **Recommendation (pick one, Founder to choose):**
  - **(a) Make it genuinely async** — enqueue a matching job (reuse the outbox/worker substrate that
    already exists for notifications) and have a worker do the scoring; `GET /matches/me` already
    exists as the read side. This realizes ST-1.2/TAD §6 as written. *(Best, but more work.)*
  - **(b) Risk-accept for v1 and correct the contract/docs** — for an advisory feature with a daily
    quota of 5 and a small bursary set, synchronous is acceptable at launch scale. If so: change the
    response to `200` (or keep `202` but document it honestly), drop the fake `job_id`/`QUEUED`, and
    annotate ST-1.2 / TAD §6 / the handoff as "synchronous advisory in v1; async deferred to v1.x."
- **Not a G3-checklist breach** (no checklist item verifies matching is *actually* queued) — which
  is exactly why an independent pass surfaces it. Treat as Fix-or-explicitly-accept before launch.

---

### MEDIUM-RISK FINDINGS

**Finding 2 — No running worker/scheduler: the outbox is never drained, reminders never fire**
- **Severity:** MEDIUM
- **Location:** `notification/worker.py::main` (single `process_batch`, then exits);
  `tracking/jobs.py` (T-3 deadline + 30/45/60 silence jobs)
- **Evidence:** `main()` claims one batch of 20 (`FOR UPDATE SKIP LOCKED`), processes it, prints,
  and **returns**. There is no loop, no daemon, no cron, no supervisor, no CI/infra entry that
  invokes it repeatedly. Same for the tracking deadline/silence jobs.
- **Why it matters:** The whole "status change enqueues an outbox row" design is only as good as the
  thing that drains it. As built, in a real deploy the `notification_outbox` accumulates and **no
  email/SMS/in-app message is ever delivered**, and T-3 / 30 / 45 / 60-day reminders never fire,
  until a scheduler is wired. The per-pass concurrency-safety (SKIP LOCKED) is correct and real;
  the *runner* is absent.
- **Recommendation:** Before launch (Stage 06 at the latest), wire a scheduler — a loop with sleep,
  a `cron`/Railway scheduled job, or a small supervisor — and add an ops runbook entry. Track it
  now so it is not silently assumed. Confirm whether Stage 05/06 owns this; if so, reference it
  explicitly in the handoff "deferred" list (currently it is not called out).

**Finding 3 — G3 evidence in the handoff is stale relative to the current tree**
- **Severity:** MEDIUM (evidence hygiene)
- **Location:** `docs/process/handoff-s03-s04.md` §0 table
- **Evidence:** §0 ("re-run from a clean tree on 2026-06-15") states **0015 head**, **30 ops**,
  **315 passed**. Current head is **0017**, **32 ops**, **330 collected**. §2b/§2c *explain* the
  post-G3 eligibility (→0017, +2 ops) and hardening passes, but the §0 evidence table was never
  refreshed. A reviewer reading only §0 is given numbers that no longer match `main`.
- **Recommendation:** Add a one-line "current head" row (or refresh §0) so the canonical evidence
  table agrees with the repo — the same phase-status-sync discipline (S10.23/S10.38) the project is
  formalizing on the active branch. *(My 06-19 re-run supersedes and confirms the static gates;
  this is about the document, not the code.)*

**Finding 4 — Test-execution evidence is CI-only and unlinked**
- **Severity:** MEDIUM (evidence gap, not a defect)
- **Evidence:** 330 tests collect, but execution requires Postgres, which won't launch on the build
  host; the 315-passed / 94%-coverage figures exist only as handoff prose. No CI run URL/artifact is
  linked from the handoff or gate.
- **Recommendation:** Attach the green CI `api` run URL (or the pytest/coverage artifact) to the G3
  evidence so the test claim is independently checkable, not author's-word. (CI *is* green on main;
  the ask is traceability.)

---

### LOW-RISK FINDINGS & RECOMMENDATIONS

**LOW-1 — LIVE/FALLBACK mode flip can surface the same bursary twice.** `uq_match` is keyed on
`(student, bursary, model_version)`; LIVE uses `embed-local-v1`, FALLBACK uses `fallback-overlap-v1`.
If the spend breaker flips modes between two runs, the same student+bursary yields **two**
`match_result` rows (different `model_version`), so `GET /matches/me` can show a duplicate. Consider
keying uniqueness on `(student, bursary)` with `mode`/`model_version` as updatable attributes, or
de-duplicating in the read.

**LOW-2 — "LIVE" matching is a local deterministic heuristic; ChromaDB is a seam.** `embed_text` /
`LIVE_MODEL="embed-local-v1"` is a local stand-in and the spend breaker meters a model that costs
nothing today. This is a fine forward-seam for a real paid model, but the "AI budget / circuit
breaker" semantics are presently theatrical — document that LIVE is a stub until a real embedding
backend lands, so no one mistakes the breaker for live cost control.

**LOW-3 — Notification rendering is a generic stub** (`_render` → "There is an update on your
FundsLink account"). Acknowledged in code ("real templates land with the content track"). Fine for
now; track for the content pass before launch.

**LOW-4 — `.tmp-stage00/01/02/03-review.md` are untracked and not gitignored** (carried from the
Stage 00 review). Add `.tmp-*` to `.gitignore` to prevent accidental commits of review scratch.

---

## CHALLENGE REVIEW — STAGE 03 QUESTIONS

**Self-Review — Are business rules implemented correctly?** Yes, with the matching async caveat.
BR-S01–S08 (state machine over transition tables, Human-Final, duplicate-active 409, OTHER
motivation, appeal), BR-E01–E07/E10 (ruleset evaluator version-pinned at submission, RETURNED
fix-list + return cycles + 3-cycle outreach, annotate-not-decide via `field_flag`/`review_flag`),
BR-M01–M04, BR-N01–N03, BR-T01–T06 are present and tested. **Is validation complete?** Largely —
H1 (SA ID required before SUBMIT), H2 (expired doc → RETURN) close prior gaps. **Are exceptions
handled?** Yes — uniform `error.code` registry (H8, 28 codes) the frontend branches on. **Are APIs
consistent?** Yes — cursor pagination `{items, meta:{next_cursor}}`, decimal-string money. **Are
services reusable?** Yes — clean router→service→repository (layering gate proven).

**Adversarial — Which endpoints fail under load?** `POST /matches/run` (Finding 1) — synchronous
scoring + cross-store writes in-request. **Which services bottleneck?** The (absent) notification
worker (Finding 2) — nothing drains the outbox. **Which business rules can be bypassed?** Human-Final
cannot (DB trigger, proven). Duplicate-active cannot (`uq_app_active_per_year`, verified against the
live index per handoff). **What happens during service outages?** Mongo/Chroma are seams behind
repository interfaces; matching has FALLBACK; Redis rate-limit fails open (carried from Stage 02).

**Independent — Are responsibilities separated?** Yes — exemplary module boundaries; only
repositories touch DB drivers. **Is the architecture modular?** Yes. **Which services are tightly
coupled?** Matching reaches into `application.schemas.PageMeta` and `auth.repository.AuditRepository`
— minor cross-module reuse, acceptable. **What maintenance challenges remain?** The worker/scheduler
gap and the matching sync/async honesty are the two that will bite a future maintainer who trusts
the contract names (`QUEUED`, "worker").

---

## UNIVERSAL FINAL CHALLENGE

1. **Most likely to fail first:** Notification delivery — the outbox is never drained because no
   worker is scheduled (Finding 2). In a real deploy, messages silently pile up.
2. **Most expensive to fix later:** Retrofitting genuine async matching after a frontend has been
   built against the `202/QUEUED` contract (Finding 1) — fix the semantics now while only the
   backend depends on them.
3. **Most dangerous assumption:** That "202 / QUEUED" and "worker" mean what they say. Both are
   partially aspirational today.
4. **Remaining security risk:** Low at this layer — RLS fail-closed + cross-user suites + Human-Final
   trigger + store-isolation hold. The live residual is operational (an unscheduled SYSTEM-context
   worker) rather than authz.
5. **Remaining scalability risk:** Synchronous matching in the request path (Finding 1) once LIVE is
   a real embedding model; single-instance outbox draining throughput once a worker exists.
6. **Remaining maintenance problem:** Contract/handoff drift (Findings 3) and naming that overstates
   async-ness — a maintainer needs the code to learn the truth.
7. **Remaining uncovered edge case:** LIVE↔FALLBACK duplicate match rows (LOW-1).
8. **10x growth:** Matching request-path cost and outbox drain rate become the limits; both are
   fixable with the queue/worker substrate that already exists for notifications.
9. **100x growth:** Needs a real job queue + worker fleet, a real embedding/vector backend
   (ChromaDB wired, not seamed), and outbox partition-aware draining — all anticipated by the
   architecture, none load-bearing yet.
10. **Would I recommend this for production?** The **data/contract/security spine — yes**. The
    **runtime async machinery (matching queue + outbox/reminders scheduler) — not until Finding 1
    is corrected/accepted and Finding 2 is wired.**
11. **If not, why not:** Two async promises (queued matching, running workers) are not yet real;
    one must be honestly downgraded or implemented, the other must be scheduled before launch.

---

## FINAL RECOMMENDATION

### **RECOMMEND: Approve after listed fixes**

**Reason:** Stage 03's data model, contract surface (32 ops, re-verified green by me today),
security walls (RLS, Human-Final, store-isolation), one-transaction atomicity, and the real
end-to-end pipeline demo are production-grade and the G3 checklist genuinely passes — but matching
advertises an async/queued contract it executes synchronously (HIGH, Finding 1) and no scheduler
drains the outbox or fires reminders (MEDIUM, Finding 2); approve once those are either implemented
or consciously risk-accepted-and-redocumented by the Founder, and the §0 G3 evidence is refreshed to
the current `0017 / 32-op / 330-test` head.

### Required before approval (or explicit L4 risk-acceptance)
1. **Finding 1** — implement genuine async matching, OR correct the `202/QUEUED/job_id` contract +
   ST-1.2/TAD §6 to "synchronous advisory, async deferred," with Founder sign-off.
2. **Finding 2** — wire (or formally schedule + document) the notification worker and tracking
   reminder jobs before launch; add to the handoff "deferred" list if owned by Stage 05/06.

### Recommended (not gate-blocking)
3. Refresh handoff §0 evidence to current head; link the green CI run (Findings 3, 4).
4. Address LOW-1 duplicate-mode edge; document the LIVE-embedding stub (LOW-2); `.gitignore .tmp-*`.

### Risk acceptances requiring Founder approval
- Synchronous matching for v1 (if choosing Finding 1 option b).
- Deferring the worker scheduler to Stage 05/06 (if that is the intended owner) — must be explicit,
  not assumed.

---

*Reviewer recommends; the Founder (L4) approves. Stage 03 reviewed independently 2026-06-19 — static
gates re-executed green on the current tree; DB-bound suite evidence rests on CI per the known
build-host limitation.*
