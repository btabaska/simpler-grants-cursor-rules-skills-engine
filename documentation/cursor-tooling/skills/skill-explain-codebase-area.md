# `skill-explain-codebase-area` Skill — Usage Guide

## Purpose

Senior-engineer walkthrough of a subsystem: entry points, data flow, key types, external dependencies, governing rules and ADRs.

## When to Use

- Onboarding to a new area.
- Reviewer context on an unfamiliar subsystem.
- Authoring subsystem documentation.

## When NOT to Use

- Single-file explanations (use `/skill-explain-pattern`).
- Architectural decisions (use ADR flow).
- Whole-monorepo tours (too coarse).

## Invocation

```
/skill-explain-codebase-area
@skill-explain-codebase-area path=api/src/services/opportunity/
@skill-explain-codebase-area path=frontend/src/services/search-client/ depth=deep
```

## Examples

### Example 1 — Onboarding

Tour of `api/src/services/opportunity/` for a new backend hire.

### Example 2 — Handoff

Deep brief on `frontend/src/services/search-client/` before rotating owners.

### Example 3 — Reviewer context

Overview of `infra/api/` before reviewing a Terraform PR.

### Example 4 — Documentation sourcing

Generate a first draft of subsystem README content.

## Tips

- Always cite ADRs; they hold the "why".
- Use `depth=deep` sparingly — it grows quickly.
- Verify entry-point claims manually; dynamic registrations can be missed.

## Pitfalls

- Data-flow bullets are inferred, not traced at runtime.
- External-dependency lists depend on naming; non-standard SSM keys may be missed.
- Do not treat the brief as spec — it describes current state, not intent.
