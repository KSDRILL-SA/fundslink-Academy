-- ============================================================
-- 0008 — Final alignment: complete the updated_at auto-stamp coverage (DB-D21 class b).
-- config, document and notification_preference carry updated_at but lacked the touch
-- trigger, so their timestamp would never advance on UPDATE. Add the missing triggers so
-- every mutable table stamps updated_at consistently.
-- ============================================================
CREATE TRIGGER tg_doc_touch    BEFORE UPDATE ON document
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
CREATE TRIGGER tg_np_touch     BEFORE UPDATE ON notification_preference
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
CREATE TRIGGER tg_config_touch BEFORE UPDATE ON config
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
