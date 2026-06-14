"""Refresh-token crypto primitives (S3.13)."""

import hashlib

from app.modules.auth import tokens


def test_new_refresh_token_returns_raw_and_matching_hash():
    raw, token_hash = tokens.new_refresh_token()
    assert token_hash == hashlib.sha256(raw.encode()).hexdigest()
    assert len(raw) >= 64  # high entropy


def test_tokens_are_unique():
    raw1, h1 = tokens.new_refresh_token()
    raw2, h2 = tokens.new_refresh_token()
    assert raw1 != raw2 and h1 != h2


def test_hash_is_deterministic():
    assert tokens.hash_refresh_token("abc") == tokens.hash_refresh_token("abc")
