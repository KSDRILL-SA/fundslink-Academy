"""Transactional email adapter (auth flows: verification + password reset).

v1 ships a console adapter — links are logged, not delivered. A real provider lands with the
Stage-03 notification module (outbox + adapters). The adapter is resolved via get_email_adapter
so tests can capture what would be sent without any network.
"""

from __future__ import annotations

import logging

logger = logging.getLogger("fundslink.auth.email")


class EmailAdapter:
    async def send(self, *, to: str, subject: str, body: str) -> None:  # pragma: no cover
        raise NotImplementedError


class ConsoleEmailAdapter(EmailAdapter):
    """Dev/staging adapter — logs the message instead of delivering it (no SMTP yet)."""

    async def send(self, *, to: str, subject: str, body: str) -> None:
        logger.info("[email:console] to=%s subject=%s\n%s", to, subject, body)


_adapter: EmailAdapter = ConsoleEmailAdapter()


def get_email_adapter() -> EmailAdapter:
    return _adapter
