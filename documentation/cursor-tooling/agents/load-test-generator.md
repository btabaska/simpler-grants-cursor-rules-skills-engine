# `load-test-generator` Agent — Usage Guide

## Purpose

Generate runnable k6 or Locust load test scenarios for simpler-grants-gov API endpoints from the OpenAPI spec, with realistic user journeys, ramp stages, and SLO assertions.

## When to Use

- You need a load test for a new endpoint and don't want to hand-craft requests
- You want to validate a performance regression hypothesis under concurrent load
- You're bootstrapping a soak or smoke test in CI
- You need a reproducible load scenario a teammate can run locally

## When NOT to Use

- You need to actually run the load test and analyze results (this agent only scaffolds)
- You want functional end-to-end coverage (use `@agent-e2e-scenario-builder`)
- You need capacity planning or cost estimation
- The workload has no corresponding OpenAPI path

## Invocation

```
/load-test
@agent-load-test-generator <workload> with <load shape> [framework=k6|locust]
```

## Examples

### Example 1 — Search load test
```
@agent-load-test-generator Generate a k6 load test for GET /v1/opportunities?search=<q>. 100 VUs, 5 min ramp, 20 min steady, 5 min ramp-down. p95 < 500ms, error rate < 1%.
```
Result: `tests/load/opportunity-search.js` with stages, random query generator, p95/error thresholds.

### Example 2 — Multi-step journey
```
@agent-load-test-generator k6 journey: list → detail → apply. 50 VUs, 2 min ramp, 10 min steady.
```
Result: journey with three requests, 1–3s think time between steps, journey-level checks.

### Example 3 — Locust alternative
```
@agent-load-test-generator Locust test for POST /v1/applications, 200 users, 30 min total.
```
Result: `tests/load/application-submission.py` with a `LoadTestShape` and fixture-backed bodies.

### Example 4 — Soak test
```
@agent-load-test-generator 24-hour soak test at 20 VUs against the agencies endpoint
```
Result: long-duration stages, tighter error budget, ramp-down included.

## Tips

- Name SLOs explicitly when they differ from architecture defaults
- Keep think time realistic (1–5s) — zero-think-time tests measure the load generator, not the service
- Use environment variables for auth, never hardcode tokens
- Commit the emitted file on a dedicated branch so capacity tests are gated behind review

## Pitfalls

- Don't target production without the explicit env gate
- Don't exceed 1000 VUs without a capacity conversation
- Don't consume test fixtures that contain real user data
- Don't skip the ramp-down — it prevents retry-storm artifacts in the metrics
