# pr-auto-labeler

## Purpose
Automatically attach area/type labels to the active PR so reviewers can triage by surface without human effort.

## Event
`stop` (Cursor). Cursor exposes no `pull_request` event; `stop` runs once per session and is the natural place to sync PR metadata.

## Trigger conditions
- `gh` CLI is installed and authenticated.
- Current branch is not `main` / `master` / detached `HEAD`.
- `gh pr view` finds an open PR for the current branch.

## What it does
1. Resolves the PR number and base ref via `gh pr view`.
2. Diffs the branch against `origin/<base>` to enumerate touched files.
3. Infers labels:
   - `area: api`, `area: frontend`, `area: docs`, `area: tooling`
   - `type: tests`, `type: docs`
4. Calls `gh pr edit --add-label` for each label (additive — never removes existing labels).
5. Logs every decision to `.cursor/hooks/logs/pr-auto-labeler.log`.

## Failure behavior
Never blocks. Missing `gh`, auth failures, missing labels on the repo, and network errors are all logged and swallowed. Exit code is always 0.

## How to bypass
- Uninstall or unauthenticate `gh` locally.
- Remove the hook entry from `.cursor/hooks.json`.
- Labels applied in error can be removed manually on the PR page; the hook will not re-add the same label if it already exists (gh is idempotent per label).

## Examples

```
[pr-auto-labeler] applied label 'area: frontend' to PR #412
[pr-auto-labeler] applied label 'type: docs' to PR #412
```
