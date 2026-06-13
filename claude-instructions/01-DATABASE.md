# STAGE 01 — THE DATABASE, ALONE, PERFECTLY (Founder's first focus)
**Read first (full):** docs/database/ (DBLC, DB-DOCTRINE, ERD-PACKAGE, schema.sql) · IMPLEMENTATION-PROCESS §3. **Reference:** TAD §4, ADR-003 (data access), MASTER-SPEC §5.6–5.8 + §14.6 (the rules your schema enforces).
**Store note:** ADR-004 (PG-only) is **REJECTED** — v1 is 3-store (PostgreSQL + MongoDB + ChromaDB + Redis). This stage builds the **PostgreSQL** schema + constraints only; the MongoDB/ChromaDB collection bootstrap and the DB-D35 cross-store integrity job arrive with the matching module (Stage 03), behind repository seams (its first consumer).
**Forbidden this stage:** endpoints, services, Angular, auth logic, "quick stubs". The database exists alone until G1.

## TASKS (in order)
1. **Migration 0001:** wrap schema.sql (validated content — do not redesign it) into Alembic via op.execute blocks; downgrade = full drop. `alembic upgrade head` from empty must be clean; downgrade→upgrade roundtrip clean.
2. **Seeds (idempotent script + migration 0002):** complete role/permission matrix from TAD §3.4; all lookups; BOTH transition tables exactly as in the sql; config (monthly_allowance_zar=1000.00, review_sla_days=14, matching_daily_budget_zar=200.00); eligibility_ruleset v1 per category with rules JSONB drafted FROM MASTER-SPEC §5.7 table (POSTGRAD: acceptance letter present; CAT_A: NSFAS-pause evidence + transcript; CAT_B: NSFAS approval + institution debt statement; CAT_C: NSFAS outcome evidence; OTHER: completeness only); lk_theme_tag starter set (FINANCIAL_GAP, FAMILY_CRISIS, HEALTH, DOCUMENTATION, INSTITUTIONAL, OTHER).
3. **Constraint test suite (DB-D37) — the crown of this stage:** pytest per constraint/trigger that ATTEMPTS the violation and asserts rejection: append-only guards (all 6 tables), human-final trigger (SYSTEM approve → fail; human approve → pass), uq_user_idnum, uq_app_active_per_year, ck_appeal_different_human, uq_tracked_pair, every transition-table illegal move, FK RESTRICT behavior on document/bursary, ck_app_dates. Target: 100% of DDL constraints exercised.
4. **Integrity job suite skeleton (DB-D39):** status-cache vs event-log consistency check; dangling-reference scan; partition-horizon check — one `make integrity` command.
5. **Partition maintenance:** job ensuring month N+12 partitions exist for the 4 partitioned tables.
6. **Repository base layer ONLY:** async session mgmt, raw-SQL helper with named params, institution-scoped base class (dormant), cuid generator. NO business repositories.
7. **Restore drill #1:** pg_dump → drop db → restore → full constraint suite green against the restored DB. Document timing in docs/operations/restore-drill-log.md.
8. **EXPLAIN pass (DB-D28/D40):** the 5 hottest v1 queries (my applications, dashboard tracked list, outbox claim, matches by student, review queue) — show index usage, commit output to docs/database/explain-baseline.md.

## GATE G1 (paste real output)
[ ] upgrade-from-zero + roundtrip clean  [ ] constraint suite 100% green in CI
[ ] `make integrity` runs clean on seeded DB  [ ] restore drill log committed
[ ] explain-baseline shows index scans on all 5
STOP. **The Founder personally stamps the database DONE.** Nothing else exists until then.
