# DataDock — portfolio case study draft

## Problem

Research assistants and operations analysts receive CSV files with inconsistent values, gaps, and repeated records. They need a quick way to inspect data and produce a cleaned copy while preserving the original.

## Implemented

Built a React and TypeScript workspace backed by FastAPI, pandas, NumPy, SQLAlchemy, and Neon PostgreSQL, deployed on Vercel. Users upload CSVs, inspect flags, filter records, explore charts, apply cleaning rules, and export cleaned data. Optional accounts preserve private reports across devices and support recovery without email delivery. A four-step guide explains the workflow.

## Engineering evidence

| Skill | Inspectable evidence |
|---|---|
| Python frameworks/libraries | `backend/app/main.py`, `analysis.py`, `models.py` |
| React/state/reuse | `frontend/src/App.tsx`, `Review.tsx`, TanStack Query invalidation and query keys |
| Responsive design | `frontend/src/styles.css` mobile/tablet layouts; scrollable tables |
| Containers | Both Docker images built successfully in GitHub Actions; full Compose runtime pending |
| DevOps | Passing GitHub Actions tests/builds; additional GitLab CI and OIDC rollout configuration |
| Hosted services | Live Vercel Python application with dedicated Neon PostgreSQL; public HTTP workflow checks passed |
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
- Why use PostgreSQL for small original uploads, and when should those files move to S3?
- What remains to verify before claiming operational AWS or GitLab experience?

## Suggested project description, accurate now

“Built and deployed DataDock, a React/TypeScript and FastAPI application for CSV quality analysis and interactive reporting. Implemented pandas/NumPy profiling, SQLAlchemy/PostgreSQL persistence, private accounts, recovery, paginated search, and export workflows. Deployed on Vercel with Neon PostgreSQL and verified the end-to-end API flow. Added passing GitHub Actions tests and Docker builds, plus Nginx, GitLab CI/CD, and AWS deployment configuration.”

After a successful AWS deployment and pipeline run, update the description with those actual outcomes and supporting links. Do not claim active clearance or team Agile experience from this project. Do not substitute authored configuration for hands-on operational experience.
