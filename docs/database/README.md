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

Single head = `0008`. `make` targets: `integrity` · `partitions` · `restore-drill` · `explain` · `verify`.

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

**Row-Level Security** is enforced on the 8 core student-data tables, fail-closed: no session
context ⇒ no rows. The owner bypasses (migrations); the app is always subject.

## Backend integration contracts (every later phase MUST honor)
1. **Connect as `fundslink_app`**, never the owner/superuser; the owner is for migrations only.
2. **Per request, in the transaction:** `SET LOCAL app.user_id = '<cuid>'` and
   `SET LOCAL app.user_role = '<role>'` — or RLS returns nothing. Jobs use `SYSTEM`.
3. **The SYSTEM principal's `user.id` MUST be literally `'SYSTEM'`** (Stage 02 seeds it) or
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
`alembic upgrade head` (0001→0008) clean · downgrade→upgrade roundtrip clean · constraint +
security + RLS suite green in CI · `make integrity` clean · restore drill PASS · EXPLAIN shows
index scans. Deployment-side security: [`../operations/security-deployment-checklist.md`](../operations/security-deployment-checklist.md).

## Product decisions & open questions
Student-edge rulings and the parking lot live in
[`../product/scenarios-and-decisions.md`](../product/scenarios-and-decisions.md) (D-001…, OQ-1…).
