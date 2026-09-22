# DataDock

DataDock is a data quality and reporting application built with React, TypeScript, and Python. Upload a CSV, inspect missing values and duplicates, explore charts, and download a cleaned copy while keeping the original file intact.

## Links

- [Open DataDock](https://datadock-fidel2197.vercel.app/)
- [Quick guide](https://datadock-fidel2197.vercel.app/#guide)
- [Repository](https://github.com/Fidel2197/DataDock)
- [Project page](https://fidel-portfolio-eta.vercel.app/datadock.html)

## Overview

DataDock helps research assistants and operations analysts understand a spreadsheet before using it in a report. It combines row-level quality checks with filtering, charts, and optional cleanup steps. Visitors can start as guests or create an account to keep reports available across devices.

The live application runs on Vercel with a FastAPI backend and hosted PostgreSQL database. Accounts, reports, rows, and original uploads are stored in the database. Docker Compose and AWS deployment configurations are also included as alternative hosting options.

## Features

- CSV uploads with file-size, row, column, and header validation
- Missing-value, duplicate, whitespace, and numeric-quality checks
- Searchable, paginated tables with row-level issue details
- Charts with selectable measures, grouping, and aggregation
- Optional cleanup with CSV and JSON exports
- Guest workspaces and account-based report history
- Password recovery through a private, one-time recovery code
- Ownership checks, revocable sessions, and account-isolation tests
- Responsive layout, collapsible navigation, and an in-app guide
- Lazy-loaded charts, cached remote state, and server-side filtering

## Technologies Used

- React 19, TypeScript, and Vite
- TanStack Query for remote state and Recharts for visualization
- Python, FastAPI, pandas, and NumPy
- SQLAlchemy and PostgreSQL; SQLite for local development
- Docker Compose and Nginx for the containerized hosting option
- pytest, Ruff, Vitest, and GitHub Actions
- Vercel and Neon PostgreSQL for the live deployment

## Using DataDock

1. Open **Uploads** and choose a CSV, or select **Open example** to use the included synthetic dataset.
2. Review the quality summary and use **Issues only** to inspect flagged rows.
3. Choose cleanup options, such as trimming spaces or removing duplicate rows.
4. Open **Dashboard** to compare categories and change the chart measure or aggregation.
5. Download a cleaned CSV or JSON report. Saved reports remain available in **Report history**.

Cleaning is optional. Missing values and unusual numbers remain available for review rather than being filled or removed automatically. Create an account for cross-device access, and keep the recovery code somewhere safe.

## Project Structure

```text
DataDock/
  frontend/        # React interface and frontend tests
  backend/         # FastAPI application, analysis, storage, and tests
  api/             # Vercel Python entry point
  deploy/          # Nginx, AWS, and release configuration
  scripts/         # Development, smoke checks, and benchmarks
  docs/            # Architecture, deployment, and performance documentation
  compose.yml      # Local Docker stack
```

## Getting Started

Use Python 3.12 and Node.js 24.

```bash
git clone https://github.com/Fidel2197/DataDock.git
cd DataDock
python -m venv .venv
```

Activate the virtual environment (`source .venv/bin/activate` on macOS/Linux or `.\.venv\Scripts\Activate.ps1` in PowerShell), then install dependencies:

```bash
python -m pip install -r backend/requirements.txt
cd frontend
npm ci
cd ..
```

Start the API from the repository root:

```bash
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8010
```

In another terminal, start the interface:

```bash
cd frontend
npm run dev
```

Open [localhost:5178](http://127.0.0.1:5178/). Vite proxies `/api` to the backend at port 8010. Local development uses SQLite and filesystem storage by default; API documentation is available at `/api/openapi.json`.

On Windows, `scripts/start-local.ps1` can start both servers after dependencies are installed. Its process IDs and logs are written to `.local/`.

### Docker and PostgreSQL

Copy `.env.example` to `.env` and set `POSTGRES_PASSWORD` to a generated random hexadecimal value.

```bash
docker compose up --build -d --wait
```

Open [localhost:8080](http://localhost:8080/). Nginx serves the application; the API and database stay on the internal container network. Named volumes preserve data when services restart. `docker compose down` stops the stack without deleting those volumes.

## Tests and Production Build

With the Python virtual environment active:

```bash
cd backend
python -m ruff check .
python -m ruff format --check .
python -m pytest
cd ../frontend
npm test
npm run build
```

GitHub Actions runs backend tests against PostgreSQL, frontend checks, and container builds. Tests cover analysis rules, uploads, report ownership, authentication, sessions, and storage behavior. See the [verification notes](docs/verification.md) and [performance results](docs/performance.md) for additional details.

## Data and Accounts

- Every report belongs to a guest session or named account, and report routes check ownership.
- Passwords use salted scrypt hashes. Sessions use HttpOnly cookies, CSRF protection, expiry, and database-side revocation.
- Recovery uses a hashed, one-time code rather than email. Resetting a password rotates the code and revokes other sessions.
- Signing in can transfer guest reports to the account. Without an account, access depends on the browser's session cookie.
- Headers, leading-zero identifiers, quoted multiline fields, and literal `NA`/`null` values are preserved. Formula-like export values receive an apostrophe for safer spreadsheet opening.

## Deployment and Limitations

The live deployment uses Vercel and Neon PostgreSQL. See the [Vercel setup](docs/vercel-deployment.md), [architecture](docs/architecture.md), and [AWS runbook](docs/aws-deployment.md) for hosting details. The AWS EC2/S3 templates and GitLab deployment pipeline are configuration examples; they have not been deployed or operated for this application.

Hosted CSV uploads are limited to 3 MB, 100,000 rows, 64 columns, and one million cells. Local and Docker installations default to a 10 MB upload limit. Workspaces support up to 30 reports. Shared teams, background processing, email recovery, and automatic retention are not implemented.

Numeric inference uses heuristics, and outlier flags are suggestions for review. Charts summarize the original data; export cleanup does not overwrite that source.

## Author

Built by Fidel Anyanwu.
