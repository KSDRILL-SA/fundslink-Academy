# FUNDSLINK ACADEMY — GOVERNANCE PATCHES v1.1
## L4 rulings of 2026-06-12, to be applied to the `system-design-template` repo

## Patch 1 — C5 Amendment (APPROVED): Immutable Ledger Standard
Add to C5 (Database Constitution):
> **S5.x (new) — Ledger Immutability.** Tables recording financial movements are append-only: the application role holds INSERT+SELECT only; UPDATE and DELETE are revoked and additionally blocked by trigger. Corrections are reversing entries referencing the original row. This standard applies to ledger, financial event, and audit tables in every KSDRILL system.
*Origin: MASTER-SPEC v1.0 §16.2 · Proven in fundslink-v1-schema.sql (violation test passed).*

## Patch 2 — fundslink-context.md: Approved Deviation (ADR-004, ACCEPTED)
Append under "Approved Deviations":
> **AD-001 (2026-06-12, Founder):** v1 data stores consolidated to PostgreSQL only — AI match reasoning as JSONB, embeddings as pgvector — behind unchanged repository seams. MongoDB (S5.33) and ChromaDB (S5.45–52) assignments resume at v2.5+ when volume justifies them. Rationale & trade-offs: ADR-004.

## Patch 3 — fundslink-context.md: Document register
Append: the system's authoritative documents are Documentation Suite v1.1 — main document **FUNDSLINK-MASTER-SPEC-v1.0.md** ⭐, with TAD v1.1, DB-DOCTRINE v1.1, ERD-PACKAGE v1.0 (+ validated `fundslink-v1-schema.sql`), STRESS-TEST-AUDIT v1.0, ADR-002/003/004, DOCS-MANIFEST v1.1.

## Patch 4 — Runbook stubs registered (to be written before v1.5/v2)
`runbooks/disbursement-runbook.md` (25th critical window — MASTER-SPEC §19.4) and `runbooks/jwt-key-rotation-runbook.md` (ST-2.9). Tracked as Manifest item 14.

**Applied by:** Founder via Claude Code in the repo. **Sign-off:** _____________ Maluleke Kurhula Success (L4)


## Patch 5 — DB-D21 Amendment (APPROVED): Third Trigger Class
DB-D21 ("triggers enforce physics, not business") gains a third approved class: **value-guards on append-only inserts that enforce constitutional principles** — currently exactly one: `fn_human_final` (SYSTEM principal barred from APPROVED/REJECTED/REJECTED_FINAL transitions — MASTER-SPEC v1.1 §5.8). Rationale: the Human-Final Principle is a constitutional invariant, not business workflow; defense-in-depth at the DB layer is warranted. Proven by violation test 2026-06-12.
