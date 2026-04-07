# `skill-sql-explain` Skill — Usage Guide

## Purpose

Analyze a SQL or SQLAlchemy query, report likely bottlenecks (seq scans, leading wildcards, N+1, missing indexes), and recommend concrete fixes. Optional `live` mode runs read-only `EXPLAIN` against the local dev DB.

## When to Use

- A new query is added or modified under `api/src/db/` or `api/src/services/`.
- Investigating a slow endpoint.
- Reviewing a PR that introduces an ORM `select` against a hot table.

## When NOT to Use

- For migration safety — use `skill-migration-safety-check`.
- For trivial primary-key lookups.
- As a substitute for production `EXPLAIN ANALYZE` traces.

## Invocation

```
/skill-sql-explain
@skill-sql-explain api/src/services/opportunities/search_service.py
@skill-sql-explain mode=live
```

## Examples

### Example 1 — Leading wildcard

`title ILIKE '%grant%'` flagged; recommends pg_trgm GIN index.

### Example 2 — N+1 detection

Per-row `select(Agency)` flagged; recommends `selectinload(Opportunity.agency)`.

### Example 3 — Missing LIMIT

User-facing search with no LIMIT flagged WARN; recommends cursor pagination.

### Example 4 — Live plan confirmation

`mode=live` confirms a `Seq Scan` on a 120k-row table and prints the cost.

## Tips

- Start with static mode; escalate to live only when the plan is non-obvious.
- Pair with `/skill-migration-safety-check` for the resulting index migration.
- Promote search workloads to the existing OpenSearch cluster when full-text patterns appear.

## Pitfalls

- Static heuristics cannot detect plan regressions caused by stale stats.
- Live mode never runs the query — `EXPLAIN ANALYZE` is intentionally disabled.
- Local row counts differ from production; treat cost numbers as relative, not absolute.
