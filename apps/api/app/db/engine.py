"""Async engine + session management (asyncpg — ADR-003, infra compose).

The runtime path is async SQLAlchemy over asyncpg; Alembic migrations use the sync
psycopg3 driver (see alembic/env.py). ``get_session`` is an async dependency that
yields a session and guarantees commit/rollback/close — the single entry point every
future repository will receive.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,  # drop dead connections rather than hand them to a request
    future=True,
)

session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """Yield a session, committing on success and rolling back on error (one unit of work)."""
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
