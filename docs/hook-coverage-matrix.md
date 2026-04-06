# Hook Coverage Matrix

Maps ALWAYS/NEVER/MUST directives from rule files to their enforcing hooks.

## API Rules

| Rule File | Directive | Enforcing Hook |
|---|---|---|
| api-services | NEVER put business logic in route handlers | `convention-checker` |
| api-services | NEVER use db_session in route handlers | `convention-checker` |
| api-error-handling | ALWAYS use raise_flask_error() | `convention-checker` |
| api-error-handling | NEVER use bare except | `convention-checker` |
| api-error-handling | Error handling contract in service/route layers | `error-pattern-checker` |
| api-database | NEVER use legacy Column() syntax | `convention-checker` |
| api-database | NEVER use raw SQL strings | `convention-checker` |
| api-database | ALWAYS use back_populates (not backref) | `convention-checker` |
| api-database | ALWAYS use schema='api' in migrations | `convention-checker` |
| api-tests | Test naming and factory conventions | `test-pattern-checker` |

## Frontend Rules

| Rule File | Directive | Enforcing Hook |
|---|---|---|
| frontend-components | No inline styles | `convention-checker` |
| frontend-components | Server components by default | `convention-checker` |
| frontend-components | No barrel files | `convention-checker` |
| frontend-i18n | NEVER hardcode user-facing strings | `convention-checker` |
| frontend-services | Use requesterForEndpoint / useClientFetch | `convention-checker` |
| frontend-tests | Test naming and factory conventions | `test-pattern-checker` |
| accessibility | onClick handlers, alt text, tabIndex, labels | `accessibility-checker` |

## Cross-Domain Rules

| Rule File | Directive | Enforcing Hook |
|---|---|---|
| cross-domain | Structured logging (no f-strings in logs) | `convention-checker` |
| cross-domain | NEVER log PII | `convention-checker` |
| cross-domain | No 'any' type annotations | `convention-checker` |
| cross-domain | Import patterns (relative/absolute) | `import-validator` |

## Security (Not in Rules — Hook-Only)

| Concern | Enforcing Hook |
|---|---|
| Block rm -rf /, sudo, force push | `dangerous-command-guard` |
| Protect .env, credentials, .pem files | `environment-protection` |
| Block production secrets from AI | `secret-redactor` |
| Redact API keys in .env files | `secret-redactor` |
| Block out-of-project filesystem access | `mcp-scope-guard` |

## Audit Trail (Not in Rules — Hook-Only)

| Concern | Enforcing Hook |
|---|---|
| All shell commands | `command-logger` |
| All MCP tool calls | `mcp-tool-logger` |
| All prompt submissions | `prompt-enrichment-logger` |
| Session summaries | `session-summary` |
| Session lifecycle | `audit-log-finalizer` |

## Not Yet Covered by Hooks

These directives rely on rule-based guidance only (no deterministic enforcement):

- Feature flag placement (service layer only)
- ADR formatting and required sections
- PR title format `[Issue N] Description`
- Database migration ordering and naming
- Infrastructure Terraform module conventions
