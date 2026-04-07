# `skill-explain-pattern` Skill — Usage Guide

## Purpose

Focused in-place explanation of one idiom or snippet, grounded in this repo's rules and ADRs.

## When to Use

- Reviewer asks "what does this do?"
- Before copying a pattern into new code.
- Onboarding engineers learning local conventions.

## When NOT to Use

- Whole-subsystem walkthroughs (`/skill-explain-codebase-area`).
- Generic language questions.
- Design alternatives (use ADR flow).

## Invocation

```
/skill-explain-pattern
@skill-explain-pattern target="api/src/api/opportunities_v1/search.py L42"
@skill-explain-pattern snippet="@require_scope('opportunity:read')"
```

## Examples

### Example 1 — Decorator

`@require_scope("opportunity:read")` — cites auth rule and scope ADR.

### Example 2 — React hook

`useFeatureFlag("new_search")` — cites flag convention and ops runbook.

### Example 3 — Undocumented idiom

SQLAlchemy `yield_per(100)` flagged "convention in practice"; two other usages linked.

### Example 4 — Failing lint

A rule lint fails; this skill explains the underlying rationale.

## Tips

- Provide a line range for precision.
- Ask targeted questions.
- Cite the output back in code review comments.

## Pitfalls

- The skill does not run the code; runtime surprises still possible.
- Undocumented patterns may not be the blessed choice — confirm with owners.
- Not a substitute for reading the ADR.
