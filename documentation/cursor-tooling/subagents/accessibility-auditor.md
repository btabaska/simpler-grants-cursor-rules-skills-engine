# accessibility-auditor

## Purpose

Specialist reviewer subagent that scans React/Next.js components, HTML, and form schema for WCAG 2.1 Level AA and Section 508 violations. Enforces the federal accessibility mandate and USWDS conformance requirements.

## Who calls it

Invoked programmatically by other agents as a Quality Gate, never by users directly:

- `visual-regression` (Gate 2) — confirms focus and high-contrast variants are covered
- `e2e-scenario-builder` (Gate 2) — confirms `getByRole` selectors
- `test-plan-generator` (Gate 2) — confirms keyboard, screen reader, focus, and contrast coverage
- `codebase-conventions-reviewer` (optional) — when `frontend/src/components/**` changes

## What it checks

- Interactive elements have accessible names
- Semantic HTML (no `<div role="button">`)
- Form field label associations and `aria-describedby` error wiring
- Visible focus, heading order, landmarks
- USWDS component usage
- Form schema field labels, required markers, and error messages
- `jest-axe` presence in component tests

## Output format

Structured JSON with `status` (`pass | warn | block`), severity summary, and per-finding `severity`, `file`, `line`, `wcag`, `rule_violated`, `issue`, `suggested_fix`. See the agent file at `.cursor/agents/accessibility-auditor.md`.

## Example invocation (from another agent)

```
Invoke accessibility-auditor with:
  files: ["frontend/src/components/application/form-submission.tsx"]
  context: "component"
  calling_agent: "visual-regression"
```

## References

- WCAG 2.1 AA: https://www.w3.org/WAI/WCAG21/quickref/
- Section 508: https://www.section508.gov/
- USWDS: https://designsystem.digital.gov/
