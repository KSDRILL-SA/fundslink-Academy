"""Root test configuration.

Windows: psycopg's async driver refuses to run on the ``ProactorEventLoop``,
which is Python's default on this platform — so every async DB test failed
locally with ``InterfaceError: Psycopg cannot use the 'ProactorEventLoop'``
while passing in CI on Linux. That gap is worse than it sounds: it means a
Windows engineer cannot verify their own async work before pushing, and gets
into the habit of treating a red local suite as normal.

Selecting the selector loop on Windows costs nothing on Linux (the branch is
skipped) and makes the local run match CI.
"""

from __future__ import annotations

import asyncio
import sys

if sys.platform == "win32":  # pragma: no cover — platform-specific
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
