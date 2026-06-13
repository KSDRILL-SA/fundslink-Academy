# FUNDSLINK ACADEMY — DATABASE DESIGN DOCTRINE
## From the Canon to the Constitution: Rob & Coronel Ch01–Ch09 → FundsLink Rules

### Version 1.1 | 2026 | Status: PROPOSED (L4 approval pending)
#### v1.1: DB-D41-D44 added from the Stress-Test Audit (typed ledger refs, timestamptz, currency, day-one partitioning)

---

## DOCUMENT CONTROL

| Attribute | Value |
|-----------|-------|
| Purpose | Convert every database good practice from the Ch01–Ch09 canon into FundsLink-specific rules: **what** the canon teaches → **why** it matters → **how/where** it applies in FundsLink → the **enforceable rule** |
| Sources | Rob & Coronel, *Database Systems: Design, Implementation & Management* — Ch01 Database Systems · Ch02 Data Models · Ch03 Relational Model · Ch04 ER Modeling · Ch05 Normalization · Ch06 Intro SQL · Ch07 Advanced SQL · Ch08 Advanced Data Modeling · Ch09 Database Design |
| Binds | master-spec · technical-architecture · the forthcoming ERD package and all DDL |
| Rule IDs | `DB-D1 … DB-D40` — every rule is citable in reviews, exactly like constitutional S-standards |
| Gate | **The ERD deliverable may not be locked until it passes the DB-D checklist in §11** |

---

# 1. FROM CH01 — DATABASE SYSTEMS: THE FOUNDATION MINDSET

## The Canon
Data are raw facts; information is data processed with context. Uncontrolled **data redundancy** causes update, insert, and delete anomalies that destroy integrity. **Data independence** means programs that access data don't depend on how data is physically stored — file systems fail precisely because they lack it. The DBMS is the single gatekeeper between applications and data.

## FundsLink Translation
FundsLink's entire trust promise ("every rand accounted for, 100% audit trail") is an *integrity* promise — and Ch01 teaches that integrity dies wherever the same fact lives in two places with no controller. The donation pool balance, a student's funding status, an institution's allocation total — each must have exactly one authoritative home. Data independence is what our repository layer (TAD §2.1) implements in modern dress: routers and services don't know whether a fact comes from a table, a view, or a raw SQL aggregate — so the physical schema can evolve without rewriting the application.

## Enforceable Rules
| ID | Rule |
|----|------|
| **DB-D1** | **Single source of truth per fact.** Every business fact has exactly one authoritative table/column. Anything derivable (pool balance, donor cumulative total, allocation sums) is computed by query or maintained by controlled mechanism — never manually duplicated. |
| **DB-D2** | **Data independence via the repository layer.** No code outside repositories may reference table or column names. Schema refactors must be invisible above the repository boundary. |
| **DB-D3** | **The DBMS enforces what the DBMS can enforce.** Integrity rules expressible as constraints (PK, FK, UNIQUE, CHECK, NOT NULL) live in the database, not only in Python. The app validates for UX; the database validates for truth. |

---

# 2. FROM CH02 — DATA MODELS: BUSINESS RULES ARE THE SOURCE CODE OF THE SCHEMA

## The Canon
Business rules are *precisely written, unambiguous statements derived from a detailed description of operations*. When written properly they define entities, relationships, attributes, connectivities, cardinalities, and constraints. **Every relationship requires TWO business rules** (one in each direction). Some rules cannot be expressed in an ERD (e.g., "credit line over $10,000 only with satisfactory history") — these are handled at the application level, *but they must still be written down*.

## FundsLink Translation
master-spec **is** our "description of operations" — Ch02 tells us the schema must be *derived* from it, sentence by sentence, not invented at the keyboard. Examples of FundsLink business rule pairs, exactly in canon form:

- An Institution receives many DisbursementBatches / each DisbursementBatch is paid to exactly one Institution.
- A DisbursementBatch contains many AllowanceAllocations / each AllowanceAllocation belongs to exactly one DisbursementBatch.
- A Student registers many TrackedApplications / each TrackedApplication belongs to exactly one Student.
- A Donor makes many Donations / each Donation is made by exactly one Donor (or the anonymous donor principal).

And the canon's "$10,000 credit line" example maps directly to our rules the ERD *cannot* draw — which therefore go into a written catalog with their enforcement location:

| Rule the ERD can't draw | Enforced at |
|--------------------------|-------------|
| `proposed_by ≠ authorized_by` on approvals | DB CHECK constraint |
| SUM(allocations) = batch.total | Service layer + nightly integrity job |
| Postgrad continues only at ≥65% average | Service layer (funding review workflow) |
| One year only for undergrad categories A & C | Service layer + `funding_end_date` validation |
| Allowance R1,000 default, quarterly review | `config` table (no hardcoding — Spec §7.12) |

## Enforceable Rules
| ID | Rule |
|----|------|
| **DB-D4** | **Business Rule Catalog precedes the ERD.** Every entity, relationship, and constraint in the ERD must trace to a numbered business rule extracted from MASTER-SPEC v1.0. No orphan tables, no orphan rules. |
| **DB-D5** | **Two statements per relationship.** Every relationship in the catalog is written in both directions with explicit connectivity (1:1, 1:M, M:N) and participation (mandatory/optional). |
| **DB-D6** | **Undrawable rules are still cataloged**, each with its enforcement location (CHECK / trigger / service / job). A rule with no enforcement location is a wish, not a rule. |

---

# 3. FROM CH03 — THE RELATIONAL MODEL: KEYS AND INTEGRITY ARE NON-NEGOTIABLE

## The Canon
**Entity integrity:** every table has a primary key; no part of it is null; values are unique. **Referential integrity:** every foreign key value either matches an existing PK value or (where allowed) is null — no orphans, ever. Candidate keys not chosen as PK remain enforced as UNIQUE. Domains constrain what values an attribute may take.

## FundsLink Translation
Referential integrity is donor trust in mechanical form: an `AllowanceAllocation` pointing at a non-existent batch, or a `LedgerEntry` referencing a deleted donation, is exactly the "untraceable rand" the spec forbids. Domains become PostgreSQL types + CHECKs: `direction IN ('D','C')`, `amount_dec > 0`, status columns constrained to their state-machine values via lookup-table FKs.

## Enforceable Rules
| ID | Rule |
|----|------|
| **DB-D7** | Every table has a PK. Every FK has a declared constraint — application-enforced "soft references" are forbidden in PostgreSQL. (Cross-store references to MongoDB/ChromaDB documents are the sole exception and must carry a validity-check job.) |
| **DB-D8** | **Candidate keys are declared UNIQUE** even when a surrogate PK is used: `Donation.gateway_txn_id`, `Section18AReceipt.seq_no`, the blind-index of SA ID number, `(batch_id, student_id)` on AllowanceAllocation. |
| **DB-D9** | **Domains are explicit:** every status/enum column references a lookup table or carries a CHECK; every money column is `NUMERIC` with `CHECK (amount >= 0)` unless a signed value is semantically required. |

---

# 4. FROM CH04 — ER MODELING: HOW FUNDSLINK'S DIAGRAM MUST BE DRAWN

## The Canon
Use **Crow's Foot** for implementation-focused design. **M:N relationships must be decomposed** into two 1:M via a bridge (composite) entity that carries at least the two FKs. Prefer a **single-attribute surrogate PK on the bridge** over a composite PK — composite PKs can't be referenced as FKs by future entities and make queries less efficient; the natural composite becomes a UNIQUE candidate key. **Participation (optional/mandatory) is a business decision per side** — derive it from the rules, don't default it. Weak entities and relationship strength are deliberate choices. Relationships read from the 1 side to the M side.

## FundsLink Translation
Our M:N decompositions, named and justified:

| Conceptual M:N | Bridge entity | Carries (beyond the FKs) |
|----------------|--------------|---------------------------|
| Student ↔ ExternalBursary ("tracks") | **TrackedApplication** | status, source, registered_at — the bridge IS a first-class business object |
| DisbursementBatch ↔ Student ("allocates to") | **AllowanceAllocation** | amount_dec, status — the per-student sub-ledger (Spec §16.3) |
| User ↔ Permission (via roles) | **Role + role_permission + user_role** | classic M:N chain, seeded as data (TAD §3.3) |
| Student ↔ Bursary ("matched to") | **MatchResult** | score, model_ver — plus reasoning doc in MongoDB |

Participation decisions, canon-style (the video-store TAPE/RENTAL lesson applied):

- ExternalBursary is **optional** to TrackedApplication's existence in reverse: a bursary may never be tracked by anyone (new bursaries start unreferenced — exactly the "never-rented tape").
- DisbursementBatch → AllowanceAllocation is **mandatory** (a batch with zero allocations is meaningless and must be rejected at creation).
- Student → FundingApplication: a Student may exist with no application yet (optional) — registration precedes applying.
- Donation → Section18AReceipt: optional (anonymous/no-tax-detail donations have no receipt); Receipt → Donation mandatory.

## Enforceable Rules
| ID | Rule |
|----|------|
| **DB-D10** | No M:N relationship is ever implemented directly. Every bridge entity uses a **single-attribute surrogate PK (cuid)**, with the natural pair declared UNIQUE (DB-D8). |
| **DB-D11** | **Participation is decided per relationship side** and recorded in the Business Rule Catalog with its justification — never left to diagramming-tool defaults. |
| **DB-D12** | The ERD is drawn in **Crow's Foot**, read 1→M, with every relationship labeled by an active verb from the catalog ("Institution *receives* DisbursementBatch"). |

---

# 5. FROM CH05 — NORMALIZATION: THE LAW, AND ITS ONE LEGAL EXCEPTION

## The Canon
Uncontrolled redundancy → update/insert/delete anomalies → integrity collapse (the $58.50 stored four times problem). Normalize: 1NF (atomic values, PK identified, no repeating groups) → 2NF (no partial dependencies on a composite key) → 3NF (no transitive dependencies — non-key attributes depend on the key, the whole key, and nothing but the key) → BCNF where every determinant is a candidate key. **Denormalization is a deliberate, documented performance decision — never an accident.**

## FundsLink Translation
The anomalies in FundsLink terms, so they're never abstract again:

- **Update anomaly:** if institution banking details lived on every DisbursementBatch row, a bank change means updating N rows — miss one and money goes to an old account. → Institution table holds it once; batches reference it. (And per TAD §3.4, changing it requires two-step approval.)
- **Insert anomaly:** if bursary data lived only inside TrackedApplication, we couldn't add a new bursary until some student tracked it. → ExternalBursary is its own entity.
- **Delete anomaly:** if a student's last application row also held their profile facts, deleting the application would delete the human. → Profile and Application are separate; soft-delete (S5.8) protects the rest.

Transitive-dependency hunt, FundsLink-specific: `donation.donor_tier` would be transitive (tier depends on donor's cumulative total, which depends on donor) → tier is computed, never stored per donation. `application.institution_name` transits through `institution_id` → name lives on Institution only.

**The legal exceptions (documented denormalization):**

| Stored derivable value | Justification |
|------------------------|---------------|
| `Donation.net_dec` (= gross − fee) | Financial snapshot at transaction time; fees are facts of the event, not recomputable if gateway pricing changes — this is *temporal accuracy*, not laziness |
| `DisbursementBatch.total_dec` | Cross-checked nightly against SUM(allocations) — stored for the approval record the authorizer signed |
| Status columns alongside `*StatusEvent` history | Current-state cache over the append-only event log; the event log remains the truth |

## Enforceable Rules
| ID | Rule |
|----|------|
| **DB-D13** | All OLTP tables reach **3NF minimum; BCNF where determinants exist beyond the PK**. The ERD package must show the dependency reasoning for any table where this was non-obvious. |
| **DB-D14** | **Denormalization requires a written entry** in the ERD package's "Deliberate Denormalizations" table: the value, the justification, and the mechanism that keeps it honest (snapshot semantics, nightly check, or trigger). |
| **DB-D15** | No multi-valued attributes, no repeating groups, no CSV-in-a-column. Lists become child tables (e.g., notification channels per preference = rows, not a string). JSONB is permitted only for genuinely schema-less payloads (webhook bodies, outbox payloads) and never for queryable business facts. |

---

# 6. FROM CH06 — INTRO SQL: CONSTRAINTS, TYPES, AND THE TRUTHS HIDDEN IN SMALL QUESTIONS

## The Canon
PK declaration enforces entity integrity. **Referential constraint actions** (ON DELETE CASCADE / SET NULL / RESTRICT) define what the DBMS does when a DML command would orphan rows — choose them, don't inherit defaults blindly. **Digits that are labels, not numbers, are CHARACTER data** — the leading-zero test: ZIP 03133 keeps its zero, so it's text. Column constraints see one column; table constraints can span columns. WHERE filters rows before grouping; HAVING filters groups after.

## FundsLink Translation
The leading-zero test convicts half our "numeric-looking" fields:

| Field | Type verdict | Why |
|-------|-------------|-----|
| SA ID number | TEXT (then encrypted per TAD §4.4) | Leading zeros possible, never summed; it's a label. Also: 13 digits overflows INT4 anyway |
| Phone number | TEXT | `082…` keeps its zero; `+27` exists |
| Receipt seq_no | INTEGER (sequence) | Genuinely ordinal, arithmetic meaningful |
| Money | NUMERIC(14,2) | Never FLOAT (S5.28); never INTEGER-cents (readability of raw financial SQL matters at 3am) |
| Percentages (65% rule) | NUMERIC(5,2) | Computed averages need decimals |

Referential actions, decided per relationship — the FundsLink policy:

| Relationship | ON DELETE | Why |
|--------------|-----------|-----|
| Anything → financial rows (LedgerEntry, Donation, Allocation, Batch) | **RESTRICT** | Money rows are never orphaned and never cascade-deleted; financial history outlives everything (soft-delete world anyway) |
| User → RefreshTokenFamily | CASCADE | Pure auth mechanics, no business meaning |
| Student → Document | RESTRICT | Documents are evidence; deletion goes through the POPIA workflow (Spec §15.5), not a cascade |
| ExternalBursary → TrackedApplication | RESTRICT | A bursary disappearing must not silently erase students' tracking history |

## Enforceable Rules
| ID | Rule |
|----|------|
| **DB-D16** | **Default referential action is RESTRICT.** CASCADE requires written justification in the DDL comment; CASCADE onto any financial or evidentiary table is forbidden. |
| **DB-D17** | **The leading-zero test is applied to every digits field** during ERD review; identifiers and labels are TEXT, measures are numeric. |
| **DB-D18** | Multi-column rules (e.g., `proposed_by <> authorized_by`, date-range sanity `funding_start < funding_end`) are **table-level CHECK constraints**, named (`ck_batch_two_person`), so violations are greppable in logs. |

---

# 7. FROM CH07 — ADVANCED SQL: TRANSACTIONS, TRIGGERS, PROCEDURES — POWER WITH A LEASH

## The Canon
A transaction is a logical unit of work — all or nothing, leaving the database consistent. Explicit JOIN syntax beats implicit comma-joins (an unintended CROSS JOIN is a Cartesian explosion). Subqueries and correlated subqueries are precision tools. Triggers and stored procedures run inside the DBMS — powerful for invariants, dangerous for hidden business logic.

## FundsLink Translation
Where transactions are sacred in FundsLink — each of these is ONE transaction or it is wrong:

1. Donation webhook: insert Donation + 2 LedgerEntries (debit gateway-clearing, credit pool) + outbox row.
2. Batch authorization: update batch status + write authorization audit + insert N allocation status changes + outbox rows.
3. Status change: update current-state column + insert StatusEvent + insert NotificationOutbox row (TAD §7 — the outbox pattern IS Ch07's atomicity lesson applied to messaging).
4. Refresh-token rotation: revoke old + issue new (atomically, or token theft detection breaks).

Trigger policy — the canon's power, leashed: triggers in FundsLink enforce **physical invariants only**, never business workflow. Approved trigger set: (a) block UPDATE/DELETE on append-only tables (ledger, events, audit — the enforcement arm of Spec §16.2); (b) auto-stamp `updated_at`. Everything else — allocations math, state machines, notifications — lives in services where it's testable (C7) and visible. Stored procedures: none at v1; if a reconciliation query ever needs one, it arrives via ADR.

## Enforceable Rules
| ID | Rule |
|----|------|
| **DB-D19** | **Money invariants ride transactions.** Any service method touching ≥2 financial rows declares an explicit transaction; partial financial writes are a SEV0 class bug. |
| **DB-D20** | **Explicit JOIN syntax only** (`JOIN … ON`); comma-joins are lint-banned in raw SQL. Every raw financial query is reviewed against an EXPLAIN before merge. |
| **DB-D21** | **Triggers enforce physics, not business.** Only append-only protection and timestamp stamping; the approved trigger list lives in the ERD package and grows only by L4 approval. |

---

# 8. FROM CH08 — ADVANCED DATA MODELING: SUPERTYPES, SURROGATE KEYS, TIME, AND TRAPS

## The Canon
**Supertype/subtype** (1:1, attribute inheritance) minimizes nulls and redundant relationships; declare the **subtype discriminator**, and whether subtypes are **disjoint or overlapping**, **partial or complete**. **PK guidelines:** unique, **non-intelligent** (no meaning embedded), immutable over time, single-attribute, preferably numeric, security-compliant. Special cases: implement 1:1 deliberately; **time-variant data needs history structures**; beware **fan traps** (ambiguous paths through a hub entity) and redundant relationships.

## FundsLink Translation
**Supertype/subtype is literally our user model:** `User` (supertype: credentials, contact, account state) with `StudentProfile`, `DonorProfile`, `InstitutionOfficerProfile`, `GraduateProfile` as 1:1 subtypes. Constraints declared canon-style: **overlapping** (a graduate IS a former student and may also be a donor — one human, multiple subtype rows) and **partial** (an admin user has no subtype). Discriminator: the role assignments (TAD §3.2) rather than a single column — documented as such.

**PK guidelines vs our constitution — the reconciliation:** the canon says "preferably numeric"; our constitution mandates **cuid (S5.10)**. The canon's *intent* — unique, non-intelligent, immutable, single-attribute, not security-leaking — is fully satisfied by cuid; "numeric" was an era/tooling preference (and sequential integers actually *violate* the security guideline by leaking volumes: donation #000041 tells a donor how few donations exist). **Ruling: cuid honors the canon's spirit and supersedes its letter.** One exception: `Section18AReceipt.seq_no` is additionally a legal sequential number — it exists as a UNIQUE attribute, not as the PK.

**Time-variant data — the canon's history lesson is already our architecture:** `ApplicationStatusEvent`, `TrackedStatusEvent`, `LedgerEntry`, `AuditLog`, `ConsentRecord` are all append-only history structures. Plus one the canon makes us add: **`config_history`** — when the R1,000 allowance changes (Spec §7.12), the old value, new value, effective date, and approver are recorded; February's reconciliation must know January's rate.

**Fan trap check, FundsLink-specific:** Institution —< DisbursementBatch and Institution —< Student creates the classic fan: "which batch paid which student?" is unanswerable through the hub. Our **AllowanceAllocation** bridge resolves it (Batch —< Allocation >— Student) — the ERD review must verify every money question routes through the allocation, never through the institution hub. Redundant-relationship check: do NOT draw Student→Institution AND Student→Application→...→Institution for the same fact; the student's institution lives in one declared place.

## Enforceable Rules
| ID | Rule |
|----|------|
| **DB-D22** | The User supertype/subtype design is mandatory; subtype tables are 1:1 on `user_id` (PK=FK), declared **overlapping + partial** in the ERD package. No "god user table" with 40 nullable role-specific columns. |
| **DB-D23** | **PKs are cuid** (constitutional), satisfying the canon's guidelines: non-intelligent, immutable, single-attribute, non-enumerable. Sequential numbers exist only where law/business demands them, as UNIQUE attributes. |
| **DB-D24** | **Every time-variant fact has a history structure.** Current-state columns are caches over event tables (DB-D14). Config values that affect money have effective-dated history. |
| **DB-D25** | The ERD review includes an explicit **fan-trap and redundant-relationship pass**; every M-M-through-a-hub question must have a bridge path. |

---

# 9. FROM CH09 — DATABASE DESIGN: THE PIPELINE THAT PRODUCES THE SCHEMA

## The Canon
*Good database design is the foundation of the information system — no application code can compensate for a bad schema.* The DBLC mirrors the SDLC. Design flows **conceptual → logical → physical**, top-down for systems with well-understood entities. Database design and systems design proceed in parallel and must cooperate. The design must avoid uncontrolled duplication, provide efficient access, and serve the information system's actual requirements.

## FundsLink Translation
Ch09's pipeline IS our deliverable chain, formalized:

```
MASTER-SPEC v1.0 (description of operations)
   ↓  extract & number
Business Rule Catalog                 [DB-D4..D6]   ← ERD package, part 1
   ↓  top-down design
Conceptual ERD (Crow's Foot)          [DB-D10..D12] ← ERD package, part 2
   ↓  normalize, keys, types, actions
Logical Model (relational schema)     [DB-D7..D9, D13..D18, D22..D25]
   ↓  PostgreSQL DDL + indexes + triggers
Physical Design (DDL scripts)         [DB-D19..D21, D26..D40]
   ↓  Alembic migration 0001
Implementation                        (gated by OpenAPI contract, S2.7)
```

Parallel-design cooperation, made concrete: the ERD locks **with** the OpenAPI contract, not after the code — the API's resources and the schema's entities are two views of one model, and drift between them is the modern version of Ch09's failed designer/analyst cooperation.

## Enforceable Rules
| ID | Rule |
|----|------|
| **DB-D26** | The ERD package ships as **Business Rule Catalog + Conceptual ERD + Logical Model + Physical DDL** — all four, traceable to each other. Skipping a stage to "save time" is constitutionally void. |
| **DB-D27** | **Top-down first** (entities from the spec), bottom-up only as a verification pass (walk every spec field and confirm it has a home). |
| **DB-D28** | Physical design includes the **index plan**: every FK indexed; every WHERE/ORDER BY in the v1 API surface (TAD §5.3) backed by a stated index; no speculative indexes. |

---

# 10. CROSS-CUTTING PHYSICAL RULES (CANON + CONSTITUTION + SPEC, MERGED)

| ID | Rule | Source |
|----|------|--------|
| **DB-D29** | Money: `NUMERIC(14,2)`, never float, never string math | Ch06 + S5.28 |
| **DB-D30** | Append-only tables (`LedgerEntry`, `*StatusEvent`, `AuditLog`, `ConsentRecord`): app role has INSERT+SELECT only; trigger blocks UPDATE/DELETE as defense-in-depth | Ch07 + Spec §16.2 |
| **DB-D31** | Soft delete via `deleted_at` on business entities; hard DELETE only via the POPIA erasure workflow; append-only tables never delete (pseudonymize instead) | S5.8 + Spec §15.5 |
| **DB-D32** | Standard columns: `id` cuid, `created_at`, `updated_at`, `created_by` on every business table | S5.10 |
| **DB-D33** | Naming: `snake_case`, singular table names, `ck_/fk_/uq_/ix_` constraint prefixes, no abbreviations that need a glossary | Ch03 discipline |
| **DB-D34** | Counselling schema (`counselling.*`) is physically separate: own role, no grants to the app role, FK to students by opaque id only | Spec §6.4/§15.3 |
| **DB-D35** | Cross-store integrity (PostgreSQL ↔ MongoDB reasoning docs ↔ ChromaDB vectors): every cross-reference carries the PostgreSQL cuid; a nightly job reports dangling references | Ch03 spirit, polyglot reality |
| **DB-D36** | Migrations are forward-only, additive-first; column repurposing is forbidden; destructive migrations require L4 + backup checkpoint | Ch09 + TAD §10 |
| **DB-D37** | Every constraint and trigger is exercised by at least one pytest (attempt the violation, assert rejection) | C7 |
| **DB-D38** | Test data is generated, never production-derived; POPIA forbids real student data in dev | Spec §15 |
| **DB-D39** | The integrity job suite (allocation sums, dangling cross-refs, orphan scans) runs nightly and alerts on variance — Ch01's anomaly warnings, automated | Ch01 + Spec §16.5 |
| **DB-D40** | EXPLAIN ANALYZE review for any query on tables expected to exceed 100k rows (events, ledger, notifications) before it ships | Ch07 |
| **DB-D41** | All timestamps `timestamptz`, stored UTC, rendered SAST; date-only business facts use `date` | ST-3 |
| **DB-D42** | Every money row carries `currency CHAR(3) DEFAULT 'ZAR'` — pan-African 2029 costs one default today, a migration later | ST-3 |
| **DB-D43** | **LedgerEntry uses typed nullable FKs** (donation_id, batch_id, allocation_id, pledge_charge_id, refund_id) with `CHECK(num_nonnulls(...)=1)` — full referential integrity; polymorphic ref_type/ref_id is forbidden | ST-3 |
| **DB-D44** | High-volume append-only tables (ledger, events, audit, outbox) are **range-partitioned by month from day one** (pg_partman); FK-indexing rule D28 applies per-partition | ST-3/ST-4 |

---

# 11. THE ERD GATE — CHECKLIST

The ERD package is locked only when every box is checked:

```
[ ] Business Rule Catalog complete, numbered, two statements per
    relationship, undrawable rules have enforcement locations (D4–D6)
[ ] Crow's Foot conceptual ERD; every M:N decomposed via surrogate-PK
    bridge with UNIQUE natural pair (D10–D12)
[ ] 3NF/BCNF demonstrated; Deliberate Denormalizations table present
    with honesty mechanisms (D13–D15)
[ ] Types pass the leading-zero test; referential actions chosen per
    relationship, RESTRICT default (D16–D18)
[ ] Supertype/subtype user model; cuid PKs; history structures for all
    time-variant facts incl. config_history (D22–D24)
[ ] Fan-trap & redundant-relationship pass documented (D25)
[ ] Four-stage package complete and traceable (D26–D27)
[ ] Index plan tied to the v1 API surface (D28)
[ ] Physical rules D29–D44 reflected in the DDL (incl. typed ledger
    FKs, timestamptz, currency, month partitioning)
[ ] Spec field walk: every field in MASTER-SPEC v1.0 §§4–18 has a home
    (bottom-up verification, D27)
```

---

# CLOSING NOTE — FROM ZERO TO HERO, HONESTLY

The canon (Ch01–Ch09) gives the timeless physics: integrity, normalization, keys, transactions, design pipeline. The constitution (C5) gives the house style: cuid, soft delete, Decimal, raw SQL for money. The spec (v4.0) gives the domain truths: append-only money, two-person approval, segregated counselling data, per-student sub-ledgers. This doctrine is where the three meet — and where they conflicted (numeric PKs vs cuid), the conflict was resolved **in writing, by intent, not by silence**. That is the whole discipline in one sentence.

**Status: PROPOSED — Engineer 01 (Claude, L1/L2). Awaiting Founder (L4) approval. On approval, this document gates the ERD deliverable.**

_________________________
**Maluleke Kurhula Success** — Founder, L4
