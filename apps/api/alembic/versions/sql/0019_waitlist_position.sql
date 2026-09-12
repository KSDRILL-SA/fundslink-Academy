-- 0019 — fn_waitlist_position: tell a waitlisted student where they stand (E4, #220).
--
-- S16-WAIT promises "you are position #K", and a position is by definition a fact about
-- OTHER people's applications. A student's RLS context can see exactly one row — their own —
-- so the same question asked directly returns 1 for everybody, which would be a comfortable
-- lie on the screen that exists to tell the truth.
--
-- SECURITY DEFINER is the narrow answer: the function runs with the owner's rights, reads the
-- rows it must count, and returns A SINGLE INTEGER. No student row, no name, no amount, no
-- identity ever crosses the boundary — only "how many were waitlisted before you".
--
-- Guard rails on the definer, because a SECURITY DEFINER function is a privilege boundary:
--   * search_path is pinned, so a caller cannot shadow a table or operator it resolves;
--   * it takes the application id and returns NULL unless that application is itself
--     waitlisted, so it cannot be used to probe arbitrary ids for anything beyond that;
--   * EXECUTE is granted only to the application role.
--
-- Position is COMPUTED, never stored. An application that leaves the waitlist stops counting
-- the moment its status changes, and everyone behind it moves up without any process having to
-- remember to renumber them. A stored rank would drift, and a drifted rank on this screen is a
-- broken promise to someone who is waiting.

CREATE OR REPLACE FUNCTION fn_waitlist_position(p_application_id text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH waitlisted AS (
    SELECT a.id,
           (SELECT max(e.created_at)
              FROM application_status_event e
             WHERE e.application_id = a.id
               AND e.to_status = 'APPROVED_WAITLISTED') AS listed_at
      FROM funding_application a
     WHERE a.status = 'APPROVED_WAITLISTED'
  ),
  mine AS (
    SELECT listed_at FROM waitlisted WHERE id = p_application_id
  )
  SELECT CASE
           WHEN NOT EXISTS (SELECT 1 FROM mine) THEN NULL
           ELSE (SELECT count(*) + 1
                   FROM waitlisted w
                  WHERE w.listed_at < (SELECT listed_at FROM mine))::integer
         END;
$$;

-- Never public: the application role only.
REVOKE ALL ON FUNCTION fn_waitlist_position(text) FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'fundslink_app') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_waitlist_position(text) TO fundslink_app';
  END IF;
END $$;
