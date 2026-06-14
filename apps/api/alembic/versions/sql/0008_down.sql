-- Downgrade for migration 0008.
DROP TRIGGER IF EXISTS tg_config_touch ON config;
DROP TRIGGER IF EXISTS tg_np_touch ON notification_preference;
DROP TRIGGER IF EXISTS tg_doc_touch ON document;
