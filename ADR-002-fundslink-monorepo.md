# ADR-002 — FundsLink Academy: Single-System Monorepo & Application Topology

| Attribute | Value |
|-----------|-------|
| **ID** | ADR-002 |
| **Date** | 2026-06-12 |
| **Status** | accepted |
| **Relates To** | ADR-001 (stack), S6.29 (deploy order), S2.7 (contract-first), S8.16 (CI) |

## Context
FundsLink comprises an Angular SPA and a FastAPI service that share one API contract and one deploy choreography, built by a solo developer with an AI-governed workflow. Repository strategy determines whether cross-cutting changes are atomic or a multi-repo coordination dance.

## Decision
1. **One monorepo per system** (`fundslink/`), containing both apps. NOT a studio-wide monorepo — the four KSDRILL platforms keep separate repos (different stacks, lifecycles, deploy cadences, zero shared runtime code).
2. **Application topology: two deployable apps + one worker.** `apps/api` (FastAPI, Railway — plus a second Railway process running the same codebase as outbox/scheduler worker) and `apps/web` (ONE Angular workspace, Vercel) with lazy-loaded, role-guarded feature areas (student/admin/donor/institution) — no portal sprawl.
3. **Shared code locations:** `packages/contracts/` (OpenAPI yaml + generated TS types — single source of truth both sides build from); Angular `libs/ui`, `libs/auth`, `libs/data-access`, `libs/util`; FastAPI `app/core` + `app/common`.
4. **Governance sync:** `system-design-template` remains its own repo; each system repo pulls it into `governance/` via a pinned-version sync script (not submodules).
5. **No Nx/Turborepo at v1** — path-filtered GitHub Actions suffice for two apps.

## Consequences
Easier: atomic contract+API+UI commits; S6.29 enforced by one ordered CI workflow (deploy-api → deploy-web); S2.7 mechanically enforceable (contract diff in CI); Claude Code gets full context in one workspace. Harder: repo grows large over years; CI needs path filters from day one to stay fast.

## Alternatives Rejected
Polyrepo (cross-repo version archaeology for every breaking change, fragile cross-repo CI triggers); studio mega-monorepo (blast radius across unrelated platforms, secrets sprawl, zero shared runtime benefit); separate admin/institution frontends (N JWT implementations to keep in sync).

> **Status: accepted — Owner approval: Maluleke Kurhula Success**
