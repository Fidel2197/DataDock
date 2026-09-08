import io
import os

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def app(tmp_path):
    return create_app(
        Settings(
            database_url=os.getenv("TEST_DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}"),
            storage_dir=tmp_path / "uploads",
        )
    )


def session(client):
    response = client.get("/api/session")
    assert response.status_code == 200
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]


def test_full_flow_ownership_pagination_export_and_history(app):
    with TestClient(app) as a, TestClient(app) as b:
        session(a)
        session(b)
        created = a.post("/api/sample")
        assert created.status_code == 201, created.text
        report = created.json()
        report_id = report["id"]
        assert a.post("/api/sample").json()["id"] == report_id
        assert a.get("/api/health").json()["database"] == "ready"
        assert len(a.get("/api/reports").json()) == 1
        assert b.get("/api/reports").json() == []
        for suffix in ["", "/rows", "/export?format=json", "/chart?category=department&aggregation=count"]:
            assert b.get(f"/api/reports/{report_id}{suffix}").status_code == 404
        assert b.post(f"/api/reports/{report_id}/clean", json={}).status_code == 404
        rows = a.get(f"/api/reports/{report_id}/rows?page=2&page_size=25").json()
        assert len(rows["rows"]) == 25
        assert rows["rows"][0]["row_number"] == 26
        assert rows["total"] == 246
        flagged = a.get(f"/api/reports/{report_id}/rows?issues_only=true").json()
        assert flagged["total"] == 29
        assert all(r["issues"] for r in flagged["rows"])
        found = a.get(f"/api/reports/{report_id}/rows?search=RS-0001").json()
        assert found["total"] == 1
        assert a.get(f"/api/reports/{report_id}/rows?search=%25").json()["total"] == 0
        assert a.get(f"/api/reports/{report_id}/rows?page_size=1000").status_code == 422
        assert a.get(f"/api/reports/{report_id}/export").status_code == 409
        cleaned = a.post(f"/api/reports/{report_id}/clean", json={}).json()
        assert cleaned["summary"]["cleaned_rows"] == 240
        exported = a.get(f"/api/reports/{report_id}/export")
        assert exported.status_code == 200
        frame = pd.read_csv(io.BytesIO(exported.content))
        assert len(frame) == 240
        assert a.get(f"/api/reports/{report_id}/export?format=json").json()["profile"]["row_count"] == 246
        assert a.get("/api/reports").json()[0]["clean_summary"]["duplicates_removed"] == 6
        chart = a.get(f"/api/reports/{report_id}/chart?category=department&metric=budget_usd&aggregation=sum")
        assert chart.status_code == 200
        assert len(chart.json()["data"]) == 6
        assert a.get(f"/api/reports/{report_id}/chart?category=bad&aggregation=count").status_code == 422
        cookie = a.cookies.get("datadock_session")
    with TestClient(app) as reopened:
        reopened.cookies.set("datadock_session", cookie)
        assert reopened.get(f"/api/reports/{report_id}").status_code == 200


def test_upload_validation_and_csrf(app):
    with TestClient(app) as client:
        assert client.post("/api/sample").status_code == 401
        response = client.get("/api/session")
        assert "HttpOnly" in response.headers["set-cookie"]
        assert "SameSite=strict" in response.headers["set-cookie"]
        assert client.post("/api/sample").status_code == 403
        session(client)
        for filename, content, status in [
            ("bad.xlsx", b"a,b\n1,2", 422),
            ("bad.csv", b"a,b\n1,2,3", 422),
            ("big.csv", b"a" * (10 * 1024 * 1024 + 1), 413),
        ]:
            result = client.post("/api/reports", files={"file": (filename, content, "text/csv")})
            assert result.status_code == status
        result = client.post(
            "/api/reports", files={"file": ("actual.csv", b"id,amount\n001,10\n002,20", "text/csv")}
        )
        assert result.status_code == 201
        assert result.json()["profile"]["row_count"] == 2


def test_secure_cookie_setting(tmp_path):
    app = create_app(
        Settings(
            database_url=f"sqlite:///{tmp_path / 'secure.db'}", storage_dir=tmp_path, secure_cookies=True
        )
    )
    with TestClient(app, base_url="https://testserver") as client:
        assert "Secure" in client.get("/api/session").headers["set-cookie"]
