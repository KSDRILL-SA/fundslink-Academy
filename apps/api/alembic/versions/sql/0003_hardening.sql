-- ============================================================
-- 0003 — Stage 01 review hardening (Founder-approved L4, 2026-06-14)
-- Performance + robustness + domain integrity. Additive (DB-D36).
-- ============================================================

-- ---------- Tier 1: performance indexes (DB-D28/D40) ----------
-- FK reverse-lookup / RESTRICT-check indexes on growing business/identity tables.
-- (Lookup-table FKs and hot append-only partition reverse-FKs are deliberately NOT
--  indexed — indexing the hottest insert path for rare reads is the wrong trade.)
CREATE INDEX ix_rtf_user        ON refresh_token_family(user_id);        -- revoke-all-sessions; CASCADE perf
CREATE INDEX ix_ta_bursary      ON tracked_application(external_bursary_id); -- RESTRICT check + "who tracks X"
CREATE INDEX ix_match_bursary   ON match_result(external_bursary_id);     -- "students matched to bursary X"
CREATE INDEX ix_user_role_role  ON user_role(role_id);                    -- "all users with role X"
CREATE INDEX ix_role_perm_perm  ON role_permission(permission_id);        -- "roles with permission X"

-- Composite index for the ADMIN REVIEW QUEUE only. Verified by EXPLAIN: with a paginated
-- LIMIT over thousands of READY_FOR_REVIEW rows the planner does an ordered "Index Scan
-- Backward" and skips the Sort entirely. The analogous student-dashboard composites were
-- tested and REJECTED — per-student cardinality is tiny, so the planner uses bitmap+sort
-- regardless and the extra index column is pure write cost (DB-D28: no speculative indexes).
DROP INDEX ix_app_status;
CREATE INDEX ix_app_status ON funding_application(status, created_at DESC);

-- ---------- Tier 4: one funded/active application per student per year (ERD §14.6 E1) ----------
-- APPROVED now counts as active, so a funded student cannot open a duplicate same-year app.
DROP INDEX uq_app_active_per_year;
CREATE UNIQUE INDEX uq_app_active_per_year ON funding_application(student_profile_id, academic_year)
  WHERE deleted_at IS NULL AND status NOT IN ('REJECTED_FINAL','REJECTED','WITHDRAWN');

-- ---------- Tier 3: domain CHECKs — every status column constrained (DB-D9) ----------
ALTER TABLE document        ADD CONSTRAINT ck_doc_av_status
  CHECK (av_status IN ('PENDING','SCANNING','CLEAN','INFECTED','ERROR'));
ALTER TABLE student_profile ADD CONSTRAINT ck_sp_level
  CHECK (level IN ('UG','HONOURS','MASTERS','PHD','PGDIP'));
-- deadline_type value-set is DERIVED (spec §12 not enumerated) — Founder-confirm.
ALTER TABLE bursary_deadline ADD CONSTRAINT ck_bd_type
  CHECK (deadline_type IN ('APPLICATION','DOCUMENT','INTERVIEW','DECISION','PAYMENT','OTHER'));

-- ---------- Tier 2: DEFAULT partitions — overflow safety nets (critical write paths) ----------
-- audit_log + notification_outbox are written inside every mutation's transaction; the two
-- *_status_event tables share that risk. A default partition catches an out-of-range row
-- instead of failing the whole transaction; the maintenance job keeps it empty. Parent-level
-- triggers (append-only guard, human-final) propagate to the default partition automatically.
CREATE TABLE audit_log_default                PARTITION OF audit_log                DEFAULT;
CREATE TABLE notification_outbox_default      PARTITION OF notification_outbox      DEFAULT;
CREATE TABLE application_status_event_default PARTITION OF application_status_event DEFAULT;
CREATE TABLE tracked_status_event_default     PARTITION OF tracked_status_event     DEFAULT;
