# Hook: background-accessibility-monitor

- **Event:** `afterFileEdit`
- **Matcher:** `frontend/**/*.{tsx,jsx}` (script self-gates)
- **Script:** `.cursor/hooks/scripts/background-accessibility-monitor.sh`
- **Command registered in `.cursor/hooks.json`:** `bash .cursor/hooks/scripts/background-accessibility-monitor.sh`

## Exit-code contract

| Code | Meaning |
|------|---------|
| 0 | Always. This is an advisory/background hook and must not block the main loop. |

## Side effects

- Appends findings to `.cursor/hooks/logs/a11y-violations.jsonl`.
- Prints `[a11y] file:line: [rule / WCAG X.Y.Z] message` to stderr.
- Honors per-file opt-out comment: `// a11y-monitor: disable`.

## Checks

- `missing-alt-text` (WCAG 1.1.1)
- `interactive-role` — `onClick` on `<div|span|p|li>` (WCAG 4.1.2)
- `tabindex-positive` (WCAG 2.4.3)
- `anchor-no-href` (WCAG 2.1.1)
- `input-unlabeled` (WCAG 3.3.2)

## Failure behavior

Purely advisory. Scanner errors are swallowed; the hook always returns 0. Required by Section 508 coverage directives.
