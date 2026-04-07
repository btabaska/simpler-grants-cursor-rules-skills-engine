# test-quality-analyzer

## Purpose

Specialist reviewer subagent that evaluates tests for meaningful assertions, factory_boy / jest-axe compliance, appropriate mocking, and absence of flaky-test anti-patterns.

## Who calls it

- `test-generation` (Gate 2)
- `test-plan-generator` (Gate 2)
- Optional gate for `regression-detector`, `codebase-conventions-reviewer`

## What it checks

- Every test has meaningful assertions (not just `assert True` or mock-called checks)
- `factory_boy` `.build()` preferred over `.create()`
- `jest-axe` `toHaveNoViolations` present in component tests
- `getByRole` / `getByLabelText` over `getByTestId`
- No `time.sleep()` flake
- Playwright tests properly tagged
- Mocks at service boundaries, not internals

## Output format

JSON with severity summary and per-test findings. See `.cursor/agents/test-quality-analyzer.md`.

## Example

```
Invoke test-quality-analyzer with:
  files: ["api/tests/services/test_grant_service.py"]
  test_type: "unit"
  calling_agent: "test-generation"
```

## Policy

Tests with no assertions always block.
