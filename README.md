# DataDock

A working data quality and reporting portal built for research assistants and operations analysts. Upload a messy CSV, inspect row-level issues, compare categories, and download a cleaned copy without changing the original.

**Stack:** React 19, TypeScript, TanStack Query, Recharts, FastAPI, pandas, NumPy, SQLAlchemy. PostgreSQL in Docker; SQLite for the local preview. AWS deployment configuration uses EC2, private S3, IAM, Systems Manager, and Nginx. GitLab CI checks, builds, publishes immutable containers, and offers a manual production deployment with rollback.

## Try the application

1. Open **Uploads** and select **Explore sample**.
2. The sample contains 246 synthetic research spending records: 12 missing cells, 6 duplicates, 3 invalid numeric values, 2 outlier suggestions, and 6 cells with extra spaces.
3. On **Data review**, select **Issues only**, search `pending`, or expand a flagged row.
4. Apply cleaning options. The default options retain 240 records. Missing data and unusual numbers remain for human review.
5. Open **Dashboard** and compare actual spending by department. Change the measure, grouping, and aggregation.
6. Download the cleaned CSV or JSON report, then reopen the report from **Report history**.

The sample is synthetic. There are no invented customers, clearance claims, or simulated production statistics.

## Local development

Requirements: Python 3.12 and Node 24. From this project directory:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd frontend
npm ci
cd ..
.\scripts\start-local.ps1
```

Open http://127.0.0.1:5178/. API listens at http://127.0.0.1:8010, with OpenAPI at `/api/openapi.json`. The Vite proxy keeps cookies and API requests on the same origin. Servers run as hidden processes; `.local/processes.json` and `.local/*log` identify them. Do not run the starter twice on the same ports.

Cross-platform manual commands, in separate terminals:

```bash
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8010
cd frontend && npm run dev
```

## Run with Docker and PostgreSQL

Copy `.env.example` to `.env`. Set `POSTGRES_PASSWORD` to a generated random hexadecimal value. Then:

```bash
docker compose up --build -d --wait
```

Open http://localhost:8080/. Only Nginx is bound to localhost; database and API are internal. Named volumes preserve PostgreSQL and uploads across restarts. `docker compose down` stops services without deleting volumes.

## Verification

```bash
cd backend
python -m ruff check .
python -m ruff format --check .
python -m pytest
cd ../frontend
npm run build
```

See [verification](docs/verification.md) for checks actually run, and [performance](docs/performance.md) for measured results and their limits. Source files are formatted with Ruff and Prettier.

## Design and behavior

- Four focused views with hash navigation, browser back/forward, and dataset switching.
- TanStack Query handles remote state, caching, loading, errors, and mutation invalidation. React owns filters and export options.
- Charts are lazy-loaded; table reads are paginated and indexed by report/row. Search is debounced and performed on the server.
- Uploads are UTF-8 CSV, at most 10 MB, 100,000 records, 64 columns, and one million cells. Large/wide inputs are rejected with an explanation.
- Duplicates compare all trimmed fields. Numeric inference needs 80% finite numeric values and excludes identifiers. Outliers use the 1.5× IQR rule and are suggestions, not mistakes to erase.
- Headers, leading-zero identifiers, quoted multiline fields, and literal `NA`/`null` are preserved. Only blank or whitespace-only cells count as missing.
- Export cleaning is opt-in and repeatable. Formula-like strings in CSV exports receive an apostrophe for safer spreadsheet opening; finite negative numbers remain numeric.
- Reports belong to a random HttpOnly browser session cookie. SQL queries enforce ownership on every report route. Writes require a CSRF token. Clearing the cookie loses access to that workspace; this is not a named-account authentication system.

## Architecture and deployment

See [architecture](docs/architecture.md), [AWS runbook](docs/aws-deployment.md), and [development backlog](docs/backlog.md).

**Deployment status:** working local application and build; AWS resources and GitLab pipeline execution are pending account setup. Configuration files are evidence of implementation, not evidence of having operated a live AWS service. Future résumé claims should distinguish these stages.

This is a bounded portfolio application, not a regulated-data platform. It has session quotas and upload limits. Long-running jobs, cross-device accounts, shared workspaces, retention automation, and high-availability infrastructure are outside version 1. Do not upload confidential records to a public demo.
