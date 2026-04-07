# stale-documentation-detector

## Purpose
Flag documentation that references a source file which was just edited but that has not itself been updated in a long time — an early-warning signal that docs are drifting from the code they describe.

## Event
`afterFileEdit` (Cursor).

## Trigger conditions
- Edited file is under `api/`, `frontend/`, `src/`, or `lib/`.
- Edited file is not itself a Markdown file.
- Repo is a git worktree and `documentation/` or `docs/` exists.

## What it does
1. Greps `documentation/` and `docs/` for Markdown files that mention the edited file (by relative path or by base-stem word boundary).
2. For each match, reads the doc's last commit timestamp (`git log -1 --format=%ct`).
3. If the doc is older than `STALE_THRESHOLD_DAYS` (default 30), prints a warning to stderr and appends to `.cursor/hooks/logs/stale-docs.jsonl`.

## Failure behavior
Advisory only. Always exits `0`, never blocks Cursor. Filesystem or git errors are swallowed.

## How to bypass
- Set `STALE_THRESHOLD_DAYS=99999` to silence.
- Remove the hook entry from `.cursor/hooks.json`.
- Remove the stale reference from the doc, or update the doc.

## Examples

```
[stale-docs] documentation/api/services.md references api/src/services/user.py but was last updated 62 days ago (threshold 30d).
```
