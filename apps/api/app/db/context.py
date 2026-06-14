"""Per-request RLS session context (handoff contract #3 · D-015).

The database is fail-closed: every RLS policy reads ``app.user_id`` / ``app.user_role`` GUCs
(0007/0009/0010). The backend MUST set them inside the request's transaction or it sees no
rows. We use ``set_config(..., is_local => true)`` — the transaction-scoped form of
``SET LOCAL`` — so the context auto-resets at COMMIT/ROLLBACK and can never bleed onto the
next request that reuses this pooled connection.

Two contexts exist:
* ``set_user_context``  — an authenticated request runs as that user (own rows only).
* ``set_system_context`` — the authentication authority (register/login/refresh) and
  background jobs run as SYSTEM, which app_is_staff() admits (D-015).
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_SET = text(
    "SELECT set_config('app.user_id', :uid, true), set_config('app.user_role', :role, true)"
)

SYSTEM_PRINCIPAL = "SYSTEM"


async def set_rls_context(session: AsyncSession, *, user_id: str | None, role: str | None) -> None:
    """Set the transaction-local RLS GUCs. None becomes '' (matches no row → fail-closed)."""
    await session.execute(_SET, {"uid": user_id or "", "role": role or ""})


async def set_user_context(session: AsyncSession, *, user_id: str, role: str) -> None:
    """Run the remainder of this transaction as the authenticated user."""
    await set_rls_context(session, user_id=user_id, role=role)


async def set_system_context(session: AsyncSession) -> None:
    """Run as the SYSTEM authentication authority (login flow, D-015) or a background job."""
    await set_rls_context(session, user_id=SYSTEM_PRINCIPAL, role=SYSTEM_PRINCIPAL)
