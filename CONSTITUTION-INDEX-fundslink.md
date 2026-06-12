# FUNDSLINK ACADEMY — CONSTITUTION-INDEX (fundslink repo)
## Claude Code entry point. Read THIS FIRST in every session. Suite v1.1.

## You are
Engineer in the KSDRILL relay. Permission level per AI-INSTRUCTIONS (governance/). Cite standard IDs (S-x, DB-Dx, BR-x, ST-x) in every non-trivial decision. Never approve — propose; the Founder (L4) approves.

## Read order (only what the task needs)
1. ⭐ docs/FUNDSLINK-MASTER-SPEC-v1.0.md — THE MAIN DOCUMENT (what & why)
2. docs/FUNDSLINK-TAD-v1.1.md — architecture (how)
3. docs/FUNDSLINK-DB-DOCTRINE-v1.1.md — DB law DB-D1–D44 (gates all schema work)
4. docs/erd/FUNDSLINK-ERD-PACKAGE-v1.0.md + db/fundslink-v1-schema.sql (validated DDL)
5. packages/contracts/FUNDSLINK-API-v1.yaml — endpoints come FROM here (S2.7), never invented
6. docs/adrs/ADR-002..004 — locked decisions (monorepo/topology, hybrid data access, v1 PG-only)
7. docs/FUNDSLINK-STRESS-TEST-AUDIT-v1.0.md — ST findings; BLOCKING gates live here
8. governance/ — constitutions C0–C10 (synced, pinned)

## Hard rules (violations = stop and flag)
- v1 scope = the 5 features in MASTER-SPEC §3 Release Map. `fin`/`institution` modules ship dark behind flags.
- Layering: router → service → repository. Only repositories import DB drivers (import-linter enforced).
- Money: raw parameterised SQL, NUMERIC, append-only ledgers (when v1.5+). CRUD: SQLAlchemy (ADR-003).
- Every endpoint declares a permission (deny-by-default lint). Every mutation writes audit_log in-transaction.
- Status changes ride the transition tables + enqueue outbox rows in the SAME transaction.
- Counselling data: NEVER in the main schema, NEVER in matching inputs (MASTER-SPEC §6.4).
- No deploys on the 24th–26th once money is live. FastAPI deploys before Angular (S6.29).
- Schema changes must pass the DB-Doctrine §11 gate; contract changes re-validate against the OpenAPI file in CI.
