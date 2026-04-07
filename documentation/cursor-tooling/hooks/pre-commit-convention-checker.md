# pre-commit-convention-checker

## Purpose
Enforce the non-negotiable project conventions (api-error-handling, api-database, frontend-components, TypeScript strictness) at commit time so violating code never enters git history.

## Event
`beforeShellExecution`.

## Trigger conditions
The outgoing shell command contains `git commit`. Otherwise the hook is a no-op.

## What it does
1. Reads staged files (`git diff --cached --name-only --diff-filter=ACM`).
2. Runs language-specific scans:
   - Python (`.py`): bare `except:`, raw `HTTPException` / `abort()`, legacy `Column()` without `Mapped[...]`.
   - TypeScript (`.ts`, `.tsx`, `.js`, `.jsx`): inline `style={{}}`, `: any` annotations, barrel `index.ts` re-exports.
3. For every violation, logs `file:line` to stderr and appends a JSON record to `.cursor/hooks/logs/convention-violations.jsonl`.
4. Exits `2` on the first batch of violations — fail-fast, actionable output.

## Failure behavior
- Exit `2` blocks the commit. Stderr lists `file:line: [rule] message` for each finding.
- Exit `1` (unexpected error) fails open — the commit is allowed so infrastructure bugs never block work.

## How to bypass
- Fix the violation (preferred).
- For a genuinely justified exception, prefix the line with an inline `# pragma: allow` / `// pragma: allow` and refactor the rule to honor it (follow-up PR).
- Emergency: remove the entry from `.cursor/hooks.json` (PR-reviewed).

## Examples

```
git commit -m "add user route"
# [pre-commit-convention-checker] BLOCK: 2 convention violation(s):
#   - api/src/routes/users.py:42: [api-error-handling] bare 'except:' clause; catch specific exceptions
#   - frontend/components/Card.tsx:17: [frontend-components] inline style={{}}; use USWDS utility classes
```
