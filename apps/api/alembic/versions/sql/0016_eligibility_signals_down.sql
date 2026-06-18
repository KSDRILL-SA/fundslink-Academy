-- Downgrade 0016 — drop the eligibility-signal columns, then the lookups (reverse FK order).
-- Grants on the dropped lookups vanish with the tables, so no explicit re-GRANT is needed.
ALTER TABLE funding_application
  DROP COLUMN IF EXISTS household_income_band,
  DROP COLUMN IF EXISTS nsfas_decline_reason,
  DROP COLUMN IF EXISTS prior_funder,
  DROP COLUMN IF EXISTS defunded_by;

DROP TABLE IF EXISTS lk_income_band;
DROP TABLE IF EXISTS lk_nsfas_decline_reason;
DROP TABLE IF EXISTS lk_prior_funder;
