"""Runtime least-privilege guard (auth↔DB integration safety).

The database's entire security model — RLS, append-only walls, ownership fencing — only holds if
the app connects as a NON-superuser, NOBYPASSRLS role (fundslink_app) that owns nothing. If the app
were ever pointed at the owner/superuser, RLS would be silently bypassed and every guarantee would
evaporate. This check lets the app PROVE, at runtime, that it is connected as a constrained role —
and refuse readiness otherwise. Auth does not operate in a way that could betray the database.

**Ownership is the third way in, and it has no flag.** PostgreSQL does not apply row security to a
table's owner unless the table carries FORCE ROW LEVEL SECURITY, and none of ours do — forcing it
would subject the migration role to the policies it has to maintain. So a role that is neither a
superuser nor BYPASSRLS, but happens to own the tables, reads every student's rows while reporting
itself perfectly constrained. That is not a hypothetical: the migration role (`fundslink`) is
exactly such a role, it lives on the same host with credentials already in the deploy environment,
and until #313 this guard answered `least_privileged: true` for it. `/readyz` would have served.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# The three ways a connection escapes row security, asked in one round trip.
#
# The third counts RLS-enabled tables (and partitioned parents) that do NOT force row security and
# whose owning role the current user is a member of — pg_has_role, not a plain `relowner = ...`,
# because ownership privileges flow through role membership and a GRANTed owner role bypasses just
# as completely as being one. Unfiltered by schema on purpose: a table we protect with RLS is worth
# protecting wherever someone put it.
_ROLE_POWERS = text(
    "SELECT current_user,"
    " (SELECT rolsuper FROM pg_roles WHERE rolname = current_user),"
    " (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user),"
    " (SELECT count(*) FROM pg_class c"
    "   WHERE c.relkind IN ('r', 'p')"
    "     AND c.relrowsecurity"
    "     AND NOT c.relforcerowsecurity"
    "     AND pg_has_role(current_user, c.relowner, 'USAGE'))"
)


async def verify_least_privilege(session: AsyncSession) -> dict:
    """Report the connected role's powers.

    ``least_privileged`` is True only when the role is a superuser by no route, RLS-bypassing by no
    attribute, and the owner of no RLS-protected table — i.e. genuinely subject to the database's
    security model rather than merely lacking the two flags that say so.

    ``owns_unforced_rls_tables`` is the count, not a boolean, because the number is what tells an
    operator reading a failed ``/readyz`` whether they have pointed the app at the owner of the
    whole schema or at a role that happens to own one stray table.
    """
    role, is_super, bypass, owned = (await session.execute(_ROLE_POWERS)).one()
    is_super, bypass, owned = bool(is_super), bool(bypass), int(owned)
    return {
        "role": role,
        "is_superuser": is_super,
        "bypasses_rls": bypass,
        "owns_unforced_rls_tables": owned,
        "least_privileged": not is_super and not bypass and owned == 0,
    }
