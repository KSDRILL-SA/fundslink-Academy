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

## 7. Defense-in-depth review (deliberate choices, revisit per stage)
- [ ] **No Row-Level Security** at v1 — owner/tenant scoping is enforced in the repository/service
      layer (TAD §3.5). Re-evaluate RLS for the most sensitive tables as a future hardening.
- [ ] Audit-log immutability rests on **two walls**: `fn_block_mutation` trigger **and** the
      `fundslink_app` privilege revoke (proven in `tests/db/test_security_least_privilege.py`).

---

*Schema-layer security is shipped and tested in Stage 01. This checklist is its deployment
counterpart — both must be green before a single rand or real student record is live.*
