# pre-commit-pii-scanner

## Purpose
Prevent Personally Identifiable Information (PII) — SSNs, emails, phone numbers — from being committed to the simpler-grants repositories. Enforces the HHS / FedRAMP policy that production PII must never be persisted in git history.

## Event
`beforeShellExecution` (Cursor). Fires before any shell command Cursor is about to run.

## Trigger conditions
- The shell command contains the substring `git commit`.
- All other shell commands are passed through untouched.

## What it does
1. Reads the pending command plus `git diff --cached` output.
2. Scans for SSN, email, and phone-number patterns.
3. Consults `.cursor/hooks/.pii-allowlist` (supports `#` comments and `*` wildcards) to permit known synthetic test values.
4. Writes a JSON log line per detection to `.cursor/hooks/logs/pii-detection.jsonl`.
5. Blocks the commit with a readable stderr message naming the PII class and match.

## Failure behavior
- Exit `2`: commit is blocked, Cursor surfaces stderr.
- Exit `1` (internal error): hook fails open — the commit proceeds. Failures still log to stderr so they show up in the hook log.

## How to bypass
- Add the synthetic value to `.cursor/hooks/.pii-allowlist`, one pattern per line (e.g. `test.pii@example.com`, `123-45-6789`, `test.*@example.com`).
- Or set `PII_ALLOWLIST_FILE=/path/to/other/file` for a per-branch allowlist.
- Emergency bypass: unregister the hook entry in `.cursor/hooks.json` (requires PR review).

## Examples

Blocked:
```
git commit -m "seed user SSN 123-45-6789"
# [pre-commit-pii-scanner] BLOCK: ssn PII detected (123-45-6789).
```

Allowed (allowlisted):
```
echo "test.pii@example.com" >> .cursor/hooks/.pii-allowlist
git commit -m "add fixture for test.pii@example.com"
```
