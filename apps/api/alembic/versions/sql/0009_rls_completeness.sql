-- ============================================================
-- 0009 — RLS completeness: every remaining student-data / sensitive table.
-- Extends 0007 so nothing sensitive is left unprotected. Auth tables (user,
-- refresh_token*) are intentionally NOT here — their access pattern depends on the
-- login flow and is a Stage 02 (C3) contract (see docs/database/README.md).
-- ============================================================

-- Ownership helper: does the current app user own this application? SECURITY INVOKER +
-- STABLE; the inner SELECT is itself RLS-aware (a student sees only their own
-- funding_application), so this is true exactly for the owner.
CREATE OR REPLACE FUNCTION app_owns_application(app_id text) RETURNS boolean LANGUAGE sql STABLE
  SET search_path = pg_catalog, public AS $$
    SELECT EXISTS (
      SELECT 1 FROM funding_application fa
      WHERE fa.id = app_id AND fa.student_profile_id = current_setting('app.user_id', true)
    )
  $$;
REVOKE EXECUTE ON FUNCTION app_owns_application(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_owns_application(text) TO fundslink_app, fundslink_readonly;

-- application_motivation — the OTHER-reasons narrative (sensitive); student writes own.
ALTER TABLE application_motivation ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_am_read   ON application_motivation FOR SELECT USING (app_is_staff() OR app_owns_application(application_id));
CREATE POLICY rls_am_insert ON application_motivation FOR INSERT WITH CHECK (app_is_staff() OR app_owns_application(application_id));
CREATE POLICY rls_am_update ON application_motivation FOR UPDATE
  USING (app_is_staff() OR app_owns_application(application_id)) WITH CHECK (app_is_staff() OR app_owns_application(application_id));

-- pre_screen_result — append-only; student reads own outcome; only staff/SYSTEM write.
ALTER TABLE pre_screen_result ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_psr_read   ON pre_screen_result FOR SELECT USING (app_is_staff() OR app_owns_application(application_id));
CREATE POLICY rls_psr_insert ON pre_screen_result FOR INSERT WITH CHECK (app_is_staff());

-- application_return — student reads own fix-list; staff create; owner/staff resolve.
ALTER TABLE application_return ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_ar_read   ON application_return FOR SELECT USING (app_is_staff() OR app_owns_application(application_id));
CREATE POLICY rls_ar_insert ON application_return FOR INSERT WITH CHECK (app_is_staff());
CREATE POLICY rls_ar_update ON application_return FOR UPDATE
  USING (app_is_staff() OR app_owns_application(application_id)) WITH CHECK (app_is_staff() OR app_owns_application(application_id));

-- appeal — student files own; only the reviewer decides (UPDATE staff-only).
ALTER TABLE appeal ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_ap_read   ON appeal FOR SELECT USING (app_is_staff() OR app_owns_application(application_id));
CREATE POLICY rls_ap_insert ON appeal FOR INSERT WITH CHECK (app_is_staff() OR app_owns_application(application_id));
CREATE POLICY rls_ap_update ON appeal FOR UPDATE USING (app_is_staff()) WITH CHECK (app_is_staff());

-- motivation_theme_tag — reviewer-only metadata.
ALTER TABLE motivation_theme_tag ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_mtt_read   ON motivation_theme_tag FOR SELECT USING (app_is_staff());
CREATE POLICY rls_mtt_insert ON motivation_theme_tag FOR INSERT WITH CHECK (app_is_staff());

-- recusal — append-only; reviewer-only metadata.
ALTER TABLE recusal ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_rec_read   ON recusal FOR SELECT USING (app_is_staff());
CREATE POLICY rls_rec_insert ON recusal FOR INSERT WITH CHECK (app_is_staff());

-- audit_log — append-only; own/staff read; audit writes are never blocked.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_al_read   ON audit_log FOR SELECT USING (app_is_staff() OR actor_user_id = app_uid());
CREATE POLICY rls_al_insert ON audit_log FOR INSERT WITH CHECK (true);
