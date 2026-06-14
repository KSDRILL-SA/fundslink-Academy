# Security Deployment Checklist — FundsLink Academy

> **Scope:** the database/runtime security controls that live in **deployment & ops**, not in
> the schema. The schema-layer controls (least-privilege role, append-only triggers,
> human-final, encryption-ready PII columns, search_path pinning) ship in migrations 0001–0005.
> This checklist is the **Stage 06 gate** for everything the migrations *can't* enforce.

Owner: Founder (L4) approves each control before production cutover.

---

## 1. Application database role (provisioning the secret)
Migration `0005` creates `fundslink_app` **NOLOGIN** (no secret in git). Production must:
- [ ] Generate a strong password in the secret manager (never in code, logs, or `.env` commits — S3.20).
- [ ] `ALTER ROLE fundslink_app LOGIN PASSWORD :'app_pw';` (value injected from the secret manager).
- [ ] Point the app's `DATABASE_URL` at **`fundslink_app`**, never at the owner/superuser.
- [ ] Confirm the owner/superuser credential is used **only** for migrations, never by the running app.
- [ ] Rotate the app password on a schedule and on any suspected exposure.
- [ ] **When a later stage adds a new append-only table**, its migration must `REVOKE UPDATE, DELETE … FROM fundslink_app` (the CI tamper test guards the existing set).

## 2. Transport security (TLS)
- [ ] `DATABASE_URL` uses `sslmode=verify-full` (Railway internal networking + cert verification).
- [ ] MongoDB / ChromaDB / Redis reached only over private networking / TLS; no public exposure.

## 3. Connection pooling (PgBouncer + asyncpg)
- [ ] PgBouncer in **transaction** pooling mode (TAD §1.1).
- [ ] asyncpg configured for it: disable server-side prepared statements
      (`statement_cache_size=0` / `prepared_statement_cache_size=0`) to avoid the
      PgBouncer-transaction-mode prepared-statement clash.

## 4. Backups & recovery
- [ ] Automated **encrypted** backups; **PITR** enabled.
- [ ] Restore drill #2 on staging from PITR (ST-6.4) before launch — extends the Stage 01
      `scripts/restore_drill.sh` proof to a real point-in-time recovery.

## 5. Secrets & keys
- [ ] RS256 JWT private key in the secret manager; rotation runbook written (ST-2.9).
- [ ] AES-256-GCM key for `id_number_enc` / `mfa_secret_enc` managed + rotatable (envelope
      encryption); the blind-index HMAC key separated from the encryption key (TAD §4.4).
- [ ] `gitleaks` green on every push (already gated in CI).

## 6. Counselling segregation (when it lands — v2.5)
- [ ] `counselling` schema gets its **own** DB role/credentials; `fundslink_app` has **no grants**
      on it (Spec §6.4 / §15.3).

## 7. Row-Level Security — the backend contract (migrations 0007 + 0009)
RLS is **enforced in the database** on **every** student-data / sensitive table (profile,
application, document, tracking, matches, consent, notification, motivation, pre-screen,
returns, appeals, theme tags, recusal, audit-log). The app role is `NOBYPASSRLS`, so the
backend **must** set the request context inside each transaction or it sees **nothing**
(fail-closed):
- [ ] After authenticating, per request: `SET LOCAL app.user_id = '<user cuid>'` and
      `SET LOCAL app.user_role = '<effective role>'` (use the request's DB transaction).
- [ ] Background jobs / matching run with `app.user_role = 'SYSTEM'` (and `app.user_id = 'SYSTEM'`).
- [ ] Analytics via `fundslink_readonly`: decide BYPASSRLS vs a SYSTEM context when a BI tool
      is introduced (today it is fail-closed by default — secure, but set a context to read).
- [ ] **New owned tables in later stages** add their own RLS policies following the 0007/0009
      pattern (`test_row_level_security.py` + `test_rls_completeness.py`).
- [ ] **Stage 02 MUST add RLS to the auth tables** (`user`, `refresh_token_family`,
      `refresh_token`) with a **SYSTEM-context** login/token-validation path — at login there is
      no `app.user_id` yet, so the auth service sets `app.user_role='SYSTEM'` for the lookup then
      switches to the user's context post-auth (decision **D-015**). Deferred from Stage 01 on
      purpose: RLS there is meaningless until the auth flow exists.

## 8. Defense-in-depth summary (deliberate choices)
- [ ] Audit-log immutability rests on **two walls**: `fn_block_mutation` trigger **and** the
      `fundslink_app` privilege revoke (proven in `tests/db/test_security_least_privilege.py`).
- [ ] Cross-user data exposure has **two walls**: RLS policies **and** the repository/service
      ownership checks. Either alone would hold; together they are belt-and-suspenders.

---

*Schema-layer security is shipped and tested in Stage 01. This checklist is its deployment
counterpart — both must be green before a single rand or real student record is live.*
