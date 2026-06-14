-- ============================================================
-- 0005 — Security: least-privilege application role + function hardening
-- Founder-approved L4, 2026-06-14. Closes the proven append-only tamper gap (DB-D30).
-- ============================================================

-- ---------- Pin search_path on the trigger functions (anti-hijack hardening) ----------
CREATE OR REPLACE FUNCTION fn_block_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'append-only table: % forbidden on %', TG_OP, TG_TABLE_NAME; END;
$$ LANGUAGE plpgsql SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION fn_touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION fn_human_final() RETURNS trigger AS $$
BEGIN
  IF NEW.to_status IN ('APPROVED','REJECTED','REJECTED_FINAL')
     AND (NEW.actor_user_id IS NULL OR NEW.actor_user_id = 'SYSTEM') THEN
    RAISE EXCEPTION 'HUMAN_FINAL_PRINCIPLE: % requires a human actor (MASTER-SPEC §5.8)', NEW.to_status;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SET search_path = pg_catalog, public;

-- ---------- Least-privilege application role (DB-D30, Spec §16.2) ----------
-- Created NOLOGIN here so NO secret enters the migration. Production provisioning grants
-- login + a password from the environment, out of band (see the Stage 06 ops checklist):
--     ALTER ROLE fundslink_app LOGIN PASSWORD :'app_pw';   -- value from a secret manager
-- The app connects as this role and is structurally incapable of disabling a trigger,
-- rewriting an append-only row, or running DDL — defense-in-depth behind the triggers.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fundslink_app') THEN
    CREATE ROLE fundslink_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO fundslink_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO fundslink_app;

-- Append-only tables: INSERT + SELECT only. UPDATE/DELETE revoked as the privilege wall
-- behind fn_block_mutation (a compromised app credential cannot rewrite history).
REVOKE UPDATE, DELETE ON
  application_status_event, tracked_status_event, audit_log, consent_record,
  config_history, pre_screen_result, recusal
  FROM fundslink_app;

-- Tables created by later stages (02+) auto-inherit CRUD; any NEW append-only table must
-- REVOKE UPDATE/DELETE in its own migration (tracked in the Stage 06 ops checklist).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO fundslink_app;
