-- ============================================================
-- 0004 — Application lifecycle improvements (Founder-approved L4, 2026-06-14)
-- Outcome of the student-journey review. Additive (DB-D36). Statements are ordered
-- so every FK/CHECK target exists before the column that references it.
-- ============================================================

-- ---------- P0.1 Priority / emergency lane ----------
-- Sortable priority via a ranked lookup (same pattern as lk_verification_level, DB-D9).
CREATE TABLE lk_priority (code text PRIMARY KEY, rank int NOT NULL);
INSERT INTO lk_priority(code, rank) VALUES ('NORMAL',1),('URGENT',2),('CRITICAL',3)
  ON CONFLICT DO NOTHING;

ALTER TABLE funding_application
  ADD COLUMN priority  text NOT NULL DEFAULT 'NORMAL' REFERENCES lk_priority,  -- triage rank
  ADD COLUMN needed_by date;                                                    -- "I need help by"

-- Reviewers triage the queue by urgency then age. Partial index on the live review queue.
CREATE INDEX ix_app_review_triage ON funding_application(priority, created_at)
  WHERE deleted_at IS NULL AND status IN ('READY_FOR_REVIEW','UNSCREENED','RESUBMITTED');

-- emergency cases get a shorter human-review SLA (config-as-data, no hardcoding — DB-D24).
INSERT INTO config(key, value) VALUES ('emergency_review_sla_days','3')
  ON CONFLICT (key) DO NOTHING;

-- ---------- P0.2 Post-approval lifecycle (money safety — MASTER-SPEC §16) ----------
-- Funding is not "fire and forget": an approved award can be suspended, revoked, or
-- completed, each with a human actor and a recorded reason.
INSERT INTO lk_app_status(code) VALUES ('SUSPENDED'),('REVOKED'),('COMPLETED')
  ON CONFLICT DO NOTHING;

INSERT INTO app_status_transition(from_status, to_status) VALUES
  ('APPROVED','SUSPENDED'),('APPROVED','REVOKED'),('APPROVED','COMPLETED'),
  ('SUSPENDED','APPROVED'),('SUSPENDED','REVOKED'),('SUSPENDED','COMPLETED')
  ON CONFLICT DO NOTHING;

-- A free-text reason/note on any transition (revocation cause, rejection reason, etc.).
ALTER TABLE application_status_event ADD COLUMN note text;

-- SUSPENDED/REVOKED are still "active" enough to keep blocking a duplicate same-year app;
-- only COMPLETED joins the terminal set alongside REJECTED_FINAL/REJECTED/WITHDRAWN.
DROP INDEX uq_app_active_per_year;
CREATE UNIQUE INDEX uq_app_active_per_year ON funding_application(student_profile_id, academic_year)
  WHERE deleted_at IS NULL AND status NOT IN ('REJECTED_FINAL','REJECTED','WITHDRAWN','COMPLETED');

-- ---------- P1.3 Document validity (BR-E10: expired docs trigger RETURN, never reject) ----------
ALTER TABLE document
  ADD COLUMN issued_at   date,
  ADD COLUMN valid_until date,
  ADD CONSTRAINT ck_doc_validity
    CHECK (issued_at IS NULL OR valid_until IS NULL OR issued_at <= valid_until);

-- ---------- P1.4 Resubmission clock ----------
ALTER TABLE application_return ADD COLUMN respond_by date;

-- ---------- P2.9 Preferred language (11 SA official languages — E11) ----------
ALTER TABLE student_profile
  ADD COLUMN preferred_language text NOT NULL DEFAULT 'en',
  ADD CONSTRAINT ck_sp_language
    CHECK (preferred_language IN ('en','af','zu','xh','nso','tn','st','ts','ss','ve','nr'));
-- Constrain the existing motivation language to the same set.
ALTER TABLE application_motivation ADD CONSTRAINT ck_motiv_language
  CHECK (language IN ('en','af','zu','xh','nso','tn','st','ts','ss','ve','nr'));

-- ---------- P1.6 WhatsApp as a consented channel (SA reality, BR-N03) ----------
INSERT INTO lk_consent_purpose(code) VALUES ('MARKETING_WHATSAPP')
  ON CONFLICT DO NOTHING;
