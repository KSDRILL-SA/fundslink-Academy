-- ============================================================
-- 0016 — Eligibility signals (D-016 / D-017): NSFAS-eligibility + income + prior-funder.
-- Founder-approved L4, 2026-06-18 (master-spec v1.2). Additive (DB-D36).
-- These are SELF-DECLARED signals the Pre-Screening Engine only ANNOTATES; a human decides
-- (MASTER-SPEC §5.7, D-010). We do NOT build a means-test — NSFAS already ran it (§1.7).
-- Order: lookups (FK targets) created/seeded before the columns that reference them.
-- ============================================================

-- ---------- Lookups (reference data — the app only READS, like other lk_ tables) ----------
-- Income bands mirror the national funding line: NSFAS ≤ R350k; missing-middle R350k–R600k
-- (DHET loan scheme). The Rand thresholds are policy carried in config / the versioned ruleset,
-- never hardcoded here (DB-D24). `rank` is income ASCENDING so need-severity ordering (E4/§16)
-- can float the lowest band to the top of a capacity-limited pool; PREFER_NOT_TO_SAY sorts last.
CREATE TABLE lk_income_band (code text PRIMARY KEY, rank int NOT NULL);
INSERT INTO lk_income_band(code, rank) VALUES
  ('SASSA_GRANT',1),('LTE_350K',2),('MISSING_MIDDLE_350_600K',3),('GT_600K',4),
  ('PREFER_NOT_TO_SAY',9)
  ON CONFLICT DO NOTHING;

-- NSFAS decline reason — read off the NSFAS outcome letter UG_CAT_C already requires (D-016).
-- Replaces §5.4's free-text "various reasons": MEANS_INCOME is the only reason we treat as
-- "NSFAS deliberately means-tested out" → human declines with a kind NSFAS/missing-middle redirect.
CREATE TABLE lk_nsfas_decline_reason (code text PRIMARY KEY);
INSERT INTO lk_nsfas_decline_reason(code) VALUES
  ('MEANS_INCOME'),('DOCUMENTATION'),('ADMINISTRATIVE'),('ACADEMIC_NPLUS'),('OTHER')
  ON CONFLICT DO NOTHING;

-- Prior funder — who funded the student before (D-016). OTHER_BURSARY + still NSFAS-eligible
-- (≤ R350k) → reviewer redirects to NSFAS first; we do not fund what NSFAS would.
CREATE TABLE lk_prior_funder (code text PRIMARY KEY);
INSERT INTO lk_prior_funder(code) VALUES
  ('NSFAS'),('OTHER_BURSARY'),('SELF'),('NONE')
  ON CONFLICT DO NOTHING;

-- ---------- Columns on the application (inherit funding_application RLS from 0007) ----------
-- All nullable / self-declared; per-type requiredness is enforced by the ruleset + service, and a
-- missing value never blocks a student (the engine annotates, never rejects — §5.7).
ALTER TABLE funding_application
  ADD COLUMN household_income_band text REFERENCES lk_income_band,
  ADD COLUMN nsfas_decline_reason  text REFERENCES lk_nsfas_decline_reason,
  ADD COLUMN prior_funder          text REFERENCES lk_prior_funder,
  ADD COLUMN defunded_by           text;

-- ---------- Least-privilege: the new lookups are read-only to the app (0014 pattern) ----------
-- Default privileges (0005) granted the app SELECT,INSERT,UPDATE on creation; strip the writes so a
-- compromised app role cannot tamper with reference data. The owner (migrations) still writes them.
REVOKE INSERT, UPDATE ON lk_income_band, lk_nsfas_decline_reason, lk_prior_funder
  FROM fundslink_app;
