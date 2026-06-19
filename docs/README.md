# FundsLink Academy — Documentation Suite

The governing documents for FundsLink Academy, filed by concern. This index gives a one-line
description of every document and the **precedence order** used to resolve conflicts. Stage briefs
live in [`/claude-instructions`](../claude-instructions); master Claude Code instructions live in
[`/CLAUDE.md`](../CLAUDE.md).

> Design phase complete (+ v1.1 Eligibility Wave). v1 store topology =
> **PostgreSQL + MongoDB + ChromaDB + Redis** (constitutional polyglot). ADR-004's PostgreSQL-only
> consolidation was **REJECTED (L4, 2026-06-13)**.

---

## Build status (as of 2026-06-15)

```mermaid
graph LR
  G0["G0 Scaffold ✅"]:::done --> G1["G1 Database ✅"]:::done --> G2["G2 Auth ✅"]:::done --> G3["G3 Backend ▶"]:::now --> G4["G4 Frontend ⬜"]:::todo --> G5["G5 Integration ⬜"]:::todo --> G6["G6 Launch ⬜"]:::todo
  classDef done fill:#0e7490,color:#fff,stroke:#155e75;
  classDef now fill:#1d4ed8,color:#fff,stroke:#1e3a8a;
  classDef todo fill:#475569,color:#fff,stroke:#334155;
```

| Area | Status |
|------|--------|
| Documentation suite (design · lifecycle · sdlc · engineering-architecture · diagrams) | ✅ **complete** |
| Stage 00 — monorepo scaffold · CI gates · env hygiene | ✅ **complete** (Gate G0) |
| Stage 01 — the database | ✅ **complete** (Gate G1; migrations 0001→0009) |
| Stage 02 — auth | ✅ **complete** (Gate G2 + hardened + DB-integrated; migrations →0014) |
| Stage 03 — backend modules | ✅ **complete** (Gate G3; 6 modules; migrations →0015) |
| Stage 03+ — eligibility-policy pass (D-016/017/018, master-spec **v1.2**) + hardening pass (H1–H8, D-019) | ✅ **complete** (migrations →0017; 32 contract ops; H5→v1.5) |
| **Stage 04 — frontend** | ▶ **next** (new session) |
| Stages 05–06 — integration → launch | ⬜ to complete |
| Deferred by design — financial/donations (v1.5+; design: architecture/funding-donations-architecture) · institution (v2) · MongoDB/ChromaDB bootstrap (Stage 03) | ⬜ flag-gated / later |

---

## Precedence order (conflict resolution)

When documents disagree, the **higher** source wins; the lower document must be amended, never
silently ignored (manifest §2 · [CLAUDE.md](../CLAUDE.md) "IF SOMETHING CONFLICTS").

```
1. Constitutions C0–C10 + ADR-001        ← governance/ (system-design-template, synced & pinned)
2. master-spec                            ← business truth
3. ADRs 0002–0005                         ← locked technical decisions
4. technical-architecture                 ← architecture (how)
5. database/doctrine                      ← database law (DB-D1–D44), gates the data model
6. audits/stress-test-audit               ← adversarial findings register (feeds amendments upward)
   then → stage briefs (claude-instructions/00–06)
```

Conflicts are reported to the Founder with both citations — never resolved silently.

---

## Doc map

```mermaid
graph LR
  ROOT["CLAUDE.md<br/>governs every session"]
  ROOT --> CI["claude-instructions/<br/>stage briefs 00–06"]
  ROOT --> DOCS["docs/"]
  ROOT --> PKG["packages/contracts<br/>openapi.yaml (S2.7)"]
  ROOT --> GV["governance/<br/>C0–C10 (synced, pinned)"]
  DOCS --> M["product · master-spec"]
  DOCS --> DEC["decisions · adr-0002…0006"]
  DOCS --> ARCH["architecture · technical + engineering"]
  DOCS --> DB["database · lifecycle · doctrine · data-model · schema"]
  DOCS --> UX["experience · ux-screen-map"]
  DOCS --> PROC["process · sdlc · implementation · workflow · manifest"]
  DOCS --> AUD["audits · stress-test"]
  DOCS --> OPS["operations · runbooks · launch"]
  DOCS --> GOV["governance · constitution-index · patches"]
  classDef r fill:#1d4ed8,color:#fff,stroke:#1e3a8a;
  class ROOT r;
```

---

## Document index

### `product/` — what & why
| Document | Description |
|----------|-------------|
| [master-spec.md](product/master-spec.md) | ⭐ THE MAIN DOCUMENT — full description of operations, the v1 Release Map, and business rules. |

### `decisions/` — locked technical decisions (ADRs)
| Document | Description |
|----------|-------------|
| [adr-0002-monorepo.md](decisions/adr-0002-monorepo.md) | Single-system monorepo + application topology (two apps + worker). **accepted**. |
| [adr-0003-data-access.md](decisions/adr-0003-data-access.md) | PostgreSQL hybrid data access — raw SQL for money paths, SQLAlchemy for CRUD. **accepted**. |
| [adr-0004-store-consolidation.md](decisions/adr-0004-store-consolidation.md) | Proposed v1 PostgreSQL-only consolidation — **REJECTED (L4, 2026-06-13)**; v1 keeps the 3-store polyglot. |
| [adr-0005-frontend-strategy.md](decisions/adr-0005-frontend-strategy.md) | Angular-native frontend — Tailwind + custom CSS + spartan/ui; Magic/Aceternity reproduced in Angular. **accepted (L4)**. |
| [adr-0006-institutional-data-feed.md](decisions/adr-0006-institutional-data-feed.md) | Institutional academic+financial data feed — **PROPOSED stub** (design-handoff to Engineer 01; gated on MOUs + POPIA; v2→v4). Not a v1 build item. |

### `architecture/` — how
| Document | Description |
|----------|-------------|
| [technical-architecture.md](architecture/technical-architecture.md) | TAD — topology, queued matching, MFA, eligibility module, deploy choreography. |
| [engineering-architecture.md](architecture/engineering-architecture.md) | Layering (router→service→repository), shared/common homes, enforced hard rules, design-for-extension seams. |
| [funding-donations-architecture.md](architecture/funding-donations-architecture.md) | Funding intake (donors/institutions/partners) forward design for v1.5+; readiness audit; PROPOSED (L4 lock pending). |
| [error-codes.md](architecture/error-codes.md) | The stable `error.code` registry (28 codes · HTTP · meaning) — the contract the frontend branches on (S4.12). |

### `database/` — database law & schema
| Document | Description |
|----------|-------------|
| [README.md](database/README.md) | **The database capstone** — apply path (migrations 0001→0017), security model (roles, RLS, append-only), triggers, and the backend/auth integration contracts. |
| [lifecycle.md](database/lifecycle.md) | Database lifecycle — conceptual/logical/physical models, normalization (1NF→BCNF), status state machines, store assignment. |
| [doctrine.md](database/doctrine.md) | Database law DB-D1–D44 — gates all schema work. |
| [data-model.md](database/data-model.md) | Entity-relationship package + business-rule catalog (BR-A/S/E/T/M/N). |
| [schema.sql](database/schema.sql) | PostgreSQL DDL — auth, applications, tracking, match records. Embeddings → ChromaDB; AI reasoning → MongoDB. |

### `experience/` — UX
| Document | Description |
|----------|-------------|
| [ux-screen-map.md](experience/ux-screen-map.md) | 21 screens, emotional-design law (P1–P8), the kind-rejection spec. |

### `process/` — how we build
| Document | Description |
|----------|-------------|
| [sdlc.md](process/sdlc.md) | SDLC foundation — gated lifecycle, Functional + Non-Functional Requirements, traceability, quality scenarios. |
| [implementation-process.md](process/implementation-process.md) | Stage-gated build order G0–G6 (database first) + Human Track. |
| [docs-manifest.md](process/docs-manifest.md) | The suite index, precedence order, and cross-document consistency record. |
| [github-workflow.md](process/github-workflow.md) | GitHub workflow: issue → branch → linked PR → self-review → squash-merge; labels & milestones. |
| [handoff-s00-s01.md](process/handoff-s00-s01.md) | Relay handoff — Stage 00 → Stage 01. |
| [handoff-s01-s02.md](process/handoff-s01-s02.md) | Relay handoff — Stage 01 (database) → Stage 02 (auth). |
| [handoff-s02-s03.md](process/handoff-s02-s03.md) | Relay handoff — Stage 02 (auth, complete + hardened) → Stage 03 (backend); contracts Stage 03 must honor. |
| [session-playbook.md](process/session-playbook.md) | **Per-phase terminal prompts (Stage 01→06)** — one phase per session; each prompt self-contained, ending by pointing to the next session. |

### `audits/` — adversarial findings
| Document | Description |
|----------|-------------|
| [stress-test-audit.md](audits/stress-test-audit.md) | Stress-test findings register (ST-1…ST-6) — blocking gates feed amendments upward. |

### `operations/` — runbooks & launch
| Document | Description |
|----------|-------------|
| [runbook-disbursement.md](operations/runbook-disbursement.md) | Monthly disbursement runbook (+ sequence diagram). |
| [runbook-jwt-key-rotation.md](operations/runbook-jwt-key-rotation.md) | RS256 JWT key-rotation runbook (+ sequence diagram). |
| [launch-checklist.md](operations/launch-checklist.md) | Production launch checklist + cutover steps. |

### `governance/` — the project's constitutional layer
| Document | Description |
|----------|-------------|
| [constitution-index.md](governance/constitution-index.md) | Claude Code entry point — read order, hard rules, standard-ID map (`S10.21`). |
| [governance-patches.md](governance/governance-patches.md) | Approved constitutional amendments for this system. |

### `packages/contracts/` — the API source of truth
| Document | Description |
|----------|-------------|
| [openapi.yaml](../packages/contracts/openapi.yaml) | OpenAPI contract — every endpoint comes FROM here (`S2.7`); CI diffs against it. |

---

*The full GOVERNOVA constitutions (C0–C10) are not stored here — they are synced into `governance/`
from `system-design-template` at a pinned SHA (ADR-002 §4). See [CLAUDE.md](../CLAUDE.md) for the
stage workflow and hard rules.*
