-- Downgrade for migration 0012.
ALTER TABLE "user" DROP COLUMN IF EXISTS mfa_recovery_enc;
ALTER TABLE "user" DROP COLUMN IF EXISTS mfa_enabled;
