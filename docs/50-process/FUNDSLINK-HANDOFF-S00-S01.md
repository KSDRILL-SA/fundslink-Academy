# FundsLink Academy — Handoff: Stage 00 (Foundation) → Stage 01 (Database)

The relay baton. Everything the next engineer (terminal Claude Code) needs to pick up at the highest level.
Date: 2026-06-13 · From: Engineer 02 (Claude Code, L3) · Approver: Founder (L4).

```mermaid
graph LR
  S0["Stage 00 ✅<br/>scaffold · CI · foundation docs"] --> S1["Stage 01 ▶<br/>THE DATABASE"]
  S1 --> S2["02 Auth"] --> S3["03 Backend"] --> S4["04 Frontend"] --> S5["05 Integration"] --> S6["06 Launch"]
  classDef done fill:#0e7490,color:#fff,stroke:#155e75;
  classDef now fill:#1d4ed8,color:#fff,stroke:#1e3a8a;
  class S0 done;
  class S1 now;
```

---

## 1. What is built (Stage 00 + foundation hardening) — all verified green

- **Monorepo (ADR-002):** `apps/api` (FastAPI, `/healthz` only), `apps/web` (Angular 18 + `libs/{ui,auth,data-access,util}`, **Tailwind + shadcn/spartan token theme**), `packages/contracts` (OpenAPI + codegen), `infra/docker-compose.dev.yml` (**postgres16 + mongo7 + chromadb + redis7**, healthchecks), `governance/` (pinned-SHA sync stub), `PARKED.md`.
- **CI gates armed & green:** `api` (ruff + import-linter + pytest), `web` (vitest + build), `contract` (OpenAPI validate), `security` (gitleaks CLI), `deploy` (ordered, disabled). Layering gate **proven to bite** (router importing `sqlalchemy` → CI failed → reverted).
- **Foundation docs (diagram-first):** DBLC, SDLC, Engineering-Architecture, ADR-005, runbook sequence diagrams, doc-suite map — merged + indexed in `docs/README.md`. Stage briefs `00–06` aligned to the corrected system.
- **Final review (on main):** `pytest` ✓ · `ruff` ✓ · `import-linter` KEPT ✓ · `vitest` ✓ · `ng build` ✓ · CI green · structure per ADR-002 · no residual store contradictions.

## 2. Locked stack & decisions

| | |
|---|---|
| Stack | Angular 18 + FastAPI (ADR-001) |
| Stores | **PostgreSQL** (auth/apps/tracking/match record) · **MongoDB** (AI reasoning, S5.33) · **ChromaDB** (embeddings, S5.45) · **Redis** (deny-list/cache) |
| Auth | RS256 JWT; refresh in HttpOnly cookie, access in Angular memory (S3.13/S3.14) |
| ADRs | 002 monorepo · 003 hybrid data access · **004 REJECTED** (PG-only) · **005** frontend (Tailwind + spartan/ui; Aceternity/Magic reproduced in Angular) |
| Deploy | Railway (API) before Vercel (web) — S6.29 |

## 3. How we work (must follow)

- **Governance:** Engineer 02 = L3 build-only; the **Founder (L4) approves/merges**; cite `S{C}.{N}`; flag violations, never silently comply. `.ksdrill/` holds the GOVERNOVA constitutions (gitignored clone).
- **GitHub workflow** (`docs/50-process/FUNDSLINK-GITHUB-WORKFLOW`): every task → **Issue first** (type `Task`, assignee `MALULEKE-KS`, labels, stage milestone, `FundsLink Academy` project + Status) → **branch** → **PR** with `Closes #N` → documented self-review → **squash-merge**. One task = one branch = one PR.
- **Docs standard:** clean, professional **Mermaid** for anything words can't carry — including PR descriptions.
- **Layering (enforced):** router → service → repository; only repositories import DB drivers (import-linter). No business logic in UI (S4.12). No hardcoded business values — config table (DB-D24). Secrets never in code (S3.20).
- **Tooling:** `gh` via full path `"/c/Program Files/GitHub CLI/gh.exe"`; auto squash-merge is granted EXCEPT for PRs that change `.claude/` permissions (Founder merges those).

## 4. ▶ NEXT TASK — Stage 01: THE DATABASE

**Command:** “execute stage 01”. **Brief:** `claude-instructions/01-DATABASE.md` (now carries the 3-store note). **Forbidden:** endpoints, services, Angular, auth logic — the database exists alone until G1.

**Read first:** `docs/30-database/` (DBLC, DB-DOCTRINE, ERD-PACKAGE, `fundslink-v1-schema.sql`) · `IMPLEMENTATION-PROCESS §3` · reference TAD §4, ADR-003.

**Tasks:** Alembic migration 0001 (wrap the validated schema — do **not** redesign) · seeds 0002 · **DB-D37 constraint test suite** (attempt every violation, assert rejection) · integrity-job skeleton · partition maintenance · repository base layer · restore drill · EXPLAIN baseline.

**Gate G1:** upgrade-from-zero + downgrade→upgrade roundtrip clean; constraint suite 100% green in CI; `make integrity` clean on seeded DB; restore-drill log committed; EXPLAIN shows index scans.

**Store scope (already in the brief):** Stage 01 builds the **PostgreSQL** schema + constraints only. The schema holds no embeddings (→ ChromaDB) or reasoning (→ MongoDB). **MongoDB/ChromaDB collection bootstrap + the DB-D35 cross-store integrity job land with the matching module (Stage 03)**, behind repository seams (its first consumer).

## 5. Founder open actions (not code)

- **Revoke** the Session-00 PAT now that setup is done.
- **Branch protection** on `main` (S1.16) — enable on GitHub Pro.
- **Gate G0 Docker check** (couldn't run on the build host — no Docker): `docker compose -f infra/docker-compose.dev.yml up -d && curl localhost:8000/healthz`.
- **`governance/sync.sh`** `GOVERNANCE_SHA` is a `<PINNED_SHA>` placeholder — pin to a real commit when first vendoring governance.

---

## 6. Paste-ready opening prompt for the terminal

```
You are Claude Code, Engineer 02 (Senior Engineer, L3, build-only) in the KSDRILL relay,
working on FundsLink Academy. Read CLAUDE.md, then docs/80-governance/CONSTITUTION-INDEX-fundslink.md
(the entry point), then docs/50-process/FUNDSLINK-HANDOFF-S00-S01.md (full build history + how we work).

Run the governance Session Startup Protocol (the .ksdrill/ clone holds C0–C10). Confirm: 3-store
topology (PostgreSQL + MongoDB + ChromaDB + Redis; ADR-004 rejected), the issue→branch→linked-PR→
squash workflow (assignee MALULEKE-KS, labels, the "Stage 01 — Database" milestone, the FundsLink
Academy project + Status), and clean Mermaid in docs and PRs.

Then EXECUTE STAGE 01 — THE DATABASE per claude-instructions/01-DATABASE.md: Alembic migration
wrapping the validated fundslink-v1-schema.sql (do not redesign), seeds, the DB-D37 constraint
test suite, integrity-job skeleton, partition maintenance, repository base layer, restore drill,
EXPLAIN baseline. PostgreSQL only this stage (Mongo/Chroma bootstrap is Stage 03). Cite standard
IDs, one PR per logical unit, and STOP at Gate G1 for the Founder.
```

---

*Stage 00 closed by Engineer 02 (Claude Code, L3) on 2026-06-13. Foundation verified solid; no blocking gaps for Stage 01.*
