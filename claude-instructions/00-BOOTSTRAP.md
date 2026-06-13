# STAGE 00 — BOOTSTRAP: FILE THE DOCS, RAISE THE SCAFFOLD, ARM THE GATES
**Read first (full):** docs-manifest.md · ADR-002 · implementation-process.md §2. **Skim:** MASTER-SPEC §1–3 (know what this system is before touching it).

## TASK 1 — File the 18 documents (they are loose in repo root)
Create and move:
```
docs/product/        master-spec.md
docs/decisions/     ADR-002*.md ADR-003*.md ADR-004*.md
docs/architecture/  technical-architecture.md
docs/database/      doctrine.md  data-model.md  schema.sql
docs/experience/    ux-screen-map.md
docs/process/       implementation-process.md  docs-manifest.md
docs/audits/        stress-test-audit.md
docs/operations/    runbook-disbursement.md  runbook-jwt-key-rotation.md  launch-checklist.md
docs/governance/    governance-patches.md  constitution-index.md
packages/contracts/    openapi.yaml
```
Write docs/README.md: one-line description per doc + the precedence order from the Manifest. Commit: `chore: file documentation suite v1.4`.

## TASK 2 — Monorepo scaffold (ADR-002 exactly)
```
apps/api/        FastAPI skeleton: app/{core,common,modules}/, main.py with /healthz, pyproject, pytest config
apps/web/        Angular 17+ workspace, strict TS, libs/{ui,auth,data-access,util} as projects, /healthz route
packages/contracts/  the yaml + codegen script (openapi-typescript) -> generated client into libs/data-access
infra/           docker-compose.dev.yml: postgres:16 + mongo:7 + chromadb + redis:7, volumes, healthchecks
governance/      sync script pulling system-design-template at a pinned SHA + GOVERNANCE_VERSION file
.github/workflows/  api.yml, web.yml (path-filtered), contract.yml
PARKED.md        empty, with header "Ideas wait here. The Release Map decides."
```

## TASK 3 — Arm every CI gate NOW (while the repo is empty)
api.yml: ruff + pytest + import-linter (modules/*/router.py, service.py may NOT import sqlalchemy/asyncpg) + permission-lint placeholder + contract-diff (fastapi openapi vs yaml). web.yml: tsc strict + Vitest + build. Deploy jobs: deploy-api THEN deploy-web (needs:), main-branch only.

## TASK 4 — Env + secrets hygiene
.env.example (never .env) for both apps; README quickstart: clone → docker compose up → make dev. Verify ANTHROPIC_API_KEY is NOT in shell profile (billing flag). Pre-commit: gitleaks.

## GATE G0 (paste real output)
[ ] `docker compose up -d && curl localhost:8000/healthz` → ok
[ ] CI green on the scaffold commit
[ ] Deliberate violation test: add `import sqlalchemy` to a router → CI FAILS → revert. The gate must be seen biting.
[ ] `tree -L 3` matches ADR-002
STOP. Founder reviews G0.
