# `skill-uat-checklist` Skill — Usage Guide

## Purpose

Turn a feature spec, user story, or PR into a deterministic UAT sign-off checklist with preconditions, happy paths, edge cases, accessibility, data handling, cross-browser, rollback, and named approvers.

## When to Use

- A feature is approaching launch readiness.
- PR is labeled `ready-for-uat`.
- During release planning to estimate UAT effort.

## When NOT to Use

- Internal refactors with no user-visible change.
- As a substitute for automated tests.
- Documentation-only PRs.

## Invocation

```
/skill-uat-checklist
@skill-uat-checklist documentation/stories/us-318-bookmarks.md
@skill-uat-checklist scope=api
```

## Examples

### Example 1 — Bookmarking feature

PR + story produce a 22-row checklist with full a11y and audit-log rows.

### Example 2 — API-only delivery

`scope=api` suppresses cross-browser; adds rows for schema validation, error codes, rate limits.

### Example 3 — Feature-flag rollout

Generates a flag-toggle checklist: enable → verify → disable → verify.

### Example 4 — Reviewer triage

PO runs the skill on the PR description to estimate UAT effort before scheduling.

## Tips

- Pair with `/skill-accessibility-check` and `/skill-cross-browser-checklist` during the QA pass.
- Edit the generated checklist; it is a starting template, not a contract.
- Always include the audit-log row for data-touching features (FedRAMP).

## Pitfalls

- Quality of the checklist depends on the quality of the source story.
- Edge cases are heuristic; QA should still add domain-specific scenarios.
- Sign-off requires real human review — the checklist does not approve itself.
