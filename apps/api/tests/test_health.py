"""Liveness test for the scaffold (S7.1 — tests alongside code)."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_healthz_returns_ok_envelope():
    resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["status"] == "ok"
    assert body["error"] is None
