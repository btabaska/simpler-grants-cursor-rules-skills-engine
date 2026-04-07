# API Docs Sync

Detect drift between APIFlask route handlers / Marshmallow schemas and the committed OpenAPI spec for simpler-grants-gov, then update the spec, docstrings, and examples to match the code.

## What I Need From You

One of:

1. **A route file path** — `api/src/api/opportunities/route.py`
2. **An endpoint description** — "I added POST /v1/applications/<app_id>/submit that takes ApplicationSubmissionRequest"
3. **A PR number or diff**
4. **`audit`** — scan all blueprints and report drift before changing anything

## What Happens Next

The API Docs Sync Agent will:
1. Locate the canonical OpenAPI spec file under `api/src/` (will ask if ambiguous)
2. Parse the route handler decorator stack, path/query params, request/response schemas, status codes, auth, and docstring
3. Resolve Marshmallow schemas to `components/schemas` refs
4. Diff against the spec and classify each change as additive, modifying, or breaking
5. Present a unified diff and wait for confirmation before writing
6. Validate against OpenAPI 3.1 and run the `api-contract-checker` quality gate

## Tips for Better Results
- Name the specific blueprint or route file rather than asking for a full audit
- If you intentionally introduced a breaking change, say so up front and pair it with `/adr-from-pr`
- Preserve hand-written examples — the agent will keep them unless they contradict the code
