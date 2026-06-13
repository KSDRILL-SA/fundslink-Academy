-- Downgrade for migration 0002 — remove seeded reference data (FK-safe order).
DELETE FROM role_permission;
DELETE FROM permission;
DELETE FROM role;
DELETE FROM eligibility_ruleset;
DELETE FROM app_status_transition;
DELETE FROM tracked_status_transition;
DELETE FROM config WHERE key IN ('monthly_allowance_zar','review_sla_days','matching_daily_budget_zar');
DELETE FROM lk_theme_tag;
DELETE FROM lk_bursary_status;
DELETE FROM lk_notify_trigger;
DELETE FROM lk_consent_purpose;
DELETE FROM lk_doc_type;
DELETE FROM lk_verification_level;
DELETE FROM lk_status_source;
DELETE FROM lk_tracked_status;
DELETE FROM lk_app_status;
DELETE FROM lk_application_type;
DELETE FROM lk_account_state;
