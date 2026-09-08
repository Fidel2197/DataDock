"""Exercise a running same-origin frontend proxy/API without controlling a browser."""
import io
import json

import httpx
import pandas as pd

with httpx.Client(base_url="http://127.0.0.1:5178", timeout=60) as client:
    assert client.get("/").status_code == 200
    response = client.get("/api/session")
    response.raise_for_status()
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    response = client.post("/api/sample")
    response.raise_for_status()
    report = response.json()
    report_id = report["id"]
    rows = client.get(f"/api/reports/{report_id}/rows?issues_only=true").json()
    assert rows["total"] == 29
    response = client.post(f"/api/reports/{report_id}/clean", json={})
    response.raise_for_status()
    exported = client.get(f"/api/reports/{report_id}/export")
    exported.raise_for_status()
    assert len(pd.read_csv(io.BytesIO(exported.content))) == 240
    chart = client.get(f"/api/reports/{report_id}/chart?category=department&metric=actual_usd&aggregation=sum")
    chart.raise_for_status()
    assert chart.json()["data"]
    assert client.get("/api/reports").json()[0]["id"] == report_id
    print(json.dumps({"result": "passed", "path": "Vite same-origin proxy → FastAPI → SQLite + local files", "sample_rows": report["row_count"], "flagged_rows": rows["total"], "export_rows": 240, "chart_groups": len(chart.json()["data"]), "history": "persisted", "note": "HTTP smoke test; not a browser visual test or AWS deployment test."}, indent=2))
