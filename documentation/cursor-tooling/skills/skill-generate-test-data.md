# `skill-generate-test-data` Skill — Usage Guide

## Purpose

Produce reproducible, synthetic test data matching a shape or endpoint.

## When to Use

- Integration tests needing realistic data volume.
- Seeding a local dev database.
- Building MSW / Storybook fixtures.

## When NOT to Use

- Production seeds.
- PII-sensitive models without review.
- When a factory is a better fit.

## Invocation

```
/skill-generate-test-data
@skill-generate-test-data target=OpportunityResponse count=50 format=json seed=42
@skill-generate-test-data target=operationId:listOpportunities count=20
```

## Examples

### Example 1 — Integration JSON

50 synthetic opportunities, seed 42.

### Example 2 — SQL seed

20 rows for local dev DB.

### Example 3 — OpenAPI-derived

Shape derived from `operationId=listOpportunities`.

### Example 4 — Story data

Fixture feeds a Storybook decorator.

## Tips

- Commit the seed in the file header.
- Reuse fixtures across tests to keep CI cheap.
- Regenerate when the shape changes.

## Pitfalls

- Stale fixtures after schema changes silently mislead tests.
- Never embed production IDs.
- Seed=0 is fine, but record it.
