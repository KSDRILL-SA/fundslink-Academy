"""Application repositories (DB-D2 boundary) — the only application files touching a DB driver.

Named-bind parameterised SQL (DB-D20 / S5.21). Money is bound as ``Decimal`` (never float —
S5.28); the status cache + append-only events + outbox are written through these methods inside
the caller's single transaction (BR-N01). Ownership on student paths is an explicit
``student_profile_id = :owner`` predicate (the value comes from the authenticated principal);
RLS is the fail-closed backstop on the read paths.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy.exc import IntegrityError

from app.common.errors import AppError
from app.db import sql
from app.db.cuid import cuid
from app.db.repository import BaseRepository

# Note: the "one active application per academic year" rule (BR-E06 / D-004) is enforced by the
# DB partial unique index uq_app_active_per_year (active = status NOT IN REJECTED_FINAL/REJECTED/
# WITHDRAWN/COMPLETED — so APPROVED/SUSPENDED/REVOKED still block). create() surfaces its violation
# as a friendly 409; the database is the single source of truth, not a duplicated constant here.


class ApplicationRepository(BaseRepository):
    async def has_profile(self, student_id: str) -> bool:
        """The funding_application FK targets student_profile — a profile must exist first."""
        row = await sql.fetch_one(
            self.session,
            "SELECT 1 FROM student_profile WHERE id = :id AND deleted_at IS NULL",
            id=student_id,
        )
        return row is not None

    async def has_sa_id(self, user_id: str) -> bool:
        """SA ID (blind-indexed) must exist before SUBMIT — the anti-duplicate gate (D-007/BR-A04).

        student_profile.id == "user".id (1:1 PK=FK), so the owner id keys the user row directly.
        """
        row = await sql.fetch_one(
            self.session,
            'SELECT 1 FROM "user" WHERE id = :id AND id_number_blind_idx IS NOT NULL',
            id=user_id,
        )
        return row is not None

    async def create(
        self,
        *,
        student_profile_id: str,
        application_type: str,
        academic_year: str,
        requested_amount: Decimal | None,
        household_income_band: str | None = None,
        nsfas_decline_reason: str | None = None,
        prior_funder: str | None = None,
        defunded_by: str | None = None,
        needed_by=None,
    ) -> str:
        app_id = cuid()
        try:
            await sql.execute(
                self.session,
                "INSERT INTO funding_application"
                " (id, student_profile_id, application_type, academic_year, requested_amount,"
                "  household_income_band, nsfas_decline_reason, prior_funder, defunded_by,"
                "  needed_by, created_by)"
                " VALUES (:id, :sp, :type, :year, :amount,"
                "  :income_band, :decline_reason, :prior_funder, :defunded_by, :needed_by, :sp)",
                id=app_id,
                sp=student_profile_id,
                type=application_type,
                year=academic_year,
                amount=requested_amount,
                income_band=household_income_band,
                decline_reason=nsfas_decline_reason,
                prior_funder=prior_funder,
                defunded_by=defunded_by,
                needed_by=needed_by,
            )
        except IntegrityError as exc:
            # uq_app_active_per_year — already one active application this academic year (BR-E06).
            raise AppError(
                "application_already_active",
                "You already have an active application for this academic year",
                status_code=409,
            ) from exc
        return app_id

    async def get_status(self, application_id: str) -> str | None:
        row = await sql.fetch_one(
            self.session,
            "SELECT status FROM funding_application WHERE id = :id AND deleted_at IS NULL",
            id=application_id,
        )
        return row[0] if row else None

    async def owner_of(self, application_id: str) -> str | None:
        row = await sql.fetch_one(
            self.session,
            "SELECT student_profile_id FROM funding_application"
            " WHERE id = :id AND deleted_at IS NULL",
            id=application_id,
        )
        return row[0] if row else None

    async def owned_id(self, application_id: str, owner_id: str) -> str | None:
        """Return the id iff owned by ``owner_id`` — the explicit-ownership gate for mutations."""
        row = await sql.fetch_one(
            self.session,
            "SELECT id FROM funding_application"
            " WHERE id = :id AND student_profile_id = :owner AND deleted_at IS NULL",
            id=application_id,
            owner=owner_id,
        )
        return row[0] if row else None

    async def set_status(self, application_id: str, status: str) -> None:
        await sql.execute(
            self.session,
            "UPDATE funding_application SET status = :s WHERE id = :id",
            s=status,
            id=application_id,
        )

    async def get_full(self, application_id: str):
        return await sql.fetch_one(
            self.session,
            "SELECT id, application_type, academic_year, requested_amount, status, currency,"
            " created_at, priority, needed_by FROM funding_application"
            " WHERE id = :id AND deleted_at IS NULL",
            id=application_id,
        )

    async def set_priority(self, application_id: str, priority: str) -> None:
        """Set triage rank (D-002/D-013). Caller is staff (reviewer ctx); RLS admits the write."""
        await sql.execute(
            self.session,
            "UPDATE funding_application SET priority = :p WHERE id = :id",
            p=priority,
            id=application_id,
        )

    async def list_for_owner(self, owner_id: str, *, limit: int, after=None):
        return await self._page(
            "student_profile_id = :owner AND deleted_at IS NULL",
            {"owner": owner_id},
            limit=limit,
            after=after,
        )

    async def list_for_review(self, *, status: str | None, limit: int, after=None):
        where = "deleted_at IS NULL"
        params: dict = {}
        if status:
            where += " AND status = :status"
            params["status"] = status
        return await self._page(where, params, limit=limit, after=after)

    async def _page(self, where: str, params: dict, *, limit: int, after):
        if after is not None:
            where += " AND (created_at, id) < (:c_created, :c_id)"
            params = {**params, "c_created": after[0], "c_id": after[1]}
        rows = await sql.fetch_all(
            self.session,
            "SELECT id, application_type, academic_year, requested_amount, status, currency,"
            f" created_at, priority, needed_by FROM funding_application WHERE {where}"
            " ORDER BY created_at DESC, id DESC LIMIT :limit",
            limit=limit + 1,
            **params,
        )
        return rows


class TransitionRepository(BaseRepository):
    async def allowed(self, from_status: str, to_status: str) -> bool:
        row = await sql.fetch_one(
            self.session,
            "SELECT 1 FROM app_status_transition WHERE from_status = :f AND to_status = :t",
            f=from_status,
            t=to_status,
        )
        return row is not None


class StatusEventRepository(BaseRepository):
    async def insert(
        self,
        *,
        application_id: str,
        from_status: str | None,
        to_status: str,
        actor_user_id: str,
        note: str | None = None,
    ) -> None:
        # created_at = clock_timestamp() (wall clock), NOT now() (transaction start): a single
        # transaction can write several events (submit → pre-screen), and "latest event = cache"
        # (DB-D24 / the integrity job) needs them strictly ordered, not tied at the txn timestamp.
        await sql.execute(
            self.session,
            "INSERT INTO application_status_event"
            " (id, application_id, from_status, to_status, actor_user_id, note, created_at)"
            " VALUES (:id, :app, :from, :to, :actor, :note, clock_timestamp())",
            id=cuid(),
            app=application_id,
            **{"from": from_status, "to": to_status},
            actor=actor_user_id,
            note=note,
        )

    async def decision(self, application_id: str):
        """The decision event a student is owed: its note, its time, and the status.

        The reviewer's words were always here — `admin_review` passes its `note`
        straight to the transition — and nothing ever read them back out, so the
        student saw a status and no reason (#220). This is that read.

        Only terminal, decided statuses count. A move to UNDER_REVIEW carries a
        note too, and it is an internal triage remark, not something written to
        be read by the applicant.
        """
        return await sql.fetch_one(
            self.session,
            "SELECT to_status, note, created_at FROM application_status_event"
            " WHERE application_id = :app"
            "   AND to_status IN ('APPROVED', 'APPROVED_WAITLISTED', 'REJECTED', 'REJECTED_FINAL')"
            " ORDER BY created_at DESC LIMIT 1",
            app=application_id,
        )

    async def waitlist_position(self, application_id: str) -> int | None:
        """Where this application sits on the waitlist, 1-based (E4).

        Delegates to `fn_waitlist_position` (migration 0019). The count must see
        other students' applications, which the caller's RLS context deliberately
        cannot — so a query written here would return 1 for everybody, on the one
        screen whose entire purpose is telling the truth. The function is
        SECURITY DEFINER and returns only the integer.

        Returns None when the application is not on the waitlist, which is what
        the response model wants for every other status.
        """
        row = await sql.fetch_one(
            self.session,
            "SELECT fn_waitlist_position(:app)",
            app=application_id,
        )
        return None if row is None or row[0] is None else int(row[0])


class MotivationRepository(BaseRepository):
    async def insert(
        self,
        *,
        application_id: str,
        situation: str,
        why_not_categories: str,
        support_needed: str,
        language: str,
    ) -> None:
        await sql.execute(
            self.session,
            "INSERT INTO application_motivation"
            " (id, application_id, situation, why_not_categories, support_needed, language,"
            "  created_by)"
            " VALUES (:id, :app, :sit, :why, :sup, :lang, :app)",
            id=cuid(),
            app=application_id,
            sit=situation,
            why=why_not_categories,
            sup=support_needed,
            lang=language,
        )

    async def get(self, application_id: str):
        return await sql.fetch_one(
            self.session,
            "SELECT situation, why_not_categories, support_needed, language"
            " FROM application_motivation WHERE application_id = :app",
            app=application_id,
        )


class PreScreenReadRepository(BaseRepository):
    async def latest(self, application_id: str):
        """Latest pre-screen outcome for the response (populated by module 3; None until then)."""
        return await sql.fetch_one(
            self.session,
            "SELECT outcome, checks FROM pre_screen_result"
            " WHERE application_id = :app ORDER BY created_at DESC LIMIT 1",
            app=application_id,
        )


class OutboxRepository(BaseRepository):
    """notification_outbox enqueue (BR-N01) — STAFF/SYSTEM context only (rls_no_insert)."""

    async def enqueue(
        self,
        *,
        user_id: str,
        trigger: str,
        payload: dict,
        channels: list[str] | None = None,
    ) -> None:
        import json

        await sql.execute(
            self.session,
            "INSERT INTO notification_outbox (id, user_id, trigger, channels, payload)"
            " VALUES (:id, :uid, :trig, :ch, :payload)",
            id=cuid(),
            uid=user_id,
            trig=trigger,
            ch=channels or ["EMAIL", "IN_APP"],  # preference/consent refinement lands in module 6
            payload=json.dumps(payload),
        )


class AppealRepository(BaseRepository):
    async def exists_for(self, application_id: str) -> bool:
        row = await sql.fetch_one(
            self.session,
            "SELECT 1 FROM appeal WHERE application_id = :app",
            app=application_id,
        )
        return row is not None

    async def create(
        self, *, application_id: str, new_information: str, original_decider_id: str
    ) -> str:
        appeal_id = cuid()
        try:
            await sql.execute(
                self.session,
                "INSERT INTO appeal (id, application_id, new_information, original_decider_id)"
                " VALUES (:id, :app, :info, :decider)",
                id=appeal_id,
                app=application_id,
                info=new_information,
                decider=original_decider_id,
            )
        except IntegrityError as exc:  # one appeal per application (uq via application_id UNIQUE)
            raise AppError(
                "appeal_exists", "This application has already been appealed", status_code=409
            ) from exc
        return appeal_id

    async def original_decider(self, application_id: str) -> str | None:
        """The human who made the last REJECTED decision — the appeal must go to someone else."""
        row = await sql.fetch_one(
            self.session,
            "SELECT actor_user_id FROM application_status_event"
            " WHERE application_id = :app AND to_status = 'REJECTED'"
            " ORDER BY created_at DESC LIMIT 1",
            app=application_id,
        )
        return row[0] if row else None
