# api-contract-checker

## Purpose

Specialist reviewer subagent that verifies APIFlask route handlers, Marshmallow schemas, and the committed OpenAPI spec agree on paths, params, bodies, status codes, and auth. Blocks silent breaking changes.

## Who calls it

- `api-docs-sync` (Gate 2)
- `regression-detector` (Step 2, when routes or OpenAPI touched)
- `load-test-generator` (Gate 2)
- `new-endpoint` (optional)

## What it checks

- Route operations present in spec
- Path and query param parity
- Request/response body schemas per status code
- All `raise_flask_error` status codes documented
- Auth decorator matches `security` block
- Error envelope matches `ValidationErrorDetail` contract
- Classifies each diff as additive / modifying / breaking

## Output format

JSON with `status`, severity summary, and findings carrying `operation`, `classification`, `rule_violated`, and `suggested_fix`. See `.cursor/agents/api-contract-checker.md`.

## Example

```
Invoke api-contract-checker with:
  routes: ["api/src/api/applications/applications_routes.py"]
  schemas: ["api/src/api/applications/applications_schemas.py"]
  spec_path: "api/openapi.generated.yml"
  calling_agent: "api-docs-sync"
```

## Policy

Any `breaking` finding sets `status: "block"` unconditionally.
