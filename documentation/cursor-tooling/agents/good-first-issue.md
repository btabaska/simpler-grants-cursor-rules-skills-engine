# `good-first-issue` Agent — Usage Guide

## Purpose

Find small, achievable contribution opportunities in simpler-grants-gov and draft GitHub issue markdown that a new contributor can pick up and finish in one to two hours while learning a real project convention.

## When to Use

- Seeding the good-first-issue backlog before an onboarding cohort
- Looking for bite-sized cleanup tasks while context-switching
- Turning a theme ("missing docstrings in API services") into a list of concrete issues
- Handing an external contributor a starter task with full context

## When NOT to Use

- You need a real feature or endpoint (use `@agent-new-endpoint`)
- You need a cross-file refactor (use `@agent-refactor`)
- You want issues opened directly on GitHub — this agent only drafts markdown
- The target change requires migrations, auth, or contract changes

## Invocation

```
/good-first-issue
@agent-good-first-issue Find <N> good first issues in <area> focused on <theme>
```

## Examples

### Example 1 — API error handling
```
@agent-good-first-issue Find 3 good first issues in api/src/services focused on ValidationErrorDetail coverage
```
Result: three issue drafts, each citing `api-error-handling.mdc`, pointing at one service with a bare `raise_flask_error` call.

### Example 2 — Frontend accessibility
```
@agent-good-first-issue Find a good first issue in frontend/src/components focused on aria-label gaps
```
Result: one draft pointing at a single component missing `aria-label`, linking `accessibility.mdc`.

### Example 3 — Docstrings
```
@agent-good-first-issue Find 2 good first issues in api/src/util focused on missing docstrings
```
Result: two drafts naming specific functions, linking the Python style convention, and listing acceptance criteria.

### Example 4 — Lint cleanup
```
@agent-good-first-issue Find good first issues in frontend/src/hooks focused on eslint warnings
```
Result: drafts grouped by file, each with the exact warning and the rule link.

## Tips

- Narrow the area — a per-subdirectory scan always beats a whole-repo scan
- Prefer themes that map 1:1 to a single rule file so the learning outcome is crisp
- Review the drafts for duplication against open issues before posting

## Pitfalls

- Don't accept drafts whose acceptance criteria span more than two files
- Don't let the agent invent PR numbers for "example PR" — verify before posting
- Don't use this to generate tasks for internal contributors; the convention-learning framing is for newcomers
