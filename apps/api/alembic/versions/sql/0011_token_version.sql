-- ============================================================
-- 0011 — token_version (session epoch) on user. Stage 02, C3.
-- The access-token 'version' claim (S3.13) is stamped from this column and re-checked on
-- every request (get_current_user). Bumping it invalidates EVERY outstanding access token for
-- the user instantly and DB-authoritatively — the defence-in-depth backstop to the Redis
-- deny-list for password change / forced global logout (S3.35). Default 1; additive (DB-D36).
-- fundslink_app already holds UPDATE on "user"; RLS lets a user bump their own row and staff
-- bump any (0010), so no grant/policy change is required.
-- ============================================================
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 1;
