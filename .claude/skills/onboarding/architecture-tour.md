# Architecture Tour

A guided walkthrough of the simpler-grants-gov monorepo. Use this with Cursor's AI — ask questions as you go.

## Stop 1: The Big Picture

Run: `get_architecture_section("overview")` via MCP

simpler-grants-gov is a federal project modernizing the grants.gov experience. It's a monorepo with:
- **api/** — Python/Flask backend with SQLAlchemy ORM
- **frontend/** — Next.js/React/TypeScript with USWDS design system
- **infra/** — Terraform infrastructure-as-code
- **documentation/** — Architecture guides, ADRs, rule documentation

## Stop 2: API Architecture

Run: `get_architecture_section("API Architecture")` via MCP

The API follows a strict layering:
1. **Routes** (`api/src/api/`) — thin HTTP handlers, decorator stack, auth
2. **Services** (`api/src/services/`) — business logic, `db_session` first param
3. **Database** (`api/src/db/`) — SQLAlchemy models, `Mapped[T]` syntax

Key rules to review: `api-routes`, `api-services`, `api-database`, `api-error-handling`

## Stop 3: Frontend Architecture

Run: `get_architecture_section("Frontend Architecture")` via MCP

The frontend uses Next.js App Router with:
1. **Pages** (`frontend/src/app/`) — React Server Components by default
2. **Components** (`frontend/src/components/`) — USWDS-based, domain-organized
3. **Hooks** (`frontend/src/hooks/`) — shared state and behavior
4. **Services** (`frontend/src/services/`) — API integration layer

Key rules to review: `frontend-components`, `frontend-hooks`, `frontend-services`

## Stop 4: The Forms Domain

Run: `get_architecture_section("The Forms Domain")` via MCP

Forms span both API and frontend with a three-schema architecture:
- JSON Schema (data structure)
- UI Schema (presentation)
- Rule Schema (validation/logic)

Key rule: `forms-vertical`

## Stop 5: Infrastructure

Run: `get_architecture_section("Infrastructure & Deployment")` via MCP

Three-layer Terraform structure:
1. **app-config** — configuration and feature flags
2. **service** — ECS services, load balancers
3. **database** — RDS, ElastiCache

Key rule: `infra`

## Stop 6: Testing Philosophy

Run: `get_architecture_section("Testing Philosophy")` via MCP

- API: pytest with factory_boy (`.build()` for unit, `.create()` for integration)
- Frontend: Jest + React Testing Library + jest-axe
- E2E: Playwright with 4-shard parallelism

Key rules: `api-tests`, `frontend-tests`, `frontend-e2e-tests`
