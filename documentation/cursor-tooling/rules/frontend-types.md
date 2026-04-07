# frontend-types

> Note: the `.cursor/rules/frontend-types.mdc` rule is already present. This companion doc summarizes it.

## Purpose
TypeScript typing conventions for the frontend: shared types, API response types, discriminated unions, and avoidance of `any`.

## Scope / Globs
`frontend/src/types/**/*.ts`, `frontend/src/**/*.d.ts`

## Conventions Enforced
- Shared types co-located under `frontend/src/types/`
- Discriminated unions for state machines
- `type` for unions and aliases, `interface` for extensible object shapes
- No `any`; use `unknown` + narrowing
- API response types generated from/mirrored with OpenAPI

## Examples
Correct: `type RequestState = { status: "idle" } | { status: "loading" } | ...`.
Incorrect: `function foo(x: any)`.

## Related Rules
`frontend-components`, `frontend-services`, `openapi`, `frontend-app-pages`.
