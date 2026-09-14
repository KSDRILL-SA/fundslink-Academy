-- Downgrade for migration 0023. The code falls back to the same literals when a key is absent,
-- so removing these rows restores the previous behaviour exactly.
DELETE FROM config
 WHERE key IN ('pre_screen_outreach_cycle', 'tracked_deadline_lead_days', 'tracked_silence_days');
