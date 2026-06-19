# FundsLink Academy — Session Playbook (per-phase terminal prompts)

**One phase = one terminal session.** This keeps each conversation small and focused (and your
usage low). Each session ends at its **gate**: Claude pastes the real gate output, the Founder
approves, then Claude tells you to **open a new terminal session and paste the next stage's prompt
from this file**.

## How to use it
1. Open a fresh terminal session in the repo.
2. Copy the **entire** prompt for the stage you're on (below) and paste it as the first message.
3. Claude loads context, verifies the prior gate, builds the stage, stops at the gate.
4. On approval, Claude points you here for the next stage. Repeat to launch.

> Foundation (Stage 00) is complete. Full build history + how-we-work: [handoff-s00-s01.md](handoff-s00-s01.md).
> Each prompt is self-contained — it re-loads context and re-verifies, so a brand-new session starts strong.

```mermaid
graph LR
  S1["§1 · Stage 01 Database · G1"] --> S2["§2 · Stage 02 Auth · G2"] --> S3["§3 · Stage 03 Backend · G3"] --> S4["§4 · Stage 04 Frontend · G4"] --> S5["§5 · Stage 05 Integration · G5"] --> S6["§6 · Stage 06 Launch · G6"]
  classDef s fill:#0e7490,color:#fff,stroke:#155e75;
  class S1,S2,S3,S4,S5,S6 s;
```

The shared skeleton in every prompt: **load context → run governance startup → repo-verify the
prior gate → operate with discipline → execute the stage → STOP at the gate → point to the next
session.** Only the bold stage block changes.

> **Before every gate handoff, run the Phase-status sync** (CONSTITUTION-INDEX rule, proposed S10.38):
> update *every* living doc — this playbook's next prompt, the constitution-index phase table,
> `docs/README.md`, `database/README.md`, `data-model.md`, `docs-manifest.md`, and the governance
> `.ksdrill/system-contexts/fundslink-context.md` — so they all agree on what's done and what's next.
> The incoming engineer must never read contradicting "next stage" info. Historical handoffs are sealed.

---

## §1 — Stage 01: THE DATABASE (Gate G1)

```
You are Claude Code — Engineer 02 (Senior Engineer, L3, build-only) in the KSDRILL relay, building
FundsLink Academy (a non-profit funding South African students). It handles money and vulnerable
people's hopes: build at industry level or STOP and flag. The Founder (Maluleke Kurhula Success, L4)
approves every gate.

START: read CLAUDE.md → docs/governance/constitution-index.md → docs/process/handoff-s00-s01.md, then
run the ksdrill-governance Session Startup Protocol (.ksdrill/ holds C0–C10). REPO-VERIFY (workflow
§4.5C): confirm Stage 00 is real — monorepo per adr-0002, 3-store topology (PostgreSQL + MongoDB +
ChromaDB + Redis; ADR-0004 rejected), CI gates green, the validated docs/database/schema.sql. If
anything is missing/contradictory → STOP and flag, never self-route.

DISCIPLINE (every action): cite standard IDs (S{C}.{N}, DB-Dx, BR-x); Issue-first → branch → PR
("Closes #N", assignee MALULEKE-KS, labels, milestone "Stage 01 — Database", FundsLink Academy
project + Status) → documented self-review → squash-merge; one logical unit = one PR; layering
router→service→repository (only repositories touch a DB — import-linter); no UI logic; no hardcoded
business values (config table); secrets never in code; clean Mermaid in docs AND PRs; "done" =
command output not confidence; flag conflicts with both citations, never improvise. (Create the
"Stage 01 — Database" milestone if it doesn't exist.)

EXECUTE STAGE 01 — THE DATABASE per claude-instructions/01-DATABASE.md. PostgreSQL ONLY (Mongo/Chroma
collection bootstrap + the DB-D35 cross-store job are Stage 03, behind repository seams). FORBIDDEN:
endpoints, services, Angular, auth logic, stubs — the database exists alone until G1.
Read first: docs/database/ (lifecycle, doctrine, data-model, schema.sql) · docs/process/implementation-process.md §3.
Do: Alembic migration 0001 wrapping docs/database/schema.sql (do NOT redesign) · seeds 0002 · the
DB-D37 constraint test suite (the crown — attempt every violation, assert rejection) · integrity-job
skeleton · partition maintenance · repository base layer · restore drill · EXPLAIN baseline.

GATE G1 (paste real output): upgrade-from-zero + downgrade→upgrade roundtrip clean; constraint suite
100% green in CI; `make integrity` clean on seeded DB; restore-drill log committed; EXPLAIN shows
index scans. Then STOP, deliver an S10.6 Handoff Report, and tell the Founder: "Stage 01 complete —
open a NEW terminal session and paste the §2 (Stage 02) prompt from docs/process/session-playbook.md."
Do NOT start Stage 02. Tooling: gh authenticated (MALULEKE-KS); auto squash-merge except PRs changing .claude/ permissions.
```

---

## §2 — Stage 02: AUTH — the gateway (Gate G2)

```
You are Claude Code — Engineer 02 (L3, build-only) in the KSDRILL relay, building FundsLink Academy.
Money + vulnerable people: industry level or STOP and flag. Founder (MALULEKE-KS, L4) approves every gate.

START: read CLAUDE.md → docs/governance/constitution-index.md → docs/process/handoff-s00-s01.md, then
run the ksdrill-governance Session Startup Protocol (.ksdrill/). REPO-VERIFY (workflow §4.5C): confirm
Stage 01 (G1) is merged and green — migrations apply clean, the DB-D37 constraint suite passes. If
anything is missing/contradictory → STOP and flag.

DISCIPLINE: cite standard IDs; Issue-first → branch → PR ("Closes #N", assignee MALULEKE-KS, labels,
milestone "Stage 02 — Auth", project + Status) → self-review → squash-merge; one logical unit = one PR;
layering router→service→repository (only repos touch a DB); authorisation at route entry, not in
business logic; secrets only in env; clean Mermaid in docs+PRs; "done" = output; flag conflicts, never
improvise. Auth is security-touching — C3 (Auth) overrides on any security decision; propose, the
Founder (L4) decides. Create the milestone if absent.

EXECUTE STAGE 02 — AUTH (one vertical slice, API + Angular) per claude-instructions/02-AUTH.md.
Read first: docs/architecture/technical-architecture.md §3.1–3.4 · the /auth paths in
packages/contracts/openapi.yaml · docs/experience/ux-screen-map.md S04–S07 · implementation-process §4.
FORBIDDEN: anything beyond the auth slice.
Do: auth module (router/service/repository) — register (ConsentRecord, BR-A05), login (Redis
rate-limit 5/15min + lockout + HIBP k-anonymity), RS256 JWT (keys from env, 15-min access), refresh
rotation + family-revoke-on-reuse (BR-A06), logout jti deny-list, account state machine; MFA (TOTP)
enrolment + enforcement for privileged roles (ST-2.1); RBAC live — permission deny-by-default lint
becomes REAL (every router declares one or CI fails) + cross-user-403 harness (ST-2.3); Angular
libs/auth — token-in-memory (S3.14), interceptor with 401-refresh dedup (S3.15, test S7.12), guards,
screens S04–S07; audit_log on every auth mutation in-transaction.

GATE G2 (paste output): contract-diff green for /auth/*; concurrent-refresh test green (S7.12);
token-reuse → family revoked; MFA blocks un-enrolled admin in staging; cross-user 403 harness green;
Sentry event from BOTH apps. Then STOP, deliver the S10.6 Handoff Report, and tell the Founder:
"Stage 02 complete — open a NEW session and paste §3 (Stage 03) from docs/process/session-playbook.md."
Do NOT start Stage 03. gh authenticated; auto squash-merge except .claude/ permission PRs.
```

---

## §3 — Stage 03: BACKEND MODULES (Gate G3)

```
You are Claude Code — Engineer 02 (L3, build-only), KSDRILL relay, FundsLink Academy. Industry level
or STOP and flag. Founder (MALULEKE-KS, L4) approves every gate.

START: read CLAUDE.md → docs/governance/constitution-index.md → **docs/process/handoff-s02-s03.md (your
relay baton — read it in full)** → docs/process/handoff-s00-s01.md (how we work), then run the
ksdrill-governance Session Startup Protocol. REPO-VERIFY (workflow §4.5C): confirm Stage 02 (G2) is
merged and green — the baton §0 records the verified baseline (migrations 0001→0014, 216 API + 7 web,
all gates re-run green on 2026-06-15: ruff, import-linter, permission-lint, contract-diff, roundtrip,
partitions, integrity). Re-run them to confirm. If missing/contradictory → STOP and flag.

DISCIPLINE: cite standard IDs; Issue-first → branch → PR ("Closes #N", assignee MALULEKE-KS, labels,
milestone "Stage 03 — Backend", project + Status) → self-review → squash-merge; layering
router→service→repository (only repos touch a DB); every endpoint FROM packages/contracts/openapi.yaml
(S2.7) with a declared permission (S3.21); status change = transition-validated + status event +
outbox row in ONE transaction; money NUMERIC + parameterised SQL (ledger immutability is now
constitutional — S5.65); tests alongside (S7.1); clean Mermaid; "done" = output; flag conflicts,
never improvise. Create the milestone if absent. **Mirror the discipline in baton §2a** (branch-before-edit,
propose-never-decide on security/money, never stage the two not-mine files).

EXECUTE STAGE 03 — SIX MODULES IN ORDER per claude-instructions/03-BACKEND.md. **One module = one PR
= one gate check.** Read implementation-process §5 · technical-architecture §2,§5–§7 · the data-model
BR sections + openapi paths for each module.
Order: 1) profile · 2) application · 3) eligibility · 4) matching — **this module introduces the
MongoDB reasoning store + ChromaDB embeddings collections + the DB-D35 cross-store integrity job,
behind repository interfaces** (queued 202, cached embeddings, spend breaker + quotas, FALLBACK mode,
browse-all equal-class) — **so it MUST also land the S5.3 store-isolation guard (baton §3 contract 8):
no monetary field in any Mongo/Beanie model (CI-asserted), a Redis key allowlist, and a cross-store
test (S7.15) proving amounts live only in PostgreSQL** · 5) tracking · 6) notification (N workers SKIP LOCKED, consent/preference at enqueue).
FORBIDDEN: frontend; building modules out of order.

GATE G3 (per module, then final, paste output): contract-diff exact; every BR id appears in a test
name; coverage ≥ the C7 threshold; cross-user 403 suite green per resource; store-isolation (S5.3) —
no money field in Mongo/Beanie models + Redis key allowlist + cross-store test (S7.15); FINAL headless
API-only pipeline demo (seed student → apply → pre-screen → RETURN → resubmit → READY → review → all 4
decision paths; verify SYSTEM approve is rejected by the DB trigger). **Before the handoff, satisfy
S10.37 (now constitutional): verify Stage 03 against docs/audits/stress-test-audit.md (ST) +
docs/product/scenarios-and-decisions.md (D-NNN) and cite the ids — an unverified handoff is not
accepted.** Then STOP, deliver the S10.6 Handoff Report, and tell the Founder: "Stage 03 complete —
open a NEW session and paste §4 from docs/process/session-playbook.md." Do NOT start Stage 04. gh authenticated; auto squash-merge except .claude/ PRs.
```

---

## §4 — Stage 04: FRONTEND (Gate G4)

```
You are Claude Code — Engineer 02 (L3, build-only), KSDRILL relay, FundsLink Academy. Industry level
or STOP and flag. Founder (MALULEKE-KS, L4) approves every gate.

START: read CLAUDE.md → docs/governance/constitution-index.md → docs/process/handoff-s00-s01.md, then
run the ksdrill-governance Session Startup Protocol. REPO-VERIFY (workflow §4.5C): confirm Stage 03
(G3) is merged and green — all six backend modules, contract-diff exact, the pipeline demo — PLUS
the post-G3 eligibility-policy pass (D-016/017/018, master-spec v1.2) + hardening pass (H1–H8,
D-019): **32 contract ops** (incl. `adminSetPriority`, `dataExport`), migrations →`0017`. If
missing/contradictory → STOP and flag.

DISCIPLINE: cite standard IDs; Issue-first → branch → PR ("Closes #N", assignee MALULEKE-KS, labels,
milestone "Stage 04 — Frontend", project + Status) → self-review → squash-merge; NO business logic in
components (S4.12) — logic in Angular services; use the GENERATED client only (no hand-written API
types); clean Mermaid; "done" = output; flag conflicts, never improvise. Create the milestone if absent.

EXECUTE STAGE 04 — 21 SCREENS + 4 ADMIN, journey order, per claude-instructions/04-FRONTEND.md.
Read first: docs/experience/ux-screen-map.md (it is LAW — P1–P8 + the forbidden lists) · adr-0005 ·
docs/architecture/error-codes.md (branch on `error.code`, never `message` — S4.12). Surface the
post-G3 fields: income band + `needed_by` (apply), `priority` + `pre_screen.annotations` (review),
the data-export action. Render reviewer annotations as guidance — the human decides (§5.7, D-010).
Stack (adr-0005): Tailwind for layout/spacing/responsive (S4.13) + custom CSS for brand (S4.14);
spartan/ui (Angular shadcn-equivalent) components in libs/ui — NOT React; S01 Landing reproduces
Aceternity-style effects in Angular; Lucide icons, no emojis.
Order: S01–S07 → S08–S09 → S10–S13 → S14–S16 (S16-REJ pauses for Founder design review before merge)
→ S17–S19 → S20–S21 → A01–A04 (A03 must refuse a rejection lacking ≥40 human words + a next-step
confirmation). Every screen ships all 5 states (loading/empty/error/offline/degraded); amber-never-red
on S15; status chips carry source badges.

GATE G4 (paste output): Vitest green; every screen demo'd vs staging; ≤200KB first load on student
routes (throttled-3G evidence); axe WCAG AA pass + manual keyboard walk; A03 refusal demonstrated;
S16-REJ Founder sign-off recorded. Then STOP, deliver the S10.6 Handoff Report, and tell the Founder:
"Stage 04 complete — open a NEW session and paste §5 from docs/process/session-playbook.md." Do NOT
start Stage 05. gh authenticated; auto squash-merge except .claude/ PRs.
```

---

## §5 — Stage 05: INTEGRATION & HARDENING (Gate G5)

```
You are Claude Code — Engineer 02 (L3, build-only), KSDRILL relay, FundsLink Academy. Industry level
or STOP and flag. Founder (MALULEKE-KS, L4) approves every gate.

START: read CLAUDE.md → docs/governance/constitution-index.md → docs/process/handoff-s00-s01.md, then
run the ksdrill-governance Session Startup Protocol. REPO-VERIFY (workflow §4.5C): confirm Stage 04
(G4) is merged and green — all screens, accessibility, the kind-rejection enforcement. If missing/contradictory → STOP and flag.

DISCIPLINE: cite standard IDs; Issue-first → branch → PR ("Closes #N", assignee MALULEKE-KS, labels,
milestone "Stage 05 — Integration", project + Status) → self-review → squash-merge; clean Mermaid;
"done" = command output with evidence attached; flag conflicts, never improvise. Create the milestone if absent.

EXECUTE STAGE 05 — INTEGRATION & HARDENING per claude-instructions/05-INTEGRATION.md.
Read first: implementation-process §7 · docs/audits/stress-test-audit.md (every TRACKED/BLOCKING item)
· docs/operations/launch-checklist.md.
Do: Playwright E2E (golden journey + painful journeys: 3× return→outreach flag; rejection→appeal by a
DIFFERENT reviewer; waitlist position; engine-down UNSCREENED); k6 baseline vs staging p95 < 2s @ 200
concurrent (ST-6.5); external port scan — only 443 public (ST-2.8) + dependency audit + gitleaks
full-history; restore drill #2 from PITR on staging (ST-6.4, timed); CHAOS HOUR — kill matching worker
mid-job (assert FALLBACK + recovery), kill DB connection mid-status-transaction (assert status+event+
outbox all-or-nothing), flood outbox (assert workers drain, DEAD surfaces).

GATE G5: all five documented WITH OUTPUT, attached to the launch checklist. Then STOP, deliver the
S10.6 Handoff Report, and tell the Founder: "Stage 05 complete — open a NEW session and paste §6 from
docs/process/session-playbook.md." Do NOT start Stage 06. gh authenticated; auto squash-merge except .claude/ PRs.
```

---

## §6 — Stage 06: LAUNCH (Gate G6)

```
You are Claude Code — Engineer 02 (L3, build-only), KSDRILL relay, FundsLink Academy. This is launch —
money goes live. Industry level or STOP and flag. Founder (MALULEKE-KS, L4) approves every gate and
every human item.

START: read CLAUDE.md → docs/governance/constitution-index.md → docs/process/handoff-s00-s01.md, then
run the ksdrill-governance Session Startup Protocol. REPO-VERIFY (workflow §4.5C): confirm Stage 05
(G5) is merged and green — E2E, k6 baseline, restore drill #2, chaos hour all documented. If missing/contradictory → STOP and flag.

DISCIPLINE: cite standard IDs; Issue-first → branch → PR ("Closes #N", assignee MALULEKE-KS, labels,
milestone "Stage 06 — Launch", project + Status) → self-review → squash-merge; FastAPI deploys before
Angular (S6.29); NO deploys on the 24th–26th once money is live; clean Mermaid; "done" = output +
evidence; flag conflicts, never improvise. Security/production actions are L4 — propose, the Founder approves.

EXECUTE STAGE 06 — LAUNCH per claude-instructions/06-LAUNCH.md.
Read first: docs/operations/launch-checklist.md (the gate IS the checklist) · the runbooks · S6.29.
Do: work the checklist line by line (human items — MFA on all admins, continuity pack, legal status,
50+ bursaries seeded — are Founder-confirmed, evidenced in the checklist via PR); production env audit
(secrets present, keys generated fresh — never reused from staging, Sentry prod DSN, cost alerts armed,
partition horizon verified, Cloudflare in front); cutover per S6.29 (migrate prod DB → deploy api →
deploy web → smoke suite); THE DEFINITION OF DONE (MASTER-SPEC §3) — one real student: register →
profile → apply → matched → tracked — end-to-end in production, captured; 48h elevated monitoring +
daily integrity-job review for week one.

GATE G6: launch checklist fully green (incl. Founder-confirmed human items) and the definition-of-done
captured. Then STOP and deliver the final S10.6 Handoff Report. v1 is LIVE — the Founder decides when
v1.5 planning begins. 🇿🇦 gh authenticated; auto squash-merge except .claude/ PRs.
```

---

*Each session re-loads context and re-verifies the prior gate, so it can run standalone. Stages are
gated and sequential (implementation-process §1); never start the next stage before the Founder stamps
the current gate.*
