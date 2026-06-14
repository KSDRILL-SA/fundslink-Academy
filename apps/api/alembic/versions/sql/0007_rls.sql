-- ============================================================
-- 0007 — Row-Level Security (right row, right person, right role). Founder-directed L4.
-- The database enforces ownership/role at the row level, fail-closed, even if the backend
-- has a bug or an injection slips past the ORM. The app role is NOBYPASSRLS (0005); the
-- owner (migrations only) bypasses. Backend contract per request:
--     SET LOCAL app.user_id   = '<authenticated user cuid>';
--     SET LOCAL app.user_role = '<effective role>';
-- No GUC set => the helpers return NULL => no rows match => deny (fail-closed).
-- ============================================================

-- ---------- Session-context helpers (STABLE, SECURITY INVOKER, pinned search_path) ----------
CREATE OR REPLACE FUNCTION app_uid() RETURNS text LANGUAGE sql STABLE
  SET search_path = pg_catalog AS $$ SELECT current_setting('app.user_id', true) $$;
CREATE OR REPLACE FUNCTION app_role() RETURNS text LANGUAGE sql STABLE
  SET search_path = pg_catalog AS $$ SELECT current_setting('app.user_role', true) $$;
CREATE OR REPLACE FUNCTION app_is_staff() RETURNS boolean LANGUAGE sql STABLE
  SET search_path = pg_catalog AS $$
    SELECT coalesce(current_setting('app.user_role', true), '')
           IN ('ADMIN_REVIEWER','ADMIN_AUTHORIZER','FINANCE_ADMIN','SYSTEM') $$;

REVOKE EXECUTE ON FUNCTION app_uid(), app_role(), app_is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_uid(), app_role(), app_is_staff() TO fundslink_app, fundslink_readonly;

-- ---------- student_profile (own row = id) ----------
ALTER TABLE student_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_sp_read   ON student_profile FOR SELECT USING (id = app_uid() OR app_is_staff());
CREATE POLICY rls_sp_insert ON student_profile FOR INSERT WITH CHECK (id = app_uid() OR app_is_staff());
CREATE POLICY rls_sp_update ON student_profile FOR UPDATE
  USING (id = app_uid() OR app_is_staff()) WITH CHECK (id = app_uid() OR app_is_staff());

-- ---------- funding_application (own via student_profile_id) ----------
ALTER TABLE funding_application ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_fa_read   ON funding_application FOR SELECT USING (student_profile_id = app_uid() OR app_is_staff());
CREATE POLICY rls_fa_insert ON funding_application FOR INSERT WITH CHECK (student_profile_id = app_uid() OR app_is_staff());
CREATE POLICY rls_fa_update ON funding_application FOR UPDATE
  USING (student_profile_id = app_uid() OR app_is_staff()) WITH CHECK (student_profile_id = app_uid() OR app_is_staff());

-- ---------- document (own via student_profile_id) ----------
ALTER TABLE document ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_doc_read   ON document FOR SELECT USING (student_profile_id = app_uid() OR app_is_staff());
CREATE POLICY rls_doc_insert ON document FOR INSERT WITH CHECK (student_profile_id = app_uid() OR app_is_staff());
CREATE POLICY rls_doc_update ON document FOR UPDATE
  USING (student_profile_id = app_uid() OR app_is_staff()) WITH CHECK (student_profile_id = app_uid() OR app_is_staff());

-- ---------- tracked_application (own via student_profile_id) ----------
ALTER TABLE tracked_application ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_ta_read   ON tracked_application FOR SELECT USING (student_profile_id = app_uid() OR app_is_staff());
CREATE POLICY rls_ta_insert ON tracked_application FOR INSERT WITH CHECK (student_profile_id = app_uid() OR app_is_staff());
CREATE POLICY rls_ta_update ON tracked_application FOR UPDATE
  USING (student_profile_id = app_uid() OR app_is_staff()) WITH CHECK (student_profile_id = app_uid() OR app_is_staff());

-- ---------- match_result (student READS own; only staff/SYSTEM write) ----------
ALTER TABLE match_result ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_mr_read   ON match_result FOR SELECT USING (student_profile_id = app_uid() OR app_is_staff());
CREATE POLICY rls_mr_insert ON match_result FOR INSERT WITH CHECK (app_is_staff());

-- ---------- consent_record (append-only; own via user_id) ----------
ALTER TABLE consent_record ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_cr_read   ON consent_record FOR SELECT USING (user_id = app_uid() OR app_is_staff());
CREATE POLICY rls_cr_insert ON consent_record FOR INSERT WITH CHECK (user_id = app_uid() OR app_is_staff());

-- ---------- notification_preference (own via user_id) ----------
ALTER TABLE notification_preference ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_np_read   ON notification_preference FOR SELECT USING (user_id = app_uid() OR app_is_staff());
CREATE POLICY rls_np_insert ON notification_preference FOR INSERT WITH CHECK (user_id = app_uid() OR app_is_staff());
CREATE POLICY rls_np_update ON notification_preference FOR UPDATE
  USING (user_id = app_uid() OR app_is_staff()) WITH CHECK (user_id = app_uid() OR app_is_staff());

-- ---------- notification_outbox (student READS own; only staff/SYSTEM write) ----------
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_no_read   ON notification_outbox FOR SELECT USING (user_id = app_uid() OR app_is_staff());
CREATE POLICY rls_no_insert ON notification_outbox FOR INSERT WITH CHECK (app_is_staff());
CREATE POLICY rls_no_update ON notification_outbox FOR UPDATE USING (app_is_staff()) WITH CHECK (app_is_staff());
