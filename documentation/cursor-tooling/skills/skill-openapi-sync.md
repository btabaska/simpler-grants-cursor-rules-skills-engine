# `skill-openapi-sync` Skill — Usage Guide

## Purpose

Find and explain drift between `api/openapi.generated.yml` and the frontend's generated TypeScript types. Classifies each change as BREAKING / ADDITIVE / DOC, locates affected call sites, and prints the regeneration command.

## When to Use

- PRs touching `api/src/api/**/*_schemas.py` or `*_routes.py`.
- PRs touching `api/openapi.generated.yml`.
- Frontend TypeScript errors referencing missing fields on API types.
- Pre-release sweeps for any release that touches the API surface.

## When NOT to Use

- API-internal refactors with no schema impact.
- Pure description/example edits in OpenAPI.
- As a substitute for contract tests.

## Invocation

```
/skill-openapi-sync
@skill-openapi-sync base_ref=origin/release/2026-04
@skill-openapi-sync scope=schemas
```

## Examples

### Example 1 — Additive bookmark field

New optional `bookmarked` boolean on `OpportunityResponse`. Skill marks ADDITIVE, prints regen command.

### Example 2 — Field rename

`postedDate` → `posted_at`. Both flagged BREAKING; 4 affected components listed.

### Example 3 — Endpoint removal

`/v1/opportunities/{id}/legacy-summary` removed. Skill flags BREAKING, lists 2 fetchers, recommends a deprecation entry in the release notes.

### Example 4 — In sync

No diff under watched paths. Skill returns "in sync" and recommends running `/skill-api-contract-test` for confidence.

## Tips

- Always run after `/skill-impact-analysis` for API-touching PRs.
- Treat generated types as read-only artifacts.
- For BREAKING changes, request a frontend reviewer and write a release note.

## Pitfalls

- Skill does not run the regeneration — copy-paste the command.
- YAML diff cannot detect semantic equivalence (key reorder may report as no-op correctly, but reformatting will not).
- Description-only changes still trigger a `DOC` classification — safe to ignore.
