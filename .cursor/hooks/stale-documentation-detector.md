# Hook: stale-documentation-detector

- **Event:** `afterFileEdit`
- **Matcher:** source files under `api/`, `frontend/`, `src/`, `lib/` (script self-gates; doc edits skipped)
- **Script:** `.cursor/hooks/scripts/stale-documentation-detector.sh`
- **Command registered in `.cursor/hooks.json`:** `bash .cursor/hooks/scripts/stale-documentation-detector.sh`

## Exit-code contract

| Code | Meaning |
|------|---------|
| 0 | Always. Advisory only. |

## What it does

1. Extracts the edited file path from the `afterFileEdit` payload.
2. Searches `documentation/` and `docs/` for Markdown files that reference the edited file (by full path or by base stem).
3. For each referencing doc, computes its age via `git log -1 --format=%ct` (falls back to `stat` mtime).
4. Emits a `[stale-docs]` stderr warning and JSONL record for every doc older than `STALE_THRESHOLD_DAYS` (default 30).

## Side effects

- `.cursor/hooks/logs/stale-docs.jsonl` append.

## Failure behavior

Purely advisory. Always exits 0; never blocks Cursor. Errors are swallowed.

## Environment

- `STALE_THRESHOLD_DAYS` — int, days before a doc is considered stale. Default `30`.
