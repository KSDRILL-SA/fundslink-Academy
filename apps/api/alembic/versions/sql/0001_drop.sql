-- Downgrade for migration 0001 — full, deterministic teardown (DB-D36 downgrade path).
-- CASCADE drops partitions, indexes, triggers and FK dependencies; order-independent.
-- alembic_version lives in public but is NOT listed here, so Alembic's bookkeeping survives.
DROP TABLE IF EXISTS
  recusal, appeal, motivation_theme_tag, application_motivation, application_return,
  pre_screen_result, eligibility_ruleset,
  config_history, config, notification_preference, notification_outbox, audit_log,
  match_result, tracked_status_event, tracked_application, bursary_deadline, external_bursary,
  document, application_status_event, funding_application,
  refresh_token, refresh_token_family, consent_record, student_profile,
  user_role, role_permission, permission, role, "user",
  app_status_transition, tracked_status_transition,
  lk_theme_tag, lk_bursary_status, lk_notify_trigger, lk_consent_purpose, lk_doc_type,
  lk_verification_level, lk_status_source, lk_tracked_status, lk_app_status,
  lk_application_type, lk_account_state
  CASCADE;

DROP FUNCTION IF EXISTS fn_human_final() CASCADE;
DROP FUNCTION IF EXISTS fn_block_mutation() CASCADE;
DROP FUNCTION IF EXISTS fn_touch_updated_at() CASCADE;
