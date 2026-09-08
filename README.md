# DataDock

A working data quality and reporting portal built for research assistants and operations analysts. Upload a messy CSV, inspect row-level issues, compare categories, and download a cleaned copy without changing the original.

**Stack:** React 19, TypeScript, TanStack Query, Recharts, FastAPI, pandas, NumPy, SQLAlchemy, and PostgreSQL. The Vercel deployment runs the actual Python API and stores accounts, reports, rows, and original uploads in a dedicated hosted PostgreSQL database. Docker Compose and an alternative AWS EC2/S3 deployment are also configured.

**Publication status:** source and production configuration are ready; activating the hosted database requires the account owner to accept Neon's marketplace terms. The public app link will be added after deployment verification.

## Try the application

1. Open **Uploads**, bring your own CSV, or select **Open example**.
2. The sample contains 246 synthetic research spending records: 12 missing cells, 6 duplicates, 3 invalid numeric values, 2 outlier suggestions, and 6 cells with extra spaces.
3. On **Data review**, select **Issues only**, search `pending`, or expand a flagged row.
4. Apply cleaning options. The default options retain 240 records. Missing data and unusual numbers remain for human review.
5. Open **Dashboard** and compare actual spending by department. Change the measure, grouping, and aggregation.
6. Download the cleaned CSV or JSON report, then reopen the report from **Report history**.

The included example is synthetic. **Quick guide** explains each step. **Your account** lets visitors register, sign in, or recover their password with a private recovery code; guests can continue without an account.

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

- Six focused views: uploads, data review, dashboard, report history, quick guide, and account.
- TanStack Query handles remote state, caching, loading, errors, and mutation invalidation. React owns filters and export options.
- Charts are lazy-loaded; table reads are paginated and indexed by report/row. Search is debounced and performed on the server.
- Hosted uploads are UTF-8 CSV, at most 3 MB, 100,000 records, 64 columns, and one million cells. The local/Docker default is 10 MB. The API supplies the active limit to the interface.
- Duplicates compare all trimmed fields. Numeric inference needs 80% finite numeric values and excludes identifiers. Outliers use the 1.5× IQR rule and are suggestions, not mistakes to erase.
- Headers, leading-zero identifiers, quoted multiline fields, and literal `NA`/`null` are preserved. Only blank or whitespace-only cells count as missing.
- Export cleaning is opt-in and repeatable. Formula-like strings in CSV exports receive an apostrophe for safer spreadsheet opening; finite negative numbers remain numeric.
- Reports belong to a guest session or named account. Each report route checks ownership. Sessions use opaque HttpOnly cookies, database-side revocation, a 30-day expiry, and CSRF protection. Vercel always uses Secure cookies.
- Passwords use scrypt with random salts. Account recovery uses a high-entropy, one-time recovery code stored only as a hash. Resetting a password rotates that code and revokes other sessions. No email delivery is required.
- Signing in can transfer current guest reports into the account. Auth transitions clear cached report data, and account operations are rate-limited in the database.

## Architecture and deployment

See [architecture](docs/architecture.md), [Vercel deployment](docs/vercel-deployment.md), [AWS runbook](docs/aws-deployment.md), and [development backlog](docs/backlog.md).

GitHub Actions runs Python tests against PostgreSQL, frontend checks, and container builds. The GitLab pipeline additionally configures immutable image publication and a manual AWS rollout with rollback. AWS resources and GitLab pipeline execution have not been deployed or operated; the repository documents this distinction.

Workspaces have a 30-report limit. Shared teams, background jobs, email recovery, and retention automation are not implemented. Guest access depends on the browser cookie; an account preserves access across devices. Save the recovery code when creating an account.
