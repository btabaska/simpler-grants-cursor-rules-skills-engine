# `pr-preparation` Agent — Usage Guide

## Purpose

Prepare a branch for PR submission by running scoped tests, checking conventions across every changed file, validating the title format, drafting the description, and producing a self-review checklist.

## When to Use

- You think a branch is done and want a final pass before opening the PR
- You want a consistent house-style description without hand-writing it
- You want the right tests run without remembering the Makefile targets
- You want to catch convention violations before reviewers do

## When NOT to Use

- You want the PR opened on GitHub — this agent stops at the draft
- You want a deep architecture review (use `architecture-strategist` via `/review-pr`)
- You need the CHANGELOG authored (use `@agent-changelog-generator` first)
- The branch is still actively changing

## Invocation

```
/prepare-pr
@agent-pr-preparation Prepare this branch for PR
```

## Examples

### Example 1 — Backend feature
```
@agent-pr-preparation Prepare this branch. Title: "feat(api): add opportunity filter by funding status"
```
Result: `make test-api` PASS, convention check PASS on 4 files, title validated, description drafted, checklist ready.

### Example 2 — Mixed-domain PR
```
@agent-pr-preparation Prepare for PR
```
Result: diff groups api + frontend + docs, runs scoped tests for each, drafts description with per-domain sections.

### Example 3 — Frontend-only refactor
```
@agent-pr-preparation Prepare. Title: "refactor(frontend): extract useApplicationFormData hook"
```
Result: `npm test -- --findRelatedTests` PASS, `frontend-hooks.mdc` conventions checked, recent-PR scan flags a pending PR touching the same file.

### Example 4 — Infra change
```
@agent-pr-preparation Prepare this Terraform change
```
Result: `terraform validate` in the changed module, convention check against `infra.mdc`, description flags `Risk: Medium` with justification.

## Tips

- Run a clean `git status` first — the agent refuses on dirty trees
- Provide a proposed title when you have one; the agent validates it instead of inventing
- Use alongside `/changelog` and `/regression-detector` for a full pre-PR sweep

## Pitfalls

- Don't treat a clean pass as a substitute for human review
- Don't skip CHANGELOG when user-visible behavior changes
- Don't paste secrets into the description — the PII gate will block it
