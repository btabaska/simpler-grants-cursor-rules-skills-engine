# `codemod` Agent — Usage Guide

## Purpose

Execute mechanical, large-scale codebase transformations in batches with scoped test verification and rollback on failure. Python uses `libcst`; TypeScript uses `ts-morph`. The agent does not make judgment calls about business logic — if reasoning is required, it hands off to `@agent-refactor`.

## When to Use

- Renaming a function/class/variable across more than ~5 files
- Rewriting import paths after a module move
- Swapping one decorator for another across a directory
- Renaming React hooks or JSX attributes en masse

## When NOT to Use

- The refactor requires semantic reasoning (use `@agent-refactor`)
- Database schema migrations (use `@agent-migration`)
- Cross-language refactors in a single run — run once per language
- Renaming public API symbols without an ADR — pair with `/adr-from-pr` first

## Invocation

```
/codemod
@agent-codemod <what> in <where>
```

## Examples

### Example 1 — Function rename

```
@agent-codemod Rename `get_opportunity_details(...)` to `fetch_opportunity_details(...)` in api/src/services/
```

Result: 12 files found → 3 batches of 4 → `libcst` transformer shown → each batch applied, `ruff format`, `uv run pytest api/tests/services -x -q`, fixup commit per batch → final `make test-api`.

### Example 2 — Import path rewrite

```
@agent-codemod Rewrite imports `from api.legacy.forms` to `from api.forms` across api/src/
```

Result: ~40 files found → 5 batches → import-only codemod script → zero test churn expected → summary.

### Example 3 — Decorator swap

```
@agent-codemod Replace `@require_auth` with `@require_auth(scope="user")` on all route handlers in api/src/api/applications/
```

Result: 8 files found → 1 batch → script added argument explicitly → scoped pytest run → committed.

### Example 4 — JSX attribute rename

```
@agent-codemod Rename JSX attribute `testId` to `data-testid` in frontend/src/components/
```

Result: `ts-morph` script → batches of 10 → `npm test -- --findRelatedTests` → committed.

## Safety Notes

- Refuses to run on a dirty working tree
- Never touches files under `api/src/db/migrations/` or anything matching `*.generated.*`, `openapi.yaml`, `schema.graphql`
- Rollback uses `git restore`, not `git reset --hard`
- Every batch produces its own fixup commit so triage is cheap
- The quality gate pipeline runs `codebase-conventions-reviewer` and the appropriate Kieran language reviewer

## Tips

- Run on a dedicated branch with nothing else in the tree
- Narrow the scope — per-domain is better than whole-repo
- Show the script to a teammate before the first batch if you're nervous; the agent always displays it

## Pitfalls

- Don't batch changes across Python and TypeScript in a single invocation
- Don't use this for refactors that reshape function signatures in ways callers can't mechanically adapt to
- Public API renames without an ADR will be refused
