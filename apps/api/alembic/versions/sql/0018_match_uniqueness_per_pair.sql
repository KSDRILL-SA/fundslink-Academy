-- 0018 — one match per (student, bursary). model_version leaves the uq_match key so a
-- LIVE<->FALLBACK mode flip refreshes the existing row instead of creating a duplicate (review LOW-1).
-- De-dup first (keep the newest row per pair) so ADD CONSTRAINT succeeds on any prior data.
DELETE FROM match_result a
USING match_result b
WHERE a.student_profile_id = b.student_profile_id
  AND a.external_bursary_id = b.external_bursary_id
  AND (a.created_at, a.id) < (b.created_at, b.id);

ALTER TABLE match_result DROP CONSTRAINT uq_match;
ALTER TABLE match_result ADD CONSTRAINT uq_match UNIQUE (student_profile_id, external_bursary_id);
