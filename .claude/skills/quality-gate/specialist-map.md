# Specialist Map

Domain → specialist(s) mapping for the quality gate pipeline.

## By Code Domain

| Domain | Specialists |
|--------|-----------|
| API routes | `architecture-strategist`, `security-sentinel` |
| API services | `architecture-strategist` |
| API database/models | `data-integrity-guardian` |
| API migrations | `data-migration-expert`, `data-integrity-guardian`, `schema-drift-detector` |
| API auth | `security-sentinel` |
| API validation/schemas | `schema-drift-detector` |
| API tasks | `performance-oracle` |
| API adapters | `performance-oracle` |
| API search | `performance-oracle` |
| Frontend components | `accessibility-auditor` |
| Frontend hooks | `julik-frontend-races-reviewer` |
| Frontend services | `performance-oracle` |
| Frontend E2E tests | `julik-frontend-races-reviewer` |
| Infrastructure | `deployment-verification-agent` |
| CI/CD | `deployment-verification-agent` |

## By Change Type

| Change Type | Additional Specialists |
|-------------|----------------------|
| New files created | `architecture-strategist` |
| Interface changes | `architecture-strategist`, `schema-drift-detector` |
| Auth changes | `security-sentinel` |
| Database queries | `performance-oracle`, `data-integrity-guardian` |
| Async/race-prone code | `julik-frontend-races-reviewer` |
| Cross-domain changes | `pattern-recognition-specialist` |
| Agent/tooling changes | `agent-native-reviewer` |

## Deployment-Sensitive Changes

For changes that affect deployment (migrations, infra, CI):
- Always invoke `deployment-verification-agent`
- Check backward compatibility and zero-downtime safety
