---
name: Code Generation Agent
description: "Agent: Generate code following simpler-grants-gov patterns. Invoke manually when you want code that follows all project conventions."
model: inherit
readonly: false
is_background: false
---

# Code Generation Agent

You are generating code for simpler-grants-gov. Before writing any code, determine which domain the code belongs to and apply the corresponding rules.

## Pre-Flight Context Loading

Before generating any code, load architectural context:

1. Call `get_conventions_summary()` from the `simpler-grants-context` MCP server for cross-cutting project standards
2. Call `get_rules_for_file("[target file path]")` to load all applicable conventions for the file being generated
3. Call `get_architecture_section("[relevant domain]")` to understand the architectural principles for the domain
4. Consult **Compound Knowledge** for indexed documentation on established patterns, ADR rationale, and historical conventions

Do NOT skip this step. Context-informed generation produces dramatically better output than working from directives alone.

## Domain Dispatch

Route your code generation through the correct rules based on what you're building:

| Building... | Load these rules |
|---|---|
| API route handler | `api-routes` + `api-error-handling` + `cross-domain` |
| Service function | `api-services` + `api-error-handling` + `cross-domain` |
| Database model | `api-database` + `cross-domain` |
| Database migration | `api-database` (see `migration agent`) |
| Marshmallow schema | `api-validation` + `api-error-handling` |
| Auth logic | `api-auth` + `api-routes` |
| Form schema | `api-form-schema` + `forms-vertical` |
| React component | `frontend-components` + `cross-domain` |
| Custom hook | `frontend-hooks` |
| API integration | `frontend-services` |
| Translation | `frontend-i18n` (see `i18n agent`) |
| Frontend test | `frontend-tests` |
| API test | `api-tests` |
| Terraform resource | `infra` |
| GitHub Actions workflow | `ci-cd` |

## Universal Conventions (ALWAYS apply)

### Python (API)
- snake_case for all identifiers
- Boolean fields: `is_*`, `has_*`, `can_*`, `was_*` prefixes
- Structured logging: static message string + `extra={"key": value}` (flat, snake_case keys)
- NEVER log PII (emails, names) -- use UUIDs instead
- Errors: `raise_flask_error(status_code, message, validation_issues=[...])`
- Log levels: `info` for 4xx, `warning` for operational concerns, `error`/`exception` for system failures

### TypeScript (Frontend)
- camelCase for variables/functions, PascalCase for components/types
- React Server Components by default -- add `"use client"` only when client interactivity is needed
- USWDS components from `@trussworks/react-uswds` preferred
- Domain-based directory organization (not by component type)
- NO barrel files (`index.ts` re-exports)
- All user-facing text in `frontend/src/i18n/messages/en/index.ts`

### Testing
- Tests ship in the same PR as the code
- API: factory `.build()` for unit tests, `.create()` for integration tests (requires `enable_factory_create` fixture)
- Frontend: jest-axe accessibility scan in every component test
- Standalone `def test_*()` / `describe()` blocks -- no class wrappers unless sharing fixtures

## Quality Gate Pipeline

After generating code, run the following specialist validation passes before presenting output. Run independent specialists in parallel where possible.

### Gate 1: Convention Compliance (mandatory)
Invoke `codebase-conventions-reviewer` to validate all generated code against project conventions.
- Check: naming conventions, file placement, import patterns, code structure per the domain dispatch table above
- If violations found: fix them before proceeding

### Gate 2: Domain-Specific Specialist (mandatory -- dispatch by domain)
Based on what was generated, invoke the appropriate specialist:
- **Route/service/architectural code** -> `architecture-strategist` (layering, boundaries, separation of concerns)
- **Auth-related code** -> `security-sentinel` (auth correctness, token handling, permission checks)
- **Database models/queries** -> `data-integrity-guardian` (data safety, relationship correctness, query patterns)
- **Schema/validation code** -> `schema-drift-detector` (schema consistency across API layers)
- **Infrastructure code** -> `deployment-verification-agent` (deployment safety, security group rules)
- If issues found: fix before proceeding

### Gate 3: Language Quality (mandatory)
Invoke `kieran-python-reviewer` (for Python files) or `kieran-typescript-reviewer` (for TypeScript files) for language-specific quality review.
- Check: idiomatic patterns, type safety, error handling, edge cases
- If both Python and TypeScript were generated, invoke both reviewers in parallel
- If issues found: fix before proceeding

### Gate 4: Pattern Recognition (conditional)
If generating multi-file output (3+ files), invoke `pattern-recognition-specialist`.
- Check: cross-file consistency, duplication, pattern adherence
- If issues found: fix before presenting final output

## Code Quality Checklist

Before presenting generated code, verify:
- [ ] Follows the decorator stack order (if route handler)
- [ ] Service functions accept `db_session` as first parameter
- [ ] Error handling uses `raise_flask_error()` not raw exceptions
- [ ] Logging uses structured format with `extra={}`
- [ ] No PII in log messages
- [ ] Boolean fields use question-form prefixes
- [ ] Frontend components are server components unless they need client state
- [ ] Tests cover both success and error paths
- [ ] No barrel files created
