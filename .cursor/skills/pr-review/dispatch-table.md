# PR Review Dispatch Table

File pattern → rule mapping for identifying which conventions apply to changed files.

| Changed files match | Enforce rules from |
|---|---|
| `api/src/api/**/*.py` | `api-routes` rule |
| `api/src/services/**/*.py` | `api-services` rule |
| `api/src/db/**/*.py` | `api-database` rule |
| `api/src/auth/**/*.py` | `api-auth` rule |
| `api/src/validation/**/*.py` | `api-validation` rule |
| `api/src/form_schema/**/*.py` | `api-form-schema` rule |
| `api/src/task/**/*.py` | `api-tasks` rule |
| `api/src/adapters/**/*.py` | `api-adapters` rule |
| `api/src/workflow/**/*.py` | `api-workflow` rule |
| `api/src/search/**/*.py` | `api-search` rule |
| `api/tests/**/*.py` | `api-tests` rule |
| `api/src/**/*.py` (any) | `api-error-handling` rule |
| `frontend/src/app/**/*` | `frontend-app-pages` rule |
| `frontend/src/components/**/*` | `frontend-components` rule |
| `frontend/src/hooks/**/*` | `frontend-hooks` rule |
| `frontend/src/services/**/*` | `frontend-services` rule |
| `frontend/src/i18n/**/*` | `frontend-i18n` rule |
| `frontend/tests/e2e/**/*` | `frontend-e2e-tests` rule |
| `frontend/tests/**/*`, `frontend/e2e/**/*` | `frontend-tests` rule |
| `frontend/src/**/*.tsx`, `frontend/src/**/*.ts` | `accessibility` rule |
| `infra/**/*.tf` | `infra` rule |
| `.github/**/*.yml` | `ci-cd` rule |
| `**/form*/**/*`, `api/src/form_schema/**/*` | `forms-vertical` rule |
| Any file | `cross-domain` rule (always applies) |

Also use `get_rules_for_file()` from the MCP server for dynamic rule discovery that supplements this static table.
