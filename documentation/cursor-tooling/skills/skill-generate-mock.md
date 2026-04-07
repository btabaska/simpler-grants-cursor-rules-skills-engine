# `skill-generate-mock` Skill — Usage Guide

## Purpose

Generate conventional mocks (pytest, Vitest, or MSW) with realistic synthetic returns.

## When to Use

- Unit tests isolating a service dependency.
- Frontend component tests mocking fetch.
- Integration tests needing MSW handlers.

## When NOT to Use

- Contract tests (`/skill-api-contract-test`).
- Real integration tests.
- Production code stubs.

## Invocation

```
/skill-generate-mock
@skill-generate-mock target=OpportunitySearchClient framework=pytest scenario=success
@skill-generate-mock target=fetchOpportunities framework=vitest scenario=empty
@skill-generate-mock target="GET /v1/opportunities/search" framework=msw scenario=error
```

## Examples

### Example 1 — Pytest success

Mock `OpportunitySearchClient.query` with a 3-item payload.

### Example 2 — Vitest empty

Exercise empty-state component.

### Example 3 — MSW error

Return 500 to test error UI.

### Example 4 — Shared returns

Combine with `/skill-generate-factory` for consistent return values.

## Tips

- Use the scenario parameter aggressively; it is the fastest way to exercise error paths.
- Put MSW handlers under `frontend/src/test-utils/msw/`.
- Reset mocks between tests.

## Pitfalls

- Mocking auth/audit modules can mask security regressions.
- Do not reuse unit-test mocks in integration tests.
- Synthetic payloads drift from reality — re-generate after schema changes.
