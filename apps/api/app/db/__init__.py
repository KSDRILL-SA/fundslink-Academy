"""Database access layer (the ONLY place DB drivers are imported — import-linter).

Stage 01 ships the *base* layer only (DB-D2): async engine/session management,
a named-parameter raw-SQL helper (ADR-003 money paths), the dormant
institution-scoped repository base (TAD §3.5 / BR-I02), and the cuid generator
(DB-D23). No business repositories exist yet — those arrive with their modules.
"""

from app.db.cuid import cuid
from app.db.engine import engine, get_session, session_factory
from app.db.repository import BaseRepository, InstitutionScopedRepository
from app.db.sql import execute, fetch_all, fetch_one

__all__ = [
    "engine",
    "session_factory",
    "get_session",
    "cuid",
    "fetch_all",
    "fetch_one",
    "execute",
    "BaseRepository",
    "InstitutionScopedRepository",
]
