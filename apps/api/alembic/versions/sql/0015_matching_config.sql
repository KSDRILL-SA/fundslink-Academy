-- 0015 — matching config (DB-D24). Idempotent. The spend breaker derives a daily CALL limit
-- from budget / cost-per-call (both ZAR, in PostgreSQL); Redis only counts calls (S5.3).
INSERT INTO config (key, value) VALUES
  ('matching_cost_per_call_zar', '0.50'),
  ('matching_user_daily_quota', '5')
  ON CONFLICT (key) DO NOTHING;
