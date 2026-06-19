# Contributing

How work happens in this repository. The full standing order lives in
[`docs/process/github-workflow.md`](docs/process/github-workflow.md); this is the working summary.

> Governance: contributors **propose**; the Founder (L4) **approves**. Cite standard IDs
> (`S-x`, `DB-Dx`, `BR-x`, `ST-x`, `D-NNN`) in every non-trivial decision. Read
> [`CLAUDE.md`](CLAUDE.md) and [`docs/governance/constitution-index.md`](docs/governance/constitution-index.md)
> before your first change.

## The loop — every unit of work

**Issue → Branch → PR → self-review → squash-merge.** One task = one branch = one PR. Nothing is
committed straight to `main`.

1. **Open an Issue first.** Set the type (`Task` / `Bug` / `Feature`), assignee, a type label +
   `stage:NN-…`, the stage milestone, and add it to the project board (`Todo → In Progress → Done`).
2. **Branch off `main`** (solo mode today), kebab-case Conventional prefix: `feat/…`, `fix/…`,
   `docs/…`, `ci/…`, `chore/…`. *(Future team mode branches off `Dev`, the integration branch,
   leaving `main` production-only — see the [branching model](docs/process/github-workflow.md#0-branching-model).)*
3. **Do the work** in logical commits — subjects `type(scope): summary`, bodies citing standards.
4. **Open the PR into `main`** — first line `Closes #N`; body = **What / Why / How verified**.
5. **Document the self-review** as a PR comment (the four quadrants: Architecture, Code Quality,
   Commits & Git, Functionality & Tests).
6. **Squash-merge** and delete the branch.

## Conventions

| Area | Convention |
|------|------------|
| Branches | kebab-case, Conventional prefix (`feat/…`, `fix/…`, `docs/…`, `ci/…`, `chore/…`) |
| Commits | `type(scope): summary`; imperative; body cites standard IDs |
| Python | `ruff` (line length 100); `router → service → repository`; only repositories import DB drivers |
| TypeScript | strict mode; generated API client only — never hand-written request types |
| Filenames | kebab-case, semantic; version lives in a doc's control table, never the filename |
| Endpoints | added **from** `packages/contracts/openapi.yaml` (S2.7); each declares a permission (S3.21) |
| Secrets | never in code, logs, or history; configure via `.env` (gitignored) or the platform secret store |

## Local setup & gates

See the [Quickstart](README.md#quickstart). Mirror CI before pushing:

```bash
make test        # api pytest + web vitest
make integrity   # ruff, import-linter, contract validation, web build
```

CI must be green before merge: `ruff · import-linter · permission-lint · contract-diff ·
store-isolation · migration roundtrip · integrity · pytest` (api), `Vitest · build` (web),
OpenAPI validation (contract), and `gitleaks` (security).

## House rules

- **Surgical edits over rewrites.** Keep diffs focused; match the surrounding code's style.
- **No AI/assistant attribution** in any branch, commit, PR, or GitHub-visible text. No
  `Co-Authored-By` trailers.
- **Scope discipline:** v1 = the MASTER-SPEC §3 Release Map. New ideas go to
  [`PARKED.md`](PARKED.md), not into code.
- **Report outcomes honestly** — a gate passes on pasted output, not confidence.
