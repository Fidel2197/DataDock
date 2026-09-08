# Development backlog and honest workflow evidence

This is a solo development backlog. It records scope and suggested estimates; it is not evidence of team stand-ups, historical sprint participation, or actual Jira use. Estimates were prepared as documentation after the initial implementation, not measured work duration.

| ID | Story | Estimate | Acceptance criteria | Status |
|---|---|---:|---|---|
| DD-01 | As an analyst, upload a CSV and understand its quality | 5 | CSV bounds; issue counts; preserved original; actionable errors | Implemented, tested |
| DD-02 | Inspect and filter flagged records | 3 | Pagination; escaped search; issue filter; row details | Implemented; API tested |
| DD-03 | Choose cleaning rules and download a copy | 3 | Counts match export; independent choices; original unchanged | Implemented, API tested |
| DD-04 | Explore category comparisons and distributions | 5 | Numeric/text datasets; grouping; count/total/average; exact values | Implemented; aggregation API tested |
| DD-05 | Reopen a saved report | 3 | Persistent history; session ownership; changed browser cannot read | Implemented, tested |
| DD-06 | Package the full stack in Docker Compose | 3 | Health checks; PostgreSQL; volumes; Nginx proxy | Authored; container execution pending |
| DD-07 | Test/build/publish/deploy through GitLab | 5 | PostgreSQL tests; immutable tags; OIDC; health check and rollback | Authored; remote pipeline pending |
| DD-08 | Deploy to AWS with HTTPS and private storage | 5 | EC2; S3; IAM role; HTTPS; SSM; restore procedure | Authored; account deployment pending |
| DD-09 | Measure one performance improvement | 2 | Reproducible input; equivalent results; documented scope | Local benchmark recorded |

## Suggested next sprint

Finish DD-06 through DD-08 with the account owner, record deployment evidence, then conduct a real review of the demo. Use this backlog in Jira if desired. Add actual dates, outcomes, revisions, and blockers as they happen; do not fabricate earlier planning history.

## Review questions

- Can a first-time visitor complete the sample workflow without instruction?
- Are quality heuristics and export changes understandable?
- Does the deployed application preserve history across a restart?
- Can the operator recover the database and original objects from backup?
- Did the protected pipeline deploy only the intended immutable revision?
