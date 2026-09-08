# Vercel deployment

The frontend is a static React/Vite build. `api/index.py` exposes the same FastAPI application used by Docker. Vercel routes `/api/*` to that function and serves the assets from `frontend/dist`.

## Runtime

- Python 3.12; root `requirements.txt` contains production dependencies only.
- `DATABASE_URL` must refer to a dedicated PostgreSQL database. Neon marketplace can provision its free plan and inject this variable. The app converts standard PostgreSQL URLs to the psycopg SQLAlchemy dialect while preserving connection parameters.
- On Vercel, secure cookies and database-backed original uploads are automatic. There is no ephemeral SQLite fallback.
- The 3 MB request limit leaves space below Vercel's 4.5 MB function payload ceiling. Analysis is bounded to 100,000 rows, 64 columns, and one million cells.
- SQLAlchemy initializes missing tables at startup. Changes to existing columns require explicit migrations.

## Publish

1. Link the project with Vercel CLI.
2. Install a dedicated Neon database on the free plan. The account owner must accept provider terms. Connect it to the DataDock project and production environment.
3. Confirm `DATABASE_URL` exists using `vercel env ls`; never commit its value.
4. Run the backend and frontend checks, then `vercel --prod`.
5. Verify `/api/health`, guest uploads, account registration, sign-out/sign-in, private report access, charts, cleaning, and downloads on the public origin.

The Python worker and database are placed in US East. This deployment does not provision AWS EC2 or S3. Those remain an alternative described in the AWS runbook.
