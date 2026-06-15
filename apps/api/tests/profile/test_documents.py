"""Document upload pipeline — ST-2.4 (upload weaponization defences) + ownership (ST-2.3).

Covers both the HTTP endpoint (uploadDocument) and the pure pipeline (process_upload), so the
sanitisation logic is asserted directly and through the stack. Behaviour-named tests (S7.5).
"""

from __future__ import annotations

import hashlib

import pytest

from app.common.errors import AppError
from app.modules.profile.documents import process_upload, sniff_type
from tests.profile.conftest import BASE, bearer, register_student, valid_profile

DOCS = f"{BASE}/students/me/documents"
PROFILE = f"{BASE}/students/me/profile"

# --- minimal valid magic-byte payloads ---
PDF = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
PNG = (
    b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + b"\x00" * 13
    + b"\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _ensure_profile(client, token):
    assert client.put(PROFILE, headers=bearer(token), json=valid_profile()).status_code == 200


def _upload(
    client, token, *, content, filename="doc.pdf", content_type="application/pdf",
    doc_type="ID_DOCUMENT", **data,
):
    return client.post(
        DOCS,
        headers=bearer(token),
        files={"file": (filename, content, content_type)},
        data={"doc_type": doc_type, **data},
    )


# --------------------------------- endpoint behaviour ---------------------------------
def test_upload_pdf_succeeds_with_av_pending(profile_client):
    token, _ = register_student(profile_client)
    _ensure_profile(profile_client, token)
    resp = _upload(profile_client, token, content=PDF)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["doc_type"] == "ID_DOCUMENT"
    assert body["av_status"] == "PENDING"  # AV scan is out-of-band (ST-2.4)
    assert body["id"]


def test_upload_requires_a_profile_first(profile_client):
    token, _ = register_student(profile_client)  # no profile yet
    resp = _upload(profile_client, token, content=PDF)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "profile_required"


def test_upload_requires_authentication(profile_client):
    resp = profile_client.post(
        DOCS, files={"file": ("x.pdf", PDF, "application/pdf")}, data={"doc_type": "ID_DOCUMENT"}
    )
    assert resp.status_code == 401


def test_upload_rejects_svg_stored_xss_vector_st_2_4(profile_client):
    """An SVG (the classic stored-XSS payload) is refused by the magic-byte allowlist."""
    token, _ = register_student(profile_client)
    _ensure_profile(profile_client, token)
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    resp = _upload(
        profile_client, token, content=svg, filename="x.svg", content_type="image/svg+xml"
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "unsupported_media_type"


def test_upload_rejects_html_disguised_as_pdf_st_2_4(profile_client):
    """A client-supplied Content-Type is never trusted — the bytes decide."""
    token, _ = register_student(profile_client)
    _ensure_profile(profile_client, token)
    html = b"<!DOCTYPE html><html><body><script>steal()</script></body></html>"
    resp = _upload(profile_client, token, content=html, filename="evil.pdf")
    assert resp.status_code == 422


def test_upload_rejects_oversized_file_413_st_2_4(profile_client, monkeypatch):
    from app.core.config import settings

    token, _ = register_student(profile_client)
    _ensure_profile(profile_client, token)
    monkeypatch.setattr(settings, "document_max_bytes", 64)
    oversized = PDF + b"\x00" * 256
    resp = _upload(profile_client, token, content=oversized, filename="big.pdf")
    assert resp.status_code == 413
    assert resp.json()["error"]["code"] == "payload_too_large"


def test_upload_to_unowned_application_is_rejected_st_2_3(profile_client):
    """A document may only be attached to the uploader's own application (ownership, ST-2.3)."""
    token, _ = register_student(profile_client)
    _ensure_profile(profile_client, token)
    resp = _upload(
        profile_client, token, content=PDF, filename="id.pdf",
        content_type="application/pdf", application_id="nonexistent_app_id",
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "invalid_application"


# --------------------------------- pipeline unit tests ---------------------------------
def test_sniff_type_allowlist():
    assert sniff_type(PDF) == "application/pdf"
    assert sniff_type(PNG) == "image/png"
    assert sniff_type(b"\xff\xd8\xff\xe0junk") == "image/jpeg"
    assert sniff_type(b"<svg></svg>") is None
    assert sniff_type(b"GIF89a") is None  # not on the allowlist


def test_process_upload_computes_sha256_of_sanitised_bytes():
    out = process_upload(PDF, max_bytes=1024)
    assert out.content_type == "application/pdf"
    assert out.sha256 == hashlib.sha256(PDF).hexdigest()  # PDFs are passed through unchanged


def test_process_upload_strips_jpeg_exif_metadata_st_2_4():
    """A JPEG carrying an APP1/EXIF block (with a GPS secret) has it removed on ingest."""
    exif_payload = b"Exif\x00\x00" + b"GPS_SECRET_LOCATION"
    app1 = b"\xff\xe1" + (len(exif_payload) + 2).to_bytes(2, "big") + exif_payload
    scan = b"\xff\xda\x00\x02\x00" + b"imagebytes" + b"\xff\xd9"  # SOS … EOI
    jpeg = b"\xff\xd8" + app1 + scan
    assert sniff_type(jpeg) == "image/jpeg"
    out = process_upload(jpeg, max_bytes=4096)
    assert b"GPS_SECRET_LOCATION" not in out.data  # EXIF stripped
    assert b"Exif" not in out.data
    assert b"imagebytes" in out.data  # actual image data preserved
    assert len(out.data) < len(jpeg)


def test_process_upload_rejects_empty_and_oversized():
    with pytest.raises(AppError) as empty:
        process_upload(b"", max_bytes=1024)
    assert empty.value.status_code == 422
    with pytest.raises(AppError) as big:
        process_upload(PDF + b"\x00" * 10_000, max_bytes=128)
    assert big.value.status_code == 413


def _png_chunk(ctype: bytes, data: bytes) -> bytes:
    return len(data).to_bytes(4, "big") + ctype + data + b"\x00\x00\x00\x00"  # CRC unchecked here


def test_process_upload_strips_png_text_metadata_st_2_4():
    """A PNG carrying a tEXt metadata chunk has it removed; rendering chunks are preserved."""
    png = (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", b"\x00" * 13)
        + _png_chunk(b"tEXt", b"Comment\x00secret-metadata-payload")
        + _png_chunk(b"IDAT", b"\x01\x02\x03")
        + _png_chunk(b"IEND", b"")
    )
    assert sniff_type(png) == "image/png"
    out = process_upload(png, max_bytes=4096)
    assert b"secret-metadata-payload" not in out.data  # tEXt stripped
    assert b"IDAT" in out.data and b"\x01\x02\x03" in out.data  # image data kept
    assert b"IHDR" in out.data and out.data.endswith(b"IEND" + b"\x00\x00\x00\x00")


def test_signed_url_is_time_boxed_and_signed(rs256_keys):
    """Retrieval URLs are HMAC-signed with an expiry — served from the separate origin."""
    from app.modules.profile.storage import get_document_storage

    url = get_document_storage().signed_url(
        "https://files.fundslink.academy/d/u/abc.pdf", ttl_seconds=120
    )
    assert url.startswith("https://files.fundslink.academy/d/u/abc.pdf?")
    assert "expires=" in url and "sig=" in url
