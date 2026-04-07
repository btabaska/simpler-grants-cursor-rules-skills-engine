# `skill-generate-factory` Skill — Usage Guide

## Purpose

Generate a factory (factory-boy or TS builder) matching repo conventions with safe synthetic defaults.

## When to Use

- New SQLAlchemy model or Pydantic DTO needs test factory.
- New TS API-response type needs a builder.
- Existing factory needs backfill after a schema change.

## When NOT to Use

- PII-sensitive models (manual review required).
- Production seed data.

## Invocation

```
/skill-generate-factory
@skill-generate-factory target=OpportunityModel side=api
@skill-generate-factory target=OpportunityResponse side=frontend
```

## Examples

### Example 1 — API model

`OpportunityModel` → `opportunity_factory.py` with `SubFactory(AgencyFactory)`.

### Example 2 — Frontend type

`OpportunityResponse` → TS builder with partial-override support.

### Example 3 — Schema backfill

Adds `closed_at` to an existing factory after a migration.

### Example 4 — Mixed generation

Combined with `/skill-generate-test-data` for end-to-end fixtures.

## Tips

- Keep factories additive.
- Use Faker providers scoped to `@example.test`.
- Prefer cycle helpers for enum fields.

## Pitfalls

- Regenerating over hand-tuned factories drops custom logic — edit, don't overwrite.
- Ambiguous field types become `# TODO`; the author must fill them.
- Do not commit factories that construct real agency codes.
