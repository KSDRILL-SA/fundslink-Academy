# FundsLink Academy

A non-profit platform funding South African students who fall through NSFAS cracks.
A student creates a profile, submits an application, and receives AI-matched funding options.

> This system handles money and the hopes of vulnerable people. It is built to industry
> standard under the KSDRILL constitutional framework. See [CLAUDE.md](CLAUDE.md) for how
> work happens here and [docs/](docs/) for the governing documents (start at
> [docs/README.md](docs/README.md)).

## Stack
Angular 18 + FastAPI · PostgreSQL + MongoDB + ChromaDB + Redis · RS256 JWT auth.
Monorepo per ADR-002: `apps/api` (FastAPI, Railway) + `apps/web` (Angular, Vercel),
shared `packages/contracts` (the OpenAPI source of truth).

## Layout
```
apps/api/            FastAPI service (router -> service -> repository)
apps/web/            Angular workspace + libs/{ui,auth,data-access,util}
packages/contracts/  openapi.yaml — the API source of truth (S2.7)
infra/               docker-compose.dev.yml (postgres, mongo, chroma, redis, api)
governance/          pinned-SHA sync of the KSDRILL constitutions (ADR-002 §4)
docs/                governing documents (master spec, ADRs, TAD, DB doctrine, …)
claude-instructions/ stage briefs 00–06
```

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
cd apps/web && npm install && npm start   # -> http://localhost:4200/healthz
```

## Common tasks
```bash
make test        # api pytest + web vitest
make integrity   # local mirror of CI: ruff, import-linter, contract validate, web build
make down        # stop the dev stack
```

## Conduct
All git identity is the Founder's; no AI/assistant references in any GitHub-visible text;
secrets never enter files, logs, or history (S3.20 / CF-04). Workflow: every task is an
Issue → branch → linked PR → squash-merge (see [docs/process](docs/process/)).
