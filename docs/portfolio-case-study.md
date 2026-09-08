# DataDock — portfolio case study draft

## Problem

Research assistants and operations analysts receive CSV files with inconsistent values, gaps, and repeated records. They need a quick way to inspect data and produce a cleaned copy while preserving the original.

## Implemented

Built a React and TypeScript workspace backed by FastAPI, pandas, NumPy, SQLAlchemy, and durable report storage. Users can upload a CSV, inspect quality flags, filter paginated records, explore charts, apply explicit cleaning rules, and export a cleaned dataset or JSON report. Separate browser sessions have isolated report histories.

## Engineering evidence

| Skill | Inspectable evidence |
|---|---|
| Python frameworks/libraries | `backend/app/main.py`, `analysis.py`, `models.py` |
| React/state/reuse | `frontend/src/App.tsx`, `Review.tsx`, TanStack Query invalidation and query keys |
| Responsive design | `frontend/src/styles.css` mobile/tablet layouts; scrollable tables |
| Containers | Backend/frontend Dockerfiles and `compose.yml`; execution pending |
| DevOps | `.gitlab-ci.yml`, OIDC deploy helper, health-gated release script; remote run pending |
| AWS | EC2/S3/IAM CloudFormation, S3 adapter; account deployment pending |
| Web servers | Container and HTTPS-edge Nginx configuration; deployed operation pending |
| Performance | Lazy-loaded chart bundle, indexed pagination, measured three-check pandas optimization |
| Planning | Explicit solo backlog with acceptance criteria and honest status |

## Interview talking points

- Why preserve originals and store cleaning options rather than overwrite uploads?
- How does every endpoint enforce report ownership?
- Why are missing values, invalid numbers and outlier suggestions left for human review?
- What do row pagination and lazy-loaded charts change about the initial experience?
- Which exact operations were 11.27× faster locally, and what was excluded from that measurement?
- How do the local filesystem/SQLite adapters differ from the production S3/PostgreSQL deployment?
- What remains to verify before claiming operational AWS or GitLab experience?

## Suggested project description, accurate now

“Built DataDock, a React/TypeScript and FastAPI application for CSV quality analysis, interactive reporting, and controlled data cleaning. Implemented pandas/NumPy profiling, SQLAlchemy persistence, isolated report sessions, paginated search, and export workflows. Authored Docker, Nginx, GitLab CI/CD, and AWS EC2/S3 deployment configurations; measured a local 11.27× improvement for three equivalent data checks.”

After a successful AWS deployment and pipeline run, update the description with those actual outcomes and supporting links. Do not claim active clearance or team Agile experience from this project. Do not substitute authored configuration for hands-on operational experience.
