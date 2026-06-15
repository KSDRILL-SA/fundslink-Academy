"""Document upload pipeline (ST-2.4 — upload weaponization defences).

A student-uploaded file is hostile until proven otherwise. Before anything is stored we:
  1. enforce a hard size cap (DoS / storage exhaustion) — over it → 413;
  2. validate the *magic bytes* (never the client filename/Content-Type) against a strict
     allowlist — only PDF, PNG, JPEG. SVG/HTML/scripts (the stored-XSS vectors) are rejected;
  3. strip metadata (EXIF/XMP/comments) so an upload can't smuggle scripts or leak GPS/PII;
  4. sha256 the *sanitised* bytes for integrity + dedupe.
The antivirus scan runs out-of-band: av_status starts PENDING and a scanner flips it
CLEAN/INFECTED. A signed serving URL is only minted once av_status is CLEAN (service-enforced).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from app.common.errors import AppError

# Magic-byte signatures → canonical content type. The allowlist IS the policy; anything that
# doesn't match (SVG, HTML, scripts, archives) is refused.
_PDF = b"%PDF-"
_PNG = b"\x89PNG\r\n\x1a\n"
_JPEG = b"\xff\xd8\xff"

EXTENSION = {"application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg"}

# PNG chunks that carry metadata (and thus EXIF/text/script vectors) — dropped on ingest.
_PNG_METADATA_CHUNKS = {b"eXIf", b"tEXt", b"zTXt", b"iTXt", b"tIME"}


@dataclass(frozen=True)
class SanitisedFile:
    content_type: str
    data: bytes
    sha256: str


def sniff_type(data: bytes) -> str | None:
    """Return the canonical content type from the leading bytes, or None if not allowlisted."""
    if data.startswith(_PDF):
        return "application/pdf"
    if data.startswith(_PNG):
        return "image/png"
    if data.startswith(_JPEG):
        return "image/jpeg"
    return None


def _strip_jpeg(data: bytes) -> bytes:
    """Remove APPn (0xFFE0–0xFFEF) and COM (0xFFFE) segments — strips EXIF/XMP/comments."""
    if not data.startswith(_JPEG):
        return data
    out = bytearray(b"\xff\xd8")  # SOI
    i, n = 2, len(data)
    while i + 1 < n:
        if data[i] != 0xFF:  # not on a marker boundary — keep the remainder verbatim (defensive)
            out.extend(data[i:])
            break
        marker = data[i + 1]
        if marker == 0xD9:  # EOI
            out.extend(b"\xff\xd9")
            break
        if marker == 0xDA:  # SOS — copy this marker + all entropy-coded scan data verbatim
            out.extend(data[i:])
            break
        if 0xD0 <= marker <= 0xD7 or marker == 0x01:  # standalone markers (RSTn / TEM): no length
            out.extend(data[i : i + 2])
            i += 2
            continue
        if i + 3 >= n:
            out.extend(data[i:])
            break
        seg_end = i + 2 + ((data[i + 2] << 8) | data[i + 3])
        if seg_end > n:  # malformed length — keep remainder, stop
            out.extend(data[i:])
            break
        if not (0xE0 <= marker <= 0xEF or marker == 0xFE):  # keep everything except APPn / COM
            out.extend(data[i:seg_end])
        i = seg_end
    return bytes(out)


def _strip_png(data: bytes) -> bytes:
    """Drop metadata chunks (eXIf/tEXt/zTXt/iTXt/tIME); keep rendering chunks intact."""
    sig = _PNG
    if not data.startswith(sig):
        return data
    out = bytearray(sig)
    i, n = 8, len(data)
    while i + 8 <= n:
        length = int.from_bytes(data[i : i + 4], "big")
        ctype = data[i + 4 : i + 8]
        chunk_end = i + 12 + length  # 4 len + 4 type + data + 4 CRC
        if chunk_end > n:  # malformed — keep remainder, stop
            out.extend(data[i:])
            break
        if ctype not in _PNG_METADATA_CHUNKS:
            out.extend(data[i:chunk_end])
        i = chunk_end
        if ctype == b"IEND":
            break
    return bytes(out)


def process_upload(data: bytes, *, max_bytes: int) -> SanitisedFile:
    """Validate + sanitise raw upload bytes. Raises AppError (413/422) on rejection."""
    if len(data) > max_bytes:
        raise AppError(
            "payload_too_large",
            f"File exceeds the {max_bytes // (1024 * 1024)} MB limit",
            status_code=413,
        )
    if not data:
        raise AppError("empty_file", "The uploaded file is empty", status_code=422)
    content_type = sniff_type(data)
    if content_type is None:
        raise AppError(
            "unsupported_media_type",
            "Only PDF, PNG and JPEG documents are accepted",
            status_code=422,
        )
    if content_type == "image/jpeg":
        data = _strip_jpeg(data)
    elif content_type == "image/png":
        data = _strip_png(data)
    return SanitisedFile(
        content_type=content_type, data=data, sha256=hashlib.sha256(data).hexdigest()
    )
