"""Notification request/response schemas (S2.23) — mirrors the contract (S2.7)."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from app.modules.application.schemas import PageMeta


class Channel(StrEnum):
    EMAIL = "EMAIL"
    SMS = "SMS"
    IN_APP = "IN_APP"


class Notification(BaseModel):
    id: str
    trigger: str
    channels: list[str] = Field(default_factory=list)
    state: str
    created_at: datetime


class NotificationPage(BaseModel):
    items: list[Notification]
    meta: PageMeta = Field(default_factory=PageMeta)


class Preferences(BaseModel):
    # per_trigger: { trigger_code: [EMAIL|SMS|IN_APP, ...] } — BR-N02 per-trigger channel choice.
    per_trigger: dict[str, list[Channel]] = Field(default_factory=dict)
