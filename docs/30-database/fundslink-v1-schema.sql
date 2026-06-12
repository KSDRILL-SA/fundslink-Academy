-- ============================================================
-- FUNDSLINK ACADEMY — v1 PHYSICAL SCHEMA (PostgreSQL 15+)
-- ERD-PACKAGE v1.0 Part 4 | Governed by DB-DOCTRINE v1.1
-- [BUILD] tables only. [FWD] financial tables arrive v1.5/v2.
-- Migration 0001 (Alembic wraps this content).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;       -- ADR-004: pgvector
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- The two approved triggers (DB-D21) ----------
CREATE OR REPLACE FUNCTION fn_block_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'append-only table: % forbidden on %', TG_OP, TG_TABLE_NAME; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ---------- Lookup tables (DB-D9: domains as data) ----------
CREATE TABLE lk_account_state    (code text PRIMARY KEY);  -- PENDING_VERIFICATION/ACTIVE/SUSPENDED/CLOSED
CREATE TABLE lk_application_type (code text PRIMARY KEY);  -- POSTGRAD/UG_CAT_A/UG_CAT_B/UG_CAT_C
CREATE TABLE lk_app_status       (code text PRIMARY KEY);
CREATE TABLE lk_tracked_status   (code text PRIMARY KEY);
CREATE TABLE lk_status_source    (code text PRIMARY KEY);  -- SELF_REPORT/EMAIL_CAPTURE/PARTNER_API
CREATE TABLE lk_verification_level (code text PRIMARY KEY, rank int NOT NULL); -- BRONZE..PLATINUM
CREATE TABLE lk_doc_type         (code text PRIMARY KEY);
CREATE TABLE lk_consent_purpose  (code text PRIMARY KEY);
CREATE TABLE lk_notify_trigger   (code text PRIMARY KEY, sms_default boolean NOT NULL DEFAULT false);
CREATE TABLE lk_bursary_status   (code text PRIMARY KEY);

-- Allowed transitions as data (BR-S04 / BR-T04)
CREATE TABLE app_status_transition (
  from_status text NOT NULL REFERENCES lk_app_status,
  to_status   text NOT NULL REFERENCES lk_app_status,
  PRIMARY KEY (from_status, to_status)
);
CREATE TABLE tracked_status_transition (
  from_status text NOT NULL REFERENCES lk_tracked_status,
  to_status   text NOT NULL REFERENCES lk_tracked_status,
  PRIMARY KEY (from_status, to_status)
);

-- ---------- Identity ----------
CREATE TABLE "user" (
  id                  text PRIMARY KEY,                 -- cuid (DB-D23), app-generated
  email               text NOT NULL,
  password_hash       text NOT NULL,
  account_state       text NOT NULL DEFAULT 'PENDING_VERIFICATION' REFERENCES lk_account_state,
  mfa_secret_enc      text,                             -- TOTP, encrypted [ST-2]
  id_number_enc       bytea,                            -- AES-256-GCM (TAD §4.4)
  id_number_blind_idx text,                             -- HMAC for uniqueness (BR-A04)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  deleted_at timestamptz                                 -- soft delete (DB-D31)
);
CREATE UNIQUE INDEX uq_user_email ON "user"(lower(email)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_user_idnum ON "user"(id_number_blind_idx) WHERE id_number_blind_idx IS NOT NULL;
CREATE TRIGGER tg_user_touch BEFORE UPDATE ON "user" FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

CREATE TABLE role       (id text PRIMARY KEY, code text UNIQUE NOT NULL);
CREATE TABLE permission (id text PRIMARY KEY, code text UNIQUE NOT NULL);
CREATE TABLE role_permission (
  id text PRIMARY KEY, role_id text NOT NULL REFERENCES role ON DELETE RESTRICT,
  permission_id text NOT NULL REFERENCES permission ON DELETE RESTRICT,
  CONSTRAINT uq_role_perm UNIQUE (role_id, permission_id)
);
CREATE TABLE user_role (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES "user" ON DELETE RESTRICT,
  role_id text NOT NULL REFERENCES role ON DELETE RESTRICT,
  CONSTRAINT uq_user_role UNIQUE (user_id, role_id)
);
CREATE INDEX ix_user_role_user ON user_role(user_id);
CREATE INDEX ix_role_perm_role ON role_permission(role_id);

CREATE TABLE student_profile (
  id text PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,  -- 1:1 subtype PK=FK (DB-D22)
  first_name text NOT NULL, last_name text NOT NULL,
  phone text,                                            -- TEXT: leading-zero test (DB-D17)
  level text NOT NULL,                                   -- UG/HONOURS/MASTERS/PHD/PGDIP
  field_of_study text NOT NULL,
  institution_id text,                                   -- FK added by v2 migration (institution [FWD])
  verification_level text NOT NULL DEFAULT 'BRONZE' REFERENCES lk_verification_level,
  hardship_narrative text,                               -- gated; excluded from logs (TAD §4.4)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text, deleted_at timestamptz
);
CREATE TRIGGER tg_sp_touch BEFORE UPDATE ON student_profile FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

CREATE TABLE consent_record (                            -- append-only (DB-D30)
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user" ON DELETE RESTRICT,
  purpose text NOT NULL REFERENCES lk_consent_purpose,
  wording_version text NOT NULL,
  channel text,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);
CREATE INDEX ix_consent_user ON consent_record(user_id, purpose);
-- withdrawal = INSERT of new record; UPDATE allowed only on withdrawn_at via app role? NO:
-- doctrine D30 — withdrawal is modeled as a new row; block all UPDATE/DELETE:
CREATE TRIGGER tg_consent_guard BEFORE UPDATE OR DELETE ON consent_record FOR EACH ROW EXECUTE FUNCTION fn_block_mutation();

CREATE TABLE refresh_token_family (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES "user" ON DELETE CASCADE, -- auth mechanics (DB-D16 exception)
  revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE refresh_token (
  id text PRIMARY KEY, family_id text NOT NULL REFERENCES refresh_token_family ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL, used_at timestamptz,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_rt_family ON refresh_token(family_id);

-- ---------- Applications ----------
CREATE TABLE funding_application (
  id text PRIMARY KEY,
  student_profile_id text NOT NULL REFERENCES student_profile ON DELETE RESTRICT,
  application_type text NOT NULL REFERENCES lk_application_type,
  status text NOT NULL DEFAULT 'DRAFT' REFERENCES lk_app_status,   -- cache (DB-D24)
  academic_year text NOT NULL,
  requested_amount numeric(14,2) CHECK (requested_amount IS NULL OR requested_amount > 0),
  currency char(3) NOT NULL DEFAULT 'ZAR',               -- DB-D42
  funding_start date, funding_end date,
  CONSTRAINT ck_app_dates CHECK (funding_start IS NULL OR funding_end IS NULL OR funding_start < funding_end),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text, deleted_at timestamptz
);
CREATE INDEX ix_app_student ON funding_application(student_profile_id);
CREATE INDEX ix_app_status  ON funding_application(status);
CREATE TRIGGER tg_app_touch BEFORE UPDATE ON funding_application FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

CREATE TABLE application_status_event (                  -- append-only, partitioned (DB-D44)
  id text NOT NULL,
  application_id text NOT NULL REFERENCES funding_application ON DELETE RESTRICT,
  from_status text REFERENCES lk_app_status,
  to_status   text NOT NULL REFERENCES lk_app_status,
  actor_user_id text NOT NULL REFERENCES "user" ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX ix_ase_app ON application_status_event(application_id, created_at DESC);
CREATE TRIGGER tg_ase_guard BEFORE UPDATE OR DELETE ON application_status_event FOR EACH ROW EXECUTE FUNCTION fn_block_mutation();

CREATE TABLE document (
  id text PRIMARY KEY,
  student_profile_id text NOT NULL REFERENCES student_profile ON DELETE RESTRICT, -- evidence: RESTRICT (DB-D16)
  application_id text REFERENCES funding_application ON DELETE RESTRICT,
  doc_type text NOT NULL REFERENCES lk_doc_type,
  storage_uri text NOT NULL, sha256 text NOT NULL,
  av_status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text, deleted_at timestamptz
);
CREATE INDEX ix_doc_student ON document(student_profile_id);
CREATE INDEX ix_doc_app ON document(application_id);

-- ---------- Bursaries & Tracking ----------
CREATE TABLE external_bursary (
  id text PRIMARY KEY,
  name text NOT NULL, provider text NOT NULL,
  level_eligibility text[] NOT NULL,
  field_tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'OPEN' REFERENCES lk_bursary_status,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text, deleted_at timestamptz
);
CREATE TRIGGER tg_eb_touch BEFORE UPDATE ON external_bursary FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

CREATE TABLE bursary_deadline (
  id text PRIMARY KEY,
  external_bursary_id text NOT NULL REFERENCES external_bursary ON DELETE RESTRICT,
  deadline_type text NOT NULL, due_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), created_by text
);
CREATE INDEX ix_bd_bursary ON bursary_deadline(external_bursary_id);
CREATE INDEX ix_bd_due ON bursary_deadline(due_on);       -- T-3 reminder scan

CREATE TABLE tracked_application (
  id text PRIMARY KEY,
  student_profile_id text NOT NULL REFERENCES student_profile ON DELETE RESTRICT,
  external_bursary_id text NOT NULL REFERENCES external_bursary ON DELETE RESTRICT, -- BR-T history protection
  status text NOT NULL DEFAULT 'REGISTERED' REFERENCES lk_tracked_status,
  last_activity_at timestamptz NOT NULL DEFAULT now(),    -- denorm §3.6
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text, deleted_at timestamptz,
  CONSTRAINT uq_tracked_pair UNIQUE (student_profile_id, external_bursary_id)  -- DB-D8
);
CREATE INDEX ix_ta_student ON tracked_application(student_profile_id);
CREATE INDEX ix_ta_silence ON tracked_application(last_activity_at) WHERE deleted_at IS NULL; -- 30/45/60 job
CREATE TRIGGER tg_ta_touch BEFORE UPDATE ON tracked_application FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

CREATE TABLE tracked_status_event (                      -- append-only, partitioned
  id text NOT NULL,
  tracked_application_id text NOT NULL REFERENCES tracked_application ON DELETE RESTRICT,
  from_status text REFERENCES lk_tracked_status,
  to_status   text NOT NULL REFERENCES lk_tracked_status,
  source text NOT NULL REFERENCES lk_status_source,       -- BR-T03 freshness label
  actor_user_id text REFERENCES "user",
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX ix_tse_tracked ON tracked_status_event(tracked_application_id, created_at DESC);
CREATE TRIGGER tg_tse_guard BEFORE UPDATE OR DELETE ON tracked_status_event FOR EACH ROW EXECUTE FUNCTION fn_block_mutation();

-- ---------- Matching (ADR-004) ----------
CREATE TABLE match_result (
  id text PRIMARY KEY,
  student_profile_id text NOT NULL REFERENCES student_profile ON DELETE RESTRICT,
  external_bursary_id text NOT NULL REFERENCES external_bursary ON DELETE RESTRICT,
  score numeric(5,4) NOT NULL CHECK (score >= 0 AND score <= 1),
  model_version text NOT NULL, prompt_version text NOT NULL,
  reasoning jsonb NOT NULL,                              -- ADR-004 (was MongoDB)
  mode text NOT NULL DEFAULT 'LIVE' CHECK (mode IN ('LIVE','FALLBACK')),  -- S8.51
  created_at timestamptz NOT NULL DEFAULT now(), created_by text,
  CONSTRAINT uq_match UNIQUE (student_profile_id, external_bursary_id, model_version)
);
CREATE INDEX ix_match_student ON match_result(student_profile_id, created_at DESC);

CREATE TABLE profile_embedding (
  student_profile_id text PRIMARY KEY REFERENCES student_profile ON DELETE RESTRICT,
  embedding vector(1536) NOT NULL,
  source_hash text NOT NULL,                             -- BR-M04 recompute trigger
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bursary_embedding (
  external_bursary_id text NOT NULL REFERENCES external_bursary ON DELETE RESTRICT,
  chunk_no int NOT NULL,
  embedding vector(1536) NOT NULL,
  source_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (external_bursary_id, chunk_no)
);
CREATE INDEX ix_be_ann ON bursary_embedding USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ---------- Notifications, Audit, Config ----------
CREATE TABLE notification_outbox (                       -- queue, partitioned
  id text NOT NULL,
  user_id text NOT NULL REFERENCES "user" ON DELETE RESTRICT,
  trigger text NOT NULL REFERENCES lk_notify_trigger,
  channels text[] NOT NULL,
  payload jsonb NOT NULL,                                -- DB-D15 sanctioned exception
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','SENDING','SENT','DEAD')),
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX ix_outbox_pending ON notification_outbox(next_attempt_at) WHERE state = 'PENDING'; -- ST-3.1 partial

CREATE TABLE notification_preference (
  id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE REFERENCES "user" ON DELETE RESTRICT,
  per_trigger jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (                                 -- append-only, partitioned
  id text NOT NULL,
  actor_user_id text,                                    -- NULL = SYSTEM principal
  action text NOT NULL, resource_type text NOT NULL, resource_id text,
  request_id text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX ix_audit_actor ON audit_log(actor_user_id, created_at DESC);
CREATE TRIGGER tg_audit_guard BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION fn_block_mutation();

CREATE TABLE config (
  key text PRIMARY KEY, value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE config_history (                            -- DB-D24, BR-F12
  id text NOT NULL, key text NOT NULL,
  old_value text, new_value text NOT NULL,
  effective_from timestamptz NOT NULL,
  approved_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
);
CREATE TRIGGER tg_cfgh_guard BEFORE UPDATE OR DELETE ON config_history FOR EACH ROW EXECUTE FUNCTION fn_block_mutation();

-- ---------- Monthly partitions (first 12; ops: pg_partman or scheduled job thereafter) ----------
DO $$
DECLARE t text; d date;
BEGIN
  FOREACH t IN ARRAY ARRAY['application_status_event','tracked_status_event','notification_outbox','audit_log'] LOOP
    FOR i IN 0..11 LOOP
      d := date_trunc('month', now())::date + (i || ' months')::interval;
      EXECUTE format('CREATE TABLE IF NOT EXISTS %I_%s PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
        t, to_char(d,'YYYYMM'), t, d, d + interval '1 month');
    END LOOP;
  END LOOP;
END $$;

-- ---------- Role grants (DB-D30) ----------
-- CREATE ROLE fundslink_app LOGIN PASSWORD :'app_pw';
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO fundslink_app;
-- REVOKE UPDATE, DELETE ON application_status_event, tracked_status_event,
--        audit_log, consent_record, config_history FROM fundslink_app;
-- (counselling schema [FWD v2.5]: NO grants to fundslink_app — Spec §6.4)

-- ---------- Seeds (abbreviated; full seed file in repo) ----------
INSERT INTO lk_account_state VALUES ('PENDING_VERIFICATION'),('ACTIVE'),('SUSPENDED'),('CLOSED');
INSERT INTO lk_application_type VALUES ('POSTGRAD'),('UG_CAT_A'),('UG_CAT_B'),('UG_CAT_C');
INSERT INTO lk_app_status VALUES ('DRAFT'),('SUBMITTED'),('UNDER_REVIEW'),('INTERVIEW_SCHEDULED'),('INTERVIEWED'),('APPROVED_PROPOSED'),('APPROVED'),('REJECTED'),('WITHDRAWN');
INSERT INTO lk_tracked_status VALUES ('REGISTERED'),('SUBMITTED'),('UNDER_REVIEW'),('SHORTLISTED'),('INTERVIEW'),('APPROVED'),('REJECTED'),('NO_RESPONSE'),('WITHDRAWN');
INSERT INTO lk_status_source VALUES ('SELF_REPORT'),('EMAIL_CAPTURE'),('PARTNER_API');
INSERT INTO lk_verification_level VALUES ('BRONZE',1),('SILVER',2),('GOLD',3),('PLATINUM',4);
INSERT INTO config VALUES ('monthly_allowance_zar','1000.00', now()),
                          ('matching_daily_budget_zar','200.00', now());
-- BR-S04 transitions seed:
INSERT INTO app_status_transition VALUES
 ('DRAFT','SUBMITTED'),('SUBMITTED','UNDER_REVIEW'),('UNDER_REVIEW','INTERVIEW_SCHEDULED'),
 ('INTERVIEW_SCHEDULED','INTERVIEWED'),('UNDER_REVIEW','APPROVED_PROPOSED'),('INTERVIEWED','APPROVED_PROPOSED'),
 ('APPROVED_PROPOSED','APPROVED'),('UNDER_REVIEW','REJECTED'),('INTERVIEWED','REJECTED'),('APPROVED_PROPOSED','REJECTED'),
 ('DRAFT','WITHDRAWN'),('SUBMITTED','WITHDRAWN'),('UNDER_REVIEW','WITHDRAWN'),('INTERVIEW_SCHEDULED','WITHDRAWN'),('INTERVIEWED','WITHDRAWN');
-- ============================================================

-- ============================================================
-- v1.1 ADDITIONS — Pre-Screening Engine + Category D (OTHER)
-- MASTER-SPEC v1.1 §5.6–5.8, §14.6 | ERD v1.1 BR-E01–E10
-- ============================================================
INSERT INTO lk_application_type VALUES ('OTHER');
INSERT INTO lk_app_status VALUES ('PRE_SCREENING'),('READY_FOR_REVIEW'),('RETURNED_FOR_INFO'),
 ('RESUBMITTED'),('UNSCREENED'),('APPROVED_WAITLISTED'),('APPEALED'),('REJECTED_FINAL');
CREATE TABLE lk_theme_tag (code text PRIMARY KEY);

-- Expanded transitions (BR-S04 v1.1)
DELETE FROM app_status_transition;
INSERT INTO app_status_transition VALUES
 ('DRAFT','SUBMITTED'),('SUBMITTED','PRE_SCREENING'),
 ('PRE_SCREENING','READY_FOR_REVIEW'),('PRE_SCREENING','RETURNED_FOR_INFO'),('PRE_SCREENING','UNSCREENED'),
 ('RETURNED_FOR_INFO','RESUBMITTED'),('RESUBMITTED','PRE_SCREENING'),
 ('READY_FOR_REVIEW','UNDER_REVIEW'),('UNSCREENED','UNDER_REVIEW'),
 ('UNDER_REVIEW','INTERVIEW_SCHEDULED'),('INTERVIEW_SCHEDULED','INTERVIEWED'),
 ('UNDER_REVIEW','APPROVED_PROPOSED'),('INTERVIEWED','APPROVED_PROPOSED'),
 ('APPROVED_PROPOSED','APPROVED'),('APPROVED_PROPOSED','APPROVED_WAITLISTED'),('APPROVED_WAITLISTED','APPROVED'),
 ('UNDER_REVIEW','REJECTED'),('INTERVIEWED','REJECTED'),('APPROVED_PROPOSED','REJECTED'),
 ('REJECTED','APPEALED'),('APPEALED','APPROVED_PROPOSED'),('APPEALED','REJECTED_FINAL'),
 ('DRAFT','WITHDRAWN'),('SUBMITTED','WITHDRAWN'),('PRE_SCREENING','WITHDRAWN'),
 ('RETURNED_FOR_INFO','WITHDRAWN'),('READY_FOR_REVIEW','WITHDRAWN'),('UNSCREENED','WITHDRAWN'),
 ('UNDER_REVIEW','WITHDRAWN'),('INTERVIEW_SCHEDULED','WITHDRAWN'),('INTERVIEWED','WITHDRAWN');

-- E1: one ACTIVE application per student per academic year
CREATE UNIQUE INDEX uq_app_active_per_year ON funding_application(student_profile_id, academic_year)
 WHERE deleted_at IS NULL AND status NOT IN ('REJECTED_FINAL','REJECTED','WITHDRAWN','APPROVED');

-- BR-E03: Human-Final — DB-level guard: SYSTEM cannot decide
CREATE OR REPLACE FUNCTION fn_human_final() RETURNS trigger AS $$
BEGIN
  IF NEW.to_status IN ('APPROVED','REJECTED','REJECTED_FINAL')
     AND (NEW.actor_user_id IS NULL OR NEW.actor_user_id = 'SYSTEM') THEN
    RAISE EXCEPTION 'HUMAN_FINAL_PRINCIPLE: % requires a human actor (MASTER-SPEC §5.8)', NEW.to_status;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER tg_human_final BEFORE INSERT ON application_status_event
 FOR EACH ROW EXECUTE FUNCTION fn_human_final();
-- NOTE (DB-D21 amendment ride-along): third approved trigger class — value-guard
-- on append-only inserts. Registered in GOVERNANCE-PATCHES.

CREATE TABLE eligibility_ruleset (                       -- BR-E02 config-as-data
  id text PRIMARY KEY,
  application_type text NOT NULL REFERENCES lk_application_type,
  version int NOT NULL,
  rules jsonb NOT NULL,
  effective_from timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), created_by text,
  CONSTRAINT uq_ruleset UNIQUE (application_type, version)
);

CREATE TABLE pre_screen_result (                         -- BR-E01 append-only
  id text PRIMARY KEY,
  application_id text NOT NULL REFERENCES funding_application ON DELETE RESTRICT,
  ruleset_id text NOT NULL REFERENCES eligibility_ruleset,
  outcome text NOT NULL CHECK (outcome IN ('READY','RETURNED','UNSCREENED')),
  checks jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_psr_app ON pre_screen_result(application_id, created_at DESC);
CREATE TRIGGER tg_psr_guard BEFORE UPDATE OR DELETE ON pre_screen_result FOR EACH ROW EXECUTE FUNCTION fn_block_mutation();

CREATE TABLE application_return (                        -- BR-E04
  id text PRIMARY KEY,
  application_id text NOT NULL REFERENCES funding_application ON DELETE RESTRICT,
  cycle_no int NOT NULL CHECK (cycle_no >= 1),
  fix_list jsonb NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_return_cycle UNIQUE (application_id, cycle_no)
);

CREATE TABLE application_motivation (                    -- BR-E05 Other-Reasons store
  id text PRIMARY KEY,
  application_id text NOT NULL UNIQUE REFERENCES funding_application ON DELETE RESTRICT,
  situation text NOT NULL,
  why_not_categories text NOT NULL,
  support_needed text NOT NULL,
  language text NOT NULL DEFAULT 'en',                   -- E11: any SA official language
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), created_by text
);
CREATE TRIGGER tg_motiv_touch BEFORE UPDATE ON application_motivation FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

CREATE TABLE motivation_theme_tag (
  id text PRIMARY KEY,
  motivation_id text NOT NULL REFERENCES application_motivation ON DELETE RESTRICT,
  tag text NOT NULL REFERENCES lk_theme_tag,
  tagged_by text NOT NULL REFERENCES "user",
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_motiv_tag UNIQUE (motivation_id, tag)
);

CREATE TABLE appeal (                                    -- BR-E07
  id text PRIMARY KEY,
  application_id text NOT NULL UNIQUE REFERENCES funding_application ON DELETE RESTRICT,
  new_information text NOT NULL,
  original_decider_id text NOT NULL REFERENCES "user",
  reviewed_by text REFERENCES "user",
  outcome text CHECK (outcome IN ('UPHELD','OVERTURNED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_appeal_different_human CHECK (reviewed_by IS NULL OR reviewed_by <> original_decider_id)
);

CREATE TABLE recusal (                                   -- BR-E09 append-only
  id text PRIMARY KEY,
  application_id text NOT NULL REFERENCES funding_application ON DELETE RESTRICT,
  reviewer_id text NOT NULL REFERENCES "user",
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_recusal UNIQUE (application_id, reviewer_id)
);
CREATE TRIGGER tg_recusal_guard BEFORE UPDATE OR DELETE ON recusal FOR EACH ROW EXECUTE FUNCTION fn_block_mutation();
