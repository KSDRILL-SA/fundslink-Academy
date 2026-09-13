-- Downgrade for migration 0022. Outbox rows already queued with the trigger keep it (FK), so the
-- lookup row is only removed when nothing references it.
DELETE FROM config WHERE key IN ('return_respond_days', 'return_reminder_lead_days');
DELETE FROM lk_notify_trigger t
 WHERE t.code = 'APPLICATION_RETURN_REMINDER'
   AND NOT EXISTS (SELECT 1 FROM notification_outbox o WHERE o.trigger = t.code);
