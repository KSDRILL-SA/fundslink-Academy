-- Downgrade for migration 0003 — restore the pre-hardening index/constraint set.
DROP TABLE IF EXISTS
  audit_log_default, notification_outbox_default,
  application_status_event_default, tracked_status_event_default;

ALTER TABLE document        DROP CONSTRAINT IF EXISTS ck_doc_av_status;
ALTER TABLE student_profile DROP CONSTRAINT IF EXISTS ck_sp_level;
ALTER TABLE bursary_deadline DROP CONSTRAINT IF EXISTS ck_bd_type;

DROP INDEX IF EXISTS uq_app_active_per_year;
CREATE UNIQUE INDEX uq_app_active_per_year ON funding_application(student_profile_id, academic_year)
  WHERE deleted_at IS NULL AND status NOT IN ('REJECTED_FINAL','REJECTED','WITHDRAWN','APPROVED');

DROP INDEX IF EXISTS ix_app_status;
CREATE INDEX ix_app_status ON funding_application(status);

DROP INDEX IF EXISTS ix_role_perm_perm;
DROP INDEX IF EXISTS ix_user_role_role;
DROP INDEX IF EXISTS ix_match_bursary;
DROP INDEX IF EXISTS ix_ta_bursary;
DROP INDEX IF EXISTS ix_rtf_user;
