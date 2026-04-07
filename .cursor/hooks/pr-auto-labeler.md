# Hook: pr-auto-labeler

- **Event:** `stop` (Cursor has no native `pull_request` event; `stop` is the closest fit and runs once per session)
- **Matcher:** n/a (self-gated)
- **Script:** `.cursor/hooks/scripts/pr-auto-labeler.sh`
- **Command registered in `.cursor/hooks.json`:** `bash .cursor/hooks/scripts/pr-auto-labeler.sh`

## Exit-code contract

| Code | Meaning |
|------|---------|
| 0 | Always. Labeling is best-effort. |

## What it does

1. Requires `gh` CLI; no-op if missing.
2. Finds an open PR for the current branch via `gh pr view`.
3. Diffs the branch against its base ref and derives labels from file paths:
   - `api/` -> `area: api`
   - `frontend/` -> `area: frontend`
   - `documentation/`, `docs/` -> `area: docs`
   - `.cursor/`, `cursor-tooling-prompts/` -> `area: tooling`
   - `*test*` / `*spec*` -> `type: tests`
   - `*.md` -> `type: docs`
4. Calls `gh pr edit --add-label` for each inferred label.

## Side effects

- Writes to `.cursor/hooks/logs/pr-auto-labeler.log`.
- Mutates PR labels on GitHub (additive only — never removes).

## Failure behavior

All failures are logged and swallowed. The hook never blocks Cursor.
