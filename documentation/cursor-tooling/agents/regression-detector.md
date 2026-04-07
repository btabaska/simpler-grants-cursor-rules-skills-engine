# `regression-detector` Agent — Usage Guide

## Purpose

Predict regressions in a PR before tests run. Reads the diff, maps call graphs, identifies contract deltas and untested branches, and produces a prioritized risk report with predicted failing tests and manual regression scenarios.

## When to Use

- Before opening a PR, to harden the self-review
- Before merging a PR someone else wrote
- After rebasing a long-lived branch onto main
- When a small diff touches a load-bearing subsystem

## When NOT to Use

- You want tests executed (use `@agent-pr-preparation`)
- You want fixes applied (use `@agent-refactor`)
- You need a full architecture review
- The diff is pure documentation or config with no code impact

## Invocation

```
/regression-detector
@agent-regression-detector Analyze this diff for regressions
```

## Examples

### Example 1 — Service signature change
```
@agent-regression-detector Analyze this diff
```
Result: 3 high-risk findings, call graph shows 11 callers for a changed signature, predicts 4 test files will fail, lists 5 manual scenarios.

### Example 2 — Index strategy change
```
@agent-regression-detector Focus on performance. I changed the opportunity search index.
```
Result: `performance-oracle` flags that filter queries may now miss the composite index, lists queries to manually verify, suggests a targeted load test.

### Example 3 — OpenAPI tweak
```
@agent-regression-detector Focus on contracts. PR #4321.
```
Result: `api-contract-checker` flags a breaking change to an error response shape, predicts three frontend tests will fail, lists the exact fields that moved.

### Example 4 — Hook refactor
```
@agent-regression-detector Analyze this frontend hook refactor
```
Result: `pattern-recognition-specialist` finds three analogous hooks that had similar regressions, predicts stale closure risk, names affected components.

## Tips

- Narrow focus when you suspect a category — the report becomes sharper
- Feed the predicted failing tests directly to `/prepare-pr`
- Read the specialist notes, not just the summary — the evidence matters

## Pitfalls

- Don't treat a clean regression report as a green light to merge
- Don't rely on this agent for test execution — it predicts, it does not run
- Don't skip the manual scenarios; they are the ones automated tests miss
