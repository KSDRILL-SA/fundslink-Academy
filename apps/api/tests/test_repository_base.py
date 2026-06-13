"""Repository base layer — DB-D2 / TAD §3.5 (no DB required).

The institution-scoped base must make the *unscoped* path unreachable: it refuses to
construct without an institution_id, and every scoped query carries the bound id.
"""

import pytest

from app.db import BaseRepository, InstitutionScopedRepository


def test_base_repository_holds_session():
    sentinel = object()
    repo = BaseRepository(sentinel)  # type: ignore[arg-type]
    assert repo.session is sentinel


def test_institution_scope_requires_id():
    with pytest.raises(ValueError):
        InstitutionScopedRepository(object(), "")  # type: ignore[arg-type]


def test_institution_scope_injects_bound_id():
    repo = InstitutionScopedRepository(object(), "inst_abc")  # type: ignore[arg-type]
    assert repo.scope_clause() == "institution_id = :institution_id"
    assert repo.scope_clause("owner_institution_id") == "owner_institution_id = :institution_id"
    merged = repo.scoped_params(status="ACTIVE")
    assert merged == {"status": "ACTIVE", "institution_id": "inst_abc"}
