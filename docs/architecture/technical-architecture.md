# FUNDSLINK ACADEMY — TECHNICAL ARCHITECTURE DOCUMENT (TAD)

## Version 1.2 | Date: 2026 (v1.2: eligibility module added — MASTER-SPEC v1.1 §5.6–5.8)
## System: FundsLink Academy | Stack: Angular + FastAPI (ADR-001, locked)
## Governance: KSDRILL SA Constitutional System C0–C10 | Spec: FUNDSLINK MASTER-SPEC v1.0

---

## DOCUMENT CONTROL

| Attribute | Value |
|-----------|-------|
| Version | 1.1 |
| v1.1 changes | Stress-Test Audit (ST-AUDIT v1.0) folded in: MFA on privileged roles, queued matching, typed ledger FKs, day-one partitioning, PgBouncer, timestamptz+currency, webhook signatures, spend circuit breaker, multi-worker outbox, hardening additions |
| Status | PROPOSED — awaiting Founder (L4) approval |
| Author | Engineer 01 — Claude (Principal Architect, L1/L2) |
| Inputs | master-spec.md · `fundslink-context.md` · ADR-001 · C0–C10 |
| Scope | Full architecture for **v1** (build now) + **forward design** for v1.5/v2 (money features) so nothing built in v1 must be torn out later |
| Build phase | Phase 1 — Core Architecture (Q2 2026, SOLO mode, solo-dev overlay active) |

### Reading Rule

Sections marked **[v1 — BUILD]** are implemented now. Sections marked **[FWD — DESIGN ONLY]** are designed now, built in v1.5/v2 — their schemas and seams exist in v1 so the money layer arrives without migration pain.

---

# 1. ARCHITECTURE OVERVIEW

## 1.1 Style

A **modular monolith**: one FastAPI service on Railway, one Angular SPA on Vercel, four data stores. No microservices at this scale (ADR-001 explicitly rejected a separate AI microservice). Modules are separated by strict internal boundaries (router → service → repository) so any module *could* be extracted later — but extraction is a v4+ conversation, not a v1 one.

**Why this is right for FundsLink:** solo developer, ≤ thousands of users in year one, three databases already — operational complexity must stay flat. A monolith with disciplined boundaries beats five services with undisciplined ones.

## 1.2 System Topology (S6.13)

```
                         ┌──────────────────────────────┐
                         │   Vercel — Angular 17+ SPA   │
                         │   strict TS · Reactive Forms │
                         │   JWT in memory (S3.14)      │
                         └──────────────┬───────────────┘
                                        │ HTTPS · JSON · /api/v1
                                        │ CORS: Vercel origin only
                         ┌──────────────▼───────────────┐
                         │   Railway — FastAPI (Python)  │
                         │  ┌─────────────────────────┐  │
                         │  │ Routers (HTTP layer)    │  │
                         │  ├─────────────────────────┤  │
                         │  │ Services (business)     │  │
                         │  ├─────────────────────────┤  │
                         │  │ Repositories (data)     │  │
                         │  └─────────────────────────┘  │
                         │  Modules: auth · profile ·    │
                         │  application · matching ·     │
                         │  tracking · notification ·    │
                         │  [fin]† · [institution]†      │
                         └──┬──────┬──────┬──────┬──────┘
                            │      │      │      │
            ┌───────────────▼┐ ┌───▼────┐ ┌▼────────┐ ┌▼──────────┐
            │ PostgreSQL     │ │MongoDB │ │ChromaDB │ │ Redis     │
            │ entities, auth,│ │AI match│ │bursary  │ │ JWT deny- │
            │ applications,  │ │reason- │ │embed-   │ │ list,     │
            │ money (Decimal)│ │ing,tags│ │dings    │ │ rate-limit│
            │ S5.3 S5.4 S5.28│ │ S5.33  │ │S5.45-52 │ │ outbox    │
            └────────────────┘ └────────┘ └─────────┘ │ signals   │
                                                       └───────────┘
            † [fin], [institution] = FWD modules, seams present in v1

External (by phase):  Email provider (v1) · SMS provider (v1, outcome-
critical only) · Payment gateway (v1.5) · OpenAI embeddings (v1) ·
Sentry (v1, S8.x) · Account-aggregation provider (v3)
```

## 1.3 Module Map vs Release Map (Spec §3)

| FastAPI Module | Spec Phase | Status in v1 |
|----------------|-----------|--------------|
| `auth` | v1 | BUILD |
| `profile` | v1 | BUILD |
| `application` | v1 | BUILD |
| `matching` (LangChain RAG) | v1 | BUILD |
| `tracking` (statuses, bursary DB, nudges) | v1 | BUILD |
| `eligibility` (pre-screen engine: ruleset evaluator, return cycles, pre-screen reports — deterministic rules-as-config, AI extraction assist only, decisions barred at DB level per MASTER-SPEC §5.8) | v1.1 | BUILD |
| `notification` (outbox, email; SMS hook) | v1 | BUILD (email), SMS adapter stubbed |
| `fin` (ledger, donations, disbursement) | v1.5 / v2 | DESIGN ONLY — schema reserved, module skeleton + feature flag off |
| `institution` (portal, confirmations) | v2 | DESIGN ONLY |
| `counselling` (segregated store) | v2.5 | DESIGN ONLY |

---

# 2. BACKEND COMPONENT ARCHITECTURE [v1 — BUILD]

## 2.1 Layering Rule (Hard Boundary)

```
HTTP Router  →  Service  →  Repository  →  Database
```

- **Routers**: request/response models (Pydantic), auth dependency, zero business logic.
- **Services**: all business rules; the ONLY layer allowed to coordinate multiple repositories; owns transactions.
- **Repositories**: the ONLY layer that touches a database driver. Financial queries are raw, parameterised SQL (S5.21). No service or router ever writes SQL.
- Cross-module calls go **service → service**, never service → another module's repository. This is the seam that keeps `fin` extractable.

## 2.2 Directory Skeleton

```
app/
├── core/            # config, security, db sessions, deps, errors
├── modules/
│   ├── auth/        # router.py · service.py · repository.py · models.py · schemas.py
│   ├── profile/
│   ├── application/
│   ├── matching/    # + pipeline.py (LangChain), embeddings.py
│   ├── tracking/
│   ├── notification/# + outbox.py · worker.py · adapters/{email,sms}.py
│   ├── fin/         # FWD: skeleton + ledger schema, flag-gated
│   └── institution/ # FWD: skeleton, flag-gated
├── common/          # pagination, idempotency, audit, state machines
└── main.py
```

## 2.3 Error Envelope (Uniform)

Every non-2xx response:

```json
{ "error": { "code": "APPLICATION_INVALID_TRANSITION",
             "message": "Cannot move from APPROVED to DRAFT",
             "request_id": "req_cuid", "details": {} } }
```

`request_id` is generated per request, logged everywhere, returned always — support and incident debugging depend on it.

---

# 3. IDENTITY, AUTH & RBAC

## 3.1 Authentication [v1 — BUILD] (S3.13–S3.20)

| Concern | Design |
|---------|--------|
| Protocol | JWT, RS256 asymmetric (keys in Railway env, never in repo) |
| Access token | 15 min TTL, held in **Angular memory only — never localStorage** (S3.14) |
| Refresh token | 7 days, httpOnly + Secure + SameSite=Strict cookie, **rotated on every use**; reuse of a rotated token revokes the whole family (theft signal) |
| Logout / revocation | Refresh-token family revoked; access token jti pushed to Redis deny-list until natural expiry |
| Password hashing | bcrypt, rounds from env (default 12) |
| Angular side | HTTP interceptor attaches token, **deduplicates concurrent 401-refresh attempts** (S3.15, tested per S7.12), queues in-flight requests during refresh |
| Brute force | Redis rate-limit: 5 failed logins / 15 min / identifier+IP → temporary lock + notification |
| Breached passwords | k-anonymity HIBP check at registration/password change [ST-2] |
| **MFA** | **TOTP mandatory for ADMIN_*, FINANCE_ADMIN, INSTITUTION_OFFICER, COUNSELLOR; optional-recommended for students [ST-2]** |
| Account states | PENDING_VERIFICATION → ACTIVE → SUSPENDED → CLOSED (state machine, audit-logged) |

## 3.2 The Role Model — All Roles, Designed Once

v1 implements **STUDENT** and **ADMIN_REVIEWER**; the schema and permission system support every role from day one so adding v2 roles is data, not migration.

| Role | Phase | Description |
|------|-------|-------------|
| STUDENT | v1 | Applies, tracks, self-reports statuses |
| ADMIN_REVIEWER | v1 | Reviews applications, verifies documents, proposes approval |
| ADMIN_AUTHORIZER | v1 (funding) · v1.5 (money) | Second signature on funding + money (Spec §16.4). Mutually exclusive with REVIEWER per action. Pulled forward from v2: without it an application stops at APPROVED_PROPOSED and nobody can be funded at all (#309) |
| FINANCE_ADMIN | v1.5 | Donations ops, reconciliation, disbursement proposal |
| INSTITUTION_OFFICER | v2 | Org-scoped: confirms distributions, flags ineligibility |
| COUNSELLOR | v2.5 | Sole access to segregated counselling store (Spec §6.4) |
| DONOR | v1.5 | Manages own donations, mandates, receipts |
| GRADUATE | v3 | Pledge lifecycle |
| SYSTEM | v1 | Non-human principal for jobs (reconciliation, nudges) — actions audit-logged like any user |

## 3.3 RBAC Enforcement [v1 — BUILD] (S3.21–S3.23)

- Permissions checked in a FastAPI dependency: `Depends(require(Permission.APPLICATION_REVIEW))` — declarative on every router.
- Role → permission mapping lives in PostgreSQL (seeded), not in code constants — v2 roles arrive by seed migration.
- **Deny by default**: an endpoint without an explicit permission declaration fails CI (custom lint check).
- Angular mirrors permissions for UI gating only — **the API is the boundary**; the SPA hides, the server forbids.

## 3.4 RBAC Matrix (Resource × Action, summary)

| Resource | STUDENT | ADM_REV | ADM_AUTH | FIN | INST_OFF | COUNS |
|----------|---------|---------|----------|-----|----------|-------|
| Own profile | CRUD | R | R | — | — | — |
| Any application | own: CRU | R + review | R + authorize | — | — | — |
| Documents | own: CRU | R + verify | R | — | — | — |
| Match results | own: R | R | R | — | — | — |
| Tracked ext. applications | own: CRUD | R | R | — | — | — |
| Counselling records | — | — | — | — | — | CRUD (own cases) |
| Ledger [FWD] | — | — | R | CRU (append-only) | — | — |
| Disbursement batch [FWD] | — | — | authorize | propose | confirm (own org) | — |
| Allowance allocations [FWD] | own: R | R | R | CRU | R+confirm (own org) | — |
| Institution data [FWD] | — | R | R | R | own org only | — |

**Two-step rule encoded structurally [FWD]:** `proposed_by ≠ authorized_by` is a CHECK constraint on every approval table — the database itself refuses single-person money movement (Spec §16.4).

## 3.5 Institution Tenancy [FWD — DESIGN ONLY]

Single-database, **row-scoped tenancy**: every institution-owned row carries `institution_id`; every repository method serving an INSTITUTION_OFFICER receives the officer's `institution_id` from the JWT claims and injects it into the WHERE clause via a mandatory repository base-class filter — it is impossible to call the unscoped variant from the institution module. Cross-institution queries exist only in admin repositories. This is FundsLink's real multi-tenancy: one tenant class (institutions), modest tenant count, no need for schema-per-tenant.

---

# 4. DATA ARCHITECTURE

## 4.1 Database Assignment (locked, `fundslink-context.md`)

| Data | Store | Standard |
|------|-------|----------|
| Users, auth, roles, sessions | PostgreSQL | S5.4 |
| Applications, funding amounts, **all money** | PostgreSQL (Decimal, never Float) | S5.3, S5.28 |
| AI match reasoning, tags, narratives | MongoDB (Beanie ODM) | S5.33 |
| Bursary document embeddings / RAG | ChromaDB (internal Railway URL only) | S5.45–S5.52 |
| Deny-list, rate-limits, outbox signal, circuit breaker | Redis | — |
| Counselling records [FWD v2.5] | **Segregated PostgreSQL schema** `counselling`, separate DB role/credentials; main app role has NO grants on it | Spec §6.4, §15.3 |

## 4.2 Core Entity Model [v1 — BUILD]

```
User ──1:1── StudentProfile          User ──M:N── Role ──M:N── Permission
User ──1:N── RefreshTokenFamily      User ──1:N── ConsentRecord
StudentProfile ──1:N── FundingApplication ──1:N── Document
StudentProfile ──1:N── TrackedApplication ──N:1── ExternalBursary
FundingApplication ──1:N── ApplicationStatusEvent   (append-only history)
TrackedApplication ──1:N── TrackedStatusEvent       (append-only, + source)
ExternalBursary ──1:N── BursaryDeadline
* ──1:N── AuditLog            * ──1:N── NotificationOutbox
```

Conventions (C5): cuid PKs (S5.10), `created_at/updated_at/created_by` as **timestamptz (UTC stored, SAST rendered)** [ST-3], soft delete via `deleted_at` (S5.8) — **except** append-only event/audit/ledger tables, which are never deleted or updated at all.

## 4.3 State Machines as Data [v1 — BUILD]

High-volume append-only tables (`*StatusEvent`, `AuditLog`, `NotificationOutbox`, and [FWD] `LedgerEntry`) are **range-partitioned by month from day one** [ST-3] — retrofitting partitions later is the worst PostgreSQL migration there is.

`FundingApplication.status` and `TrackedApplication.status` transitions are validated against an allowed-transitions table in `common/state_machines.py`; every change writes an immutable `*StatusEvent` row (actor, source, timestamp). Illegal transitions raise `*_INVALID_TRANSITION`. The spec's state machine (§12.4) is therefore enforceable, not decorative.

`TrackedStatusEvent.source ∈ {SELF_REPORT, EMAIL_CAPTURE, PARTNER_API}` — the dashboard's freshness label (Spec §12.4) comes straight from this column.

## 4.4 Sensitive Field Handling [v1 — BUILD]

| Field | Treatment |
|-------|-----------|
| SA ID number | Field-level encryption (AES-256-GCM, key in env/KMS); a **blind index** (HMAC of normalized value) supports the uniqueness check (one ID = one account, Spec §14.4) without storing plaintext |
| Hardship narrative | Stored in PostgreSQL `text`, access gated to reviewer+ roles, excluded from logs and analytics events |
| Documents | Object storage (Railway volume v1 → S3-compatible **before 1,000 students** [ST-1]), private; served via short-lived signed URLs only; AV-scan hook on upload |
| Card data | **Never touches FundsLink** — gateway-hosted fields/redirect only (v1.5); FundsLink stores gateway tokens |

## 4.5 Financial Schema [FWD — DESIGN ONLY, schema reserved in v1]

```
LedgerEntry(id, journal_id, account, direction{D,C}, amount_dec,
            currency CHAR(3) DEFAULT 'ZAR',
            donation_id NULL FK, batch_id NULL FK, allocation_id NULL FK,
            pledge_charge_id NULL FK, refund_id NULL FK,
            CHECK(num_nonnulls(donation_id,batch_id,allocation_id,
                  pledge_charge_id,refund_id)=1),  -- typed refs [ST-3]
            reverses_id NULL, created_at timestamptz)
   -- PARTITIONED BY RANGE (created_at), monthly, from day one [ST-3]
   -- append-only: no UPDATE/DELETE grants for app role; trigger blocks both
Donation(id, donor_id, gateway, gateway_txn_id UNIQUE, gross_dec,
         fee_dec, net_dec, status, receipt_id NULL)
RecurringMandate(id, donor_id, state{ACTIVE,PAUSED,CANCELLED,FAILED_RETRY},
                 amount_dec, next_run, retries)
Section18AReceipt(id, seq_no UNIQUE, donor_tax_details, pdf_uri, issued_at)
DisbursementBatch(id, institution_id, type{TUITION,DEBT,ALLOWANCE},
                  total_dec, proposed_by, authorized_by,
                  CHECK(proposed_by <> authorized_by), status)
AllowanceAllocation(id, batch_id, student_id, amount_dec,
                    status{ALLOCATED,CONFIRMED,RETURNED,VOID})
   -- SUM(allocations.amount) == batch.total enforced at service layer + nightly check
```

Webhook idempotency = `gateway_txn_id UNIQUE` + upsert-noop pattern: a replay can never double-record (Spec §8.4).

---

# 5. API DESIGN [v1 — BUILD]

## 5.1 Contract-First (S2.7)

The OpenAPI 3.1 contract (`openapi.yaml` — next deliverable) is written and Founder-approved **before** any endpoint code. FastAPI's generated schema is diffed against the contract in CI; drift fails the build.

## 5.2 Conventions

| Concern | Rule |
|---------|------|
| Base path | `/api/v1` — URI versioning; breaking changes require `/v2` + deprecation window |
| Resources | Plural nouns: `/students/me/profile`, `/applications/{id}`, `/tracked-applications`, `/matches` |
| Pagination | Cursor-based (`?cursor=&limit=`, max 100); never OFFSET on growing tables |
| Filtering | Whitelisted query params per endpoint; unknown params → 400 |
| Idempotency | All POSTs that create money-adjacent or notification-triggering resources accept `Idempotency-Key` header (stored 24h in Redis → replay returns original response) |
| Errors | Uniform envelope (§2.3); business rule violations are 409/422 with stable `code` strings the Angular app switches on |
| Rate limits | Per-user and per-IP via Redis; 429 with `Retry-After` |
| Audit | Every mutating request writes AuditLog(actor, action, resource, request_id) in the same transaction |

## 5.3 v1 Surface (summary — full detail in OpenAPI contract)

```
auth:      POST /auth/register · /auth/login · /auth/refresh · /auth/logout
profile:   GET/PUT /students/me/profile · POST /students/me/documents
apply:     POST /applications · GET /applications/me · GET /applications/{id}
           POST /applications/{id}/submit          (state machine guard)
matching:  POST /matches/run → 200 + match page (v1 sync advisory; async 202 queue → v1.x — §6.2) · GET /matches/me
           GET /bursaries (browse-all, equal prominence — Spec §17.2)
tracking:  POST /tracked-applications · GET /tracked-applications
           POST /tracked-applications/{id}/status  (self-report)
admin:     GET /admin/applications?status= · POST /admin/applications/{id}/review
notify:    GET /notifications/me · PUT /notifications/preferences
```

---

# 6. AI MATCHING PIPELINE [v1 — BUILD]

## 6.1 Flow

```
Bursary admin upserts bursary → text chunked → OpenAI embeddings
→ ChromaDB collection (metadata: bursary_id, deadline, level, field)
                                          │
Student profile (structured eligibility facts ONLY — never
counselling data, Spec §17.2.4)           │
        └──────────► RAG query: eligibility-filtered semantic search
                     (deadline > today filter applied IN the query —
                      expired bursaries cannot match, Spec §17.5)
                             │
                     LangChain chain produces ranked matches
                     + per-match reasoning + confidence
                             │
        ┌────────────────────┴─────────────────────┐
        ▼                                          ▼
PostgreSQL: MatchResult(id, student_id,    MongoDB: reasoning narrative,
bursary_id, score, model_ver, created_at)  tags, prompt/version snapshot
                                           (S5.33) — full audit trail
```

## 6.2 Execution Model [ST-1]

**v1 — synchronous advisory (Founder-approved L4 2026-06-19):** `POST /matches/run` scores the open,
non-expired bursaries **in-request** and returns **200 + the match page** directly (no fake job id).
The cost/rate-limit failure mode is held off not by a queue but by a **spend circuit breaker** (daily
budget in config; breaker OPEN → fallback mode), a **per-user daily quota**, and a **local embedding
heuristic** (no live OpenAI calls in v1). Profile embeddings are **cached** and re-computed only on
profile change; bursary embeddings re-index on bursary update.

**v1.x target (deferred):** move matching to a **queued background job** — `POST /matches/run`
enqueues and returns 202, a worker computes, the SPA polls `GET /matches/me` — once a real (paid)
embedding model lands and volume warrants offloading the request path. This is what removes the
rate-limit/cost failure mode at 10k users.

## 6.3 Governance Hooks (Spec §17 → code)

| Rule | Implementation |
|------|----------------|
| Advisory only | `/bursaries` browse-all endpoint + equal-prominence UI requirement recorded as acceptance criterion |
| Auditable | model version + prompt version + source chunks persisted per match |
| Degradation (S8.51) | Circuit breaker (Redis) around the pipeline; OPEN → API returns rule-based filter results flagged `"mode":"FALLBACK"`; Angular shows "Smart matching temporarily unavailable — showing rule-based results" |
| Freshness | Re-index on every bursary update; nightly job evicts expired-deadline vectors |
| Testing | Pre-computed embeddings fixtures (S7.37) — no live OpenAI calls in CI |
| Fairness review | Quarterly export of match distributions by province/institution/field for board review (Spec §17.7) |

---

# 7. NOTIFICATION ARCHITECTURE [v1 — BUILD]

**Transactional outbox** (Spec §18.2): the same DB transaction that writes a status change inserts a `NotificationOutbox` row (event_type, recipient, channels[], payload, state=PENDING). Workers (1..N Railway background processes, claiming via SELECT … FOR UPDATE SKIP LOCKED) drain the outbox: renders template → sends via adapter → marks SENT, with exponential-backoff retries and a DEAD state that surfaces operationally and on the student dashboard ("we couldn't reach you").

Channel policy enforced at enqueue time from the policy table (Spec §18.1): SMS only for outcome-critical event types unless the student upgraded a trigger in preferences. Consent (§15.4 of the spec) checked at enqueue; no consent → channel skipped and logged.

Adapters: `EmailAdapter` (v1, provider via env), `SmsAdapter` (interface ready; wired when SMS provider contract signed). The 30/45/60-day no-response follow-ups (Spec §12.5) and deadline T-3 reminders are scheduled jobs that enqueue through the same outbox — one delivery path, one retry policy, one audit trail.

---

# 8. SECURITY & THREAT MODEL

## 8.1 Baseline Controls [v1 — BUILD]

TLS everywhere; CORS locked to the Vercel origin; security headers (CSP, HSTS, X-Content-Type-Options) on both deployments; Pydantic validation on every input; parameterised SQL only (S5.21); secrets in Railway/Vercel env (never in repo — and per the standing billing flag, `ANTHROPIC_API_KEY` stays out of shell profiles); dependency scanning + lockfiles in CI; upload AV-scan hook; signed URLs for documents **served from a separate origin** (stored-XSS isolation); strict CSP with no `unsafe-inline` and `bypassSecurityTrust*` lint-banned; upload magic-byte validation + EXIF strip; Cloudflare in front of both apps (CDN/WAF/bot, R0); payment **webhook signature verification + IP allow-list** (v1.5) [ST-2]; out-of-band (phone-on-file) confirmation for institution bank-detail changes; JWT **key-rotation runbook** with overlap window.

## 8.2 STRIDE Summary (top risks)

| Threat | Vector | Mitigation |
|--------|--------|------------|
| Spoofing | Stolen refresh token | Rotation + family revocation on reuse; httpOnly/SameSite=Strict |
| Tampering | Status/ledger manipulation | Append-only event & ledger tables; DB-level UPDATE/DELETE revoked; state-machine guards |
| Repudiation | "I never approved that" | AuditLog on every mutation; two-step approvals store both identities |
| Info disclosure | ID numbers, narratives, counselling data | Field-level encryption + blind index; role gating; segregated counselling schema with separate credentials; log scrubbing |
| DoS | Credential stuffing, scrape floods | Redis rate-limits, login lockout, cursor pagination caps |
| Elevation | Forgotten endpoint guard | Deny-by-default CI lint (§3.3); permission tests per router (C7) |
| Fraud (domain) | Duplicate identities, fake institutions, insider approval | Blind-index ID uniqueness; registrar verification workflow; `proposed_by ≠ authorized_by` CHECK; approval-pattern anomaly report (Spec §14.4) |

## 8.3 POPIA Implementation Map (Spec §15 → architecture)

| Spec requirement | Where it lives |
|------------------|----------------|
| Consent as first-class record | `ConsentRecord` entity (purpose, wording version, timestamp, channel, withdrawn_at) |
| Data classification | §4.4 handling table; classification tag in schema docs |
| Special-info segregation | `counselling` schema, separate role/credentials [FWD v2.5] |
| Subject rights (view/export/delete) | `/students/me/data-export` + deletion workflow honoring §15.5 retention; ledger pseudonymization routine |
| Breach protocol | SEV0 runbook + Sentry alerting + Information Officer escalation path |

---

# 9. NON-FUNCTIONAL REQUIREMENTS [v1 — BUILD targets]

| NFR | Target (Spec §19) | Architectural support |
|-----|-------------------|----------------------|
| Platform availability | 99.5%/mo | Railway health checks + restart; stateless API |
| Donation capture availability | 99.9%/mo [v1.5] | Gateway-hosted payment page (their uptime, not ours) + idempotent webhook recovery |
| Dashboard p95 | < 2s | Cursor pagination, indexed queries, match results pre-computed |
| Ledger RPO/RTO | ≤5 min / ≤4 h | PostgreSQL PITR (WAL archiving) — **not** nightly dumps |
| App data RPO/RTO | ≤1 h / ≤8 h | PITR covers; documents store replicated |
| Restore confidence | Quarterly drill | Runbook + calendar entry; an untested backup is not a backup |

---

# 10. DEPLOYMENT ARCHITECTURE [v1 — BUILD]

| Aspect | Design |
|--------|--------|
| Environments | `dev` (local docker-compose: PG+Mongo+Chroma+Redis) → `staging` (Railway+Vercel preview) → `prod` |
| Deploy order | **FastAPI (Railway) deploys before Angular (Vercel) — always** (S6.29); enforced by CI pipeline ordering |
| CI | Two pipelines (S8.16): pytest + lint + contract-diff + permission-lint for API; Vitest + strict tsc + build for Angular (S7.2) |
| Migrations | Alembic, forward-only, reviewed; destructive migrations require Founder approval; never auto-run against prod without backup checkpoint |
| Feature flags | Env-driven flags gate `fin`/`institution` modules — FWD code ships dark |
| Freeze windows | No prod deploys 24th–26th monthly (disbursement window, Spec §19.4) once v2 money is live |
| Rollback | Railway redeploy previous image + Alembic down only if non-destructive; otherwise fix-forward per runbook |

---

# 11. OBSERVABILITY [v1 — BUILD]

- **Errors:** Sentry on both apps (env DSN), release-tagged.
- **Logs:** structured JSON, `request_id` correlation, PII-scrubbed (ID numbers, narratives never logged).
- **Metrics/alerts (minimum set, Spec §19.3):** auth failure spikes, outbox backlog age, matching circuit-breaker state, 5xx rate, p95 latency, [v1.5+] webhook failures, reconciliation variance, batch failures, receipt-generation failures.
- **Audit:** AuditLog table is the compliance trail; quarterly approval-pattern anomaly report feeds the fraud review (Spec §14.4).

---

# 12. SCALABILITY PATH (so we never panic)

| Pressure point | First response | Later |
|----------------|----------------|-------|
| API CPU | Railway vertical scale → multiple replicas (stateless by design; Redis holds shared state) | Extract `matching` worker if RAG load dominates |
| PG connections | **PgBouncer (transaction mode) from first replica scale-out** [ST-4] | Read replica for dashboards |
| PostgreSQL | Indexing + read replica for dashboards | Partition event/ledger tables by month |
| ChromaDB | Collection sharding by bursary category | Managed vector DB migration via repository seam |
| Outbox worker | Scale worker count (SELECT … FOR UPDATE SKIP LOCKED) | Move to queue service if >10k notifications/day |
| Documents | Railway volume | S3-compatible object store (seam exists in v1) |

---

# 13. RISKS & OPEN DECISIONS (L4 attention)

| # | Item | Recommendation | Status |
|---|------|----------------|--------|
| R1 | Payment gateway selection (v1.5) | Evaluate PayFast vs Peach vs Ozow on: fee structure for small amounts, recurring mandates, settlement report quality. Decide via ADR-002 | OPEN — Founder |
| R2 | Email + SMS providers | Email at v1 launch; SMS contract before first funding decisions go out | OPEN — Founder |
| R3 | C5 amendment: immutable ledger standard | Proposed in Spec §16.2.4 | AWAITING L4 |
| R4 | Disbursement-day runbook | Add `runbooks/disbursement-runbook.md` before v2 | AWAITING L4 |
| R5 | Document storage | Railway volume for v1; S3-compatible move triggered at 1,000 students | RECOMMENDED |
| R7 | **Second human authorizer** | Two-step approval needs a named, trained, MFA'd second person (co-founder/board) before ANY money release — a CHECK constraint cannot conjure a colleague [ST-6] | **BLOCKING for v1.5+ — Founder** |
| R8 | ADR-004: v1 store consolidation (Mongo→JSONB, Chroma→pgvector) | **REJECTED — Founder (L4) 2026-06-13.** v1 runs the full constitutional polyglot (PostgreSQL + MongoDB + ChromaDB + Redis); see ADR-004. | CLOSED |
| R9 | Continuity pack (access escrow + runbook index held by board) — bus factor 1 | Before public launch [ST-6] | OPEN — Founder |
| R10 | Restore drill + k6 load baseline on staging | Before launch, not after [ST-6] | OPEN |
| R6 | Counselling store hosting | Same PG instance/separate schema at v2.5; separate instance if counselling volume grows | RECOMMENDED |

---

# 14. COMPLIANCE TRACE MATRIX (spot checks)

| MASTER-SPEC v1.0 | TAD section | Standard |
|-----------|-------------|----------|
| §3 Release Map | §1.3 module map, §10 flags | S9.9 |
| §8.4 webhook idempotency | §4.5, §5.2 | S5.21, S5.28 |
| §12.4 status source labels | §4.3 | — |
| §14.4 anti-fraud | §3.4, §8.2 | S3.21–23 |
| §15 POPIA | §4.4, §8.3 | — |
| §16.2 immutable ledger | §4.5 (+ R3 amendment) | S5.3, S5.28 |
| §16.4 two-step approval | §3.4 CHECK constraint | — |
| §17 AI governance | §6.2 | S5.45–52, S7.37, S8.51 |
| §18 notifications | §7 | — |
| §19 NFR/ops | §9–§11 | S6.29, S8.2/8.3 |

---

# APPROVAL

**Status: PROPOSED.** Per AI-INSTRUCTIONS, Engineer 01 (Claude, L1/L2) submits this TAD for Founder (L4) approval. On approval: (1) TAD becomes locked v1.0; (2) next deliverable is the OpenAPI contract `openapi.yaml` (S2.7 gate); (3) R1–R4 decisions scheduled.

_________________________
**Maluleke Kurhula Success** — Founder, L4
