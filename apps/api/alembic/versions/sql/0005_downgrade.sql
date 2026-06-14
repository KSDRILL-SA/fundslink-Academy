-- Downgrade for migration 0005 — remove the app role and unpin search_path.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'fundslink_app') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public '
            'REVOKE SELECT, INSERT, UPDATE ON TABLES FROM fundslink_app';
    EXECUTE 'DROP OWNED BY fundslink_app';   -- removes all grants to / objects owned by the role
    EXECUTE 'DROP ROLE fundslink_app';
  END IF;
END $$;

-- Restore the trigger functions without the pinned search_path (functionally identical).
CREATE OR REPLACE FUNCTION fn_block_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'append-only table: % forbidden on %', TG_OP, TG_TABLE_NAME; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_human_final() RETURNS trigger AS $$
BEGIN
  IF NEW.to_status IN ('APPROVED','REJECTED','REJECTED_FINAL')
     AND (NEW.actor_user_id IS NULL OR NEW.actor_user_id = 'SYSTEM') THEN
    RAISE EXCEPTION 'HUMAN_FINAL_PRINCIPLE: % requires a human actor (MASTER-SPEC §5.8)', NEW.to_status;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
