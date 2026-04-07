# `skill-impact-analysis` Skill — Usage Guide

## Purpose

Deterministic, read-only blast-radius analysis for a proposed change. Identifies direct callers, transitive consumers, schema-coupled artifacts, and cross-service contracts so reviewers can size scope and route the right approvers.

## When to Use

- Before refactoring shared utils, base classes, SQLAlchemy models, or API schemas.
- When a PR touches `api/src/db/models/`, `api/openapi.generated.yml`, or `frontend/src/types/`.
- During reviewer triage to estimate scope.

## When NOT to Use

- Pure documentation changes.
- As a substitute for actually running tests.
- Single-file changes with no exports.

## Invocation

```
/skill-impact-analysis
@skill-impact-analysis api/src/db/models/opportunity_models.py
@skill-impact-analysis scope=frontend depth=3
@skill-impact-analysis OpportunityService.get_summary
```

## Examples

### Example 1 — Model rename

Renaming `Opportunity.status` returns 7 downstream nodes including the OpenAPI spec, frontend type, and route handler. All flagged HIGH.

### Example 2 — Shared util tweak

Touch `api/src/util/datetime_util.format_iso`. Skill returns 17 callers and recommends a scoped test run via `skill-run-relevant-tests`.

### Example 3 — Alembic-only change

Index-only migration. Skill flags LOW risk, no model field changes, recommends `skill-migration-safety-check`.

### Example 4 — Frontend hook refactor

Rework `useOpportunitySearch`. Skill identifies 4 consuming components and 2 stories; suggests `skill-generate-story` to refresh fixtures.

## Tips

- Use `depth=1` for quick triage; `depth=3` for deep refactors.
- Always pair with `/skill-run-relevant-tests` for actual signal.
- Cross-service contract changes (OpenAPI) should always trigger a frontend reviewer.

## Pitfalls

- Graph walks miss reflective and dynamic dispatch.
- Does not detect runtime feature-flag wiring; pair with `skill-feature-flag-audit`.
- Caps at depth 3 to avoid combinatorial blowup; very large refactors should be split.
