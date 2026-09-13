-- Downgrade for migration 0021. Restores the 0020 state exactly — including the holes, because
-- a downgrade that silently keeps a policy is not a downgrade.

DROP POLICY IF EXISTS rls_ur_insert ON user_role;
DROP POLICY IF EXISTS rls_ur_read   ON user_role;
ALTER TABLE user_role DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_tse_insert ON tracked_status_event;
DROP POLICY IF EXISTS rls_tse_read   ON tracked_status_event;
ALTER TABLE tracked_status_event DISABLE ROW LEVEL SECURITY;
DROP FUNCTION IF EXISTS app_owns_tracked(text);

DROP POLICY IF EXISTS rls_ase_insert ON application_status_event;
DROP POLICY IF EXISTS rls_ase_read   ON application_status_event;
ALTER TABLE application_status_event DISABLE ROW LEVEL SECURITY;

-- Unseal: partitions get back what 0005's GRANT … ON ALL TABLES and its default privileges gave
-- them, and 0006 gave the read-only role (append-only UPDATE was only ever revoked on parents).
DO $$
DECLARE part regclass;
BEGIN
  FOR part IN
    SELECT c.oid::regclass
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relispartition AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE %s DISABLE ROW LEVEL SECURITY', part);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %s TO fundslink_app', part);
    EXECUTE format('GRANT SELECT ON TABLE %s TO fundslink_readonly', part);
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS fn_seal_partitions();
