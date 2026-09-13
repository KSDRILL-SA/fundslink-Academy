"""Insights-test fixtures — the application harness plus the insights router."""

from __future__ import annotations

import pytest

from app.modules.application.router import router as application_router
from app.modules.insights.router import router as insights_router
from app.modules.profile.router import router as profile_router
from tests.application.conftest import admin_conn  # noqa: F401
from tests.auth.conftest import auth_test_client, migrated_db, rs256_keys  # noqa: F401


@pytest.fixture
def client(migrated_db, rs256_keys, monkeypatch):  # noqa: F811
    with auth_test_client(
        migrated_db,
        monkeypatch,
        extra_routers=[profile_router, application_router, insights_router],
    ) as test_client:
        yield test_client
