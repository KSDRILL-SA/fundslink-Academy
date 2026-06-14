-- ============================================================
-- 0014 — Least-privilege tightening: fundslink_app is SELECT-only on reference + RBAC-matrix
-- tables. Stage 02 auth↔DB integration hardening.
-- These tables are seed/migration-managed data the app only READS — lookups (FK validation),
-- the role/permission matrix (RBAC lookup, S3.21), and consent purposes. Removing the app's
-- write access means a compromised app role CANNOT escalate (e.g. INSERT into role_permission to
-- grant itself a permission) or tamper with reference data. The owner (migrations) still writes
-- them; user_role keeps INSERT (the app assigns a STUDENT role at registration). Additive (DB-D36).
-- ============================================================
REVOKE INSERT, UPDATE ON
  role, permission, role_permission,
  lk_account_state, lk_app_status, lk_application_type, lk_bursary_status,
  lk_consent_purpose, lk_doc_type, lk_notify_trigger, lk_priority,
  lk_status_source, lk_theme_tag, lk_tracked_status, lk_verification_level
FROM fundslink_app;
