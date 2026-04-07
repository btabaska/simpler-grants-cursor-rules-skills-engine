# Codemod

Plan and execute a mechanical, large-scale codebase transformation in batches, with scoped test runs and rollback on failure. Uses `libcst` for Python and `ts-morph` for TypeScript.

## What I Need From You

1. **Transformation** — e.g. "rename `get_opportunity_details` to `fetch_opportunity_details`", "rewrite `from old.module` imports to `from new.module`", "swap `@old_decorator` for `@new_decorator(arg=...)`"
2. **Scope** — a directory, glob, or explicit file list
3. **Ticket or ADR link** (optional) — for traceability

The working tree must be clean before invocation. The agent will refuse otherwise.

## What Happens Next

The Codemod Agent will:
1. Verify clean tree and that `libcst` / `ts-morph` are available
2. Discover candidate files with `rg` and report the count
3. Plan 5–10-file batches grouped by nearest common parent directory
4. Write the codemod script under `.cursor/tmp/codemods/` and show it before the first batch
5. Execute each batch, format, run scoped tests, and create a fixup commit
6. Roll back the batch via `git restore` on any test failure
7. Run the broader domain test once at the end and summarize

## Tips for Better Results
- Narrow the scope — full-repo codemods should be broken into per-domain runs
- Pair public API renames with `/adr-from-pr` (the agent will refuse otherwise)
- Run on its own branch; keep unrelated work out of the tree
