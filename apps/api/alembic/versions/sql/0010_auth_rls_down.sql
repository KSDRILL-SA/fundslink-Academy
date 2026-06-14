-- Downgrade for migration 0010 — drop auth-table RLS, helper, and the SYSTEM principal.
DROP POLICY IF EXISTS rls_rt_update  ON refresh_token;
DROP POLICY IF EXISTS rls_rt_insert  ON refresh_token;
DROP POLICY IF EXISTS rls_rt_read    ON refresh_token;
ALTER TABLE refresh_token DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_rtf_update ON refresh_token_family;
DROP POLICY IF EXISTS rls_rtf_insert ON refresh_token_family;
DROP POLICY IF EXISTS rls_rtf_read   ON refresh_token_family;
ALTER TABLE refresh_token_family DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_user_update ON "user";
DROP POLICY IF EXISTS rls_user_insert ON "user";
DROP POLICY IF EXISTS rls_user_read   ON "user";
ALTER TABLE "user" DISABLE ROW LEVEL SECURITY;

DELETE FROM user_role WHERE id = 'ur_system';
DELETE FROM "user" WHERE id = 'SYSTEM';

DROP FUNCTION IF EXISTS app_owns_family(text);
