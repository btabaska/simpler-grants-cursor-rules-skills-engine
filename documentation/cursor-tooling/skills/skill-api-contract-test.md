# `skill-api-contract-test` Skill — Usage Guide

## Purpose

Generate a contract test validating that an API endpoint's request and response shapes match the OpenAPI spec and the frontend's TypeScript types.

## When to Use

- A new endpoint was just added or modified.
- You regenerated `api/openapi.generated.yml` and want to pin the new shape.
- A frontend service calls an endpoint with no contract test.

## When NOT to Use

- Endpoints still under active design (tests become churn).
- Streaming or SSE endpoints (fixtures cannot capture behavior).
- Pure service-layer logic (use unit tests).

## Invocation

```
/skill-api-contract-test
@skill-api-contract-test endpoint="GET /v1/opportunities/search" side=api
@skill-api-contract-test endpoint="POST /v1/applications" side=frontend
```

## Examples

### Example 1 — API-side

`endpoint="POST /v1/applications" side=api`. Produces `api/tests/contracts/test_applications_contract.py`, runs it, reports pass.

### Example 2 — Drift detection

`endpoint="GET /v1/opportunities/search" side=frontend`. Generated Vitest fails because frontend TS client omits `pagination_token`. Skill prints a diff and recommends `/skill-openapi-sync`.

### Example 3 — Custom fixture

Caller supplies a realistic payload. Skill scrubs PII keys (`email`, `ssn`, `ein`) before writing the fixture.

### Example 4 — Pre-merge pin

Run before merging a handler change to freeze the current shape. CI catches any future drift.

## Tips

- Regenerate the OpenAPI spec first; stale specs produce stale tests.
- One contract test per endpoint; keep them shape-focused, not behavior-focused.
- Use synthetic agency codes (`TEST-001`) in fixtures.

## Pitfalls

- Don't paste real production payloads; PII scrubbing is best-effort, not guaranteed.
- Don't use contract tests as the only testing layer — they only check shape.
- Updating the spec without regenerating frontend types produces false drift.
