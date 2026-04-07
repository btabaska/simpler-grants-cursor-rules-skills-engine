# background-test-runner

## Purpose
Run scoped test suites automatically at the end of a Cursor session so the developer gets fast feedback without having to remember `pytest` / `npm test`. Non-blocking — meant to surface regressions, not gate work.

## Event
`stop` (Cursor). Fires when the assistant turn ends.

## Trigger conditions
- The repo is a git worktree.
- `git diff --name-only HEAD` reports touched files under `api/` or `frontend/`.

## What it does
1. Inspects the working-tree diff to decide which surfaces to test.
2. For `api/`, spawns `cd api && python -m pytest tests/ --tb=short -q` as a detached background process.
3. For `frontend/`, spawns `cd frontend && npm test -- --watchAll=false --reporters=default` similarly.
4. Streams all output (both stdout and stderr) to `.cursor/hooks/logs/test-runner.log`.

## Failure behavior
The hook itself always returns `0`. Test failures are written to the log only — they never block Cursor's main loop. A separate `stop` handler or a developer `tail -f` surfaces them.

## How to bypass
- Remove/rename the entry in `.cursor/hooks.json`.
- Or stash the changes (`git stash`) before the session ends so there are no touched files.

## Examples

```
[background-test-runner] spawning: api-tests :: cd api && python -m pytest tests/ --tb=short -q
[background-test-runner] spawning: frontend-tests :: cd frontend && npm test -- --watchAll=false
[background-test-runner] dispatch complete; tail .cursor/hooks/logs/test-runner.log for results
```
