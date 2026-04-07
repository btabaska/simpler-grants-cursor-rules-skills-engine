# `skill-run-relevant-tests` Skill — Usage Guide

## Purpose

Map changed files to the minimal pytest and Jest targets that exercise them, then run those targets and parse failures. Local pre-push smoke test that eliminates "did I break anything" anxiety without waiting on CI.

## When to Use

- Before pushing a branch.
- After completing a focused refactor.
- During a PR fix loop to verify the patch.

## When NOT to Use

- Documentation-only PRs.
- As a replacement for full CI.
- When the workspace is dirty with unrelated changes.

## Invocation

```
/skill-run-relevant-tests
@skill-run-relevant-tests scope=frontend
@skill-run-relevant-tests mode=deep base_ref=origin/release/2026-04
```

## Examples

### Example 1 — API service tweak

Edit `search_service.py`. Skill runs the matching service test and route test in 4 seconds.

### Example 2 — Frontend component edit

Edit `SearchBar.tsx`. Skill runs `SearchBar.test.tsx` plus integration tests importing it (deep mode).

### Example 3 — Schema drift surfaces in tests

Test fails on a removed field. Skill attributes the failure to `opportunity_schemas.py` and recommends `/skill-openapi-sync`.

### Example 4 — Migration touch

Migration file edit triggers `api/tests/src/db/test_migrations.py` automatically.

## Tips

- `mode=fast` for tight loops; `mode=deep` after touching shared utils.
- Pair with `/skill-impact-analysis` to preview the test surface.
- Confirm before running large plans (>50 files).

## Pitfalls

- Heuristic file mapping misses tests that exercise code via fixtures or factories. Use `mode=deep` for high-leverage refactors.
- Never run with `--force` against a dirty unrelated workspace — the failure attribution will mislead.
- Local DB state can mask CI failures; still rely on CI for the final word.
