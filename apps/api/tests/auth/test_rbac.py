"""RBAC — require() permission gate (S3.21-S3.23), ownership (S3.22), deny-by-default (S3.21).

The cross-user-403 harness (ST-2.3) is built here and applied to a dummy owned resource mounted
on an isolated test app (so it never enters the real contract surface).
"""

from __future__ import annotations

import subprocess
import sys
import uuid
from pathlib import Path

import pytest
from fastapi import APIRouter, Depends, FastAPI
from fastapi.routing import APIRoute

from app.common.errors import AppError
from app.common.rbac import declares_posture
from app.modules.auth.deps import CurrentUser
from app.modules.auth.jwt import decode_access_token
from app.modules.auth.permissions import Permission, require
from tests.auth.conftest import auth_test_client

BASE = "/api/v1/auth"
GOOD_PW = "Str0ng!Passw0rd"

# --- dummy owned-resource router (test-only; isolated app, never in the real contract) ---
dummy = APIRouter(prefix="/rbac-test", tags=["rbac-test"])


@dummy.get("/owned/{owner_id}", operation_id="rbacTestOwned")
async def _owned(
    owner_id: str, current: CurrentUser = Depends(require(Permission.PROFILE_READ_OWN))
):
    if owner_id != current.id:  # ownership verification AFTER the role check (S3.22)
        raise AppError("forbidden", "You do not own this resource", status_code=403)
    return {"owner_id": owner_id}


@dummy.get("/admin-only", operation_id="rbacTestAdminOnly")
async def _admin_only(current: CurrentUser = Depends(require(Permission.APPLICATION_REVIEW))):
    return {"ok": True}


@pytest.fixture
def rbac_client(migrated_db, rs256_keys, monkeypatch):
    with auth_test_client(migrated_db, monkeypatch, extra_routers=[dummy]) as test_client:
        yield test_client


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _register_student(client) -> tuple[str, str]:
    email = f"rbac_{uuid.uuid4().hex}@learner.fundslink.io"
    resp = client.post(
        f"{BASE}/register",
        json={"email": email, "password": GOOD_PW,
              "consents": [{"purpose": "TERMS_OF_SERVICE", "wording_version": "v1"}]},
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    client.cookies.clear()
    return token, decode_access_token(token)["sub"]


def assert_cross_user_403(client, *, owner_token, owner_id, other_token, path_for):
    """Reusable ST-2.3 harness: the owner reaches their resource; another user gets 403."""
    assert client.get(path_for(owner_id), headers=_bearer(owner_token)).status_code == 200
    assert client.get(path_for(owner_id), headers=_bearer(other_token)).status_code == 403


# ------------------------------- require() behaviour -------------------------------
def test_student_has_profile_read_own_permission(rbac_client):
    token, uid = _register_student(rbac_client)
    resp = rbac_client.get(f"/api/v1/rbac-test/owned/{uid}", headers=_bearer(token))
    assert resp.status_code == 200


def test_student_lacks_application_review_permission(rbac_client):
    token, _ = _register_student(rbac_client)
    resp = rbac_client.get("/api/v1/rbac-test/admin-only", headers=_bearer(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "forbidden"


def test_protected_route_requires_authentication(rbac_client):
    assert rbac_client.get("/api/v1/rbac-test/admin-only").status_code == 401


# --------------------------- cross-user 403 harness (ST-2.3) -----------------------
def test_cross_user_access_is_forbidden(rbac_client):
    a_token, a_id = _register_student(rbac_client)
    b_token, _b_id = _register_student(rbac_client)
    assert_cross_user_403(
        rbac_client,
        owner_token=a_token,
        owner_id=a_id,
        other_token=b_token,
        path_for=lambda oid: f"/api/v1/rbac-test/owned/{oid}",
    )


# ------------------------------ deny-by-default (S3.21) ----------------------------
def test_declares_posture_detects_declared_and_undeclared():
    probe = FastAPI()

    @probe.get("/declared", dependencies=[Depends(require(Permission.PROFILE_READ_OWN))])
    async def _declared():
        return {}

    @probe.get("/undeclared")
    async def _undeclared():
        return {}

    routes = {r.path: r for r in probe.routes if isinstance(r, APIRoute)}
    assert declares_posture(routes["/declared"].dependant) is True
    assert declares_posture(routes["/undeclared"].dependant) is False


def _load_lint():
    """Import scripts/permission_lint.py as a module, so tests can hand check() a synthetic app."""
    import importlib.util

    repo = Path(__file__).resolve().parents[4]  # auth/tests/api/apps/<repo>
    spec = importlib.util.spec_from_file_location(
        "permission_lint", repo / "scripts" / "permission_lint.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_permission_lint_passes_on_the_real_app_and_actually_checks_every_route():
    """Exit code 0 is not enough — that is exactly what a lint that checks nothing returns.

    For as long as FastAPI 0.137 was installed this lint printed "0 business route(s) all declare
    an access posture" and exited 0, and this test, which only checked the exit code, passed. It
    now requires the lint to have checked at least as many routes as the contract declares.
    """
    repo = Path(__file__).resolve().parents[4]
    lint = _load_lint()
    result = subprocess.run(
        [sys.executable, str(repo / "scripts" / "permission_lint.py")],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr

    import re

    checked = int(re.search(r"OK \(S3\.21\): (\d+) business route", result.stdout).group(1))
    assert checked >= lint.contract_operation_count() > 0, result.stdout


def test_permission_lint_walks_included_routers_and_catches_an_undeclared_route():
    """The shape that fooled the old lint: routes that only exist behind include_router()."""
    lint = _load_lint()
    router = APIRouter()

    @router.get("/declared", dependencies=[Depends(require(Permission.PROFILE_READ_OWN))])
    async def _declared():
        return {}

    @router.get("/forgotten")
    async def _forgotten():
        return {}

    probe = FastAPI()
    probe.include_router(router, prefix="/api/v1")

    checked, offenders, problems = lint.check(probe, minimum=2)

    assert checked == 2, "the lint could not see routes mounted with include_router()"
    assert len(offenders) == 1 and "/api/v1/forgotten" in offenders[0]
    assert problems == []


def test_permission_lint_honours_posture_declared_at_include_time():
    """A posture on include_router(dependencies=...) protects every route under it."""
    lint = _load_lint()
    router = APIRouter()

    @router.get("/covered-by-include")
    async def _covered():
        return {}

    probe = FastAPI()
    probe.include_router(
        router, prefix="/api/v1", dependencies=[Depends(require(Permission.PROFILE_READ_OWN))]
    )

    checked, offenders, _problems = lint.check(probe, minimum=1)

    assert checked == 1
    assert offenders == [], "a posture declared at include time was not recognised"


def test_permission_lint_refuses_to_pass_when_it_sees_fewer_routes_than_the_contract():
    """The vacuity guard: a lint that cannot see routes must go red, not quietly green."""
    lint = _load_lint()
    probe = FastAPI()  # an app whose business routes the lint cannot see: none at all

    checked, offenders, problems = lint.check(probe, minimum=lint.contract_operation_count())

    assert checked == 0
    assert offenders == []
    assert problems and "refusing to" in problems[0]
