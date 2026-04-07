# API Contract Test

Generate a contract test that validates an endpoint against the OpenAPI spec.

## What I Need From You

- Endpoint: method + path (e.g. `GET /v1/opportunities/search`).
- Side: `api` or `frontend` (default `api`).
- Optional: a sample payload fixture.

## What Happens Next

1. Locates the handler and Pydantic models (or TS client).
2. Reads the operation from `api/openapi.generated.yml`.
3. Writes a pytest or Vitest file under the conventional contracts directory.
4. Runs the generated test once and reports the result (or drift diff).

## Tips

- Run `/skill-openapi-sync` first if you suspect spec drift.
- Keep contract tests endpoint-focused — put business-logic assertions in unit tests.
- Commit generated fixtures alongside the test so CI is deterministic.
