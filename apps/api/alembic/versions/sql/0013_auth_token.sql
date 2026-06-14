-- ============================================================
-- 0013 — auth_token: short-lived single-use tokens for email verification (S3.12) and
-- password reset (S3.30). Stage 02, C3. Only the SHA-256 hash is stored (never the raw token,
-- like refresh tokens). RLS mirrors the 0010 auth pattern: the issuing/redeeming flows run
-- under SYSTEM context (verify/reset are unauthenticated — D-015), an authenticated user sees
-- only their own. Mutable (used_at is stamped on redemption), so not append-only.
-- ============================================================
CREATE TABLE auth_token (
    id          text PRIMARY KEY,
    user_id     text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    kind        text NOT NULL CHECK (kind IN ('EMAIL_VERIFY', 'PASSWORD_RESET')),
    token_hash  text NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_auth_token_user ON auth_token (user_id);

-- Least privilege: the app reads, inserts, and stamps used_at — never deletes.
GRANT SELECT, INSERT, UPDATE ON auth_token TO fundslink_app;
GRANT SELECT ON auth_token TO fundslink_readonly;

ALTER TABLE auth_token ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_at_read   ON auth_token FOR SELECT USING (user_id = app_uid() OR app_is_staff());
CREATE POLICY rls_at_insert ON auth_token FOR INSERT WITH CHECK (user_id = app_uid() OR app_is_staff());
CREATE POLICY rls_at_update ON auth_token FOR UPDATE
  USING (user_id = app_uid() OR app_is_staff()) WITH CHECK (user_id = app_uid() OR app_is_staff());
