-- ============================================================
-- 0023 — the last hardcoded business values become config (DB-D24 · #311).
--
-- CLAUDE.md: "No hardcoded business values — config table (allowance, SLAs, budgets)." The SLA
-- days, the monthly allowance, the matching budget and the return windows were already here.
-- These three were missed, and each is a policy decision about how the platform treats a student
-- under pressure — changing one meant a code change, a review, a deploy and a restart.
--
-- * pre_screen_outreach_cycle    — after this many RETURNED_FOR_INFO cycles the loop stops and a
--                                  person reaches out directly (BR-E04). Was OUTREACH_CYCLE.
-- * tracked_deadline_lead_days   — how many days before a tracked bursary's deadline the reminder
--                                  goes out (BR-T05). Was DEADLINE_LEAD_DAYS.
-- * tracked_silence_days         — the follow-up cadence for a tracked application that has gone
--                                  quiet, in days since the last activity (BR-T06). Was
--                                  SILENCE_DAYS. Stored as a comma-separated list because the
--                                  rule is a sequence, not a single number; the reader rejects
--                                  anything that is not a list of positive integers, so a typo
--                                  in the config table falls back to the seeded cadence rather
--                                  than silently sending nothing.
--
-- Same values as the code they replace — this migration changes no behaviour, only who can change
-- it. Additive and idempotent (DB-D36).
-- ============================================================

INSERT INTO config (key, value) VALUES
  ('pre_screen_outreach_cycle', '3'),
  ('tracked_deadline_lead_days', '3'),
  ('tracked_silence_days', '30,45,60')
  ON CONFLICT (key) DO NOTHING;
