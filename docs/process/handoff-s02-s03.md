# Handoff: Stage 02 (Auth) → Stage 03 (Backend modules)

The relay baton. Everything Stage 03 needs to pick up at the highest level.
Date: 2026-06-15 · From: Engineer 02 (Claude Code, L3, sole operator) · Approver: Founder (L4).

```mermaid
graph LR
  S0["00 ✅"] --> S1["01 DATABASE ✅"] --> S2["02 AUTH ✅<br/>G2 + hardened"] --> S3["03 Backend ▶"] --> S4["04 Frontend"] --> S5["05 Integration"] --> S6["06 Launch"]
  classDef done fill:#0e7490,color:#fff,stroke:#155e75;
  classDef now fill:#1d4ed8,color:#fff,stroke:#1e3a8a;
  class S0,S1,S2 done; class S3 now;
```

## 0. Status — Stage 02 COMPLETE (Gate G2 passed, then hardened, then DB-integrated)

**Before implementing Stage 03:** Review the frameworks that govern this relay:
- `.ksdrill/workflow/ai-assisted-software-development-workflow/SKILL.md` — the 8-step implementation workflow
- `.ksdrill/workflow/ai-review-challenge-framework/SKILL.md` — stage-specific review questions and the Universal Final Challenge
Auth is built, gate-green, hardened against the stress-test audit, and verified to sit on every
DB security wall. **Migrations 0001→0014, 216 API tests + 7 web tests, contract-diff +
permission-lint now REAL.**

**Final integration check — re-run from a clean tree on 2026-06-15 (every gate, real output):**

| Gate | Command | Result |
|------|---------|--------|
| Lint | `ruff check .` | **All checks passed** |
| Layering (router→service→repo) | `lint-imports` | **1 contract kept, 0 broken** (64 files, 149 deps) |
| Permission deny-by-default (S3.21) | `python scripts/permission_lint.py` | **OK — 11 routes declare a posture** |
| Contract-first (S2.7) | `python scripts/contract_diff.py` | **OK — 11 ops match `openapi.yaml`** |
| Migrations up (DB-D36) | `alembic upgrade head` | **0014 (head)** |
| Migration roundtrip | `alembic downgrade base && alembic upgrade head` | **clean** |
| Partition horizon (DB-D44) | `python -m app.db.partitions` | **+12-month horizon kept (4 tables)** |
| Integrity (DB-D39) | `python -m app.db.integrity` | **all checks clean** |
| API suite | `pytest -q` | **216 passed** |
| Web suite | `npm test` (Vitest) | **7 passed** (incl. S7.12 refresh-dedup) |
| Web strict AOT | `npm run build` | **bundle generated, typecheck clean** |

*How to reproduce locally (no Docker on this host): `initdb` a throwaway trust cluster, `pg_ctl … start` on a spare port, `createdb fundslink`, export `ALEMBIC_DATABASE_URL`/`DATABASE_URL` at it, run the gates above, then stop + delete the cluster. CI (`.github/workflows/api.yml`) runs the same sequence against a `postgres:16` service.*

## 1. Full build history
- **Engineer 01 — Claude (design):** master-spec, TAD v1.2, C0–C10, DB-DOCTRINE, ERD, OpenAPI contract, ADRs, the stress-test audit (ST-1…6).
- **Engineer 02 — Claude Code (Stage 00):** monorepo scaffold, CI gates (with placeholders).
- **Engineer 02 — Claude Code (Stage 01):** THE DATABASE — migrations 0001–0009, least-privilege `fundslink_app`, RLS, append-only triggers, 121 tests.
- **Engineer 02 — Claude Code (Stage 02, sole operator):** see §2.

## 2. What is built (verified green on `main`)
| PR | Brings |
|----|--------|
| #66 | migration 0010 — auth-table RLS + SYSTEM principal (D-015) |
| #68 | app security baseline — config (env-only), CORS (S3.29), headers (S3.31), Sentry, RLS context |
| #70 | crypto core — RS256 JWT, bcrypt+HIBP, refresh tokens, Redis 3-layer rate-limit + deny-list |
| #72 | authentication vertical — register/login/refresh/logout, family-revoke-on-reuse, get_current_user, **contract-diff gate REAL**; migration 0011 (token_version) |
| #74 | RBAC — `require(Permission)`, **deny-by-default permission-lint REAL**, cross-user 403 harness (ST-2.3) |
| #76 | MFA (TOTP) — enrol/activate + step-up enforcement (privileged roles); migration 0012 |
| #78 | Angular `libs/auth` — in-memory token (S3.14), 401-refresh dedup interceptor (S7.12), guards, S04/S05 screens, Sentry web |
| #80/#82 | account lifecycle — verify-email / forgot / reset / change-password + Angular S06/S07; migration 0013 |
| #86 | hardening — timing-safe login, JWT key-rotation verify, uniform 500 envelope, Retry-After, lockout email, TOTP replay guard |
| #88 | auth↔DB integration — least-privilege guard + `/readyz` + migration 0014 (app SELECT-only on RBAC/lookup tables) |

**Standards satisfied:** S2.7, S3.2–S3.4, S3.13–S3.24, S3.29, S3.31, S3.33–S3.36, S7.12, ST-2/ST-2.9, TAD §2.3/§3.1/§4.4, DB-D36, BR-A05, D-015.

**Governance + docs landed alongside (same operator):** PRs #90/#92/#94/#96 — docs brought current to Stage-02-complete; the stress-test audit made a *standing* post-phase rule; and **two C0 §8 amendments ratified (L4) and applied to the template** (`system-design-template` `1db276f`, issue #8): **S5.65** (C5 — ledger immutability) and **S10.37** (C10 — post-phase adversarial verification before handoff). Both are now *in force* — see §3 and §4.

## 2a. How this engineer worked — mirror this discipline
You inherit a way of working, not just code. Hold the same bar:
- **"Done" = command output, never confidence.** Every gate in §0 was re-run from a clean tree and pasted. Do the same at G3 — paste the real pipeline-demo output, don't assert it.
- **Branch before you touch anything.** I twice slipped and edited on `main`; both times I caught it with `git branch --show-current` and recovered (`git branch <feat> && git branch -f main origin/main`). Check the branch *first*, every time.
- **Issue → branch → linked PR (`Closes #N`) → documented self-review (S10.27) → squash-merge → delete branch.** One logical unit per PR. Furniture every time: assignee MALULEKE-KS, labels, the stage milestone, the project board Status.
- **Cite a standard ID for every non-trivial move** (`S{C}.{N}`, `DB-Dx`, `BR-x`, `ST-x`, `D-NNN`). If nothing governs it, say so and propose — don't invent a rule.
- **Propose, never decide, on anything security/constitutional.** Auth and money decisions are L4. I proposed the contract expansion and the two amendments; the Founder ratified.
- **Two working-tree files are NOT mine — never stage them:** `docs/database/explain-baseline.md`, `docs/operations/restore-drill-log.md`.
- **Build-host facts:** no Docker (throwaway PG cluster — §0); `gh` hits intermittent TLS — wrap network calls in a short retry loop and verify state via the REST API; some git/network ops need the sandbox disabled.
- **Surgical edits over rewrites; clean Mermaid in docs *and* PRs.**

## 3. Contracts Stage 03 MUST honor (from auth + DB)
1. **Connect as `fundslink_app`** (the runtime guard + `/readyz` enforce non-superuser/NOBYPASSRLS).
2. **Per request set the RLS context** — `set_user_context` (authenticated) / `set_system_context` (jobs). No context ⇒ no rows.
3. **Protect every new route** with `Depends(require(Permission.X))` or an explicit `public_endpoint`/`authenticated_only` marker — the deny-by-default lint fails CI otherwise.
4. **Endpoints come FROM `packages/contracts/openapi.yaml`** (S2.7); contract-diff + permission-lint gate every PR.
5. **New owned table** ⇒ RLS (0007 pattern) + (append-only ⇒ REVOKE UPDATE,DELETE). New reference/lookup ⇒ `fundslink_app` SELECT-only (0014 pattern).
6. **Status changes** ⇒ transition-table check + status event + outbox row in ONE transaction; SYSTEM can never reach a final decision (`fn_human_final`).
7. **Money** (when v1.5) ⇒ raw parameterised SQL + NUMERIC + append-only ledger (ADR-003); ledger immutability is now constitutional (**S5.65**); two-step approval (§16.4).
8. **Store isolation becomes machine-enforced the moment the polyglot stores come online (S5.3).** When the matching module bootstraps **MongoDB + ChromaDB**, it MUST land the guards that make "funding amounts live in PostgreSQL only — never MongoDB or Redis" un-violable, not merely documented:
   - (a) **No monetary fields in MongoDB / Beanie models** — the matching reasoning doc carries `score`/text/tags only; assert in CI (a lint or model check that fails on a money-typed field).
   - (b) **Redis key allowlist** — only `denylist:*`, `rl:*`, and matching's cache/quota keys; no Redis *value* is a money amount.
   - (c) **Cross-store integration test (S7.15)** — a match round-trip writes **no** amount outside PostgreSQL.

   Rationale: today S5.3's "never MongoDB/Redis" half holds only by convention (the schema keeps money in PG, ADR-003 is a review rule, and the other stores don't exist yet). Stage 03 is the first phase where a violation is *possible* — so it is the phase that must make it *impossible*. Funding amounts stay `NUMERIC` in PG (S5.28 / DB-D29 / DB-D42).

## 4. MANDATORY before the Stage-03 handoff (post-phase verification — now constitutional: S10.37)
This is no longer a custom: **S10.37** (C10 v1.1) makes it a hard gate — a handoff that doesn't
document it is **not accepted**. Verify Stage 03 satisfies the relevant findings in
**`docs/audits/stress-test-audit.md`** (esp. ST-2.3 IDOR/cross-user, ST-2.4 upload weaponization,
ST-2.6 matching cost attack, ST-1 growth) and **`docs/product/scenarios-and-decisions.md`**
(D-001…). Cite the ST/D ids satisfied (and any deferred, with reason) in your G3 handoff. See the
CONSTITUTION-INDEX "Post-phase verification" rule.

## 5. Do NOT touch
Locked migrations 0001–0014, RLS policies/helpers, append-only triggers, least-privilege grants,
the auth module's security paths. Extend via new additive migrations only (DB-D36).

## 6. Open items / L4 decisions carried forward
- Live infra (Founder): stamp G2; live Sentry receipt (real DSNs + deploy); provision `fundslink_app` LOGIN password + RS256/PII keys for staging.
- Pending **C5 ledger-immutability amendment** (MASTER-SPEC §16.2) — ratify before v1.5 ledger.
- Funding/donations forward design: `docs/architecture/funding-donations-architecture.md` (v1.5+).
- Residual LOW auth items (optional): registration 409 reveals email-taken (UX vs enumeration); PENDING user gets an unusable token; add S3.34 alerts on password change/reset.

## 7. ▶ NEXT TASK — Stage 03: BACKEND MODULES
Owner: **Engineer 02 (Claude Code)** — NEW session. Brief: `claude-instructions/03-BACKEND.md`.
Order (data dependency): profile → application → eligibility → matching → tracking → notification.
Paste-ready opening prompt: **§3 (Stage 03)** in [`session-playbook.md`](session-playbook.md).

---
*Stage 02 closed by Engineer 02 (Claude Code, L3, sole operator), 2026-06-15. Awaiting the Founder's DONE stamp. Do NOT start Stage 03 in this session.*
