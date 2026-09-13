-- ============================================================
-- 0021 — Close the two holes in the RLS wall (#292).
--
-- 1. PARTITIONS. PostgreSQL applies row-level security to the relation NAMED in the query.
--    A partition named directly (audit_log_202609) is its own table: RLS off, no policies,
--    and 0005's GRANT … ON ALL TABLES reached it. Proven: a student context read 0 audit rows
--    through audit_log and 7033 through audit_log_202609. Queries through the parent check
--    privileges on the parent only, so the app never needs a privilege on a partition.
--    Every partition is therefore SEALED: all privileges revoked from the app roles, and RLS
--    enabled with no policy (deny) as a second wall should a future grant reach it.
--    Default privileges (0005) re-grant on every partition the maintenance job creates, so
--    fn_seal_partitions() is the ONE definition of "sealed"; the job calls it on every run
--    and the integrity job (DB-D39) fails if any partition is reachable.
--
-- 2. THREE TABLES WITHOUT RLS. 0009 set out to cover "every remaining student-data /
--    sensitive table" and missed both status-event logs (reviewer notes live in
--    application_status_event); 0010 covered the identity tables and missed user_role.
--
-- Write paths these policies must admit (proven by the API suite):
--   application_status_event — the student's own submit / withdraw / resubmit / appeal
--     (actor = themselves); every staff and SYSTEM transition (app_is_staff()).
--   tracked_status_event — the student's own tracker updates (actor = themselves);
--     SYSTEM jobs (silence nudges).
--   user_role — registration assigns STUDENT under SYSTEM context (D-015); login / refresh
--     read roles under SYSTEM. An authenticated user reads only their own.
-- Additive (DB-D36).
-- ============================================================

-- ---------- 1. Sealing partitions ----------
-- SECURITY INVOKER: it only works for the owner (REVOKE / ALTER TABLE need ownership), which
-- is who runs migrations and the maintenance job. The app roles cannot execute it.
CREATE OR REPLACE FUNCTION fn_seal_partitions() RETURNS integer LANGUAGE plpgsql
  SET search_path = pg_catalog, public AS $$
DECLARE
  part regclass;
  sealed integer := 0;
BEGIN
  FOR part IN
    SELECT c.oid::regclass
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relispartition AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, fundslink_app, fundslink_readonly', part);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', part);
    sealed := sealed + 1;
  END LOOP;
  RETURN sealed;
END $$;
REVOKE EXECUTE ON FUNCTION fn_seal_partitions() FROM PUBLIC;

SELECT fn_seal_partitions();

-- ---------- 2a. application_status_event — the application's history, reviewer notes ----------
ALTER TABLE application_status_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_ase_read   ON application_status_event FOR SELECT
  USING (app_is_staff() OR app_owns_application(application_id));
-- A student records only their OWN actions on their OWN application. The state machine still
-- decides which transitions are legal; this decides whose they may be.
CREATE POLICY rls_ase_insert ON application_status_event FOR INSERT
  WITH CHECK (app_is_staff() OR (app_owns_application(application_id) AND actor_user_id = app_uid()));

-- ---------- 2b. tracked_status_event — a student's external bursary tracker ----------
-- Ownership helper, mirroring app_owns_application (0009): SECURITY INVOKER + STABLE, and the
-- inner SELECT is itself RLS-aware. Soft-deleted trackers still belong to their owner.
CREATE OR REPLACE FUNCTION app_owns_tracked(tracked_id text) RETURNS boolean LANGUAGE sql STABLE
  SET search_path = pg_catalog, public AS $$
    SELECT EXISTS (
      SELECT 1 FROM tracked_application ta
      WHERE ta.id = tracked_id AND ta.student_profile_id = current_setting('app.user_id', true)
    )
  $$;
REVOKE EXECUTE ON FUNCTION app_owns_tracked(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_owns_tracked(text) TO fundslink_app, fundslink_readonly;

ALTER TABLE tracked_status_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tse_read   ON tracked_status_event FOR SELECT
  USING (app_is_staff() OR app_owns_tracked(tracked_application_id));
CREATE POLICY rls_tse_insert ON tracked_status_event FOR INSERT
  WITH CHECK (app_is_staff() OR (app_owns_tracked(tracked_application_id) AND actor_user_id = app_uid()));

-- ---------- 2c. user_role — who holds which role (who is an admin) ----------
-- No UPDATE policy: nothing in the app updates a role assignment, so none is admitted.
ALTER TABLE user_role ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_ur_read   ON user_role FOR SELECT USING (user_id = app_uid() OR app_is_staff());
CREATE POLICY rls_ur_insert ON user_role FOR INSERT WITH CHECK (app_is_staff());
