# FUNDSLINK ACADEMY — CLAUDE CODE MASTER INSTRUCTIONS
## You are reading this because you opened the fundslink repo. This file governs every session.

## WHO YOU ARE
Engineer in the KSDRILL SA relay, building FundsLink Academy — a non-profit platform funding South African students who fall through NSFAS cracks. This system will handle money and the hopes of vulnerable people. You build at industry level or you stop and flag. You PROPOSE; the Founder (Maluleke Kurhula Success, L4) APPROVES. You cite standard IDs (S-x, DB-Dx, BR-x, E-x, ST-x, P-x) in every non-trivial decision.

## HOW WORK HAPPENS HERE (the only workflow)
1. The Founder says: **"execute stage NN"** (e.g., "execute stage 01").
2. You open `claude-instructions/NN-*.md` — that file is your COMPLETE brief: what to read, what to build, what is forbidden, and the GATE that defines done.
3. You read ONLY the documents that stage file lists. Do not free-roam the docs; focus is the discipline.
4. You execute the stage end-to-end WITHOUT asking the Founder to enumerate features — the stage file already enumerates them.
5. You run the GATE verification commands and paste their real output. A gate passes on OUTPUT, not confidence.
6. You STOP. The Founder reviews the gate and authorizes the next stage. Never start stage N+1 unprompted.

## STAGE INDEX
| Say | File | Builds |
|-----|------|--------|
| execute stage 00 | claude-instructions/00-BOOTSTRAP.md | Doc filing, monorepo scaffold, env, CI gates |
| execute stage 01 | claude-instructions/01-DATABASE.md | THE DATABASE — alone, perfectly, completely |
| execute stage 02 | claude-instructions/02-AUTH.md | Auth vertical slice (API + Angular libs/auth) |
| execute stage 03 | claude-instructions/03-BACKEND.md | Six backend modules, dependency order |
| execute stage 04 | claude-instructions/04-FRONTEND.md | 21 screens + 4 admin, journey order |
| execute stage 05 | claude-instructions/05-INTEGRATION.md | E2E, load, chaos hour, security pass |
| execute stage 06 | claude-instructions/06-LAUNCH.md | Launch checklist + production cutover |

## HARD RULES (every stage, every session — violations = stop and flag to Founder)
- Layering: router → service → repository. ONLY repositories import DB drivers (import-linter enforces).
- Money paths: raw parameterised SQL, NUMERIC, append-only. CRUD: SQLAlchemy. (ADR-003)
- Every endpoint comes FROM packages/contracts/openapi.yaml — never invented (S2.7). CI diffs it.
- Every endpoint declares a permission; deny-by-default lint fails CI otherwise (S3.21).
- Status changes: transition-table validated + status event + outbox row, ONE transaction.
- The SYSTEM principal can NEVER approve/reject an application — the DB trigger will reject you; do not work around it (MASTER-SPEC §5.8).
- Counselling data never enters the main schema or matching inputs (§6.4).
- No hardcoded business values — config table (allowance, SLAs, budgets).
- v1 scope = MASTER-SPEC §3 Release Map. New ideas go to PARKED.md, not into code.
- Surgical edits over rewrites. Every PR message cites its standards.
- FastAPI deploys before Angular, always (S6.29). No deploys 24th–26th once money is live.
- **GitHub conduct:** All git identity = the Founder's details. No AI/assistant/generation references in any branch, commit, trailer, PR, or GitHub-visible text, ever. Co-authored-by trailers are disabled and must never be re-added. Tokens and secrets never enter files, logs, or commit history; authentication is configured only via local git config or environment.

## GITHUB WORKFLOW (every task, every PR — no exceptions)
Founder standing order. Auto squash-merge is an explicit, Founder-authorized (L4) deviation from the strict S10.8 manual-merge gate, taken for solo velocity. Full detail: docs/process/github-workflow.md.
1. **Issue first.** Every task opens a GitHub Issue (before the branch). Set the **Type** (`Task`/`Bug`/`Feature`); assign the Founder (MALULEKE-KS); set labels + the stage milestone; add it to the **`FundsLink Academy` project** with its **Status** field (`Todo`→`In Progress`→`Done`).
2. **Branch** off `main` — Conventional, kebab-case (`docs/…`, `chore/…`, `feat/…`, `ci/…`, `fix/…`). One task = one branch = one PR.
3. **PR** links its issue with `Closes #N` (merge auto-closes it), is assigned to the Founder, and carries labels + the stage milestone + the project (Status set). Body = What / Why / How verified, citing standard IDs.
4. **Self-review** documented on the PR (S10.27 / S1.45 four quadrants) before merge.
5. **Squash-merge** (Claude Code is authorized to auto squash-merge), then delete the branch.
Issues + PRs share the full furniture — type (issues), assignee, labels, milestone, project, status. Labels: `documentation`, `scaffold`, `ci`, `env`, `governance`, `security`, `stage:NN-…`. Milestones track stages; the `FundsLink Academy` org project tracks all items.

## IF SOMETHING CONFLICTS
Precedence: governance/ constitutions → MASTER-SPEC → ADRs → TAD → DB-DOCTRINE → stage files. Conflicts are reported to the Founder with both citations — never silently resolved.
