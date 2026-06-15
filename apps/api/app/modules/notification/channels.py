"""Notification channel adapters + the channel→consent map (BR-N03).

Each channel is an adapter behind a common interface (the email adapter reuses the auth console
adapter; SMS is a stubbed interface wired to a provider at deploy; in-app is the outbox row itself,
read via listMyNotifications). BR-N03: a channel that requires consent the user hasn't granted is
skipped and logged — the map below is the policy (EMAIL/IN_APP are transactional; SMS needs
MARKETING_SMS). The exact channel↔consent policy is an L4/POPIA decision (flagged in the PR).
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod

from app.modules.auth.email import get_email_adapter

logger = logging.getLogger("fundslink.notification")

# A channel listed here may only be used if the user has granted the named consent (BR-N03).
CHANNEL_CONSENT: dict[str, str] = {"SMS": "MARKETING_SMS"}


class ChannelAdapter(ABC):
    @abstractmethod
    async def send(self, *, recipient: str | None, subject: str, body: str) -> None: ...


class EmailChannel(ChannelAdapter):
    async def send(self, *, recipient: str | None, subject: str, body: str) -> None:
        if not recipient:
            raise ValueError("email channel requires a recipient address")
        await get_email_adapter().send(to=recipient, subject=subject, body=body)


class SmsChannel(ChannelAdapter):
    """Stubbed SMS interface — logs instead of sending; a real provider is wired at deploy."""

    async def send(self, *, recipient: str | None, subject: str, body: str) -> None:
        logger.info("[sms:stub] to=%s %s", recipient, subject)


class InAppChannel(ChannelAdapter):
    """In-app delivery IS the outbox row — surfaced by listMyNotifications. No external send."""

    async def send(self, *, recipient: str | None, subject: str, body: str) -> None:
        return None


CHANNELS: dict[str, ChannelAdapter] = {
    "EMAIL": EmailChannel(),
    "SMS": SmsChannel(),
    "IN_APP": InAppChannel(),
}
