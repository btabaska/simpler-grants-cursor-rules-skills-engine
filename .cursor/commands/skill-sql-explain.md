# SQL Explain

Analyze a SQL or SQLAlchemy query and report likely bottlenecks and missing indexes.

## What I Need From You

Either:
- A raw SQL string,
- A path to a file containing a SQLAlchemy `select`, or
- An active editor selection over the query.
- Optional: `mode=live` to run `EXPLAIN` (read-only) against the local dev DB.

## What Happens Next

1. Renders the query to SQL (binding literals).
2. Runs static heuristics: leading wildcards, missing LIMIT, unindexed filters, OR-across-tables, N+1 patterns.
3. In `mode=live`, runs `EXPLAIN` (never `EXPLAIN ANALYZE`) against the local DB.
4. Cross-references model index declarations under `api/src/db/models/`.
5. Emits findings with concrete index or rewrite recommendations. Read-only.

## Tips

- Default to `mode=static` — fast, deterministic, no DB.
- Use `mode=live` only for genuinely puzzling plans.
- Pair with `/skill-migration-safety-check` when the recommendation is a new index.
- Never assume an index exists — the skill verifies against the model files.
