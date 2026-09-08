"""Exercise the deployed API with a synthetic, private QA account. Never prints credentials."""

import secrets
import sys

import httpx

origin = sys.argv[1].rstrip("/")
if not origin.startswith("https://"):
    raise SystemExit("A public HTTPS origin is required.")


def session(client):
    response = client.get("/api/session")
    response.raise_for_status()
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    return response.json()


def auth(client, action, body=None):
    response = client.post("/api/auth/" + action, json=body)
    response.raise_for_status()
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    return response.json()


with (
    httpx.Client(base_url=origin, timeout=90) as a,
    httpx.Client(base_url=origin, timeout=90) as b,
):
    assert a.get("/").status_code == 200
    health = a.get("/api/health")
    health.raise_for_status()
    assert health.json()["database"] == "ready"
    print("Public frontend and database health passed.", flush=True)
    assert session(a)["max_upload_mb"] == 3
    session(b)
    assert "Secure" in b.get("/api/session").headers.get("set-cookie", "") or b.cookies
    data = b"record_id,department,amount\n001,Science,20\n002,Arts,30\n002,Arts,30\n"
    upload = a.post(
        "/api/reports", files={"file": ("verification.csv", data, "text/csv")}
    )
    upload.raise_for_status()
    report_id = upload.json()["id"]
    assert upload.json()["profile"]["row_count"] == 3
    assert b.get("/api/reports/" + report_id).status_code == 404
    credentials = {
        "username": "qa_" + secrets.token_hex(6),
        "password": secrets.token_urlsafe(24),
    }
    created = auth(a, "register", {**credentials, "name": "Deployment verification"})
    assert a.get("/api/reports").json()[0]["id"] == report_id
    auth(b, "login", credentials)
    assert b.get("/api/reports").json()[0]["id"] == report_id
    print(
        "CSV upload, private ownership, registration, and cross-device sign-in passed.",
        flush=True,
    )
    chart = b.get(
        f"/api/reports/{report_id}/chart",
        params={"category": "department", "metric": "amount", "aggregation": "sum"},
    )
    chart.raise_for_status()
    assert chart.json()["data"][0] == {"label": "Arts", "value": 60.0}
    cleaned = b.post(f"/api/reports/{report_id}/clean", json={})
    cleaned.raise_for_status()
    assert cleaned.json()["summary"]["cleaned_rows"] == 2
    exported = b.get(f"/api/reports/{report_id}/export")
    exported.raise_for_status()
    assert "001" in exported.text
    assert (
        b.get(f"/api/reports/{report_id}/export?format=json").json()["profile"][
            "row_count"
        ]
        == 3
    )
    print("Charts, cleaning, CSV export, and JSON report passed.", flush=True)
    auth(a, "logout")
    assert a.get("/api/reports").json() == []
    recovered = auth(
        a,
        "recover",
        {
            **credentials,
            "password": secrets.token_urlsafe(24),
            "recovery_code": created["recovery_code"],
        },
    )
    assert recovered["recovery_code"] != created["recovery_code"]
    assert b.get("/api/reports").status_code == 401
    assert a.get("/api/reports").json()[0]["id"] == report_id
    print("Sign-out, account recovery, and old-session revocation passed.", flush=True)
