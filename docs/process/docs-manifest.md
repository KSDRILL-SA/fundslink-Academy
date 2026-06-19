# FUNDSLINK ACADEMY — DOCUMENTATION SUITE MANIFEST
## Suite Version 1.5 | 2026 — DESIGN PHASE COMPLETE (+ v1.1 Eligibility Wave)

> **This manifest is the design-phase completion record.** Live build status + the full document
> index are in [`docs/README.md`](../README.md). Build progress: Stages 00/01/02/03 ✅ + the
> eligibility-policy pass (D-016/017/018, **master-spec v1.2**) + the hardening pass (H1–H8, D-019)
> all done; migrations **0001→0017**; **32 contract ops**; **Stage 04 (frontend) next**. New
> reference doc: [`architecture/error-codes.md`](../architecture/error-codes.md) (the stable
> `error.code` registry). Forward design: `architecture/funding-donations-architecture.md` (v1.5+);
> `decisions/adr-0006-institutional-data-feed.md` (PROPOSED stub, Engineer 01).

**v1.3 change wave (Founder edge-case directive):** Smart Pre-Screening Engine, Category D (OTHER) with Other-Reasons store + theme tags, Human-Final Principle (DB-enforced + proven), 14-entry edge-case register (E1–E14), appeal/recusal/waitlist structures. Updated: MASTER-SPEC→v1.1 ⭐, ERD→v1.1 (+BR-E01–E10, 7 tables), schema (re-validated from scratch; 4 violation proofs passed), API→v1.1.0 (validated; +resubmit, +appeal), TAD→v1.2 (eligibility module), GOVERNANCE-PATCHES→v1.1 (DB-D21 third trigger class). | The single index, precedence order, and consistency record

---

## 1. THE SUITE AT v1.0

Per Founder directive, the documentation set is versioned **as a suite: Suite v1.0**. Individual documents keep internal version lineage (the Spec carries v4.0 because v1–v3 were prior business-spec generations — renaming it would orphan its own history). **Suite v1.0 = the exact set below, cross-checked for contradictions on 2026-06-12.**

| # | Document | Doc Version | Status | Role |
|---|----------|------------|--------|------|
| 1 | ⭐ master-spec.md | **v1.0 MASTER (Founder ruling: renamed from v4.0)** | LOCKED | **THE MAIN DOCUMENT** — description of operations |
| 2 | adr-0002-monorepo.md | — | accepted | Repo strategy + app topology |
| 3 | adr-0003-data-access.md | — | accepted | PostgreSQL hybrid data access |
| 4 | adr-0004-store-consolidation.md | — | **REJECTED (L4, 2026-06-13)** | declined — v1 keeps the 3 constitutional stores (PG + MongoDB + ChromaDB) |
| 5 | technical-architecture.md | v1.1 | PROPOSED → lock on L4 | HOW — architecture |
| 6 | doctrine.md | v1.1 | PROPOSED → lock on L4 | Database law (DB-D1–D44) — gates the ERD |
| 7 | stress-test-audit.md | v1.0 | ACCEPTED | Adversarial findings register (ST-1…ST-6) |
| 18a | CLAUDE.md (repo root) | v1.0 | ready | Claude Code auto-read master instructions: stage workflow, hard rules, precedence |
| 18b | claude-instructions/00–06 (7 files) | v1.0 | ready | Self-contained stage briefs — Founder says "execute stage NN", nothing more |
| 16 | ux-screen-map.md | v1.0 | PROPOSED → L4 lock | 21 screens, emotional design law (P1–P8), the kind rejection spec |
| 17 | implementation-process.md | v1.0 | PROPOSED → L4 lock | Stage-gated build order G0–G6 (database first) + Human Track |
| 17a | stage-review-playbook.md | v1.0 | ready | Sequential stage review protocol applying the `.ksdrill` AI review/challenge framework to FundsLink stages 00-06 |
| 8 | docs-manifest.md | v1.0 | this document | Index + precedence + order |

Superseded & retired: SPEC v3.0 (fully superseded by v4.0); TAD v1.0 and DOCTRINE v1.0 (superseded by v1.1 — do not circulate).

## 2. PRECEDENCE ORDER (conflict resolution)

When documents disagree, higher wins; the lower document must be amended, never silently ignored:

```
1. Constitutions C0–C10 + ADR-001          (system-design-template, governance/)
2. FUNDSLINK MASTER-SPEC v1.0                     (business truth)
3. ADRs 002–004                            (locked technical decisions)
4. TAD v1.1                                (architecture)
5. DB-DOCTRINE v1.1                        (database law)
6. STRESS-TEST-AUDIT v1.0                  (findings register — feeds amendments upward)
```

## 3. IMPLEMENTATION ORDER — WHERE WE ARE, WHAT WAS SKIPPED, WHAT'S NEXT

```
✅ 01 MASTER-SPEC v1.0                      ✅ 05 DB-DOCTRINE v1.1
✅ 02 ADR-002 (was SKIPPED, now done) ✅ 06 STRESS-TEST-AUDIT v1.0
✅ 03 ADR-003 (was SKIPPED, now done) ✅ 07 DOCS-MANIFEST v1.0
✅ 04 TAD v1.1                        ✅ 08 ADR-004 REJECTED (L4 2026-06-13 — v1 keeps 3 stores)
                                      ✅ 09 ERD PACKAGE v1.0 + schema.sql (DDL VALIDATED
                                                                      against live PostgreSQL 16;
                                                                      append-only & uniqueness constraints
                                                                      proven by violation tests)
                                      ✅ 10 openapi.yaml — VALIDATED (openapi-spec-validator: 19 paths, 22 schemas)
                                      ✅ 11 C5 AMENDMENT approved (GOVERNANCE-PATCHES v1.0)
                                      ✅ 12 context patch drafted (GOVERNANCE-PATCHES v1.0 — apply in repo)
                                      ✅ 13 constitution-index.md
                                      ✅ 14 runbook-disbursement.md + runbook-jwt-key-rotation.md
                                      ✅ 15 launch-checklist.md
   ━━━ DESIGN PIPELINE 01–15: COMPLETE ━━━
   then → CODE (repo scaffold per ADR-002 → auth module first)
```

## 4. CONSISTENCY SWEEP — CONTRADICTIONS FOUND & RESOLVED (2026-06-12)

| # | Contradiction | Resolution |
|---|---------------|------------|
| C-1 | TAD v1.0 ledger used polymorphic ref_type/ref_id; ST-3.2 condemned it | TAD v1.1 §4.5 + DB-D43: typed FKs. RESOLVED |
| C-2 | TAD v1.0 matching was synchronous; ST-1.2 showed cost/rate failure | TAD v1.1 §6.2 queued. RESOLVED |
| C-3 | TAD v1.0 "a worker" (singular) vs ST-1.3 | TAD v1.1: N workers SKIP LOCKED. RESOLVED |
| C-4 | No MFA anywhere vs two-step money approval | TAD v1.1 §3.1 MFA mandatory privileged roles. RESOLVED |
| C-5 | Doctrine D35 nightly cross-store job vs ADR-004 (if accepted, no cross-store at v1) | RESOLVED: ADR-004 **rejected** (L4 2026-06-13) → v1 runs the 3-store polyglot, so DB-D35's cross-store consistency job is **active**, not a no-op. |
| C-6 | MASTER-SPEC v1.0 vs locked 5-feature context | Resolved by Spec §3 Release Map (v1 = the 5). Already consistent |
| C-7 | Canon "numeric PKs" vs constitutional cuid | Doctrine §8 written ruling: cuid honors intent. RESOLVED |
| C-8 | Doc version naming ("all docs v1") vs Spec's v4.0 lineage | Suite-level v1.0 (this manifest); Spec keeps lineage with explanation. RESOLVED |

No unresolved contradictions remain. C-5 is resolved: ADR-004 was **rejected** (L4 2026-06-13), so DB-D35's cross-store consistency job is active.

## 5. OPEN L4 DECISIONS (the only things blocking the ERD)

1. ~~**ADR-004** — accept or reject v1 store consolidation~~ — **RESOLVED: REJECTED (L4 2026-06-13);** v1 keeps the 3-store polyglot.
2. **Lock TAD v1.1 + DB-DOCTRINE v1.1** (both carry your signature block).
3. C5 immutable-ledger amendment (can ride alongside the ERD).

Say the word on these three and item 09 — the ERD package — fires.
