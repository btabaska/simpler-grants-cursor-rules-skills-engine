# background-accessibility-monitor

## Purpose
Provide real-time, non-blocking accessibility feedback on frontend edits. Helps maintain Section 508 / WCAG 2.1 AA compliance required of the Simpler Grants user-facing site.

## Event
`afterFileEdit` (Cursor). Fires after Cursor saves an edit to disk.

## Trigger conditions
- File path matches `frontend/**/*.{tsx,jsx}`.
- File does not contain the opt-out marker `a11y-monitor: disable`.

## What it does
1. Reads the edited file from disk.
2. Runs a set of regex-based WCAG 2.1 AA anti-pattern checks:
   - Missing `alt` on `<img>` (1.1.1)
   - `onClick` on non-interactive elements (4.1.2)
   - Positive `tabIndex` (2.4.3)
   - `<a>` without `href` (2.1.1)
   - Unlabeled `<input>` (3.3.2)
3. Writes findings to `.cursor/hooks/logs/a11y-violations.jsonl` and echoes them to stderr as `[a11y] file:line: [rule / WCAG code] message`.

## Failure behavior
Purely advisory. The hook always exits `0` — it never blocks the Cursor main loop, never fails Cursor's edit flow. Scanner errors are silently swallowed.

## How to bypass
- Add `// a11y-monitor: disable` near the top of the file to skip scanning entirely.
- Or temporarily unregister the hook in `.cursor/hooks.json`.

## Examples

```
[a11y] frontend/components/Avatar.tsx:12: [missing-alt-text / WCAG 1.1.1] <img> missing alt attribute
[a11y] frontend/components/Card.tsx:44: [interactive-role / WCAG 4.1.2] onClick on non-button element; use <button> or add role + keyboard handler
```
