# `api-docs-sync` Agent — Usage Guide

## Purpose

Detect drift between APIFlask route handlers + Marshmallow schemas and the committed OpenAPI spec, then update the spec, docstrings, and endpoint examples to match the code. Code is the source of truth.

## When to Use

- You added or modified a route handler and want the spec updated in the same PR
- You changed a Marshmallow schema (added/removed/renamed fields, changed validators)
- You're reviewing a PR and suspect the spec is out of date
- You want a one-shot drift audit before a release cut

## When NOT to Use

- You want to refactor route handlers or schemas — use `@agent-refactor`
- You're bumping API versions (`v1` → `v2`) — manual ADR required
- You want to publish or deploy the spec — out of scope

## Invocation

```
/api-docs-sync
@agent-api-docs-sync <route file, endpoint description, PR number, or `audit`>
```

## Examples

### Example 1 — New endpoint

```
@agent-api-docs-sync I added POST /v1/applications/<app_id>/submit that takes
ApplicationSubmissionRequest and returns 200 ApplicationSubmissionResponse
or 400 / 403.
```

Result: new path entry under `/v1/applications/{app_id}/submit`, request body referencing `ApplicationSubmissionRequest`, response shapes for 200/400/403, auth requirement matching the decorator. Diff presented before write.

### Example 2 — Schema field added

```
@agent-api-docs-sync api/src/api/opportunities/schemas.py changed: added
`assistance_listing_numbers: list[str]` to OpportunitySearchResponse
```

Result: classified `additive`. Spec updated to add the field to the existing `OpportunitySearchResponse` component schema. No breaking-change warning.

### Example 3 — Audit

```
@agent-api-docs-sync audit
```

Result: scan of all blueprints, drift report grouped by blueprint and severity, no writes until the user picks which to fix.

### Example 4 — Breaking change refused

```
@agent-api-docs-sync I removed the deprecated `agency_code` field from OpportunityResponse
```

Result: classified `BREAKING`. Agent refuses to write, prints the diff, and recommends pairing the change with `/adr-from-pr`.

## Tips

- Name the specific file or endpoint rather than asking for a full audit
- Pair breaking changes with `/adr-from-pr` so the rationale is captured
- Don't hand-edit `components/schemas` after this agent runs without re-running it — drift will return

## Pitfalls

- The agent edits the spec file it locates first; if your repo has multiple OpenAPI files, confirm which is canonical
- Hand-written `examples` and `description` overrides are preserved unless they contradict the code — review the diff
- The agent does NOT change route handlers; if a docstring is wrong, it updates the spec from the docstring, not the other way around
