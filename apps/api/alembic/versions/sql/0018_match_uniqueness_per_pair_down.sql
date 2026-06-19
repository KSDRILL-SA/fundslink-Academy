-- Revert uq_match to the per-(student, bursary, model_version) key.
ALTER TABLE match_result DROP CONSTRAINT uq_match;
ALTER TABLE match_result ADD CONSTRAINT uq_match UNIQUE (student_profile_id, external_bursary_id, model_version);
