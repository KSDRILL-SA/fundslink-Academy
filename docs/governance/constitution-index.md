# FUNDSLINK ACADEMY — CONSTITUTION-INDEX (fundslink repo)
## Claude Code entry point. Read THIS FIRST in every session. Suite v1.1.

## Phase status (keep current — S10.23)
| Stage | State | Proof |
|-------|-------|-------|
| 00 Scaffold · 01 Database (G1) · 02 Auth (G2) | ✅ DONE | migrations 0001→0014; 216 API + 7 web tests; contract-diff + permission-lint REAL |
| 03 Backend modules (G3) | ✅ DONE | migrations 0001→0015; 315 API tests; 30 contract ops; store-isolation (S5.3) CI gate; pipeline demo green — see `docs/process/handoff-s03-s04.md` |
| 04 Frontend (G4) | ▶ NEXT (new session) | `claude-instructions/04-FRONTEND.md` |
Money/donations are **v1.5+ (deferred-not-promised, MASTER-SPEC §3.3)** — forward design: `docs/architecture/funding-donations-architecture.md`.

## Post-phase verification (MANDATORY before every handoff)
After finishing a phase, **before** the S10.6 handoff, verify your work satisfies the adversarial
results in **`docs/audits/stress-test-audit.md`** (ST-1…6 — the active-attacker/hardening audit)
and the edge rulings in **`docs/product/scenarios-and-decisions.md`** (D-NNN). Cite the ST/D ids
you satisfied (e.g. ST-2.1 MFA, ST-2.3 cross-user 403, ST-2.9 key-rotation, D-015 auth RLS).
A phase is not "done" until its relevant ST findings are met or explicitly deferred with a reason.

## You are
Engineer in the KSDRILL relay. Permission level per AI-INSTRUCTIONS (governance/). Cite standard IDs (S-x, DB-Dx, BR-x, ST-x) in every non-trivial decision. Never approve — propose; the Founder (L4) approves.

## Read order (only what the task needs)
1. ⭐ docs/product/master-spec.md — THE MAIN DOCUMENT (what & why)
2. docs/architecture/technical-architecture.md — architecture; docs/architecture/engineering-architecture.md — layering, rules, design-for-extension
3. docs/database/doctrine.md — DB law DB-D1–D44 (gates all schema work); docs/database/lifecycle.md — models, normalization, state machines
4. docs/database/data-model.md + docs/database/schema.sql (validated DDL)
5. packages/contracts/openapi.yaml — endpoints come FROM here (S2.7), never invented
6. docs/decisions/ADR-002..005 — locked decisions (monorepo, hybrid data access, store topology, frontend). **ADR-004 (PG-only) is REJECTED — v1 = PostgreSQL + MongoDB + ChromaDB + Redis.**
7. docs/process/sdlc.md — FRs/NFRs/traceability/gated lifecycle
7a. ⭐ docs/product/scenarios-and-decisions.md — the Scenarios & Decisions Playbook: student-edge rulings (D-NNN) every phase consults before building a flow; append new decisions, never guess
8. docs/audits/stress-test-audit.md — ST findings; BLOCKING gates live here
9. governance/ — constitutions C0–C10 (synced, pinned)

## Hard rules (violations = stop and flag)
- v1 scope = the 5 features in MASTER-SPEC §3 Release Map. `fin`/`institution` modules ship dark behind flags.
- Layering: router → service → repository. Only repositories import DB drivers (import-linter enforced).
- Money: raw parameterised SQL, NUMERIC, append-only ledgers (when v1.5+). CRUD: SQLAlchemy (ADR-003).
- Every endpoint declares a permission (deny-by-default lint). Every mutation writes audit_log in-transaction.
- Status changes ride the transition tables + enqueue outbox rows in the SAME transaction.
- Counselling data: NEVER in the main schema, NEVER in matching inputs (MASTER-SPEC §6.4).
- No deploys on the 24th–26th once money is live. FastAPI deploys before Angular (S6.29).
- Schema changes must pass the DB-Doctrine §11 gate; contract changes re-validate against the OpenAPI file in CI.
