-- Downgrade for migration 0014 — restore the prior (broader) grants.
GRANT INSERT, UPDATE ON
  role, permission, role_permission,
  lk_account_state, lk_app_status, lk_application_type, lk_bursary_status,
  lk_consent_purpose, lk_doc_type, lk_notify_trigger, lk_priority,
  lk_status_source, lk_theme_tag, lk_tracked_status, lk_verification_level
TO fundslink_app;
