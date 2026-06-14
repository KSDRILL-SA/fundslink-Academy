-- Downgrade for migration 0011.
ALTER TABLE "user" DROP COLUMN IF EXISTS token_version;
