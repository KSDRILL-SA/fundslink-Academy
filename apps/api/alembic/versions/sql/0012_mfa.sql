-- ============================================================
-- 0012 — MFA (TOTP) state on user. Stage 02, C3 (MFA mandatory for privileged roles, TAD §3.1).
-- mfa_secret_enc already exists (0001); add the activation flag and encrypted recovery codes.
-- Secrets are AES-256-GCM encrypted app-side (TAD §4.4) before they reach these columns.
-- Additive (DB-D36); fundslink_app already holds UPDATE on "user"; RLS lets a user update
-- their own row (0010), so enrolment/activation works under the user's own context.
-- ============================================================
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS mfa_recovery_enc text;
