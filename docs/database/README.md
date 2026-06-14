# FundsLink Academy — Database (Stage 01 capstone)

> The PostgreSQL foundation everything else stands on. This is the **one page** every later
> phase reads before touching data: what exists, what the database enforces (and what it
> deliberately doesn't), the security model, and the contracts your backend must honor so it
> "just fits in". Design of record: [`data-model.md`](data-model.md) · law: [`doctrine.md`](doctrine.md).

## Apply path — Alembic migrations are authoritative

| Migration | Brings |
|-----------|--------|
| `0001` | Structural DDL (v1.0/v1.1 baseline) — tables, the 3 trigger fns, partitions |
| `0002` | Seed/reference data (lookups, RBAC matrix, transitions, config, eligibility rulesets) |
| `0003` | Review hardening — FK + review-queue indexes, APPROVED-dup block, domain CHECKs, default partitions |
| `0004` | Application lifecycle — priority lane, post-approval states, doc validity, language, WhatsApp |
| `0005` | **Security** — least-privilege `fundslink_app` role, append-only privilege revoke, search_path pin |
| `0006` | **Security** — privilege lockdown (revoke PUBLIC, role timeouts/limits, read-only role) |
| `0007` | **Security** — Row-Level Security (right row, right person, right role; fail-closed) |
| `0008` | Alignment — `updated_at` auto-stamp on the remaining mutable tables |
| `0009` | **Security** — RLS completeness (motivation, pre-screen, returns, appeals, audit-log) |
| `0010` | **Security** — auth-table RLS (`user`, `refresh_token*`) + SYSTEM principal seed (Stage 02, D-015) |
| `0011` | Auth — `token_version` session-epoch on `user` (S3.13 claim + global invalidation S3.35) |
| `0012` | Auth — MFA state (`mfa_enabled`, encrypted recovery codes) for TOTP (Stage 02, TAD §3.1) |
| `0013` | **Security** — `auth_token` table (email-verify + password-reset single-use tokens) + RLS |

Single head = `0013`. `make` targets: `integrity` · `partitions` · `restore-drill` · `explain` · `verify`.

## Stores (3-store polyglot — ADR-004 rejected)
PostgreSQL is the **system of record** (auth, applications, tracking, match records, outbox,
audit, config). MongoDB holds AI match reasoning (S5.33), ChromaDB the embeddings (S5.45),
Redis the deny-list/cache. Cross-store references carry the PG cuid; the DB-D35 reconciliation
job lands with the matching module (Stage 03).

## Triggers — 3 functions, deliberately minimal (DB-D21: physics, not business)
| Function | Fires | Why |
|----------|-------|-----|
| `fn_block_mutation` | BEFORE UPDATE/DELETE on 7 append-only tables (+ partitions) | Immutability of audit / status events / consent (tamper-evidence) |
| `fn_human_final` | BEFORE INSERT on `application_status_event` | The SYSTEM principal can never reach APPROVED/REJECTED/REJECTED_FINAL (§5.8) |
| `fn_touch_updated_at` | BEFORE UPDATE on the 9 mutable tables | Auto-stamp `updated_at` |

## Stored procedures — **none, on purpose**
Business logic lives in the **service layer** (testable, reviewable, versioned), never hidden
in the database (DB-D21 / Ch07). The only in-DB procedural code is physics (the 3 trigger fns)
and read-only security context (`app_uid`/`app_role`/`app_is_staff`). `pgcrypto` is installed
(HMAC/blind-index seam) but unused at v1 — PII encryption is app-side AES-256-GCM (TAD §4.4).

## Security model — the crown
**Three roles.** The *owner* (migrations only) bypasses RLS. **`fundslink_app`** (NOLOGIN in
git; LOGIN + password provisioned from a secret manager) is the app's identity — non-owner, no
DDL, NOBYPASSRLS, fenced by `statement_timeout`/`idle`/`lock_timeout` + connection limit.
**`fundslink_readonly`** is SELECT-only for analytics.

**Two walls, twice.**
- *Audit immutability* = `fn_block_mutation` trigger **and** the privilege revoke (app has no
  UPDATE/DELETE on append-only tables) — proven in `test_security_least_privilege.py`.
- *Cross-user exposure* = RLS policies **and** the service ownership checks — proven in
  `test_row_level_security.py`.

**Row-Level Security** is enforced on **every** student-data / sensitive table (0007 + 0009):
profile, application, document, tracking, matches, consent, notification, motivation,
pre-screen, returns, appeals, theme tags, recusal, and audit-log — fail-closed: no session
context ⇒ no rows. Reviewer-only metadata is staff-scoped; audit is own/staff. The owner
bypasses (migrations); the app is always subject. **Auth tables (`user`/`refresh_token*`) now
carry RLS (0010)** with a SYSTEM-context login/token path (no `user_id` at login) — see D-015;
the SYSTEM principal is seeded with the literal `user.id='SYSTEM'` (so `fn_human_final` keys on it).

## Backend integration contracts (every later phase MUST honor)
1. **Connect as `fundslink_app`**, never the owner/superuser; the owner is for migrations only.
2. **Per request, in the transaction:** `SET LOCAL app.user_id = '<cuid>'` and
   `SET LOCAL app.user_role = '<role>'` — or RLS returns nothing. Jobs use `SYSTEM`.
3. **The SYSTEM principal's `user.id` MUST be literally `'SYSTEM'`** (seeded in 0010) or
   `fn_human_final` won't catch it.
4. **New append-only table** ⇒ its migration `REVOKE UPDATE, DELETE … FROM fundslink_app`.
5. **New owned table** ⇒ add RLS policies following the 0007 pattern.
6. **Money / financial-history paths** ⇒ raw parameterised SQL + NUMERIC (ADR-003); CRUD via ORM.
7. **Status change** ⇒ transition-table check + status event + outbox row, in **one** transaction.
8. **Endpoints** come FROM `packages/contracts/openapi.yaml` (S2.7); each declares a permission.

## What's enforced where
| Concern | Database | Service (later stages) |
|---------|----------|------------------------|
| Entity/referential integrity, domains | ✅ PK/FK/CHECK/lookups | validation for UX |
| Append-only / audit immutability | ✅ trigger + privilege | writes go through repos |
| Human-only final decisions | ✅ `fn_human_final` | transition orchestration |
| One active application per year | ✅ partial unique index | friendly 409 |
| Ownership / tenancy | ✅ RLS (fail-closed) | ownership checks + JWT scoping |
| State-machine *transitions* | data table (the oracle) | ✅ validated in the service |
| Business rules / workflow | — | ✅ services (no stored procs) |
| PII encryption / key mgmt | columns ready | ✅ app-side AES-256-GCM (Stage 02) |

## Verification (Gate G1+)
`alembic upgrade head` (0001→0010) clean · downgrade→upgrade roundtrip clean · constraint +
security + RLS suite green in CI · `make integrity` clean · restore drill PASS · EXPLAIN shows
index scans. Deployment-side security: [`../operations/security-deployment-checklist.md`](../operations/security-deployment-checklist.md).

## Product decisions & open questions
Student-edge rulings and the parking lot live in
[`../product/scenarios-and-decisions.md`](../product/scenarios-and-decisions.md) (D-001…, OQ-1…).
