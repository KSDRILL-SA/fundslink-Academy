-- 0020 — the waitlist is ordered by need, not by arrival (E4 · D-017 · §4.1).
--
-- 0019 ordered the waitlist by WHEN a student was waitlisted. MASTER-SPEC E4 states the order in
-- one sentence — "postgraduate priority per §3, need-severity ordering" — and §4.1 is explicit:
-- "SASSA / <= R350k applicants are floated to the top of any capacity-limited pool". First-come
-- ordering gave a student in the greatest need a worse place than a comfortable one who happened
-- to wait longer, and printed that wrong number on the S16-WAIT screen. (#284, completeness audit
-- G1.)
--
-- The order, and where each key comes from — none of it is invented here:
--   1. Postgraduate first ........ E4 "postgraduate priority per §3"; §4.1 names postgrad PRIMARY
--   2. Need severity ............. lk_income_band.rank (SASSA_GRANT 1 … GT_600K 4). The seed ranks
--                                  exist for exactly this ordering and nothing read them before.
--                                  PREFER_NOT_TO_SAY is seeded at rank 9, so declining to say
--                                  sorts after every declared band — a decision already made in
--                                  0016, not one taken here. An unanswered (NULL) band is treated
--                                  the same way: the question is optional ("not a test you can
--                                  fail"), so skipping it is not punished below saying no.
--   3. Time on the waitlist ...... fairness among equals: earlier waitlisted, earlier place.
--   4. Application id ............ a deterministic tiebreak, so a position is stable between two
--                                  reads and two students can never share one.
--
-- Still one integer out, and still SECURITY DEFINER with a pinned search_path: the function reads
-- other students' type and band to compute a rank, and returns neither. No row, name, band or
-- amount crosses the boundary.

CREATE OR REPLACE FUNCTION fn_waitlist_position(p_application_id text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH waitlisted AS (
    SELECT a.id,
           CASE WHEN a.application_type = 'POSTGRAD' THEN 0 ELSE 1 END AS level_key,
           COALESCE(b.rank, 9)                                          AS need_key,
           COALESCE(
             (SELECT max(e.created_at)
                FROM application_status_event e
               WHERE e.application_id = a.id
                 AND e.to_status = 'APPROVED_WAITLISTED'),
             a.created_at
           )                                                           AS listed_at
      FROM funding_application a
      LEFT JOIN lk_income_band b ON b.code = a.household_income_band
     WHERE a.status = 'APPROVED_WAITLISTED'
       AND a.deleted_at IS NULL
  ),
  mine AS (
    SELECT level_key, need_key, listed_at, id FROM waitlisted WHERE id = p_application_id
  )
  SELECT CASE
           WHEN NOT EXISTS (SELECT 1 FROM mine) THEN NULL
           ELSE (
             SELECT count(*) + 1
               FROM waitlisted w, mine m
              WHERE (w.level_key, w.need_key, w.listed_at, w.id)
                  < (m.level_key, m.need_key, m.listed_at, m.id)
           )::integer
         END;
$$;

REVOKE ALL ON FUNCTION fn_waitlist_position(text) FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'fundslink_app') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_waitlist_position(text) TO fundslink_app';
  END IF;
END $$;
