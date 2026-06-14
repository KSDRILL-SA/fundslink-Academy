-- Downgrade for migration 0009.
DROP POLICY IF EXISTS rls_al_insert ON audit_log;
DROP POLICY IF EXISTS rls_al_read   ON audit_log;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_rec_insert ON recusal;
DROP POLICY IF EXISTS rls_rec_read   ON recusal;
ALTER TABLE recusal DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_mtt_insert ON motivation_theme_tag;
DROP POLICY IF EXISTS rls_mtt_read   ON motivation_theme_tag;
ALTER TABLE motivation_theme_tag DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_ap_update ON appeal;
DROP POLICY IF EXISTS rls_ap_insert ON appeal;
DROP POLICY IF EXISTS rls_ap_read   ON appeal;
ALTER TABLE appeal DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_ar_update ON application_return;
DROP POLICY IF EXISTS rls_ar_insert ON application_return;
DROP POLICY IF EXISTS rls_ar_read   ON application_return;
ALTER TABLE application_return DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_psr_insert ON pre_screen_result;
DROP POLICY IF EXISTS rls_psr_read   ON pre_screen_result;
ALTER TABLE pre_screen_result DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_am_update ON application_motivation;
DROP POLICY IF EXISTS rls_am_insert ON application_motivation;
DROP POLICY IF EXISTS rls_am_read   ON application_motivation;
ALTER TABLE application_motivation DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS app_owns_application(text);
