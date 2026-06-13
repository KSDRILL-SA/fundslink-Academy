"""Raw parameterised SQL helper (named binds only — DB-D20, S5.21).

Money and financial-history paths use raw, parameterised SQL with NUMERIC (ADR-003,
S5.28); CRUD uses the ORM. This helper enforces *named* binds (``:name``) so no caller
can ever build a string with interpolation — parameterisation is the only door in.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession


async def fetch_all(session: AsyncSession, sql: str, /, **params: Any) -> list[Row[Any]]:
    """Run a named-parameter query and return all rows."""
    result = await session.execute(text(sql), params)
    return list(result.fetchall())


async def fetch_one(session: AsyncSession, sql: str, /, **params: Any) -> Row[Any] | None:
    """Run a named-parameter query and return the first row (or None)."""
    result = await session.execute(text(sql), params)
    return result.first()


async def execute(session: AsyncSession, sql: str, /, **params: Any) -> int:
    """Run a named-parameter statement; return affected row count (-1 if unknown)."""
    result = await session.execute(text(sql), params)
    return result.rowcount
