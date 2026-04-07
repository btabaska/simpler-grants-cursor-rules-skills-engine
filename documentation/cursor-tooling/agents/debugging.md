# `debugging` Agent — Usage Guide

## Purpose

Diagnose errors, trace call chains, detect regressions via git history, and suggest convention-compliant fixes. Handles Python tracebacks, frontend errors, test failures, CI failures, database errors, and migration errors. See `.cursor/agents/debugging.md` for the full system prompt.

## When to Use

- You have a stack trace, error message, or failing test and need help diagnosing it
- A test passes locally but fails in CI
- You're seeing unexpected behavior and want to trace the execution path
- A migration is failing in staging or production
- You want the root cause, not just a symptomatic patch

## When NOT to Use

- You need to write new code from scratch (use `@agent-code-generation` or `@agent-new-endpoint`)
- You're reviewing code quality, not debugging a specific error (use `/review-pr`)
- The error message is self-explanatory and the fix is obvious
- The failure is in infrastructure / Terraform / AWS plumbing (out of scope)

## Invocation

```
/debug
@agent-debugging <paste the error, stack trace, or description of unexpected behavior>
```

## Examples

### Example 1 — Python traceback

```
@agent-debugging Here's a stack trace from the API: [paste traceback]. What's wrong?
```

Result: classifies as Python/API, reads the files in the traceback, traces the call chain, runs `git log -L` on the failing function to detect regressions, proposes a convention-compliant fix.

### Example 2 — Flaky E2E test

```
@agent-debugging This E2E test is failing intermittently: test_search_filters in search.spec.ts.
```

Result: reads the spec, identifies timing/race conditions, checks for known Playwright pitfalls, suggests a deterministic fix.

### Example 3 — 500 on form submit

```
@agent-debugging I'm getting a 500 when submitting a form. Here's the log: [paste log]
```

Result: traces the form schema → validator → service path, identifies the offending field, recommends the fix and which test covers it.

### Example 4 — CI-only failure

```
@agent-debugging The CI build is failing with this error: [paste error]. Works fine locally.
```

Result: checks for env differences, Docker layer caching, secret availability, and recent workflow changes via `git log .github/workflows/`.

### Example 5 — Migration failure

```
@agent-debugging This migration is failing in staging: [paste error].
```

Result: reads the migration file, checks for data-state assumptions, recommends a repair migration (never rewriting the failing one in place).

## Regression Detection

When the agent suspects a regression it runs:
- `git log -L :<function>:<file>` to find recent changes to the failing code
- `git log --oneline -- <file>` for broader context
- Bisect only when explicitly requested

## Tips

- Paste the full traceback, not a summary
- Include recent commit hash or branch if you know the error appeared after a specific change
- Tell the agent where you've already looked so it doesn't re-trace the same path

## Pitfalls

- The agent will propose fixes but never apply them without confirmation
- Infrastructure/Terraform/AWS failures are outside its training — it will say so
- For multi-step investigations, keep the agent in the same chat so context accumulates
