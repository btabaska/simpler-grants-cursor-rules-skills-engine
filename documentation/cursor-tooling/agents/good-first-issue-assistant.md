# `good-first-issue-assistant` Agent — Usage Guide

## Purpose

Walk a new contributor end-to-end through a `good-first-issue` from simpler-grants-gov: read the issue, map it to code, scaffold the change as a diff (not applied), draft a sample test, and produce the PR submission steps. Read-only on the working tree.

## When to Use

- A new contributor wants to claim and resolve a `good-first-issue`
- An onboarding buddy wants a structured walkthrough for a first PR
- Cohort onboarding where each contributor needs the same scaffolded journey

## When NOT to Use

- Multi-file refactors (use `@agent-refactor`)
- Issues without the `good-first-issue` label
- Complex feature work (use `@agent-new-endpoint` or `@agent-code-generation`)
- Debugging (use `@agent-debugging`)

## Invocation

```
/good-first-issue-assistant
@agent-good-first-issue-assistant <issue url or number>
```

## Examples

### Example 1 — Issue URL
```
@agent-good-first-issue-assistant https://github.com/HHS/simpler-grants-gov/issues/5432
```

### Example 2 — Number
```
@agent-good-first-issue-assistant 5432
```

### Example 3 — Search
```
@agent-good-first-issue-assistant find a good-first-issue in frontend i18n
```

## Output Shape

Issue summary, affected files, governing rule(s), diff-format scaffold, sample test with file path, PR walkthrough (`gh pr create`), and a final pre-submission checklist.

## Tips

- Confirm the issue carries `good-first-issue` before invoking; the agent will refuse otherwise
- Pair with `@agent-pattern-catalog` if the scaffold uses an unfamiliar pattern
- After scaffolding, use a write-capable agent only when you understand the change

## Pitfalls

- Will not apply the diff, push branches, or open PRs on your behalf
- Will refuse if the scaffold balloons across modules
- Will not fabricate test fixtures or file paths
