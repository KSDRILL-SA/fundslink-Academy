# FundsLink Academy

> A non-profit platform that funds South African students who fall through NSFAS cracks — a student
> creates a profile, submits a funding application, and receives AI-matched bursaries, with a human
> making every funding decision.

[![api](https://github.com/KSDRILL-SA/fundslink-Academy/actions/workflows/api.yml/badge.svg)](https://github.com/KSDRILL-SA/fundslink-Academy/actions/workflows/api.yml)
[![web](https://github.com/KSDRILL-SA/fundslink-Academy/actions/workflows/web.yml/badge.svg)](https://github.com/KSDRILL-SA/fundslink-Academy/actions/workflows/web.yml)
[![contract](https://github.com/KSDRILL-SA/fundslink-Academy/actions/workflows/contract.yml/badge.svg)](https://github.com/KSDRILL-SA/fundslink-Academy/actions/workflows/contract.yml)
[![security](https://github.com/KSDRILL-SA/fundslink-Academy/actions/workflows/security.yml/badge.svg)](https://github.com/KSDRILL-SA/fundslink-Academy/actions/workflows/security.yml)

This system handles money and the hopes of vulnerable people. It is built to industry standard under
the KSDRILL constitutional framework — see [`CLAUDE.md`](CLAUDE.md) for how work happens here and
[`ARCHITECTURE.md`](ARCHITECTURE.md) for how it is built.

## Status

Stage-gated build (G0 → G6). **Foundation complete through Stage 03**; frontend is next.

| Gate | Stage | State |
|------|-------|-------|
| G0 | Scaffold · CI · environment | ✅ done |
| G1 | Database | ✅ done |
| G2 | Authentication & authorization | ✅ done |
| G3 | Backend modules (6) | ✅ done |
| G4 | Frontend | ▶ next |
| G5–G6 | Integration · Launch | ☐ to come |

## Stack

Angular 18 (Vercel) · FastAPI (Railway) · PostgreSQL + MongoDB + ChromaDB + Redis · RS256 JWT auth.
Monorepo per [ADR-002](docs/decisions/adr-0002-monorepo.md), contract-first per
[`packages/contracts/openapi.yaml`](packages/contracts/openapi.yaml).

## Repository structure

| Path | What lives here |
|------|-----------------|
| [`apps/api/`](apps/api) | FastAPI service — `router → service → repository`; Alembic migrations |
| [`apps/web/`](apps/web) | Angular 18 workspace — `libs/{ui,auth,data-access,util}` |
| [`packages/contracts/`](packages/contracts) | `openapi.yaml` — the single source of truth for every endpoint (S2.7) |
| [`infra/`](infra) | `docker-compose.dev.yml` — the full dev stack in one command |
| [`scripts/`](scripts) | CI gate scripts (contract-diff, permission-lint, store-isolation, drills) |
| [`docs/`](docs/README.md) | Governing documents, filed by concern — **start at `docs/README.md`** |
| [`claude-instructions/`](claude-instructions) | Per-stage build briefs (00–06) |
| [`governance/`](governance) | Pinned-SHA sync of the KSDRILL constitutions (ADR-002 §4) |

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the system map and [`docs/README.md`](docs/README.md)
for the full document index and precedence order.

## Quickstart

```bash
git clone https://github.com/KSDRILL-SA/fundslink-Academy.git
cd fundslink-Academy

# 1) Secrets — copy the templates and fill in locally (never commit .env)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 2) Bring up the dev stack (postgres, mongo, chroma, redis, api with /healthz)
make dev          # = docker compose -f infra/docker-compose.dev.yml up
curl localhost:8000/healthz   # -> {"success": true, "data": {"status": "ok"}, ...}

# 3) Run the Angular app (separate terminal)
cd apps/web && npm install && npm start   # -> http://localhost:4200
```

## Common tasks

```bash
make test        # api pytest + web vitest
make integrity   # local mirror of CI: ruff, import-linter, contract validate, web build
make down        # stop the dev stack
```

## Contributing & conduct

Every task travels **Issue → branch → PR → self-review → squash-merge** — see
[`CONTRIBUTING.md`](CONTRIBUTING.md). All git identity is the Founder's; no AI/assistant references in
any GitHub-visible text; secrets never enter files, logs, or history (S3.20 / CF-04).

## License

See [`LICENSE`](LICENSE). © 2026 KSDRILL-SA.
