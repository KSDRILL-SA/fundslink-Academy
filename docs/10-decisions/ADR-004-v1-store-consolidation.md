# ADR-004 — FundsLink Academy: v1 Data-Store Consolidation

| Attribute | Value |
|-----------|-------|
| **ID** | ADR-004 |
| **Date** | 2026-06-12 |
| **Status** | **REJECTED — Founder (L4), 2026-06-13** |
| **Relates To** | ADR-001, S5.33, S5.45–S5.52, ST-AUDIT Q5/Q6 |

## Context
ADR-001 assigns three stores (PostgreSQL + MongoDB for AI reasoning + ChromaDB for vectors). At v1 scale with a solo operator, three stateful services means 3× backups, monitoring, upgrade surface, and cost — identified by the Stress-Test Audit as v1 ops weight without v1 benefit.

## Proposal
For v1 ONLY: AI match reasoning → PostgreSQL **JSONB** (same repository interface as the Beanie implementation); embeddings → **pgvector** (same repository interface as the ChromaDB client). One stateful service to back up and pay for. MongoDB and ChromaDB return at v2.5+ when reasoning-document volume and vector scale justify them — the repository seams make the migration mechanical, and the constitutional polyglot assignment (S5.33, S5.45) is retained as the at-scale architecture.

## Trade-offs
For: ~40% infra cost cut, one backup/restore drill, one upgrade path, PITR covers everything including vectors. Against: deviates from the locked context's three-store assignment (requires an Approved Deviation entry in fundslink-context.md); pgvector index tuning differs from ChromaDB defaults.

## Decision
**Rejected (Founder, L4, 2026-06-13).** v1 keeps the constitutional polyglot stores —
**PostgreSQL + MongoDB + ChromaDB + Redis** — per ADR-001 and the locked `fundslink-context.md`
(Approved Deviations: *None*). The system is not time-constrained, so the solo-ops cost saving did
not justify deviating from the locked architecture. The polyglot assignment stands in full
(S5.33 MongoDB for reasoning, S5.45 ChromaDB for vectors); doctrine DB-D35's cross-store job
remains **active**, not a no-op. MongoDB and ChromaDB are present from v1, not deferred.
