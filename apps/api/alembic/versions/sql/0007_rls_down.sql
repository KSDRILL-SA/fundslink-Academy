-- Downgrade for migration 0007 — drop policies, disable RLS, remove helpers.
DROP POLICY IF EXISTS rls_no_update ON notification_outbox;
DROP POLICY IF EXISTS rls_no_insert ON notification_outbox;
DROP POLICY IF EXISTS rls_no_read   ON notification_outbox;
ALTER TABLE notification_outbox DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_np_update ON notification_preference;
DROP POLICY IF EXISTS rls_np_insert ON notification_preference;
DROP POLICY IF EXISTS rls_np_read   ON notification_preference;
ALTER TABLE notification_preference DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_cr_insert ON consent_record;
DROP POLICY IF EXISTS rls_cr_read   ON consent_record;
ALTER TABLE consent_record DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_mr_insert ON match_result;
DROP POLICY IF EXISTS rls_mr_read   ON match_result;
ALTER TABLE match_result DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_ta_update ON tracked_application;
DROP POLICY IF EXISTS rls_ta_insert ON tracked_application;
DROP POLICY IF EXISTS rls_ta_read   ON tracked_application;
ALTER TABLE tracked_application DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_doc_update ON document;
DROP POLICY IF EXISTS rls_doc_insert ON document;
DROP POLICY IF EXISTS rls_doc_read   ON document;
ALTER TABLE document DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_fa_update ON funding_application;
DROP POLICY IF EXISTS rls_fa_insert ON funding_application;
DROP POLICY IF EXISTS rls_fa_read   ON funding_application;
ALTER TABLE funding_application DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_sp_update ON student_profile;
DROP POLICY IF EXISTS rls_sp_insert ON student_profile;
DROP POLICY IF EXISTS rls_sp_read   ON student_profile;
ALTER TABLE student_profile DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS app_is_staff();
DROP FUNCTION IF EXISTS app_role();
DROP FUNCTION IF EXISTS app_uid();
