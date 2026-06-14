-- ============================================================
-- 0006 — Privilege lockdown (defense-in-depth). Founder-directed L4 security pass.
-- Deny-by-default: strip ambient PUBLIC grants, fence the app role with resource
-- guardrails, and add a dedicated read-only role for analytics/BI.
-- ============================================================

-- ---------- Strip ambient PUBLIC privileges ----------
DO $$ BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO fundslink_app', current_database());
END $$;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO fundslink_app;        -- USAGE only — never CREATE for the app
REVOKE CREATE ON SCHEMA public FROM fundslink_app;    -- explicit: app cannot create objects
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;  -- triggers still fire; direct calls denied

-- ---------- Resource guardrails on the application role (bound DoS / runaway / exfiltration) ----------
ALTER ROLE fundslink_app SET statement_timeout = '30s';
ALTER ROLE fundslink_app SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE fundslink_app SET lock_timeout = '10s';
ALTER ROLE fundslink_app CONNECTION LIMIT 100;

-- ---------- Dedicated read-only role (analytics / BI / support — never writes) ----------
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fundslink_readonly') THEN
    CREATE ROLE fundslink_readonly NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO fundslink_readonly', current_database());
END $$;
GRANT USAGE ON SCHEMA public TO fundslink_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO fundslink_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO fundslink_readonly;
ALTER ROLE fundslink_readonly SET statement_timeout = '60s';
ALTER ROLE fundslink_readonly SET idle_in_transaction_session_timeout = '60s';
