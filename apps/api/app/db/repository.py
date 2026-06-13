"""Repository base classes (DB-D2 — data independence boundary).

No code above the repository layer references table/column names; repositories are the
only place that touches the DB. Stage 01 ships the *base* classes only — no business
repositories. Two bases:

* ``BaseRepository`` — holds the async session; the parent of every future repository.
* ``InstitutionScopedRepository`` — TAD §3.5 row-scoped tenancy (BR-I02). Dormant in v1
  (institutions are [FWD]); it exists now so the institution module physically *cannot*
  call an unscoped query — every scoped statement must route through ``scope_clause`` /
  ``scoped_params``. Constructing one without an ``institution_id`` is a programming error.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession


class BaseRepository:
    """Base for all repositories: carries the unit-of-work session, nothing more."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @property
    def session(self) -> AsyncSession:
        return self._session


class InstitutionScopedRepository(BaseRepository):
    """Repository whose every query is forced through an institution_id filter (TAD §3.5).

    Dormant until the institution module ships [FWD]; the seam exists now so the unscoped
    variant is unreachable from institution-officer code paths by construction.
    """

    def __init__(self, session: AsyncSession, institution_id: str) -> None:
        if not institution_id:
            raise ValueError("InstitutionScopedRepository requires a non-empty institution_id")
        super().__init__(session)
        self._institution_id = institution_id

    @property
    def institution_id(self) -> str:
        return self._institution_id

    def scope_clause(self, column: str = "institution_id") -> str:
        """Return the mandatory WHERE fragment, e.g. ``institution_id = :institution_id``."""
        return f"{column} = :institution_id"

    def scoped_params(self, **params: object) -> dict[str, object]:
        """Merge the bound institution_id into a caller's named params (cannot be omitted)."""
        return {**params, "institution_id": self._institution_id}
