# Verification record

## Completed locally

- **21 Python tests passed** against temporary SQLite databases: profiling, cleaning, preserved originals, validation, formula-safe export, session isolation, CSRF, pagination, escaped search, charts, storage adapters, account registration/login, password recovery, old-session revocation, cross-device report access, durable original files, recovery-code rotation, auth throttling, and migration quota enforcement.
- **3 frontend tests passed**: CSRF header propagation with same-origin cookies, actionable API errors, and safe fallback handling for an HTML proxy error.
- **TypeScript and Vite production build passed.** The dashboard and chart dependencies are separate lazy-loaded chunks.
- **Ruff lint/format passed** for backend source/tests; frontend source formatted with Prettier.
- **HTTP smoke test passed** through the running Vite proxy to FastAPI and SQLite/local storage: 246-row sample, 29 flagged rows, saved cleaning options, 240-row CSV download, category chart, and persisted history.
- **AWS CloudFormation static lint passed** for the EC2/S3 template and optional GitLab OIDC deployment-role template.
- **Performance microbenchmark recorded** with matching baseline/vectorized results; see performance.md and benchmark-results.json.

S3 tests use botocore's Stubber and verify exact requests/encryption settings. They do not send requests to AWS or prove live IAM access.

## Not yet completed

- Docker image builds, Nginx runtime checks, and Docker Compose execution: Docker is not installed in the build environment.
- PostgreSQL runtime tests: configured as a GitLab CI service; not executed locally.
- Actual GitLab pipeline, container registry publishing, remote deploy, rollback, and recovery drills.
- AWS resource creation, S3 live upload, TLS, DNS, cost controls, deployment health, and account-level IAM validation.
- Browser interaction, visual, accessibility audit, or real-device testing. The local preview was opened, but no browser QA was performed.

The Python suite emits two dependency deprecation warnings from Starlette/AnyIO's test-client integration; tests still pass. These are recorded rather than hidden.

## Reproduce

```bash
cd backend
python -m ruff check .
python -m ruff format --check .
python -m pytest
cd ../frontend
npm test
npm run build
cd ..
python scripts/benchmark.py
python scripts/smoke.py  # requires both local servers
cfn-lint deploy/aws-stack.yaml deploy/gitlab-oidc-role.yaml
```

CloudFormation lint is a separate developer tool and is not required to run the application. Install it explicitly when needed. The generated requirements.txt locks application and test dependencies; the frontend lockfile records the resolved npm dependencies.
