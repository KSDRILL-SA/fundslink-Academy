"""Insights response schemas (S2.23) — mirror the contract (S2.7)."""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel

from app.modules.application.schemas import PageMeta


class ActivityCategory(StrEnum):
    SECURITY = "SECURITY"
    ACCOUNT = "ACCOUNT"
    PRIVACY = "PRIVACY"
    DOCUMENTS = "DOCUMENTS"
    APPLICATION = "APPLICATION"
    MATCHING = "MATCHING"
    TRACKING = "TRACKING"


class ActivityActor(StrEnum):
    YOU = "YOU"
    FUNDSLINK = "FUNDSLINK"


class ActivityItem(BaseModel):
    id: str
    occurred_at: datetime
    category: ActivityCategory
    event: str
    actor: ActivityActor
    resource_id: str | None = None
    to_status: str | None = None
    label: str | None = None


class ActivityPage(BaseModel):
    items: list[ActivityItem]
    meta: PageMeta


class StatusCount(BaseModel):
    status: str
    count: int


class ApplicationFigures(BaseModel):
    total: int
    drafts: int
    needs_your_action: int
    with_fundslink: int
    decided: int
    by_status: list[StatusCount]


class TrackedDeadline(BaseModel):
    tracked_application_id: str
    bursary_name: str
    due_on: date
    deadline_type: str


class TrackingFigures(BaseModel):
    total: int
    active: int
    by_status: list[StatusCount]
    next_deadline: TrackedDeadline | None


class MatchFigures(BaseModel):
    total: int
    last_run_at: datetime | None


class NotificationFigures(BaseModel):
    total: int
    last_at: datetime | None


class AccountFigures(BaseModel):
    member_since: datetime
    previous_sign_in_at: datetime | None
    mfa_enabled: bool


class StudentOverview(BaseModel):
    generated_at: datetime
    applications: ApplicationFigures
    tracking: TrackingFigures
    matches: MatchFigures
    notifications: NotificationFigures
    account: AccountFigures


class QueueFigures(BaseModel):
    awaiting_review: int
    overdue: int
    emergency: int
    unscreened: int
    awaiting_student: int
    by_status: list[StatusCount]


class FlowFigures(BaseModel):
    submitted: int
    approved: int
    waitlisted: int
    not_funded: int
    median_days_to_decision: float | None


class DeliveryFigures(BaseModel):
    pending: int
    failed: int
    sent: int


class AccountSecurityFigures(BaseModel):
    registered: int
    sign_ins: int
    failed_sign_ins: int
    locked: int


class AdminOverview(BaseModel):
    generated_at: datetime
    window_days: int
    queue: QueueFigures
    flow: FlowFigures
    notifications: DeliveryFigures
    accounts: AccountSecurityFigures


class ActorKind(StrEnum):
    STUDENT = "STUDENT"
    STAFF = "STAFF"
    SYSTEM = "SYSTEM"
    ANONYMOUS = "ANONYMOUS"


class AdminActivityItem(BaseModel):
    id: str
    occurred_at: datetime
    action: str
    resource_type: str
    resource_id: str | None = None
    actor_kind: ActorKind


class AdminActivityPage(BaseModel):
    items: list[AdminActivityItem]
    meta: PageMeta
