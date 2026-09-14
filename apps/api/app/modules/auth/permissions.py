"""RBAC — permission enum + the `require()` authorisation gate (S3.21-S3.23).

The enum mirrors the permission codes seeded in PostgreSQL (migration 0002); the authoritative
role→permission mapping lives in the DB, not in code (S3.21) — `require()` looks it up per
request. Authorisation happens at route entry via `Depends` (S3.23), never in business logic.

Deny-by-default (S3.21): every business route must declare its access posture — a permission
via `require(...)`, or one of the explicit markers `public_endpoint` / `authenticated_only`.
The permission-lint CI gate fails the build on any undeclared route.
"""

from __future__ import annotations

from collections.abc import Callable
from enum import StrEnum

from fastapi import Depends

from app.common.errors import AppError
from app.db.engine import get_session
from app.modules.auth.deps import CurrentUser, get_current_user
from app.modules.auth.repository import RbacRepository


class Permission(StrEnum):
    """Permission codes — mirror lk/permission seed (0002). Value == DB code."""

    ALLOCATION_CONFIRM = "ALLOCATION_CONFIRM"
    ALLOCATION_MANAGE = "ALLOCATION_MANAGE"
    ALLOCATION_READ_ANY = "ALLOCATION_READ_ANY"
    ALLOCATION_READ_OWN = "ALLOCATION_READ_OWN"
    APPLICATION_AUTHORIZE = "APPLICATION_AUTHORIZE"
    APPLICATION_CREATE = "APPLICATION_CREATE"
    APPLICATION_READ_ANY = "APPLICATION_READ_ANY"
    APPLICATION_READ_OWN = "APPLICATION_READ_OWN"
    APPLICATION_REVIEW = "APPLICATION_REVIEW"
    APPLICATION_UPDATE_OWN = "APPLICATION_UPDATE_OWN"
    COUNSELLING_MANAGE = "COUNSELLING_MANAGE"
    DISBURSEMENT_AUTHORIZE = "DISBURSEMENT_AUTHORIZE"
    DISBURSEMENT_CONFIRM = "DISBURSEMENT_CONFIRM"
    DISBURSEMENT_PROPOSE = "DISBURSEMENT_PROPOSE"
    DOCUMENT_CREATE = "DOCUMENT_CREATE"
    DOCUMENT_READ_ANY = "DOCUMENT_READ_ANY"
    DOCUMENT_READ_OWN = "DOCUMENT_READ_OWN"
    DOCUMENT_UPDATE_OWN = "DOCUMENT_UPDATE_OWN"
    DOCUMENT_VERIFY = "DOCUMENT_VERIFY"
    INSTITUTION_MANAGE_OWN = "INSTITUTION_MANAGE_OWN"
    INSTITUTION_READ = "INSTITUTION_READ"
    LEDGER_APPEND = "LEDGER_APPEND"
    LEDGER_READ = "LEDGER_READ"
    MATCH_READ_ANY = "MATCH_READ_ANY"
    MATCH_READ_OWN = "MATCH_READ_OWN"
    PROFILE_CREATE = "PROFILE_CREATE"
    PROFILE_READ_ANY = "PROFILE_READ_ANY"
    PROFILE_READ_OWN = "PROFILE_READ_OWN"
    PROFILE_UPDATE_OWN = "PROFILE_UPDATE_OWN"
    TRACKED_CREATE = "TRACKED_CREATE"
    TRACKED_DELETE_OWN = "TRACKED_DELETE_OWN"
    TRACKED_READ_ANY = "TRACKED_READ_ANY"
    TRACKED_READ_OWN = "TRACKED_READ_OWN"
    TRACKED_UPDATE_OWN = "TRACKED_UPDATE_OWN"


def require(permission: Permission) -> Callable:
    """A FastAPI dependency that admits the caller only if their role grants `permission`.

    Authenticates via get_current_user (which also sets the RLS context), then checks the
    seeded role→permission map (S3.21). Returns the CurrentUser so handlers can use it.
    """

    async def _dependency(
        current: CurrentUser = Depends(get_current_user),
        session=Depends(get_session),
    ) -> CurrentUser:
        granted = await RbacRepository(session).get_permissions_for_role(current.role)
        if permission.value not in granted:
            raise AppError(
                "forbidden", f"Missing required permission: {permission.value}", status_code=403
            )
        return current

    _dependency._fundslink_permission = permission.value  # marker for the deny-by-default lint
    return _dependency


def require_any(*permissions: Permission) -> Callable:
    """A route open to a caller holding ANY ONE of these permissions.

    For the few routes two different jobs share. A reviewer and an authorizer both have to be able
    to step aside from an application they have a conflict with (BR-E09), and they hold different
    permissions by design — one proposes a decision, the other rules on it (MASTER-SPEC §16.4).
    Without this, closing that gap would have meant granting one role the other's power, which is
    the opposite of what the two-person rule is for.

    Still deny-by-default (S3.21): the set is explicit and small, and the lint marker records every
    permission that can open the door, so the route's posture stays readable from its declaration.
    """
    if not permissions:
        raise ValueError("require_any() with no permissions would admit nobody, silently")
    wanted = {p.value for p in permissions}

    async def _dependency(
        current: CurrentUser = Depends(get_current_user),
        session=Depends(get_session),
    ) -> CurrentUser:
        granted = await RbacRepository(session).get_permissions_for_role(current.role)
        if wanted.isdisjoint(granted):
            raise AppError(
                "forbidden",
                "Missing required permission: one of " + ", ".join(sorted(wanted)),
                status_code=403,
            )
        return current

    _dependency._fundslink_permission = "|".join(sorted(wanted))
    return _dependency


def public_endpoint() -> None:
    """Explicit marker for an intentionally unauthenticated route (register/login/refresh)."""
    return None


public_endpoint._fundslink_public = True


def authenticated_only(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Marker for a route that needs a valid session but no specific permission (logout)."""
    return current


authenticated_only._fundslink_authenticated = True
