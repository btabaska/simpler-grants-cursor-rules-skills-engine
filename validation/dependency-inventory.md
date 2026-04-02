# Dependency Inventory

Generated during Phase 8 Final Validation Pass.

## Compound Engineering Specialists

All 15 canonical specialists are referenced across the 24 rule files:

| Specialist | Files Referencing |
|------------|------------------|
| `codebase-conventions-reviewer` | All 24 files |
| `security-sentinel` | 9 files (api-routes, api-services, api-auth, api-validation, api-error-handling, frontend-services, infra, ci-cd, pr-review + agents) |
| `performance-oracle` | 7 files (api-tests, frontend-tests, ci-cd, pr-review + agents) |
| `code-simplicity-reviewer` | 6 files (api-services, api-validation, frontend-components, frontend-hooks, pr-review + agents) |
| `architecture-strategist` | 10 files (api-routes, api-services, api-auth, api-error-handling, frontend-components, infra, cross-domain, pr-review + agents) |
| `kieran-typescript-reviewer` | 8 files (frontend-*, agent-code-generation, agent-test-generation, agent-i18n, pr-review) |
| `kieran-python-reviewer` | 10 files (api-*, agent-new-endpoint, agent-code-generation, agent-test-generation, agent-migration, pr-review) |
| `julik-frontend-races-reviewer` | 2 files (frontend-hooks, pr-review) |
| `data-integrity-guardian` | 5 files (api-database, api-form-schema, forms-vertical, agent-migration, agent-new-endpoint) |
| `data-migration-expert` | 2 files (agent-migration, pr-review) |
| `schema-drift-detector` | 4 files (api-database, api-form-schema, forms-vertical, agent-migration) |
| `deployment-verification-agent` | 4 files (infra, ci-cd, agent-migration, pr-review) |
| `agent-native-reviewer` | 1 file (pr-review) |
| `pattern-recognition-specialist` | 5 files (frontend-i18n, cross-domain, forms-vertical, agent-code-generation, agent-i18n) |
| `git-history-analyzer` | 2 files (agent-adr, pr-review) |

**Validation:** All specialist names match the canonical list. No typos or hallucinated specialists found.

## MCP Server Tools

| Tool | Call Count | Files Using |
|------|-----------|-------------|
| `get_rule_detail(rule_name)` | 31 | All 24 files |
| `get_architecture_section(section)` | 18 | 18 files |
| `get_rules_for_file(file_path)` | 10 | 10 files |
| `get_conventions_summary()` | 8 | 8 files |
| `list_rules()` | 2 | 2 files (agent-adr, cross-domain) |

**Validation:** All MCP tool calls match the `simpler-grants-context` server API. No invalid tool references found.

## Compound Knowledge References

24/24 files reference Compound Knowledge. All references specify what to look up (indexed documentation, ADR rationale, historical patterns, domain-specific conventions).

## Cross-Rule References

108 total cross-rule references across all 24 files. All references resolve to existing files in `.cursor/rules/`.

## Plugin Dependencies Summary

To use this toolkit at full capability, developers need:

1. **Compound Engineering** (Cursor plugin) — provides 15 specialist sub-agents
2. **Compound Knowledge** (Cursor plugin) — provides documentation knowledge indexing
3. **simpler-grants-context** (custom MCP server) — provides 5 architecture/convention query tools
4. **GitHub MCP server** — provides PR/issue lookup
5. **Filesystem MCP server** — provides file access to documentation
