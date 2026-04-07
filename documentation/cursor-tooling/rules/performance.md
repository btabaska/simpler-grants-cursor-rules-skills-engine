# performance

## Purpose
Performance budgets and patterns spanning API query discipline, caching, payload size, and frontend rendering strategy.

## Scope / Globs
`api/src/**/*.py`, `frontend/src/**/*.{ts,tsx}`

## Conventions Enforced
- Explicit `selectinload(Model.rel)`; never `selectinload("*")`
- Paginated list endpoints with indexed filters
- No N+1 — batch related fetches
- ISR (`revalidate`) or `force-dynamic` chosen explicitly per page
- Lazy-loaded heavy client components via `next/dynamic`
- Compressed, minimal response payloads; presigned URLs for blobs
- p95 latency and CWV budgets enforced in review
- Long-running work offloaded to background tasks

## Examples
Correct: `selectinload(Opportunity.agency)` + `.limit(...).offset(...)`.
Incorrect: unbounded list query returning joined relationships via wildcard.

## Related Rules
`api-database`, `api-search`, `api-tasks`, `frontend-app-pages`, `frontend-components`, `accessibility`.
