# FundsLink Academy — Database Lifecycle (DBLC) v1.0

The database foundation, end to end, **bounded to FundsLink**. This document is diagram-first:
the visuals carry the model; prose only connects them. It **derives from** (never duplicates)
[ERD-PACKAGE v1.1](data-model.md), [DB-DOCTRINE v1.1](doctrine.md),
and the validated [schema](schema.sql).

| Attribute | Value |
|-----------|-------|
| Stores | PostgreSQL (record) · MongoDB (S5.33) · ChromaDB (S5.45) · Redis (cache) |
| Keys | cuid PKs (DB-D23); cross-store refs carry the PG cuid (S5.5, DB-D35) |
| Money | NUMERIC, never float (S5.28); append-only ledgers [FWD v1.5] |
| Status | ADR-004 rejected — full polyglot from v1 |

---

## 1. The DBLC pipeline

```mermaid
graph LR
  BR["Business rules<br/>BR-A/S/E/T/M/N"] --> CN["Conceptual<br/>entities + relationships"]
  CN --> LG["Logical<br/>attributes, keys, bridges"]
  LG --> NF["Normalization<br/>1NF → BCNF"]
  NF --> PH["Physical<br/>DDL · stores · partitions · indexes"]
  PH --> IN["Integrity<br/>constraints · triggers · cross-store job"]
  IN --> MN["Maintenance<br/>partitions · restore drills · backups"]
  classDef s fill:#0e7490,color:#fff,stroke:#155e75;
  class BR,CN,LG,NF,PH,IN,MN s;
```

Traceability is one-way and total (DB-D26/D27): every physical column answers to a logical
attribute, which answers to a business rule, which answers to the MASTER-SPEC.

---

## 2. Conceptual domain map

Entity clusters and the relationships that cross them. Detailed entities are in §3.

```mermaid
graph TB
  subgraph IA["Identity & Access"]
    USER; SP["Student Profile"]; ROLE; CONSENT["Consent"]
  end
  subgraph AP["Applications & Decisions"]
    APP["Funding Application"]; ASE["Status Events"]; DOC["Documents"]; PSR["Pre-screen"]; MOT["Motivation (OTHER)"]; APPEAL
  end
  subgraph TR["Bursary Tracking"]
    EB["External Bursary"]; TA["Tracked Application"]; TSE["Tracked Events"]; DL["Deadlines"]
  end
  subgraph MT["AI Matching (polyglot)"]
    MR["match_result · PG"]; RZ["reasoning · MongoDB"]; EM["embeddings · ChromaDB"]
  end
  subgraph OP["Notifications · Audit · Config"]
    OUT["Outbox"]; AUD["Audit log"]; CFG["Config + history"]
  end
  USER --- SP
  SP --> APP --> ASE
  APP --> PSR
  SP --> DOC
  SP --> TA --> TSE
  EB --> TA
  EB --> DL
  SP --> MR
  MR -. "id (S5.5)" .-> RZ
  SP -. text .-> EM
  EB -. text .-> EM
  USER --> OUT
  USER --> AUD
  classDef c fill:#1e293b,color:#fff,stroke:#475569;
```

---

## 3. Logical model — attribute-level ERDs (by subsystem)

Split for clarity (DB-D12 Crow's Foot). Key attributes only — full column detail lives in the DDL.
All PKs are cuid `text`; `⏱` = `timestamptz`; append-only tables carry no `updated_at`.

### 3.1 Identity & Access

```mermaid
erDiagram
  USER ||--o| STUDENT_PROFILE : "has subtype (PK=FK)"
  USER ||--o{ USER_ROLE : holds
  ROLE ||--o{ USER_ROLE : "granted via"
  ROLE ||--o{ ROLE_PERMISSION : grants
  PERMISSION ||--o{ ROLE_PERMISSION : "via"
  USER ||--o{ CONSENT_RECORD : gives
  USER ||--o{ REFRESH_TOKEN_FAMILY : owns
  REFRESH_TOKEN_FAMILY ||--o{ REFRESH_TOKEN : rotates

  USER {
    text id PK
    text email UK "lower(email), soft-delete aware"
    text password_hash
    text account_state FK "lk_account_state"
    bytea id_number_enc "AES-256-GCM"
    text id_number_blind_idx UK "HMAC (BR-A04)"
    text mfa_secret_enc "TOTP, encrypted"
  }
  STUDENT_PROFILE {
    text id PK "= user_id (DB-D22)"
    text level "UG/HONOURS/MASTERS/PHD/PGDIP"
    text field_of_study
    text verification_level FK "BRONZE→PLATINUM"
    text hardship_narrative "gated; excluded from logs"
  }
  CONSENT_RECORD {
    text id PK
    text user_id FK
    text purpose FK
    text wording_version
    timestamptz withdrawn_at "append-only (DB-D30)"
  }
```

### 3.2 Applications & Decisions (incl. v1.1 pre-screening / Category D)

```mermaid
erDiagram
  STUDENT_PROFILE ||--o{ FUNDING_APPLICATION : submits
  FUNDING_APPLICATION ||--|{ APPLICATION_STATUS_EVENT : "progresses via"
  FUNDING_APPLICATION ||--o{ DOCUMENT : "evidenced by"
  FUNDING_APPLICATION ||--o{ PRE_SCREEN_RESULT : screens
  FUNDING_APPLICATION ||--o| APPLICATION_MOTIVATION : "OTHER only"
  FUNDING_APPLICATION ||--o{ APPLICATION_RETURN : "returned via"
  FUNDING_APPLICATION ||--o| APPEAL : "appealed via"
  ELIGIBILITY_RULESET ||--o{ PRE_SCREEN_RESULT : "evaluated by"

  FUNDING_APPLICATION {
    text id PK
    text student_profile_id FK
    text application_type FK "POSTGRAD/UG_A/B/C/OTHER"
    text status FK "cache (DB-D24)"
    text academic_year
    numeric requested_amount "NUMERIC(14,2) > 0"
    char currency "ZAR (DB-D42)"
  }
  APPLICATION_STATUS_EVENT {
    text id PK "partitioned monthly (DB-D44)"
    text from_status FK
    text to_status FK
    text actor_user_id FK "human-final trigger (BR-E03)"
    timestamptz created_at
  }
  PRE_SCREEN_RESULT {
    text id PK "append-only (BR-E01)"
    text outcome "READY/RETURNED/UNSCREENED"
    jsonb checks
  }
  APPLICATION_MOTIVATION {
    text id PK
    text application_id UK "one per OTHER app (BR-E05)"
    text situation
    text language "any SA official language (E11)"
  }
  APPEAL {
    text id PK
    text application_id UK
    text original_decider_id FK
    text reviewed_by FK "≠ original decider (CHECK)"
  }
```

### 3.3 Bursary Tracking

```mermaid
erDiagram
  STUDENT_PROFILE ||--o{ TRACKED_APPLICATION : registers
  EXTERNAL_BURSARY ||--o{ TRACKED_APPLICATION : "tracked via"
  TRACKED_APPLICATION ||--|{ TRACKED_STATUS_EVENT : "progresses via"
  EXTERNAL_BURSARY ||--o{ BURSARY_DEADLINE : has

  EXTERNAL_BURSARY {
    text id PK
    text name
    text provider
    text status FK "OPEN/CLOSED"
  }
  TRACKED_APPLICATION {
    text id PK
    text student_profile_id FK
    text external_bursary_id FK
    text status FK "cache"
    timestamptz last_activity_at "denorm: 30/45/60 job"
  }
  TRACKED_STATUS_EVENT {
    text id PK "append-only, partitioned"
    text to_status FK
    text source FK "SELF_REPORT/EMAIL/PARTNER (BR-T03)"
  }
  BURSARY_DEADLINE {
    text id PK
    date due_on "drives T-3 reminders"
  }
```

### 3.4 AI Matching — the polyglot seam

```mermaid
erDiagram
  STUDENT_PROFILE ||--o{ MATCH_RESULT : receives
  EXTERNAL_BURSARY ||--o{ MATCH_RESULT : "matched via"
  MATCH_RESULT {
    text id PK
    text student_profile_id FK
    text external_bursary_id FK
    numeric score "NUMERIC(5,4) 0..1"
    text model_version
    text prompt_version
    text mode "LIVE/FALLBACK (S8.51)"
  }
```

`match_result` (PostgreSQL) is the queryable record. Its **reasoning document** lives in **MongoDB**
(S5.33) keyed by `match_result.id`; **profile/bursary embeddings** live in **ChromaDB** (S5.45).
See ERD-PACKAGE §2.5 for the store-assignment diagram.

---

## 4. Normalization analysis (1NF → BCNF)

The relational core is **BCNF**; the only departures are deliberate, documented denormalizations
(DB-D14) with a stated honesty mechanism.

| Form | Rule | How FundsLink satisfies it |
|------|------|----------------------------|
| **1NF** | Atomic values; no repeating groups / CSV-in-a-column | Notification channels are rows in `notification_preference` per-trigger JSON, not a CSV; lists like `level_eligibility` use typed `text[]` only where order-free sets are intended (DB-D15) |
| **2NF** | No partial dependency on part of a composite key | All M:N relations resolved to bridges with **surrogate cuid PKs** + a natural `UNIQUE` pair (`user_role`, `role_permission`, `tracked_application`, `match_result`) — no attribute hangs off half a key |
| **3NF** | No transitive dependency (non-key → non-key) | Domains extracted to **lookup tables** (`lk_*`, DB-D9): account state, app status, doc type, etc. Institution name, verification tier, status labels are never copied into child rows |
| **BCNF** | Every determinant is a candidate key | Subtype `student_profile` uses **PK = FK** to `user` (DB-D22); `id_number` uniqueness via a blind index; no non-key determinants remain |

**Status as data, not enum drift:** allowed transitions live in `app_status_transition` /
`tracked_status_transition` tables (BR-S04/T04) — the state machine is data the service validates,
not hard-coded.

### Deliberate denormalizations (DB-D14)

| Stored | Why | Honesty mechanism |
|--------|-----|-------------------|
| `funding_application.status` / `tracked_application.status` | read-hot current state | rebuilt from the append-only event log; nightly consistency check |
| `tracked_application.last_activity_at` | cheap 30/45/60-day silence scan | written in the same transaction as the event |
| `donation.net`, `disbursement_batch.total` [FWD] | transaction-time financial snapshot | immutable row; nightly `SUM(children) = total` variance alert |

---

## 5. Status state machines

### 5.1 Funding application (BR-S04, v1.1)

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> SUBMITTED
  SUBMITTED --> PRE_SCREENING
  PRE_SCREENING --> READY_FOR_REVIEW
  PRE_SCREENING --> RETURNED_FOR_INFO
  PRE_SCREENING --> UNSCREENED
  RETURNED_FOR_INFO --> RESUBMITTED
  RESUBMITTED --> PRE_SCREENING
  READY_FOR_REVIEW --> UNDER_REVIEW
  UNSCREENED --> UNDER_REVIEW
  UNDER_REVIEW --> INTERVIEW_SCHEDULED
  INTERVIEW_SCHEDULED --> INTERVIEWED
  UNDER_REVIEW --> APPROVED_PROPOSED
  INTERVIEWED --> APPROVED_PROPOSED
  APPROVED_PROPOSED --> APPROVED
  APPROVED_PROPOSED --> APPROVED_WAITLISTED
  APPROVED_WAITLISTED --> APPROVED
  UNDER_REVIEW --> REJECTED
  INTERVIEWED --> REJECTED
  APPROVED_PROPOSED --> REJECTED
  REJECTED --> APPEALED
  APPEALED --> APPROVED_PROPOSED
  APPEALED --> REJECTED_FINAL
  APPROVED --> [*]
  REJECTED_FINAL --> [*]
  note right of APPROVED
    APPROVED / REJECTED / REJECTED_FINAL
    require a HUMAN actor — SYSTEM is
    barred by trigger (BR-E03, §5.8)
  end note
```

WITHDRAWN is reachable from every pre-decision state (omitted above for clarity).

### 5.2 Tracked external application (BR-T04)

```mermaid
stateDiagram-v2
  [*] --> REGISTERED
  REGISTERED --> SUBMITTED
  SUBMITTED --> UNDER_REVIEW
  UNDER_REVIEW --> SHORTLISTED
  SHORTLISTED --> INTERVIEW
  INTERVIEW --> APPROVED
  INTERVIEW --> REJECTED
  UNDER_REVIEW --> NO_RESPONSE : "day 60 silence"
  APPROVED --> [*]
  REJECTED --> [*]
  NO_RESPONSE --> [*]
```

---

## 6. Physical design

**Store assignment:** see ERD-PACKAGE §2.5. **Partitioning** — four high-volume append-only tables
are RANGE-partitioned monthly (DB-D44), 12 partitions pre-created, then `pg_partman`/job:

```mermaid
graph LR
  subgraph Partitioned["RANGE BY (created_at) — monthly"]
    ASE[application_status_event]
    TSE[tracked_status_event]
    OUT[notification_outbox]
    AUD[audit_log]
  end
  classDef p fill:#7c3aed,color:#fff,stroke:#5b21b6;
  class ASE,TSE,OUT,AUD p;
```

**Three (and only three) approved trigger classes (DB-D21):**

```mermaid
graph TB
  T1["fn_touch_updated_at<br/>BEFORE UPDATE → set updated_at"]
  T2["fn_block_mutation<br/>BEFORE UPDATE/DELETE on append-only → RAISE"]
  T3["fn_human_final<br/>BEFORE INSERT status event → SYSTEM cannot decide (BR-E03)"]
  classDef t fill:#b45309,color:#fff,stroke:#92400e;
  class T1,T2,T3 t;
```

**Index strategy (DB-D28):** every FK indexed; partial index on `notification_outbox` PENDING;
composite `(owner_id, created_at DESC)` on event partitions; partial unique
`uq_app_active_per_year`; blind-index UNIQUE on `id_number`. ANN indexing lives in ChromaDB.

---

## 7. Integrity & maintenance

| Concern | Mechanism | Standard |
|---------|-----------|----------|
| Append-only truth | `fn_block_mutation` on consent, status events, audit, config_history, pre_screen, recusal | DB-D30 |
| Human-final decisions | `fn_human_final` trigger + service guard | BR-E03 / §5.8 |
| One active app / year | partial unique index | BR-E06 |
| Cross-store integrity | nightly job: PG cuid ↔ MongoDB reasoning ↔ ChromaDB vectors; reports dangling refs | DB-D35 |
| Constraint proof | pytest suite attempts every violation and asserts rejection (Stage 01, DB-D37) | DB-D37 |
| Recoverability | `pg_dump` → drop → restore → full constraint suite green; logged | restore drill |
| Partition horizon | job keeps month N+12 partitions present | DB-D44 |

> Counselling case content (Spec §6.4) never enters this schema — segregation is the requirement
> (BR-S09). The main schema holds only a case id + structured outcome [FWD v2.5].

---

*v1.0 — derived from ERD-PACKAGE v1.1, DB-DOCTRINE v1.1, and the validated schema. ADR-004 rejected:
full polyglot (PostgreSQL + MongoDB + ChromaDB + Redis) from v1.*
