# `e2e-scenario-builder` Agent — Usage Guide

## Purpose

Generate a Playwright end-to-end test for a described user workflow, matching the conventions in `frontend/tests/e2e/`. The agent reads sibling specs first, picks fixtures over hand-rolled auth, and never mocks the API.

## When to Use

- You shipped a new feature and need a `@smoke` or `@core-regression` scenario
- You fixed a bug and want an E2E regression test for it
- You're back-filling E2E coverage for an existing flow

## When NOT to Use

- Visual regression — use `@agent-visual-regression`
- Performance / load testing — use `@agent-load-test-generator`
- API contract tests — use the `api-contract-test` skill
- Component tests with mocked APIs — use the component-test rules instead

## Invocation

```
/e2e-scenario
@agent-e2e-scenario-builder <workflow + role + outcome + tags>
```

## Examples

### Example 1 — Smoke happy path

```
@agent-e2e-scenario-builder @smoke: guest user searches opportunities, filters by agency, views details
```

Result: single spec under `frontend/tests/e2e/search/` with `getByRole('searchbox')`, agency filter via `getByLabel`, results assertion, detail-page URL + heading assertion. Under 30 seconds.

### Example 2 — Error flow

```
@agent-e2e-scenario-builder @core-regression: logged-in applicant submits an application with a missing required field, expects validation error
```

Result: spec uses `loggedInApplicant` fixture, fills the form leaving one required field empty, clicks submit, asserts the validation message via the i18n helper, asserts URL unchanged.

### Example 3 — Multi-role

```
@agent-e2e-scenario-builder @core-regression: agency reviewer approves a submitted application
```

Result: uses `agencyReviewer` fixture, seeds a submitted application in `beforeEach` via the API, walks the review page, asserts the approval banner and the application's new status.

### Example 4 — Regression for a specific bug

```
@agent-e2e-scenario-builder @core-regression: regression for #4512 — search pagination preserves filters across pages
```

Result: spec name references the issue, applies filters, navigates page 2, asserts both the URL query params and the visible filter chips.

## Tag Policy

| Tag | Runs | Budget |
|-----|------|--------|
| `@smoke` | Every PR | < 30s, single feature area |
| `@core-regression` | Merge to main | Broader, multiple per feature |
| untagged | Nightly | Use sparingly |

## Tips

- Use fixtures, not hand-rolled auth
- Locators: `getByRole` > `getByLabel` > `getByTestId`, no CSS selectors
- Use `expect(...).toBeVisible()` for implicit waits; never `waitForTimeout`
- Route text assertions through the i18n helper if sibling specs do

## Pitfalls

- No API mocks in E2E — if you need mocks, write a component test
- Don't tag slow scenarios `@smoke`
- Don't create new fixtures here — propose them, then add in a separate PR
