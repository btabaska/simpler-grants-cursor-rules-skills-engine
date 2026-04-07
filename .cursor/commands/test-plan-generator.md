# Test Plan Generator

Generate a QA-executable manual test plan for a feature, covering happy path, edge cases, error states, accessibility, cross-browser, responsive, and localization scenarios.

## What I Need From You

1. **Feature** — description, issue link, or PR summary
2. **Scope** (optional) — UI only, API only, end-to-end
3. **Coverage depth** (optional) — `smoke`, `standard`, or `deep` (default `standard`)

## What Happens Next

The Test Plan Generator Agent will:
1. Parse the feature into user-visible capabilities
2. Enumerate scenarios across seven buckets (happy path, edge, error, a11y, browser, responsive, locale)
3. Format each scenario with preconditions, steps, expected outcome, and pass/fail checkboxes
4. Write the plan to `documentation/test-plans/<slug>.md`
5. Run accessibility, convention, and scenario-realism quality gates
6. Summarize scenario counts per bucket

## Tips for Better Results
- Provide acceptance criteria if you have them — the plan gets tighter
- Name locales if i18n matters for the feature
- Use `/e2e-scenario` afterward to automate the high-value scenarios
