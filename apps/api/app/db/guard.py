"""Runtime least-privilege guard (auth↔DB integration safety).

The database's entire security model — RLS, append-only walls, ownership fencing — only holds if
the app connects as a NON-superuser, NOBYPASSRLS role (fundslink_app). If the app were ever
pointed at the owner/superuser, RLS would be silently bypassed and every guarantee would
evaporate. This check lets the app PROVE, at runtime, that it is connected as a constrained role —
and refuse readiness otherwise. Auth does not operate in a way that could betray the database.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_ROLE_POWERS = text(
    "SELECT current_user,"
    " (SELECT rolsuper FROM pg_roles WHERE rolname = current_user),"
    " (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user)"
)


async def verify_least_privilege(session: AsyncSession) -> dict:
    """Report the connected role's powers. ``least_privileged`` is True only when the role is
    neither a superuser nor RLS-bypassing — i.e. fully subject to the DB's security model."""
    role, is_super, bypass = (await session.execute(_ROLE_POWERS)).one()
    is_super, bypass = bool(is_super), bool(bypass)
    return {
        "role": role,
        "is_superuser": is_super,
        "bypasses_rls": bypass,
        "least_privileged": not is_super and not bypass,
    }
