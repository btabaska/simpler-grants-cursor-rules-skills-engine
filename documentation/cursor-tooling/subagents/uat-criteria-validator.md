# uat-criteria-validator

## Purpose

Specialist reviewer subagent that validates user acceptance criteria in PRs, test plans, and E2E scenarios for specificity, testability, traceability to requirements, and coverage of both happy and failure paths.

## Who calls it

- `test-plan-generator` (Gate 2)
- `e2e-scenario-builder` (Gate 2)
- `pr-preparation` (optional)

## What it checks

- Vague language ("works", "fast", "user-friendly")
- Measurable thresholds on performance/timeout claims
- Happy-path + failure-path pair per story
- Traceability link to ADR / issue / requirement
- Accessibility path (keyboard + screen reader) on UI criteria
- Security negative cases (denied, expired token, wrong tenant)
- Persona alignment (applicant, reviewer, admin)
- Given/When/Then structure

## Output format

JSON with severity summary and per-criterion findings. See `.cursor/agents/uat-criteria-validator.md`.

## Example

```
Invoke uat-criteria-validator with:
  criteria: ["As an applicant I can submit SF-424 and receive confirmation within 5 seconds."]
  source: "test-plan"
  requirement_refs: ["ADR-0042"]
  calling_agent: "test-plan-generator"
```

## Policy

Untestable or contradictory criteria always block.
