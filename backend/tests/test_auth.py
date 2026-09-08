import secrets

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.auth import COOKIE, digest
from app.config import Settings
from app.main import create_app
from app.models import Account, AuthSession, StoredUpload


def start(client):
    data = client.get("/api/session").json()
    client.headers["X-CSRF-Token"] = data["csrf_token"]
    return data


def change(client, path, body=None):
    response = client.post("/api/auth/" + path, json=body)
    if response.is_success:
        client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    return response


def test_accounts_survive_restart_and_recovery_revokes_sessions(tmp_path):
    config = Settings(database_url=f"sqlite:///{tmp_path / 'accounts.db'}", storage_backend="database")
    app = create_app(config)
    username = "analyst_" + secrets.token_hex(4)
    credentials = dict(username=username, password="a-long-secret-password")
    with TestClient(app) as first, TestClient(app) as other:
        start(first)
        start(other)
        guest_cookie = first.cookies.get(COOKIE)
        report = first.post("/api/sample").json()["id"]
        registration = change(first, "register", {**credentials, "name": "Analyst"})
        assert registration.status_code == 201, registration.text
        code = registration.json()["recovery_code"]
        assert registration.json()["user"]["username"] == username
        assert first.cookies.get(COOKIE) != guest_cookie
        assert first.get("/api/reports").json()[0]["id"] == report
        assert other.get(f"/api/reports/{report}").status_code == 404
        assert change(other, "login", {**credentials, "password": "wrong"}).status_code == 401
        assert change(other, "login", credentials).status_code == 200
        assert (
            other.get(f"/api/reports/{report}/chart?category=department&aggregation=count").status_code == 200
        )
        assert change(first, "logout").status_code == 200
        assert first.get("/api/reports").json() == []
        guest_report = first.post("/api/sample").json()["id"]
        reset = change(
            first, "recover", {**credentials, "password": "a-new-secret-password", "recovery_code": code}
        )
        assert reset.status_code == 200, reset.text
        assert reset.json()["recovery_code"] != code
        assert {r["id"] for r in first.get("/api/reports").json()} == {report, guest_report}
        assert other.get("/api/reports").status_code == 401
        start(other)
        assert change(other, "recover", {**credentials, "recovery_code": code}).status_code == 400
        assert change(other, "login", credentials).status_code == 401
        assert change(other, "login", {**credentials, "password": "a-new-secret-password"}).status_code == 200
        saved_cookie = other.cookies.get(COOKIE)
    with TestClient(create_app(config)) as reopened:
        reopened.cookies.set(COOKIE, saved_cookie)
        assert start(reopened)["user"]["username"] == username
        assert (
            reopened.get(f"/api/reports/{report}/chart?category=department&aggregation=count").status_code
            == 200
        )
    with Session(create_engine(config.database_url)) as db:
        account = db.scalar(select(Account))
        assert "a-new-secret-password" not in account.password_hash
        assert account.recovery_hash != code
        assert db.get(AuthSession, digest(guest_cookie)) is None
        assert db.scalar(select(StoredUpload)).content.startswith(b"record_id,")


def test_auth_validation_csrf_and_throttle(tmp_path):
    app = create_app(Settings(database_url=f"sqlite:///{tmp_path / 'auth.db'}", storage_backend="database"))
    with TestClient(app) as client, TestClient(app) as duplicate:
        start(client)
        start(duplicate)
        body = {"username": "Test_User", "name": "Test", "password": "long-enough-password"}
        assert client.post("/api/auth/register", json={**body, "password": "short"}).status_code == 422
        assert (
            client.post("/api/auth/register", json=body, headers={"X-CSRF-Token": "wrong"}).status_code == 403
        )
        assert change(client, "register", body).status_code == 201
        assert start(client)["user"]["username"] == "test_user"
        assert change(duplicate, "register", {**body, "username": "test_user"}).status_code == 409
        for _ in range(10):
            assert change(duplicate, "login", {"username": "nobody", "password": "wrong"}).status_code == 401
        assert change(duplicate, "login", {"username": "nobody", "password": "wrong"}).status_code == 429


def test_guest_migration_respects_workspace_quota(tmp_path):
    config = Settings(
        database_url=f"sqlite:///{tmp_path / 'quota.db'}",
        storage_backend="database",
        max_reports_per_session=1,
    )
    with TestClient(create_app(config)) as client:
        start(client)
        client.post("/api/sample")
        body = {"username": "analyst", "name": "Test", "password": "long-enough-password"}
        assert change(client, "register", body).status_code == 201
        change(client, "logout")
        guest_report = client.post("/api/sample").json()["id"]
        assert change(client, "login", body).status_code == 409
        assert client.get("/api/reports").json()[0]["id"] == guest_report
        assert change(client, "login", {**body, "keep_reports": False}).status_code == 200
