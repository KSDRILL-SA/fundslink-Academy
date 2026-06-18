-- ============================================================
-- 0017 — Eligibility rulesets v2 (config-as-data, BR-E02 / MASTER-SPEC §5.7): D-016 + D-017.
-- Founder-approved L4, 2026-06-18 (master-spec v1.2). Additive (DB-D36).
-- New VERSIONS (effective_from now) — v1 is preserved for history and for in-flight applications
-- whose ruleset is pinned at first screen (§5.7 "history is preserved"). The `effective()` query
-- picks the highest version, so new submissions get v2.
--
-- The new `field_flag` checks carry severity "review_flag" → the engine emits an ANNOTATION for
-- the human reviewer; it NEVER returns or rejects (§5.7, D-010). Rand thresholds are expressed as
-- the bounded income BANDS (lk_income_band), not numbers in code (DB-D24).
-- ============================================================
INSERT INTO eligibility_ruleset (id, application_type, version, rules, effective_from, created_by)
VALUES
 -- UG Category C (D-016): same required NSFAS outcome letter, now read for its REASON.
 ('ers_ug_cat_c_v2','UG_CAT_C',2,
  '{"category":"UG_CAT_C","required_documents":["NSFAS_OUTCOME"],"requires_motivation":false,
    "checks":[
      {"id":"nsfas_outcome_present","type":"document_present","doc_type":"NSFAS_OUTCOME","severity":"required","label":"NSFAS outcome evidence present"},
      {"id":"nsfas_declined_for_income","type":"field_flag","field":"nsfas_decline_reason","flag_values":["MEANS_INCOME"],"severity":"review_flag","label":"NSFAS declined for household income above the threshold — verify the letter, then decline with a kind NSFAS / missing-middle redirect (D-016, §5.4)"},
      {"id":"still_nsfas_eligible_redirect","type":"field_flag","field":"prior_funder","flag_values":["OTHER_BURSARY"],"also":[{"field":"household_income_band","in":["SASSA_GRANT","LTE_350K"]}],"severity":"review_flag","label":"A private bursary dropped this student but they are still NSFAS-eligible (≤ R350k) — redirect to NSFAS first (D-016)"}
    ]}'::jsonb,
  now(),'SYSTEM'),
 -- Postgrad (D-017): acceptance + income evidence required; income ceiling annotated for a human.
 ('ers_postgrad_v2','POSTGRAD',2,
  '{"category":"POSTGRAD","required_documents":["ACCEPTANCE_LETTER","PROOF_OF_INCOME"],"requires_motivation":false,
    "checks":[
      {"id":"acceptance_letter_present","type":"document_present","doc_type":"ACCEPTANCE_LETTER","severity":"required","label":"Acceptance letter present"},
      {"id":"income_evidence_present","type":"document_present","doc_type":"PROOF_OF_INCOME","severity":"required","label":"Proof of household income (or a SASSA confirmation) present"},
      {"id":"income_above_postgrad_ceiling","type":"field_flag","field":"household_income_band","flag_values":["GT_600K"],"severity":"review_flag","label":"Household income above the postgrad ceiling (> R600k) — verify and redirect to NRF / commercial; FundsLink funds postgrad students who cannot self-fund (D-017)"}
    ]}'::jsonb,
  now(),'SYSTEM')
ON CONFLICT (application_type, version) DO NOTHING;
