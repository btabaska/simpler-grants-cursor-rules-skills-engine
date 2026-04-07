# `skill-check-conventions` Skill — Usage Guide

## Purpose

Deterministic compliance check mapping each ALWAYS/NEVER/MUST directive from convention rules onto the target file, with line numbers and fix hints.

## When to Use

- Pre-push self-review.
- Inside the Quality Gate Pipeline.
- After refactoring to confirm no drift.

## When NOT to Use

- Generated files (OpenAPI, auto-generated migrations, `.next/`).
- Design-intent questions (use ADR flow).
- Vendored or fixture files.

## Invocation

```
/skill-check-conventions
@skill-check-conventions api/src/services/opportunity_service.py
@skill-check-conventions scope=diff
```

## Examples

### Example 1 — API service

Flags raw SQL in a service method; cites `api-data-access.md`.

### Example 2 — Frontend component

Flags a hard-coded color literal violating USWDS token directive.

### Example 3 — Diff-only

Legacy file with pre-existing violations; only added lines are checked.

### Example 4 — Pre-merge gate

Invoked by the Quality Gate Pipeline before allowing merge.

## Tips

- Use `scope=diff` on legacy files.
- Rules are plain markdown — inspect them to understand any failure.
- Run after auto-formatting so line numbers are stable.

## Pitfalls

- This skill does not fix anything; pair with the relevant generator or refactor agent.
- Silenced directives (archived rule files) are not checked; keep rules current.
- A PASS does not certify correctness — only rule coverage.
