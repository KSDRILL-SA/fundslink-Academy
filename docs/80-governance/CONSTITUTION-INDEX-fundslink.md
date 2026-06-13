# FUNDSLINK ACADEMY — CONSTITUTION-INDEX (fundslink repo)
## Claude Code entry point. Read THIS FIRST in every session. Suite v1.1.

## You are
Engineer in the KSDRILL relay. Permission level per AI-INSTRUCTIONS (governance/). Cite standard IDs (S-x, DB-Dx, BR-x, ST-x) in every non-trivial decision. Never approve — propose; the Founder (L4) approves.

## Read order (only what the task needs)
1. ⭐ docs/00-master/FUNDSLINK-MASTER-SPEC-v1.1.md — THE MAIN DOCUMENT (what & why)
2. docs/20-architecture/FUNDSLINK-TAD-v1.2.md — architecture; docs/20-architecture/FUNDSLINK-ENGINEERING-ARCHITECTURE-v1.0.md — layering, rules, design-for-extension
3. docs/30-database/FUNDSLINK-DB-DOCTRINE-v1.1.md — DB law DB-D1–D44 (gates all schema work); docs/30-database/FUNDSLINK-DBLC-v1.0.md — models, normalization, state machines
4. docs/30-database/FUNDSLINK-ERD-PACKAGE-v1.1.md + docs/30-database/fundslink-v1-schema.sql (validated DDL)
5. packages/contracts/FUNDSLINK-API-v1.yaml — endpoints come FROM here (S2.7), never invented
6. docs/10-decisions/ADR-002..005 — locked decisions (monorepo, hybrid data access, store topology, frontend). **ADR-004 (PG-only) is REJECTED — v1 = PostgreSQL + MongoDB + ChromaDB + Redis.**
7. docs/50-process/FUNDSLINK-SDLC-v1.0.md — FRs/NFRs/traceability/gated lifecycle
8. docs/60-audits/FUNDSLINK-STRESS-TEST-AUDIT-v1.0.md — ST findings; BLOCKING gates live here
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
