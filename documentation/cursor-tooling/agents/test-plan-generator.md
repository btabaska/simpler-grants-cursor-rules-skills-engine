# `test-plan-generator` Agent — Usage Guide

## Purpose

Turn a feature description into a QA-executable test plan covering happy paths, edge cases, error states, accessibility, cross-browser, responsive, and localization scenarios.

## When to Use

- A feature is about to enter QA and you need a checklist they can run
- You want a structured test plan from a GitHub issue or PR description
- You need accessibility coverage baked in without writing it by hand
- You want scenario counts to size QA effort

## When NOT to Use

- You need the tests automated (use `@agent-e2e-scenario-builder`)
- You need unit or integration tests written (use `/generate` or `@agent-test-generation`)
- You need performance testing (use `@agent-load-test-generator`)
- The feature description is too vague to enumerate preconditions

## Invocation

```
/test-plan
@agent-test-plan-generator Generate a test plan for <feature>
```

## Examples

### Example 1 — Filter UI
```
@agent-test-plan-generator Generate a test plan for the new opportunity filter UI (agency, funding status, type)
```
Result: 18 scenarios across seven buckets written to `documentation/test-plans/opportunity-filter-ui.md`, including keyboard and screen-reader scenarios.

### Example 2 — Form submission
```
@agent-test-plan-generator Plan for the application form submission flow with autosave
```
Result: scenarios covering draft autosave timing, network loss mid-save, validation errors per field, focus restoration on error.

### Example 3 — API endpoint
```
@agent-test-plan-generator API-only plan for POST /v1/opportunities
```
Result: request/response scenarios, auth failures, rate limiting, malformed payloads, idempotency behavior.

### Example 4 — Smoke plan
```
@agent-test-plan-generator Smoke plan for the search page
```
Result: 5–7 critical-path scenarios only, ready for a 15-minute smoke test.

## Tips

- Provide acceptance criteria verbatim when you have them
- Explicitly request a locale if i18n is in scope
- Use `smoke` depth for release gates, `deep` for risky features

## Pitfalls

- Don't skip the accessibility bucket for UI features — the gate will block it anyway
- Don't use this to generate automated tests; pipe to `@agent-e2e-scenario-builder`
- Don't embed real credentials in preconditions
