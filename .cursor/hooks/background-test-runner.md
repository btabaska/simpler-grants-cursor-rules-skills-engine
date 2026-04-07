# Hook: background-test-runner

- **Event:** `stop`
- **Matcher:** n/a (script self-gates on changed paths)
- **Script:** `.cursor/hooks/scripts/background-test-runner.sh`
- **Command registered in `.cursor/hooks.json`:** `bash .cursor/hooks/scripts/background-test-runner.sh`

## Exit-code contract

| Code | Meaning |
|------|---------|
| 0 | Always. Non-blocking by design. |

## What it does

- Inspects `git diff --name-only HEAD`.
- If `api/` files changed, spawns `pytest` under `api/` in the background (`&`, `disown`).
- If `frontend/` files changed, spawns `npm test` under `frontend/` in the background.
- All output is captured to `.cursor/hooks/logs/test-runner.log`.

## Side effects

- Background child processes outlive the hook invocation.
- Writes/append to `.cursor/hooks/logs/test-runner.log`.

## Failure behavior

Never blocks. Test failures are recorded in the log and surfaced by any subsequent `stop` handler that reads them. The hook itself always exits 0.
