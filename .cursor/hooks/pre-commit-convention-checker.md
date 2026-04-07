# Hook: pre-commit-convention-checker

- **Event:** `beforeShellExecution`
- **Matcher:** commands containing `git commit`
- **Script:** `.cursor/hooks/scripts/pre-commit-convention-checker.sh`
- **Command registered in `.cursor/hooks.json`:** `bash .cursor/hooks/scripts/pre-commit-convention-checker.sh`

## Exit-code contract

| Code | Meaning |
|------|---------|
| 0 | All staged files pass convention gates. |
| 2 | Violation(s) found. Commit blocked; stderr lists `file:line [rule] message`. |
| 1 | Internal error. Fail-open. |

## Rules enforced (hard block)

Python:
- `api-error-handling`: no bare `except:`; no raw `raise HTTPException` / `abort()`.
- `api-database`: no legacy `Column()` without `Mapped[...]`.

TypeScript / TSX:
- `frontend-components`: no inline `style={{ }}`; no barrel `index.ts` re-exports.
- `typescript`: no `: any` annotations.

## Side effects

- Logs each violation as JSON to `.cursor/hooks/logs/convention-violations.jsonl`.
- Reads `git diff --cached --name-only` to scope the scan to staged files only.

## Failure behavior

- Fails fast on the first commit attempt: prints every violation with `file:line`, then exits non-zero.
- Only runs when the pending shell command is a `git commit` invocation.
