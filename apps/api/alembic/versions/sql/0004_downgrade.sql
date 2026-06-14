-- Downgrade for migration 0004 — reverse in dependency-safe order.
INSERT INTO lk_consent_purpose(code) VALUES ('MARKETING_WHATSAPP') ON CONFLICT DO NOTHING;
DELETE FROM lk_consent_purpose WHERE code='MARKETING_WHATSAPP';

ALTER TABLE application_motivation DROP CONSTRAINT IF EXISTS ck_motiv_language;
ALTER TABLE student_profile DROP CONSTRAINT IF EXISTS ck_sp_language;
ALTER TABLE student_profile DROP COLUMN IF EXISTS preferred_language;

ALTER TABLE application_return DROP COLUMN IF EXISTS respond_by;

ALTER TABLE document DROP CONSTRAINT IF EXISTS ck_doc_validity;
ALTER TABLE document DROP COLUMN IF EXISTS issued_at;
ALTER TABLE document DROP COLUMN IF EXISTS valid_until;

-- Restore the pre-0004 active-uniqueness predicate (APPROVED already excluded by 0003).
DROP INDEX IF EXISTS uq_app_active_per_year;
CREATE UNIQUE INDEX uq_app_active_per_year ON funding_application(student_profile_id, academic_year)
  WHERE deleted_at IS NULL AND status NOT IN ('REJECTED_FINAL','REJECTED','WITHDRAWN');

ALTER TABLE application_status_event DROP COLUMN IF EXISTS note;

DELETE FROM app_status_transition WHERE
  (from_status, to_status) IN (
    ('APPROVED','SUSPENDED'),('APPROVED','REVOKED'),('APPROVED','COMPLETED'),
    ('SUSPENDED','APPROVED'),('SUSPENDED','REVOKED'),('SUSPENDED','COMPLETED'));
DELETE FROM lk_app_status WHERE code IN ('SUSPENDED','REVOKED','COMPLETED');

DROP INDEX IF EXISTS ix_app_review_triage;
DELETE FROM config WHERE key='emergency_review_sla_days';
ALTER TABLE funding_application DROP COLUMN IF EXISTS needed_by;
ALTER TABLE funding_application DROP COLUMN IF EXISTS priority;
DROP TABLE IF EXISTS lk_priority;
