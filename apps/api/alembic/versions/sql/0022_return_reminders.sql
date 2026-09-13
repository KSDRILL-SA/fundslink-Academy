-- ============================================================
-- 0022 — Return reminders (D-006 "remind, don't punish" · completeness audit G3 · #298).
--
-- A RETURNED_FOR_INFO application carries `respond_by`, and nothing ever reminded the student:
-- a returned application died silently. The respond window was also a literal in code (14).
--
-- * return_respond_days       — how long a student has to send what we asked for. Was the literal
--                               default in ReturnRepository.insert; same value, now config.
-- * return_reminder_lead_days — how many days before respond_by the gentle reminder goes out.
--                               A second reminder goes out the day after respond_by passes. Neither
--                               changes the application: D-006 reminds, it never punishes.
--
-- Values are the Stage 03 defaults, changeable through config like every other SLA (DB-D24).
-- Additive and idempotent (DB-D36).
-- ============================================================

INSERT INTO lk_notify_trigger (code, sms_default) VALUES
  ('APPLICATION_RETURN_REMINDER', false)
  ON CONFLICT (code) DO NOTHING;

INSERT INTO config (key, value) VALUES
  ('return_respond_days', '14'),
  ('return_reminder_lead_days', '3')
  ON CONFLICT (key) DO NOTHING;
