# ADR-003 — FundsLink Academy: PostgreSQL Hybrid Data-Access Strategy

| Attribute | Value |
|-----------|-------|
| **ID** | ADR-003 |
| **Date** | 2026-06-12 |
| **Status** | accepted |
| **Relates To** | S5.3, S5.19, S5.21, S5.28, ADR-001, DB-DOCTRINE v1.1 |

## Context
The constitution mandates raw parameterised SQL for financial queries (S5.21) and PostgreSQL for all money (S5.3). The question: raw SQL everywhere (the CMPG 311 Oracle discipline) or an ORM, for the non-financial 80% of tables. Note: FundsLink is PostgreSQL, NOT Oracle — Oracle XE is resource-capped, unhosted on Railway, and license-priced beyond a non-profit; the founder's Oracle raw-SQL skills transfer almost entirely (joins, constraints, normalization are portable; syntax differences are minor).

## Decision
**Hybrid, behind one repository layer:**
- **Money paths — raw parameterised SQL, always** (ledger writes, allocation math, reconciliation, disbursement batches): auditable, hand-tunable, no ORM-generated mystery at 3am.
- **CRUD entities — SQLAlchemy ORM + Alembic** (profiles, applications, documents, preferences): migrations, relationships, 10x less boilerplate.
- Services never know which served them; any hot CRUD query graduates to raw SQL inside its repository with zero ripple.

## Consequences
Easier: each query gets the treatment its risk deserves; Alembic owns migrations for the whole schema (raw-SQL tables included via op.execute). Harder: two idioms in one codebase — mitigated by the repository boundary and code review.

## Alternatives Rejected
Raw-SQL-everywhere (velocity donated to nobody on a solo four-platform timeline); ORM-everywhere (hides the money — violates S5.21 and the auditability principle).

> **Status: accepted — Owner approval: Maluleke Kurhula Success**
