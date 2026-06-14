-- Downgrade for migration 0006 — restore prior grant state and remove the read-only role.
ALTER ROLE fundslink_app RESET statement_timeout;
ALTER ROLE fundslink_app RESET idle_in_transaction_session_timeout;
ALTER ROLE fundslink_app RESET lock_timeout;
ALTER ROLE fundslink_app CONNECTION LIMIT -1;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO PUBLIC;
GRANT USAGE ON SCHEMA public TO PUBLIC;
DO $$ BEGIN
  EXECUTE format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO PUBLIC', current_database());
  -- Revoke the explicit DB grant 0006 gave the app (PUBLIC now covers CONNECT again) so
  -- migration 0005's DROP ROLE has no lingering database-level dependency.
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM fundslink_app', current_database());
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'fundslink_readonly') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM fundslink_readonly';
    EXECUTE format('REVOKE ALL ON DATABASE %I FROM fundslink_readonly', current_database());
    EXECUTE 'DROP OWNED BY fundslink_readonly';
    EXECUTE 'DROP ROLE fundslink_readonly';
  END IF;
END $$;
