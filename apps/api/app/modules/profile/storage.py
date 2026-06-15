"""Document storage adapter (ST-2.4 — separate serving origin + signed, expiring URLs).

Uploaded documents are NEVER served from the API origin: content on the app's own origin can
run in the app's security context (stored XSS via SVG/HTML — folded by the magic-byte allowlist
too). The adapter returns a ``storage_uri`` on a SEPARATE origin and mints short-lived
HMAC-signed retrieval URLs. v1 ships a content-addressed adapter; a real object store (S3/R2)
swaps in behind this seam without touching the service — same shape as the auth email adapter.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import time

from app.core.config import settings

logger = logging.getLogger("fundslink.profile.storage")


def _signing_key() -> bytes:
    """HMAC subkey for signed URLs — domain-separated from any encryption key (key separation)."""
    secret = settings.document_url_signing_key or settings.pii_encryption_key
    if not secret:
        raise RuntimeError("No document URL signing key configured (set DOCUMENT_URL_SIGNING_KEY)")
    return hashlib.sha256(b"fundslink.doc_url.v1|" + secret.encode("utf-8")).digest()


class DocumentStorage:
    """Adapter seam — a backend persists object bytes and addresses them on a separate origin."""

    async def put(self, *, key: str, data: bytes, content_type: str) -> str:  # pragma: no cover
        raise NotImplementedError

    def signed_url(self, storage_uri: str, *, ttl_seconds: int | None = None) -> str:
        """A time-boxed, tamper-evident retrieval URL (HMAC over uri|expiry)."""
        ttl = ttl_seconds if ttl_seconds is not None else settings.document_url_ttl_seconds
        expires = int(time.time()) + ttl
        sig = hmac.new(
            _signing_key(), f"{storage_uri}|{expires}".encode(), hashlib.sha256
        ).hexdigest()
        return f"{storage_uri}?expires={expires}&sig={sig}"


class SeparateOriginStorage(DocumentStorage):
    """v1 default: content-addressed objects on settings.document_storage_origin.

    The durable backend (object store) is wired at deploy; the default logs the intent rather
    than silently pretending durability, and returns the canonical storage_uri the row records.
    """

    async def put(self, *, key: str, data: bytes, content_type: str) -> str:
        uri = f"{settings.document_storage_origin.rstrip('/')}/d/{key}"
        logger.info(
            "[storage] object %s (%d bytes, %s) — durable backend wired at deploy",
            uri,
            len(data),
            content_type,
        )
        return uri


_adapter: DocumentStorage = SeparateOriginStorage()


def get_document_storage() -> DocumentStorage:
    return _adapter
