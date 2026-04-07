# E2E Scenario Builder

Generate a Playwright end-to-end test for a described user workflow in `frontend/tests/e2e/`.

## What I Need From You

1. **Workflow** — step-by-step prose ("search → filter by agency → view details → apply")
2. **User role** — guest, applicant, agency reviewer, admin
3. **Expected outcome** — success, validation error, redirect
4. **Tags** — `@smoke`, `@core-regression`, or both

## What Happens Next

The E2E Scenario Builder Agent will:
1. Read 2–3 sibling specs and the E2E fixtures to match style
2. Pick the right auth fixture and any existing test-data builders
3. Generate a `test.describe` block with role/label/testid locators and awaited interactions
4. Add URL + content assertions at each meaningful step
5. Run `npx playwright test <spec> --list` to confirm it parses
6. Run convention, TypeScript, and accessibility quality gates

## Tips for Better Results
- Name the role and the expected outcome up front — the agent will ask otherwise
- Keep `@smoke` scenarios under ~30 seconds and within a single feature area
- Don't ask for API mocks — E2E tests run against the real stack here
