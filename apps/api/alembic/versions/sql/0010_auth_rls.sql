-- ============================================================
-- 0010 — Auth-table Row-Level Security + SYSTEM principal (Stage 02, C3).
-- Completes the RLS wall on the identity tables that 0007/0009 deferred to the
-- login-flow contract (decision D-015). At login / refresh / registration there is no
-- authenticated user_id yet, so the auth service runs those lookups under SYSTEM context
--     SET LOCAL app.user_role = 'SYSTEM';   -- (no app.user_id)
-- which app_is_staff() admits — SYSTEM is the authentication authority. Once a request is
-- authenticated it carries the real app.user_id and a user sees ONLY their own identity
-- rows. No context => helpers return NULL => no rows => deny (fail-closed), exactly as 0007.
-- The owner (migrations only) bypasses RLS; fundslink_app is NOBYPASSRLS (0005) and subject.
-- ============================================================

-- ---------- Ownership helper: does the current app user own this token family? ----------
-- SECURITY INVOKER + STABLE; mirrors app_owns_application (0009). The login/refresh path
-- runs under SYSTEM (app_is_staff()), so it never depends on this — this gates the
-- AUTHENTICATED user to their own families only.
CREATE OR REPLACE FUNCTION app_owns_family(fam_id text) RETURNS boolean LANGUAGE sql STABLE
  SET search_path = pg_catalog, public AS $$
    SELECT EXISTS (
      SELECT 1 FROM refresh_token_family f
      WHERE f.id = fam_id AND f.user_id = current_setting('app.user_id', true)
    )
  $$;
REVOKE EXECUTE ON FUNCTION app_owns_family(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_owns_family(text) TO fundslink_app, fundslink_readonly;

-- ---------- SYSTEM principal (TAD §3.2) — fn_human_final keys on the literal 'SYSTEM' ----------
-- Non-human job principal assumed by background jobs (reconciliation, nudges). It NEVER
-- authenticates via /auth/login: password_hash is a locked sentinel that no bcrypt verify
-- can match, and the auth service refuses id='SYSTEM' explicitly. Seeded as the owner, so
-- RLS does not apply to this INSERT.
INSERT INTO "user" (id, email, password_hash, account_state, created_by)
VALUES ('SYSTEM', 'system@fundslink.internal', '!SYSTEM-NO-LOGIN', 'ACTIVE', 'SYSTEM')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_role (id, user_id, role_id)
SELECT 'ur_system', 'SYSTEM', r.id FROM role r WHERE r.code = 'SYSTEM'
ON CONFLICT DO NOTHING;

-- ---------- user (own row = id; SYSTEM/staff context sees all for the login path) ----------
-- INSERT is staff/SYSTEM-only: registration runs under SYSTEM context (no user_id yet),
-- so a student can never mint a user row. UPDATE allows self (password change, MFA enrol,
-- self-service account close) or staff/SYSTEM (admin state transitions, lockout).
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_user_read   ON "user" FOR SELECT USING (id = app_uid() OR app_is_staff());
CREATE POLICY rls_user_insert ON "user" FOR INSERT WITH CHECK (app_is_staff());
CREATE POLICY rls_user_update ON "user" FOR UPDATE
  USING (id = app_uid() OR app_is_staff()) WITH CHECK (id = app_uid() OR app_is_staff());

-- ---------- refresh_token_family (own via user_id; login/refresh under SYSTEM) ----------
ALTER TABLE refresh_token_family ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_rtf_read   ON refresh_token_family FOR SELECT USING (user_id = app_uid() OR app_is_staff());
CREATE POLICY rls_rtf_insert ON refresh_token_family FOR INSERT WITH CHECK (user_id = app_uid() OR app_is_staff());
CREATE POLICY rls_rtf_update ON refresh_token_family FOR UPDATE
  USING (user_id = app_uid() OR app_is_staff()) WITH CHECK (user_id = app_uid() OR app_is_staff());

-- ---------- refresh_token (own via family.user_id; login/refresh under SYSTEM) ----------
ALTER TABLE refresh_token ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_rt_read   ON refresh_token FOR SELECT USING (app_is_staff() OR app_owns_family(family_id));
CREATE POLICY rls_rt_insert ON refresh_token FOR INSERT WITH CHECK (app_is_staff() OR app_owns_family(family_id));
CREATE POLICY rls_rt_update ON refresh_token FOR UPDATE
  USING (app_is_staff() OR app_owns_family(family_id)) WITH CHECK (app_is_staff() OR app_owns_family(family_id));
