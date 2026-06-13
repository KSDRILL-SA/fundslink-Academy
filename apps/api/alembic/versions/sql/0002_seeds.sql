-- ============================================================
-- FUNDSLINK ACADEMY — REFERENCE / SEED DATA (migration 0002)
-- Idempotent (ON CONFLICT DO NOTHING) — re-running is a no-op.
-- Sources: schema.sql inline seeds (lookups, app transitions, config),
--          TAD §3.2/§3.4 (roles + RBAC matrix), stage 01 task 2 (themes,
--          eligibility rulesets), BR-T04 (tracked transitions — derived,
--          see PR note). DB-D9 (domains as data), DB-D24 (config-as-data).
-- ============================================================

-- ---------- Lookups (DB-D9) ----------
INSERT INTO lk_account_state (code) VALUES
  ('PENDING_VERIFICATION'),('ACTIVE'),('SUSPENDED'),('CLOSED')
  ON CONFLICT DO NOTHING;

INSERT INTO lk_application_type (code) VALUES
  ('POSTGRAD'),('UG_CAT_A'),('UG_CAT_B'),('UG_CAT_C'),('OTHER')
  ON CONFLICT DO NOTHING;

INSERT INTO lk_app_status (code) VALUES
  ('DRAFT'),('SUBMITTED'),('UNDER_REVIEW'),('INTERVIEW_SCHEDULED'),('INTERVIEWED'),
  ('APPROVED_PROPOSED'),('APPROVED'),('REJECTED'),('WITHDRAWN'),
  ('PRE_SCREENING'),('READY_FOR_REVIEW'),('RETURNED_FOR_INFO'),('RESUBMITTED'),
  ('UNSCREENED'),('APPROVED_WAITLISTED'),('APPEALED'),('REJECTED_FINAL')
  ON CONFLICT DO NOTHING;

INSERT INTO lk_tracked_status (code) VALUES
  ('REGISTERED'),('SUBMITTED'),('UNDER_REVIEW'),('SHORTLISTED'),('INTERVIEW'),
  ('APPROVED'),('REJECTED'),('NO_RESPONSE'),('WITHDRAWN')
  ON CONFLICT DO NOTHING;

INSERT INTO lk_status_source (code) VALUES
  ('SELF_REPORT'),('EMAIL_CAPTURE'),('PARTNER_API')
  ON CONFLICT DO NOTHING;

INSERT INTO lk_verification_level (code, rank) VALUES
  ('BRONZE',1),('SILVER',2),('GOLD',3),('PLATINUM',4)
  ON CONFLICT DO NOTHING;

-- Document types — DERIVED from eligibility evidence (stage 01 task 2) + spec §13/§14.
-- Pending Founder confirmation against MASTER-SPEC §13–§14 (see PR note).
INSERT INTO lk_doc_type (code) VALUES
  ('ID_DOCUMENT'),('PROOF_OF_REGISTRATION'),('ACADEMIC_TRANSCRIPT'),('ACCEPTANCE_LETTER'),
  ('NSFAS_OUTCOME'),('NSFAS_PAUSE_EVIDENCE'),('INSTITUTION_DEBT_STATEMENT'),
  ('PROOF_OF_INCOME'),('MOTIVATION_LETTER'),('OTHER')
  ON CONFLICT DO NOTHING;

-- Consent purposes — DERIVED from POPIA consent model (spec §15.4). Founder-confirm.
INSERT INTO lk_consent_purpose (code) VALUES
  ('TERMS_OF_SERVICE'),('PRIVACY_POLICY'),('DATA_PROCESSING'),
  ('AI_MATCHING'),('MARKETING_EMAIL'),('MARKETING_SMS')
  ON CONFLICT DO NOTHING;

-- Notification triggers — sms_default true only for outcome-critical (BR-N02). DERIVED set.
INSERT INTO lk_notify_trigger (code, sms_default) VALUES
  ('APPLICATION_SUBMITTED', false),
  ('APPLICATION_STATUS_CHANGED', false),
  ('APPLICATION_RETURNED_FOR_INFO', false),
  ('INTERVIEW_SCHEDULED', true),
  ('DECISION_APPROVED', true),
  ('DECISION_REJECTED', true),
  ('TRACKED_DEADLINE_REMINDER', false),
  ('TRACKED_FOLLOW_UP', false),
  ('ACCOUNT_VERIFICATION', false)
  ON CONFLICT DO NOTHING;

-- Bursary statuses — must include 'OPEN' (external_bursary.status DEFAULT 'OPEN').
INSERT INTO lk_bursary_status (code) VALUES
  ('OPEN'),('CLOSING_SOON'),('CLOSED'),('EXPIRED')
  ON CONFLICT DO NOTHING;

-- Theme tags — exact starter set (stage 01 task 2; BR-E05).
INSERT INTO lk_theme_tag (code) VALUES
  ('FINANCIAL_GAP'),('FAMILY_CRISIS'),('HEALTH'),('DOCUMENTATION'),('INSTITUTIONAL'),('OTHER')
  ON CONFLICT DO NOTHING;

-- ---------- Application status transitions (BR-S04 v1.1 — exactly as schema.sql) ----------
INSERT INTO app_status_transition (from_status, to_status) VALUES
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
 ('UNDER_REVIEW','WITHDRAWN'),('INTERVIEW_SCHEDULED','WITHDRAWN'),('INTERVIEWED','WITHDRAWN')
 ON CONFLICT DO NOTHING;

-- ---------- Tracked status transitions (BR-T04) ----------
-- DERIVED from BR-T04 prose (schema.sql does not seed this table). Founder-confirm.
-- Chain: REGISTERED->SUBMITTED->UNDER_REVIEW->SHORTLISTED->INTERVIEW->{APPROVED,REJECTED};
-- NO_RESPONSE reachable from any active state; WITHDRAWN from any non-terminal state.
INSERT INTO tracked_status_transition (from_status, to_status) VALUES
 ('REGISTERED','SUBMITTED'),('SUBMITTED','UNDER_REVIEW'),('UNDER_REVIEW','SHORTLISTED'),
 ('SHORTLISTED','INTERVIEW'),('INTERVIEW','APPROVED'),('INTERVIEW','REJECTED'),
 ('REGISTERED','NO_RESPONSE'),('SUBMITTED','NO_RESPONSE'),('UNDER_REVIEW','NO_RESPONSE'),
 ('SHORTLISTED','NO_RESPONSE'),('INTERVIEW','NO_RESPONSE'),
 ('REGISTERED','WITHDRAWN'),('SUBMITTED','WITHDRAWN'),('UNDER_REVIEW','WITHDRAWN'),
 ('SHORTLISTED','WITHDRAWN'),('INTERVIEW','WITHDRAWN'),('NO_RESPONSE','WITHDRAWN')
 ON CONFLICT DO NOTHING;

-- ---------- Config (DB-D24, BR-F12 — no hardcoded business values) ----------
INSERT INTO config (key, value) VALUES
  ('monthly_allowance_zar','1000.00'),
  ('review_sla_days','14'),
  ('matching_daily_budget_zar','200.00')
  ON CONFLICT (key) DO NOTHING;

-- ---------- RBAC: roles (TAD §3.2 — all roles designed once, seeded as data) ----------
INSERT INTO role (id, code) VALUES
  ('rol_student','STUDENT'),
  ('rol_admin_reviewer','ADMIN_REVIEWER'),
  ('rol_admin_authorizer','ADMIN_AUTHORIZER'),
  ('rol_finance_admin','FINANCE_ADMIN'),
  ('rol_institution_officer','INSTITUTION_OFFICER'),
  ('rol_counsellor','COUNSELLOR'),
  ('rol_donor','DONOR'),
  ('rol_graduate','GRADUATE'),
  ('rol_system','SYSTEM')
  ON CONFLICT (code) DO NOTHING;

-- ---------- RBAC: permission catalog (resource_action — TAD §3.4) ----------
INSERT INTO permission (id, code) VALUES
  ('prm_profile_create','PROFILE_CREATE'),
  ('prm_profile_read_own','PROFILE_READ_OWN'),
  ('prm_profile_update_own','PROFILE_UPDATE_OWN'),
  ('prm_profile_read_any','PROFILE_READ_ANY'),
  ('prm_application_create','APPLICATION_CREATE'),
  ('prm_application_read_own','APPLICATION_READ_OWN'),
  ('prm_application_update_own','APPLICATION_UPDATE_OWN'),
  ('prm_application_read_any','APPLICATION_READ_ANY'),
  ('prm_application_review','APPLICATION_REVIEW'),
  ('prm_application_authorize','APPLICATION_AUTHORIZE'),
  ('prm_document_create','DOCUMENT_CREATE'),
  ('prm_document_read_own','DOCUMENT_READ_OWN'),
  ('prm_document_update_own','DOCUMENT_UPDATE_OWN'),
  ('prm_document_read_any','DOCUMENT_READ_ANY'),
  ('prm_document_verify','DOCUMENT_VERIFY'),
  ('prm_match_read_own','MATCH_READ_OWN'),
  ('prm_match_read_any','MATCH_READ_ANY'),
  ('prm_tracked_create','TRACKED_CREATE'),
  ('prm_tracked_read_own','TRACKED_READ_OWN'),
  ('prm_tracked_update_own','TRACKED_UPDATE_OWN'),
  ('prm_tracked_delete_own','TRACKED_DELETE_OWN'),
  ('prm_tracked_read_any','TRACKED_READ_ANY'),
  ('prm_counselling_manage','COUNSELLING_MANAGE'),
  ('prm_ledger_read','LEDGER_READ'),
  ('prm_ledger_append','LEDGER_APPEND'),
  ('prm_disbursement_propose','DISBURSEMENT_PROPOSE'),
  ('prm_disbursement_authorize','DISBURSEMENT_AUTHORIZE'),
  ('prm_disbursement_confirm','DISBURSEMENT_CONFIRM'),
  ('prm_allocation_read_own','ALLOCATION_READ_OWN'),
  ('prm_allocation_read_any','ALLOCATION_READ_ANY'),
  ('prm_allocation_manage','ALLOCATION_MANAGE'),
  ('prm_allocation_confirm','ALLOCATION_CONFIRM'),
  ('prm_institution_read','INSTITUTION_READ'),
  ('prm_institution_manage_own','INSTITUTION_MANAGE_OWN')
  ON CONFLICT (code) DO NOTHING;

-- ---------- RBAC: role -> permission grants (exactly per TAD §3.4 matrix) ----------
-- SYSTEM is intentionally granted NOTHING — the Human-Final Principle (BR-E03, MASTER-SPEC
-- §5.8) bars the non-human principal from approving/rejecting; reinforced by tg_human_final.
INSERT INTO role_permission (id, role_id, permission_id)
SELECT 'rp_' || r.code || '__' || p.code, r.id, p.id
FROM role r
JOIN permission p ON (r.code, p.code) IN (VALUES
  -- STUDENT
  ('STUDENT','PROFILE_CREATE'),('STUDENT','PROFILE_READ_OWN'),('STUDENT','PROFILE_UPDATE_OWN'),
  ('STUDENT','APPLICATION_CREATE'),('STUDENT','APPLICATION_READ_OWN'),('STUDENT','APPLICATION_UPDATE_OWN'),
  ('STUDENT','DOCUMENT_CREATE'),('STUDENT','DOCUMENT_READ_OWN'),('STUDENT','DOCUMENT_UPDATE_OWN'),
  ('STUDENT','MATCH_READ_OWN'),
  ('STUDENT','TRACKED_CREATE'),('STUDENT','TRACKED_READ_OWN'),('STUDENT','TRACKED_UPDATE_OWN'),('STUDENT','TRACKED_DELETE_OWN'),
  ('STUDENT','ALLOCATION_READ_OWN'),
  -- ADMIN_REVIEWER
  ('ADMIN_REVIEWER','PROFILE_READ_ANY'),('ADMIN_REVIEWER','APPLICATION_READ_ANY'),('ADMIN_REVIEWER','APPLICATION_REVIEW'),
  ('ADMIN_REVIEWER','DOCUMENT_READ_ANY'),('ADMIN_REVIEWER','DOCUMENT_VERIFY'),('ADMIN_REVIEWER','MATCH_READ_ANY'),
  ('ADMIN_REVIEWER','TRACKED_READ_ANY'),('ADMIN_REVIEWER','ALLOCATION_READ_ANY'),('ADMIN_REVIEWER','INSTITUTION_READ'),
  -- ADMIN_AUTHORIZER
  ('ADMIN_AUTHORIZER','PROFILE_READ_ANY'),('ADMIN_AUTHORIZER','APPLICATION_READ_ANY'),('ADMIN_AUTHORIZER','APPLICATION_AUTHORIZE'),
  ('ADMIN_AUTHORIZER','DOCUMENT_READ_ANY'),('ADMIN_AUTHORIZER','MATCH_READ_ANY'),('ADMIN_AUTHORIZER','TRACKED_READ_ANY'),
  ('ADMIN_AUTHORIZER','LEDGER_READ'),('ADMIN_AUTHORIZER','DISBURSEMENT_AUTHORIZE'),
  ('ADMIN_AUTHORIZER','ALLOCATION_READ_ANY'),('ADMIN_AUTHORIZER','INSTITUTION_READ'),
  -- FINANCE_ADMIN
  ('FINANCE_ADMIN','LEDGER_READ'),('FINANCE_ADMIN','LEDGER_APPEND'),('FINANCE_ADMIN','DISBURSEMENT_PROPOSE'),
  ('FINANCE_ADMIN','ALLOCATION_MANAGE'),('FINANCE_ADMIN','INSTITUTION_READ'),
  -- INSTITUTION_OFFICER
  ('INSTITUTION_OFFICER','ALLOCATION_READ_ANY'),('INSTITUTION_OFFICER','ALLOCATION_CONFIRM'),
  ('INSTITUTION_OFFICER','DISBURSEMENT_CONFIRM'),('INSTITUTION_OFFICER','INSTITUTION_MANAGE_OWN'),
  -- COUNSELLOR
  ('COUNSELLOR','COUNSELLING_MANAGE')
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------- Eligibility rulesets v1 (BR-E02 — rules drafted FROM MASTER-SPEC §5.7) ----------
INSERT INTO eligibility_ruleset (id, application_type, version, rules, effective_from, created_by) VALUES
 ('ers_postgrad_v1','POSTGRAD',1,
  '{"category":"POSTGRAD","required_documents":["ACCEPTANCE_LETTER"],"requires_motivation":false,
    "checks":[{"id":"acceptance_letter_present","type":"document_present","doc_type":"ACCEPTANCE_LETTER","severity":"required","label":"Acceptance letter present"}]}'::jsonb,
  now(),'SYSTEM'),
 ('ers_ug_cat_a_v1','UG_CAT_A',1,
  '{"category":"UG_CAT_A","required_documents":["NSFAS_PAUSE_EVIDENCE","ACADEMIC_TRANSCRIPT"],"requires_motivation":false,
    "checks":[{"id":"nsfas_pause_evidence_present","type":"document_present","doc_type":"NSFAS_PAUSE_EVIDENCE","severity":"required","label":"NSFAS pause evidence present"},{"id":"transcript_present","type":"document_present","doc_type":"ACADEMIC_TRANSCRIPT","severity":"required","label":"Academic transcript present"}]}'::jsonb,
  now(),'SYSTEM'),
 ('ers_ug_cat_b_v1','UG_CAT_B',1,
  '{"category":"UG_CAT_B","required_documents":["NSFAS_OUTCOME","INSTITUTION_DEBT_STATEMENT"],"requires_motivation":false,
    "checks":[{"id":"nsfas_approval_present","type":"document_present","doc_type":"NSFAS_OUTCOME","severity":"required","label":"NSFAS approval evidence present"},{"id":"debt_statement_present","type":"document_present","doc_type":"INSTITUTION_DEBT_STATEMENT","severity":"required","label":"Institution debt statement present"}]}'::jsonb,
  now(),'SYSTEM'),
 ('ers_ug_cat_c_v1','UG_CAT_C',1,
  '{"category":"UG_CAT_C","required_documents":["NSFAS_OUTCOME"],"requires_motivation":false,
    "checks":[{"id":"nsfas_outcome_present","type":"document_present","doc_type":"NSFAS_OUTCOME","severity":"required","label":"NSFAS outcome evidence present"}]}'::jsonb,
  now(),'SYSTEM'),
 ('ers_other_v1','OTHER',1,
  '{"category":"OTHER","required_documents":[],"requires_motivation":true,
    "checks":[{"id":"motivation_complete","type":"motivation_present","severity":"required","label":"Structured motivation complete"}]}'::jsonb,
  now(),'SYSTEM')
 ON CONFLICT (application_type, version) DO NOTHING;
