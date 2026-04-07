# api-constants

## Purpose
Standardize how constants, `StrEnum`s, and lookup tables are defined and consumed in the API.

## Scope / Globs
`api/src/constants/**/*.py`, `api/src/db/lookups/**/*.py`, `api/src/**/*_enum.py`

## Conventions Enforced
- `StrEnum` for small immutable dev-time sets
- UPPER_SNAKE_CASE constants grouped by concern in `api/src/constants/`
- Four-tier lookup pattern (StrEnum -> LookupConfig -> LookupTable -> FK columns)
- Single source of truth; no duplicated magic strings
- Lookup rows changed only via Alembic migrations

## Examples
Correct: import `GrantStatus` enum everywhere the value is referenced.
Incorrect: `if status == "DRAFT"` in multiple files.

## Related Rules
`api-database`, `api-form-schema`, `api-validation`, `cross-domain`.
