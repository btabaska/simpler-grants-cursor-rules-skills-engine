# `skill-cross-browser-checklist` Skill — Usage Guide

## Purpose

Generate a diff-scoped manual cross-browser checklist that tells QA exactly what to verify, per browser, for the touched flows.

## When to Use

- Pre-staging promotion.
- PRs touching form controls, modals, sticky layout, USWDS overrides.
- Release readiness reviews.

## When NOT to Use

- Backend-only or content-only changes.
- Flows fully covered by cross-browser Playwright runs.

## Invocation

```
/skill-cross-browser-checklist
@skill-cross-browser-checklist diff=origin/main...HEAD
@skill-cross-browser-checklist browsers=safari-ios,chrome
```

## Examples

### Example 1 — Filter feature

Scoped checklist: filter open/close, date picker, sticky sidebar per browser.

### Example 2 — Form refactor

Adds iOS keyboard and autofill checks.

### Example 3 — Modal introduction

Adds focus trap, backdrop click, Esc handling per browser.

### Example 4 — USWDS component override

Adds checks for rendering and focus state differences.

## Tips

- Paste the checklist into the PR description for reviewers.
- Run alongside `/skill-accessibility-check` for a complete pre-release sweep.
- Prefer Playwright automation for anything run more than twice.

## Pitfalls

- This is a tester focus list, not a test harness.
- Do not trim items without confirming the flow is unaffected.
- Always include iOS Safari — it diverges most from desktop Chrome.
