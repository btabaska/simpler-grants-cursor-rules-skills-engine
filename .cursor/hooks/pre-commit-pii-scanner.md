# Hook: pre-commit-pii-scanner

- **Event:** `beforeShellExecution`
- **Matcher:** commands containing `git commit`
- **Script:** `.cursor/hooks/scripts/pre-commit-pii-scanner.sh`
- **Command registered in `.cursor/hooks.json`:** `bash .cursor/hooks/scripts/pre-commit-pii-scanner.sh`

## Exit-code contract

| Code | Meaning |
|------|---------|
| 0 | No PII found (or allowlisted). Allow the shell command. |
| 2 | PII detected. Block the commit. Stderr contains the reason. |
| 1 | Internal error. Treated as allow (fail-open) to avoid breaking legitimate work. |

## Side effects

- Appends one JSON line per detection to `.cursor/hooks/logs/pii-detection.jsonl`.
- Reads optional allowlist at `.cursor/hooks/.pii-allowlist` (overridable via `PII_ALLOWLIST_FILE`).
- Reads `git diff --cached` when invoked inside a git worktree.

## Failure behavior

- Hard block on `git commit` with PII in either the commit message or staged diff.
- Non-git-commit shell commands are ignored (no-op, exit 0).

## PII patterns

- SSN: `NNN-NN-NNNN`
- Email: standard `local@domain.tld`
- Phone: `NNN-NNN-NNNN` and `(NNN) NNN-NNNN`

Rooted in the HHS / FedRAMP directive: no production PII in git history.
