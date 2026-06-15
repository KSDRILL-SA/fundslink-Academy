# FUNDSLINK ACADEMY — GOVERNANCE PATCHES v1.2
## L4 rulings, applied to the `system-design-template` repo

> **2026-06-15 — Patches 1 & 6 RATIFIED + APPLIED.** Both committed to the governance template
> (`system-design-template`) at commit `1db276f`, amendment issue **#8**, via the C0 §8 protocol
> (24h sit satisfied, adversarial + cross-constitution review documented). Patch 1 → **C5 v1.1,
> S5.65**; Patch 6 → **C10 v1.1, S10.37**.

## Patch 1 — C5 Amendment (✅ RATIFIED + APPLIED 2026-06-15): Immutable Ledger Standard
Added to C5 (Database Constitution) as **S5.65** (Part 9 — Financial Ledger Integrity), C5 v1.1:
> **S5.65 — Ledger Immutability.** Tables recording financial movements are append-only: the application role holds INSERT+SELECT only; UPDATE and DELETE are revoked and additionally blocked by trigger. Corrections are reversing entries referencing the original row. Ledgers are exempt from S5.8 soft-delete (a `deleted_at` stamp is itself an UPDATE). This standard applies to ledger, financial event, and audit tables in every KSDRILL system.
*Origin: MASTER-SPEC v1.0 §16.2 · Proven in schema.sql (violation test passed) · Applied: template commit `1db276f`, issue #8.*

## Patch 2 — fundslink-context.md: ADR-004 REJECTED (no deviation recorded)
~~Append under "Approved Deviations":~~ **Rescinded.** No deviation is recorded; the locked
context's 3-store assignment stands unchanged.
> **AD-001 (2026-06-12 → RESCINDED 2026-06-13, Founder):** the v1 PostgreSQL-only consolidation is **rescinded**. v1 uses the constitutional 3-store polyglot — PostgreSQL + MongoDB (AI reasoning, S5.33) + ChromaDB (embeddings, S5.45–52) + Redis. ADR-004 is rejected; the polyglot applies from v1, not v2.5. See ADR-004 and ERD-PACKAGE v1.1.

## Patch 3 — fundslink-context.md: Document register
Append: the system's authoritative documents are Documentation Suite v1.1 — main document **master-spec.md** ⭐, with TAD v1.1, DB-DOCTRINE v1.1, ERD-PACKAGE v1.0 (+ validated `schema.sql`), STRESS-TEST-AUDIT v1.0, ADR-002/003/004, DOCS-MANIFEST v1.1.

## Patch 4 — Runbook stubs registered (to be written before v1.5/v2)
`runbooks/disbursement-runbook.md` (25th critical window — MASTER-SPEC §19.4) and `runbooks/jwt-key-rotation-runbook.md` (ST-2.9). Tracked as Manifest item 14.

**Applied by:** Founder (L4) in the repo. **Sign-off:** Maluleke Kurhula Success (L4) — 2026-06-12 (Patches 1–5), 2026-06-15 (Patches 1 & 6 ratified + applied to template).


## Patch 5 — DB-D21 Amendment (APPROVED): Third Trigger Class
DB-D21 ("triggers enforce physics, not business") gains a third approved class: **value-guards on append-only inserts that enforce constitutional principles** — currently exactly one: `fn_human_final` (SYSTEM principal barred from APPROVED/REJECTED/REJECTED_FINAL transitions — MASTER-SPEC v1.1 §5.8). Rationale: the Human-Final Principle is a constitutional invariant, not business workflow; defense-in-depth at the DB layer is warranted. Proven by violation test 2026-06-12.


## Patch 6 — C10 Amendment (✅ RATIFIED + APPLIED 2026-06-15): Post-Phase Adversarial Verification
Added to C10 (AI Collaboration) as **S10.37** (Part 7 — Relay Handoff Verification), C10 v1.1:
> **S10.37 — Post-Phase Adversarial Verification Before Handoff.** Before delivering the S10.6 handoff, the engineer verifies the completed phase against the system's stress-test/red-team audit (`ST-x`) and scenario-and-decision log (`D-NNN`), recording in the handoff report the ids satisfied (and any deferred, with reason). An unverified handoff is incomplete and is not accepted at the S10.6 gate. Generic — applies to every KSDRILL system.
*Origin: FundsLink Stage-02 hardening caught 7 ST-2 gaps that the green test suite had passed · Cross-refs S10.6, S10.27, C7 · Applied: template commit `1db276f`, issue #8.*

This is the standing rule already wired into FundsLink's own docs: see CONSTITUTION-INDEX "Post-phase verification", the S01→S02 and S02→S03 handoffs, and the system-context. `docs/audits/stress-test-audit.md` (ST-1…6) + `docs/product/scenarios-and-decisions.md` (D-NNN) are the registers every phase is checked against.
