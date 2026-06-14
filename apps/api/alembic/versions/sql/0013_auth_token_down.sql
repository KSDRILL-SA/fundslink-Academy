-- Downgrade for migration 0013.
DROP POLICY IF EXISTS rls_at_update ON auth_token;
DROP POLICY IF EXISTS rls_at_insert ON auth_token;
DROP POLICY IF EXISTS rls_at_read   ON auth_token;
DROP TABLE IF EXISTS auth_token;
