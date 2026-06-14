"""Sentry error tracking (S3.34 security alerts · S8.11). Disabled when no DSN is set.

PII is never forwarded (send_default_pii=False) — auth events carry emails/IDs that must not
leak to a third party (POPIA, MASTER-SPEC §15). The release/environment tags let alerts be
scoped per deploy.
"""

from __future__ import annotations

from app.core.config import settings


def init_sentry() -> bool:
    """Initialise Sentry if a DSN is configured. Returns True when enabled."""
    if not settings.sentry_dsn:
        return False

    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        release=f"{settings.app_name}@{settings.app_version}",
        traces_sample_rate=settings.sentry_traces_sample_rate,
        send_default_pii=False,
    )
    return True
