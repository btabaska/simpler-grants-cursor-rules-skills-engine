# simpler-grants-gov Architecture & Philosophy Guide

> **Status:** Draft — pending tech lead validation. Patterns marked with (⏳) are awaiting team confirmation. This guide was generated from analysis of 1,459 merged pull requests spanning 12 months of development history, 50 Architecture Decision Records, and cross-domain pattern synthesis across 14 codebase domains.

---

## 1. Mission & Context

Simpler.grants.gov is a modernization initiative for Grants.gov, the federal government's central portal for finding and applying for federal financial assistance. The project's vision is to make Grants.gov "an extremely simple, accessible, and easy-to-use tool for posting, finding, sharing, and applying for federal financial assistance." Three pillars guide every technical and product decision: make grants.gov **easy** (lower friction for both grantors and applicants), make it **accessible and collaborative** (ensure all communities have access, especially those with limited resources), and make it **transparent and participatory** (work in the open, share data, and show the public how decisions are made).

The project is fully open-source, licensed under CC0 public domain. This is not incidental — open source is a core value that influences technology choices throughout the stack (Python over proprietary languages, PostgreSQL over Oracle, OpenSearch over Elasticsearch, Metabase over QuickSight). When the team evaluates tools, "can an external contributor replicate this?" is a real consideration.

Simpler.grants.gov does not replace the legacy Grants.gov system overnight. The two systems coexist: the legacy Oracle-backed Grants.gov continues to operate while simpler.grants.gov progressively takes over user-facing functionality. Data flows from Oracle to PostgreSQL via AWS DMS replication, and for grant application forms, XML output must match the legacy system's element ordering, namespaces, and enum values exactly. Understanding this coexistence — and the constraints it creates — is essential context for working in this codebase.

The project is organized into workstreams that reflect its product surface areas: SimplerFind (search and opportunity listing), SimplerApply (application workflow), SimplerEngagement (community collaboration), SimplerPlatform (infrastructure and scaling), SimplerReporting (metrics and dashboards), SimplerDelivery (project management), CommonGrants (shared protocol), and SimplerNOFOs (Notice of Funding Opportunities). These workstreams map loosely to code areas but are primarily a product planning construct.

## 2. Project Structure

The primary codebase lives in a monorepo at `HHS/simpler-grants-gov`, though the project follows a hybrid repository strategy (per its repo organization ADR) that includes separate repositories for the PDF builder (`simpler-grants-pdf-builder`) and the shared grants protocol specification (`simpler-grants-protocol`). Product and delivery planning lives in `grants-product-and-delivery`, and private NOFO workstream management in `nofo-transformation`. This separation reflects Conway's Law in practice — different teams with different release cadences get their own repositories.

Within the main monorepo, the top-level structure is:

The **`api/`** directory contains the Python API built with Flask and APIFlask. Source code lives in `api/src/`, with subdirectories organizing code by concern: `api/src/api/` for route handlers and schemas, `api/src/services/` for business logic, `api/src/db/` for database models and migrations, `api/src/auth/` for authentication, `api/src/validation/` for validation constants and utilities, and `api/src/form_schema/` for the grant application form system. Tests mirror this structure under `api/tests/`.

The **`frontend/`** directory contains the Next.js web application. Components live in `frontend/src/components/` organized by domain (not by technical type), hooks in `frontend/src/hooks/`, API integration services in `frontend/src/services/`, and internationalization in `frontend/src/i18n/`. Tests live in `frontend/tests/` with a parallel directory structure, though there is an ongoing discussion about co-locating tests alongside source files (⏳).

The **`infra/`** directory contains Terraform modules organized in a three-layer architecture (described in detail in Section 9). Each application surface (API, frontend, analytics, etc.) follows the same `app-config/` → `service/` → `database/` layering.

The **`documentation/`** directory holds project documentation, including the Architecture Decision Records in `documentation/decisions/adr/`, project goals, deliverables, and dependency mappings between workstreams.

The **`.github/`** directory contains GitHub Actions workflows for CI/CD, issue templates, and (until recently) CODEOWNERS configuration. The CODEOWNERS file was removed in favor of a GitHub Action-based review assignment model, reflecting the team's preference for programmable governance over static file ownership.

## 3. Tech Stack & Rationale

Every major technology choice in the stack has a corresponding ADR with documented rationale. Understanding not just *what* the team chose but *why* helps you make decisions that align with the project's values and constraints.

**Python and Flask** power the API. Python was selected for its accessibility (easy for new contributors to learn), its open-source ecosystem, and its strength in data processing — important given the complex datasets flowing from the legacy Grants.gov system. The team evaluated Django (rejected as too monolithic for the project's needs) and FastAPI (rejected due to concerns about single-maintainer risk at the time of evaluation). Flask was chosen for its lightweight, unopinionated nature and because Nava PBC's platform template provided a pre-configured Flask foundation including CI/CD, Docker setup, database migrations, and monitoring integration. The project extends Flask with APIFlask, which provides code-first OpenAPI spec generation and schema-based request/response validation via Marshmallow.

**Next.js with TypeScript** powers the frontend. The team selected Next.js for its support of server-side rendering (critical for authenticated, data-heavy pages), its large community, and again the availability of a Nava platform template. TypeScript was a natural choice for type safety. The project uses the App Router with React Server Components as the default rendering strategy — the team's rationale is direct: "You can make your server fast, but you can't control the user's device." Components are server-rendered unless they require client-side interactivity, in which case they explicitly declare `"use client"`.

**PostgreSQL on Amazon RDS** serves as the primary database. The choice was driven by PostgreSQL's advanced features (materialized views, complex query support), its open-source nature, and its ability to handle the high-frequency writes and complex relational queries inherent in grants data. The legacy Grants.gov system runs on Oracle, and data is replicated to PostgreSQL via AWS Database Migration Service (DMS) with VPC peering.

**OpenSearch** handles search functionality. The team chose OpenSearch over Elasticsearch following Elastic's license change controversy, aligning with the project's commitment to open-source licensing integrity.

**Terraform and Docker** manage infrastructure as code. Terraform was selected for its interoperability, broad adoption, excellent documentation, and availability of Nava infrastructure templates. All services run as Docker containers on AWS ECS with Fargate (serverless containers), chosen for consistent deployment across the API and frontend layers. Lambda was considered but rejected due to its 15-minute execution limit; S3 static hosting was rejected because the application requires server-side rendering.

**AWS** is the cloud provider, driven primarily by HHS's existing AWS relationship and FedRAMP authorization requirements. FedRAMP compliance is a hard constraint that shapes nearly every technology decision — tools that lack FedRAMP authorization (such as Discourse, which the project uses for community forums) require special justification and risk acceptance.

**New Relic** provides application performance monitoring and is the primary observability platform. It was selected for its comprehensive APM feature set and FedRAMP authorization. AWS CloudWatch supplements New Relic for security and compliance logging. The structured logging patterns described in Section 10 are designed specifically to enable effective querying and alerting in New Relic.

**USWDS (U.S. Web Design System)** is the frontend design system, accessed via the react-uswds component library. This is not optional — it is required by the 21st Century Integrated Digital Experience Act (21st Century IDEA) and maintained by the General Services Administration (GSA). The project wraps USWDS primitives in project-specific components (like `SimplerModal`) to handle framework-specific concerns like SSR safety and consistent behavior across the application.

## 4. API Architecture

The API follows a layered architecture with a strict separation of concerns. Understanding this layering — and where each type of logic belongs — is the single most important thing for a new API contributor to internalize.

**Routes are thin.** A route handler's job is to accept a request, call the appropriate service function, and return the response. It should not contain business logic, validation logic, or complex data transformation. This principle is one of the most consistently enforced patterns across 153 API route PRs. If you find yourself writing more than a few lines of logic in a route handler, you are almost certainly putting code in the wrong place.

Every route handler follows a prescribed decorator stack, and the ordering is immutable. From top to bottom: the HTTP method decorator (`@blueprint.post`), the input schema (`@blueprint.input`), the output schema (`@blueprint.output`), the documentation decorator (`@blueprint.doc`), the authentication decorator (`@blueprint.auth_required`), and finally the database session injection (`@flask_db.with_db_session`). This ordering is enforced in 100% of route handlers and is immediately flagged when violated in code review. For the detailed decorator patterns and code examples, see `documentation/rules/api-routes.md`.

**The service layer holds business logic.** Service functions live in `api/src/services/`, organized by domain (e.g., `applications/`, `opportunities/`, `users/`). Each service file typically contains a single public function. Service functions always accept `db_session` as their first parameter, but critically, they do *not* manage transaction boundaries — that responsibility belongs to the route layer via `with db_session.begin():` blocks. This separation ensures that services can be composed (one service calling another) without creating nested transaction problems.

**Database access** uses SQLAlchemy with a set of strictly enforced conventions. All models inherit from `ApiSchemaTable` and `TimestampMixin`, use UUID primary keys (with `default=uuid.uuid4`), and follow singular table names (e.g., `application`, not `applications`). The project uses a four-layer lookup table pattern for enumerated values: a `StrEnum` defining the values, a `LookupConfig` mapping them, a `LookupTable` model, and a `LookupColumn` on the referencing model. Importantly, adding new values to a lookup table does *not* require a database migration — the sync process handles it automatically. Migrations use Alembic with a `YYYY_MM_DD_<slug>.py` naming convention and always declare the `api` schema explicitly.

For database queries, the team uses `select()` with `scalar_one_or_none()` (never the legacy `query()` API) and always wraps database operations in `db_session.begin()`. Relationship loading must be explicit — `selectinload(Model.relationship)` for each needed relationship — and the wildcard `selectinload("*")` is strictly forbidden. Soft deletes are the standard for user-facing deletion operations, preserving audit trails.

**Error handling** follows a centralized pattern built around `raise_flask_error()`. All API errors — whether validation failures, authorization denials, or not-found conditions — flow through this function with a list of `ValidationErrorDetail` objects. Each detail includes a `type` (from the `ValidationErrorType` StrEnum), a human-readable `message`, and optional `field` and `value` parameters. The `type` field is the API-frontend contract: the frontend maps these type strings to localized user messages. This pattern is foundational to how errors propagate through the system and is covered in depth in Section 7.

**Authentication** has evolved through several phases and currently uses a multi-auth composition pattern. The current standard is JWT + API key multi-auth, implemented via a `MultiHttpTokenAuth` class that accepts either a JWT bearer token or an API key. All new endpoints must use the multi-auth pattern (⏳ — the canonical name for the multi-auth object is pending resolution between `jwt_or_key_multi_auth` and `jwt_or_api_user_key_multi_auth`). An important framework-specific constraint: APIFlask does not support multi-auth in its `@blueprint.auth_required()` decorator, so the project uses Flask's native `@multi_auth.login_required` instead. Role-based access control (RBAC) is implemented through `can_access()` and `verify_access()` utility functions, and authorization checks must come *after* 404 checks but *before* business logic to prevent information leakage.

For the complete set of API conventions with code examples, see the Tier 2 documents: `documentation/rules/api-routes.md`, `documentation/rules/api-services.md`, `documentation/rules/api-database.md`, and `documentation/rules/api-auth.md`.

## 5. Frontend Architecture

The frontend is a Next.js application using the App Router and React Server Components. The foundational principle is **server-first rendering**: components are React Server Components by default, and the `"use client"` directive is added only when a component needs hooks, event handlers, or other client-side interactivity. This is not a suggestion — it is actively enforced in code review across 293 frontend component PRs.

**Component organization** follows a domain-based directory structure under `frontend/src/components/`. Components are grouped by feature area (e.g., `search/`, `application/`, `workspace/`), not by technical type (e.g., no `buttons/` or `modals/` directories). This structure was formally codified in PR #4414 and is consistently followed. The project does not use barrel files (`index.ts` for re-exports) — all imports reference the specific file directly. When a component or utility is shared across multiple features, it moves to `frontend/src/utils/` rather than being duplicated.

**Data fetching** follows a clear duality based on rendering context. For server-side fetching (the majority of cases), the project uses `requesterForEndpoint()`, a factory function that creates typed fetch functions from an `EndpointConfig`. These server-side fetchers are wrapped in React's `cache()` for automatic deduplication within a single render pass. A notable pattern is passing unresolved promises as props to child components — the naming convention uses `varNamePromise` for the promise and `resolvedVarName` for the awaited value, enabling non-blocking data loading without unnecessary Suspense boundaries.

For client-side fetching (in `"use client"` components), the project uses the `useClientFetch<T>()` hook, which handles token expiration detection, automatic logout on 401 responses, and JSON parsing. A known constraint: `useClientFetch` cannot be added to `useEffect` dependency arrays without causing infinite re-renders. For form submissions on the client, the project is progressively adopting `useActionState` with server actions, which is becoming the preferred pattern over `useClientFetch` for POST operations.

**Styling** follows the USWDS three-tier hierarchy. The first choice is USWDS design tokens and settings variables. When tokens don't cover the need, USWDS utility classes are the next option. Custom CSS (in SCSS files) is the last resort. The project wraps several USWDS primitives in project-specific components to handle framework integration concerns — `SimplerModal`, for example, consolidates Truss Modal's SSR safety requirements, Escape key handling, and custom close behavior into a single component that other developers can use without understanding those complexities.

**Props and types** follow several consistently enforced conventions. Props are destructured with inline type annotations — the project does not use `React.FC`. TypeScript `type` is preferred over `interface` unless extension is specifically needed. When a component needs data, it receives whole objects (or `Pick<>` types) rather than many individual scalar props, which reduces prop drilling and makes refactoring easier. Pure helper functions are defined outside component bodies, and reusable logic is extracted to `frontend/src/utils/`.

**Internationalization** uses `next-intl` with a single centralized translation file at `frontend/src/i18n/messages/en/index.ts`. All user-facing strings must come through the `useTranslations` hook (client components) or `getTranslations` (server components), scoped as narrowly as practical using dot-namespaced keys. Keys follow camelCase naming (formally enforced in PR #5143, which renamed 120+ keys across 59 files) with PascalCase for top-level namespaces. Rich text with inline formatting uses `t.rich()` with XML-like tags that map to React components. The project currently supports English only, though the full locale routing infrastructure is in place for future multi-language support (⏳).

**Strict equality** is mandatory — `!==` and `===` only, never `!=` or `==`. Conditional rendering uses ternary operators rather than `&&` to avoid a known React bug where `.length && <Component>` renders `0` to the DOM.

For the complete frontend conventions, see `documentation/rules/frontend-components.md`, `documentation/rules/frontend-services.md`, `documentation/rules/frontend-i18n.md`, and `documentation/rules/frontend-hooks.md`.

## 6. The Forms Domain

The grant application forms system is the project's most complex domain, spanning the full stack from database models through XML generation to frontend rendering. It has enough unique conventions to warrant dedicated documentation beyond what the general API and frontend patterns cover.

The system is built on a **three-schema architecture**. Each grant application form is defined by three JSON documents working in concert. The **JSON Schema** (Draft 2020-12) defines the data structure — what fields exist, their types, and basic validation constraints. The **UI Schema** defines how those fields render in the frontend — layout, ordering, grouping into sections, and field-level display configuration using a hierarchy of `section`, `field`, and `multiField` elements. The **Rule Schema** defines behavior that cannot be expressed in standard JSON Schema — cross-field validation, date ordering constraints, field auto-population from application context, and conditional logic. Rules are organized into groups (`gg_pre_population`, `gg_post_population`, `gg_validation`) and are processed recursively against the form response data.

The project has extended the JSON Schema library with a custom validator (`OUR_VALIDATOR`) that fixes a longstanding gap in how required-field validation errors report their paths. This is not a quirk — it is a deliberate fix for a 10+ year deficiency in the standard library, and new form developers need to use `OUR_VALIDATOR` rather than the default validator.

**Validation follows a non-blocking philosophy during editing.** When an applicant saves a form, validation runs but returns warnings rather than blocking errors. Only at submission time does validation become blocking. This approach reflects an architectural principle specific to federal forms: complex multi-page applications should never lose user progress, and applicants should be able to save incomplete work and return later. The `ValidationErrorDetail` types for form validation (`MISSING_REQUIRED_FORM`, `APPLICATION_FORM_VALIDATION`) propagate to the frontend where they can direct users to specific forms and fields that need attention.

**XML generation** is a critical requirement for legacy Grants.gov compatibility. Each form type defines declarative transform rules that map JSON form responses to XML elements. The output must precisely match legacy format expectations — element ordering, namespace declarations, and enum values from `UniversalCodes-V2.0.xsd`. Tests compare generated XML against known-good samples from the legacy system to catch format regressions. Three XML namespaces (`att`, `globLib`, `glob`) must always be declared, even when not directly referenced, to maintain parser compatibility.

The forms domain encompasses several grant-specific form types: the SF-424 family (standard federal forms), CD511 (certification forms), budget narratives, and attachment handling. Each has its own schema definitions and transform rules, but all follow the three-schema architecture. Section labels in the UI Schema must match the corresponding PDF form exactly — this is not cosmetic but functional, as it ensures applicants can map between the digital and paper versions of the form.

For the complete forms conventions, see `documentation/rules/api-form-schema.md` and the forms vertical review document.

## 7. How the API and Frontend Communicate

The API and frontend communicate via REST endpoints, but the contract between them goes deeper than HTTP verbs and JSON payloads. Understanding the error propagation path and authentication flow is essential for working on either side of the boundary.

**Authentication** flows through the `X-SGG-Token` header. Every authenticated request from the frontend includes this header, which carries a JWT token issued after login.gov authentication. On the frontend, `getSession()` is the sole entry point for obtaining the current user's session — there is no other way to access auth state, and you should always check for a null session before making authenticated API calls. The frontend includes `AuthenticationGate` and `AuthorizationGate` components for page-level access control, ensuring unauthenticated or unauthorized users see appropriate messaging rather than broken pages.

Token expiration is handled proactively. The `useClientFetch` hook detects token expiration on both route changes and individual API calls, triggering automatic logout when a token is no longer valid. Auth timing constants live in `frontend/src/constants/auth.ts` and express expiration thresholds in milliseconds.

**Error propagation** follows a structured path. When the API encounters a problem — whether a validation failure, a permission denial, or a missing resource — it raises the error via `raise_flask_error()` with a list of `ValidationErrorDetail` objects. Each detail's `type` field (from the `ValidationErrorType` StrEnum) is the primary contract between API and frontend. The frontend maps these type strings to localized user messages via its i18n system. The `message` field on each error serves as a fallback for direct API consumers but should not be displayed to end users in the web application.

On the frontend side, errors from API calls flow through `ApiRequestError`, a structured error class with `parseErrorStatus()` for type-safe error handling. Server-side fetcher functions catch and wrap API errors, making them available to components in a consistent format. Some fetchers silently return empty arrays on authentication failure rather than throwing (⏳ — this pattern is flagged for review as it may mask legitimate errors).

**Server-side vs. client-side requests** are architecturally distinct. Server-side requests (the majority) go through `requesterForEndpoint()` and execute during React Server Component rendering — they never touch the browser. Client-side requests go through `useClientFetch<T>()` and execute in the browser, carrying the user's token. This duality means that a new endpoint needs to be consumed differently depending on whether the page component is a server component or a client component. The Tier 2 documents cover the specific patterns for each case.

**Type sharing** across the language boundary does not happen automatically. The API defines schemas in Python (Marshmallow for request/response schemas, Pydantic for service-layer parameter validation) and the frontend defines types in TypeScript. There is no code generation step that keeps these in sync — they are maintained independently. This means that when an API response shape changes, the corresponding TypeScript types must be updated manually.

## 8. Testing Philosophy

Testing in simpler-grants-gov is not optional or afterthought — tests ship with code in the same PR, and this expectation is consistently enforced in code review. The project maintains distinct testing strategies for the API and frontend, with a shared philosophy: test what matters, at the right level of abstraction, without creating a maintenance burden.

**API testing** uses pytest with factory_boy for test data generation. The most important pattern to internalize is the distinction between `.build()` and `.create()`: use `Factory.build()` when your test does not need database persistence (unit tests of service logic, validation functions), and `Factory.create()` when your test requires records to exist in the database (route handler tests, integration tests). This is one of the most frequently corrected patterns in code review — the primary API reviewer (chouinar) regularly redirects contributors from `.create()` to `.build()` when no database access is needed. The `enable_factory_create` fixture must be included in any test that uses `.create()`.

Test files mirror the source structure (e.g., tests for `api/src/services/applications/submit_application.py` live at `api/tests/src/services/applications/test_submit_application.py`). Shared test utilities, factories, and fixtures live in `conftest.py` files at appropriate directory levels. For time-dependent tests (such as competition window validation), the `freezegun` library's `@freeze_time` decorator is used with module-level `TEST_DATE` constants and parametrized boundary conditions.

The project targets 80% code coverage for the backend (per its testing ADR), though the emphasis is on meaningful coverage rather than hitting a number. Tests should assert on behavior and outcomes, not implementation details.

**Frontend unit testing** uses Jest with React Testing Library (RTL) and has a mandatory accessibility component: every component test must include a `jest-axe` scan with `toHaveNoViolations()`. This is non-negotiable and reflects the project's legal obligation under Section 508 accessibility requirements and its commitment to the USWDS design system. Skipping `jest-axe` in a component test will be flagged in code review.

Async server components present a testing challenge that the project handles with a specific pattern: call the async component as a function, `await` the result, then pass it to RTL's `render()`. This avoids the complexity of testing server components through the full Next.js rendering pipeline.

Test mocking is centralized. Translation mocks live in `frontend/src/utils/testing/intlMocks.ts`, and shared test fixtures in `frontend/src/utils/testing/fixtures.ts`. Tests assert on translation *keys*, not translated *values* — this decouples test correctness from copy changes. When adding new translations that appear in tests, both the real translation file and `intlMocks.ts` must be updated in sync.

**End-to-end testing** uses Playwright with multi-browser support (Chromium, Firefox, WebKit, and Mobile Chrome). Tests run in CI with 4-way sharding for parallelism, and reports are merged from shard artifacts. Authentication in E2E tests is handled via spoofed session cookies (`createSpoofedSessionCookie()`) that bypass the login.gov flow entirely — this avoids flaky dependencies on external auth services in CI.

E2E tests use a tagging system for organizing test runs: `@smoke` for critical happy-path tests that run on every PR, `@core-regression` for broader coverage, `@full-regression` for comprehensive runs, and `@extended` for edge cases. The project is progressively adopting a Page Object Model for form-related E2E tests (⏳), which wraps page interactions in reusable abstractions.

For the complete testing conventions, see `documentation/rules/api-tests.md`, `documentation/rules/frontend-tests.md`, and the related domain-specific documents.

## 9. Infrastructure & Deployment

The infrastructure is managed entirely through Terraform, following a modular architecture that provides consistency across all application surfaces while allowing per-application customization.

**The three-layer module structure** is universal. Every application (API, frontend, analytics, etc.) is organized into three Terraform layers: `app-config/` defines environment-specific configuration and variable values, `service/` defines the ECS service, load balancer, and runtime resources, and `database/` defines RDS instances and related storage. This separation has a critical operational constraint: `app-config/` runs in CI pipelines that do not have AWS credentials, so it must not contain AWS data sources or resource lookups — those belong in the `service/` layer only. Each environment (dev, staging, training, prod) gets its own `.tf` file in `app-config/` that calls the module with environment-specific values.

**Feature flags** are gated through a combination of Terraform variables and AWS SSM Parameter Store. The Terraform pattern uses boolean variables with `count`: `count = var.enable_feature ? 1 : 0`. When referencing feature-gated resources elsewhere, you must use indexed access (`resource[0]`) because the resource may not exist. SSM parameters store the runtime feature flag values that the application reads, and a critical operational rule is that SSM parameters must exist in all environments (dev, staging, training, prod) before the PR that references them is merged. This prevents deployment failures from missing parameters.

**Environment variables** follow a two-tier system. Plain configuration values go in `default_extra_environment_variables` maps. Secrets and sensitive values are stored in SSM Parameter Store and referenced via a `secrets` map that includes a `manage_method` field. Feature flags typically use `manage_method = "manual"` to allow toggling without Terraform changes.

**Deployment** follows a four-environment promotion chain: dev → staging → training → prod. CI/CD workflows deploy automatically on merge to the main branch, with serialized deployments (`max-parallel: 1, fail-fast: false`) to prevent environment race conditions. The CI pipeline follows a three-job structure: checks (lint, test, build) → deploy (per-environment) → notify. Release-event-triggered workflows handle production deployments, with manual dispatch as an escape hatch.

**Security scanning** uses a triple-scanner approach: Trivy for container vulnerability scanning, Anchore/Grype for software composition analysis, and Dockle for container best practices. False positives are managed through `.trivyignore` and `.dockleignore` files. Checkov scans Terraform for security misconfigurations, and any Checkov skip annotations must include the rule ID and a reference to a tracking issue — unannotated skips are not acceptable.

**IAM permissions** follow least-privilege principles with separated policy documents per concern (task execution, runtime logging, email access, API gateway access). A common mistake caught in code review is attaching runtime permissions to the `task_executor` role instead of the `app_service` role — these are distinct and serve different purposes.

Shared infrastructure modules live in `infra/modules/` and include standardized patterns for SQS queues (main queue + dead letter queue + encryption + IAM access policy), secrets management, domain configuration, and monitoring. Terraform lock files (`.terraform.lock.hcl`) are committed to the repository for reproducible builds.

For the complete infrastructure conventions, see `documentation/rules/infra.md` and `documentation/rules/ci-cd.md`.

## 10. Cross-Cutting Conventions

Several conventions transcend individual domains and apply everywhere in the codebase. These are the patterns that a new contributor will encounter regardless of which part of the system they work in, and they represent the team's most consistently enforced standards.

**Structured logging** is the single most frequently enforced convention across the entire codebase, with 10+ explicit reviewer corrections documented in the PR history. The rule is straightforward: log messages must be static strings, and all dynamic values (IDs, counts, statuses, dates) go in the `extra={}` parameter dictionary. Keys in `extra` must be flat snake_case (e.g., `user_id`, `application_id`) — never dotted or nested (e.g., never `user.id` or `application.application_id`). The `auth.` prefix is a documented exception for auth-specific fields. This convention exists because the team queries logs in New Relic, where static messages enable count aggregation and dynamic values in `extra` appear as searchable, filterable attributes. Putting variable text in log messages makes them impossible to group and count meaningfully.

**Log level discipline** is the companion rule to structured logging. Expected client errors (all 4xx status codes — bad requests, unauthorized, forbidden, not found, unprocessable entity) must be logged at `info` level. `warning` is reserved for operational concerns that may require attention but are not errors. `error` and `exception` are for actual system failures. The reason is practical: warning-level logs trigger alerts in New Relic. Logging a routine 404 as a warning means the on-call engineer gets paged for normal user behavior.

**PII protection** in logs is absolute. Never log email addresses, names, or other personally identifiable information. Even in error contexts, log the user's UUID rather than their email.

**Boolean naming** follows a question-form convention: fields and variables that hold boolean values must be prefixed with `is_`, `has_`, `can_`, or `was_`. This applies across both Python and TypeScript code.

**The "fail loudly, never silently" principle** pervades the codebase. When something is wrong — an invalid schema, a missing parameter, an unexpected state — the code should raise an explicit error rather than returning a default value or silently continuing. Invalid form schemas produce 500 errors, not undefined behavior. Missing configuration fails the application at startup, not at runtime. This principle is particularly important in the forms domain, where silently swallowing a validation error could result in a grant application being submitted with missing data.

**Convention over configuration, enforced by review.** The project relies on code review rather than automated linting for most convention enforcement. There are no ESLint rules for boolean naming, no Ruff rules for log message formatting, no automated checks for the route decorator stack order. Instead, experienced reviewers (primarily chouinar for API code and doug-s-nava for frontend code) enforce conventions through PR review. This is both a strength (human judgment can handle nuance) and a known gap (new reviewers may not catch convention violations). The team acknowledges that adding automated enforcement for the most critical conventions is an area for future investment.

**Feature flag gating** controls the rollout of new functionality. On the API side, feature flags typically use environment variables like `ENABLE_{FEATURE}_ENDPOINTS` with conditional route registration. On the infrastructure side, Terraform boolean variables control resource creation. On the frontend, SSM-backed feature flags follow a `FEATURE_{NAME}_OFF` naming pattern, read through Next.js environment configuration. Note that there is a known inconsistency in feature flag naming across these three surfaces (see Section 13).

## 11. Development Workflow

The project follows trunk-based development on the `main` branch with squash-and-merge as the standard merge strategy. The squash-and-merge approach was chosen to reduce the cognitive load of reading commit history — each PR becomes a single commit on main with a clear description, rather than a series of work-in-progress commits.

**Pull request conventions** follow the format `[Issue N] Description`, linking each PR to the GitHub issue it addresses. PRs are expected to include tests, pass all CI checks (linting, type checking, test suites, security scans), and follow the coding conventions documented in this guide and the Tier 2 rule documents. The CONTRIBUTING.md file outlines the process for external contributors, including forking, branching, and the pull request template.

**Code review** is where conventions are enforced. The project has an informal but well-understood reviewer authority model, identified through analysis of 12 months of review patterns:

On the API side, **chouinar** is the primary authority for database patterns, service layer architecture, logging conventions, authentication, query patterns, and transaction management. Chouinar's review comments are decisive and pattern-setting — when chouinar corrects a pattern, it becomes the canonical approach. Other API reviewers include joshtonava (schema validation, fail-loud behavior), mikehgrantsgov (multi-auth patterns), and doug-s-nava (form UI schema alignment).

On the frontend side, **doug-s-nava** is the primary authority for component architecture, i18n conventions, code style, prop patterns, and test structure. Other frontend reviewers include andycochran (USWDS compliance and design system alignment), acouch (design token precision), and ErinPattisonNava (conditional rendering patterns).

For infrastructure, **chouinar** covers environment variables and secret management, **sean-navapbc** handles Terraform module design, and **mdragon** manages CI/CD pipeline design and deployment ordering.

**Branch hygiene** follows the trunk-based model: short-lived feature branches, frequent merges to main, and no long-running feature branches. The CI pipeline runs on every PR and must pass before merge. The project uses CalVer (calendar versioning) for releases.

The project maintainers are @btabaska, @mdragon, and @KevinJBoyer. External contributions follow the fork-and-PR model. Security vulnerabilities should be reported through HHS's responsible disclosure program at https://hhs.responsibledisclosure.com, not through public GitHub issues.

## 12. Architectural Decisions

The project maintains 50 Architecture Decision Records (ADRs) in `documentation/decisions/adr/`. These documents capture the reasoning behind major technical choices and are valuable context for understanding why the codebase works the way it does. Here are the decisions most relevant to a new contributor:

**Core Technology Choices:** Python was chosen over alternatives for accessibility and data processing strength. Flask (with APIFlask) was selected over Django (too monolithic) and FastAPI (single-maintainer risk). Next.js with TypeScript provides server-side rendering for authenticated pages. PostgreSQL handles relational grant data with complex query support. All choices prioritize open-source licensing.

**Infrastructure Decisions:** AWS is the cloud provider (HHS relationship, FedRAMP). ECS with Fargate provides serverless container deployment. Terraform manages infrastructure as code with Nava template foundations. New Relic provides APM with FedRAMP authorization.

**Development Process:** Trunk-based development with squash-and-merge reduces commit noise. GitHub Actions provides CI/CD (free, FedRAMP authorized). GitHub Issues and Projects track work. The monorepo houses API, frontend, and infra with separate repos for the PDF builder and protocol spec.

**Frontend Decisions:** Server-side rendering is the default for data-heavy pages. USWDS via react-uswds is the design system (legally required). Playwright replaced earlier E2E testing approaches for multi-browser support and debugging capabilities.

**Data and Search:** AWS DMS replicates Oracle data to PostgreSQL during the transition period. OpenSearch was chosen over Elasticsearch for open-source licensing integrity. Document storage uses S3 with separate draft and published buckets.

**Monitoring and Reporting:** Metabase provides open-source dashboarding on ECS, chosen over QuickSight for its UX, lower cost ($100/mo vs $300/mo), and replicability by external contributors.

**Potentially outdated decisions** that new contributors should be aware of:
- **GitBook** for external documentation received significant negative usability feedback and may be replaced
- **Sendy** for email marketing was explicitly described as a short-term solution
- **Google Groups** for listserv functionality is largely unused, superseded by Discourse
- **Black** for Python formatting may be superseded by Ruff's formatting capabilities, which the project already uses for linting
- **AWS DMS** replication from Oracle is a temporary bridge that will be deprecated once the Oracle migration is complete

## 13. Known Inconsistencies & Open Questions

Honest assessment of inconsistencies builds trust in this document. The following areas were identified through the pattern analysis as places where the codebase does things in multiple ways without a clear canonical approach. These are not failures — they reflect a project that has evolved over time and is actively working toward consistency. Each of these is included in the tech lead review documents and is awaiting resolution.

1. **Feature flag naming uses three different conventions.** The frontend references SSM parameters named `FEATURE_{NAME}_OFF`. The API uses environment variables like `ENABLE_{FEATURE}_ENDPOINTS`. Local development configuration uses `ENABLE_{FEATURE}=TRUE`. A single naming convention would reduce the cognitive load of working with feature flags across the stack.

2. **The validation framework quad-stack.** The codebase uses four different validation frameworks in different contexts: Marshmallow for API request/response schema validation (in the route layer), Pydantic for service-layer parameter validation, JSON Schema for form response validation, and Zod for frontend server action validation. Each was chosen for good reasons in its specific context, but the overall picture is complex. It may be worth clarifying whether this is intentional specialization or incidental complexity.

3. **Singular vs. plural file naming in API routes.** Some route files use singular names (`agency_schema.py`) while others use plural (`user_schemas.py`). Neither pattern has been established as canonical, and reviewers do not consistently correct one toward the other.

4. **Duplicate authorization utilities.** The API contains both `verify_access()` and `check_user_access()` with overlapping functionality. Their intended scopes and the plan for consolidation have not been documented.

5. **Frontend test file location.** The traditional approach places tests in a parallel `frontend/tests/` directory mirroring the source structure. Some newer code co-locates tests alongside source files. Neither approach has been formally chosen as the canonical pattern, and both exist in the current codebase.

Additional lower-priority inconsistencies include the evolution of auth object naming (`jwt_or_key_multi_auth` vs. `jwt_or_api_user_key_multi_auth`), inconsistent casing in the `"server-only"` / `"server only"` directive, and mixed use of named vs. default exports in frontend code.

## 14. Coverage Gaps

The following are areas where the team acknowledges that conventions have not yet been formally established. These are not criticisms — they represent the natural state of a project transitioning from startup mode to a larger team. Documenting them is the first step toward addressing them.

1. **No automated enforcement of naming conventions.** Boolean naming, camelCase i18n keys, singular table names, and the route decorator stack order are all enforced entirely through code review. ESLint and Ruff rules could automate the most common violations.

2. **No centralized feature flag registry.** Feature flags are scattered across Terraform variables, SSM parameters, and code references. There is no single place to see all active flags, their current states, or their intended lifecycle.

3. **No documented API versioning strategy.** The API uses path-based versioning (`/v1/`, `/alpha/`) but there is no documented strategy for how endpoints graduate from alpha to v1, how breaking changes are communicated, or when old versions are deprecated.

4. **No migration rollback strategy.** Alembic supports both `upgrade()` and `downgrade()`, but there is no documented policy for rolling back migrations in production or testing downgrade paths.

5. **No documented error budget or SLA targets.** The monitoring infrastructure (New Relic, CloudWatch Synthetic Canary) is in place, but there are no documented targets for uptime, latency, or error rates.

6. **No component library documentation beyond code.** USWDS wrapper components like `SimplerModal` exist in code but have no documentation beyond their implementations and usage in tests.

7. **No formal deprecation process for old patterns.** When the team moves from one approach to another (e.g., the auth migration), there is no documented process for tracking and completing the migration of existing code.

8. **No cross-team style guide bridging TypeScript and Python naming.** Python uses `snake_case` and TypeScript uses `camelCase`, but the boundary conventions (how field names transform when crossing the API boundary) are not documented.

The codebase knowledge extraction project that produced this guide is itself part of addressing these gaps — by making implicit conventions explicit, the team can identify which gaps matter most and prioritize closing them.

## 15. Where to Go from Here

This guide provides the high-level picture. For the detailed, domain-specific conventions with code examples and enforcement rules, see the Tier 2 contextual rule documents:

**API domains:**
- `documentation/rules/api-routes.md` — endpoint structure, decorator stack, request handling
- `documentation/rules/api-services.md` — service layer patterns, business logic organization
- `documentation/rules/api-database.md` — model definitions, migrations, query patterns
- `documentation/rules/api-auth.md` — authentication flow, multi-auth, RBAC
- `documentation/rules/api-validation.md` — validation patterns, error types, error contracts
- `documentation/rules/api-form-schema.md` — form definitions, JSON Schema, XML transforms
- `documentation/rules/api-tests.md` — pytest conventions, factory_boy, test organization

**Frontend domains:**
- `documentation/rules/frontend-components.md` — component patterns, USWDS, props
- `documentation/rules/frontend-services.md` — data fetching, API integration, error handling
- `documentation/rules/frontend-i18n.md` — internationalization patterns
- `documentation/rules/frontend-hooks.md` — custom hook conventions
- `documentation/rules/frontend-tests.md` — Jest, RTL, Playwright, accessibility testing

**Cross-cutting domains:**
- `documentation/rules/infra.md` — Terraform modules, feature flags, security
- `documentation/rules/ci-cd.md` — GitHub Actions workflows, deployment pipeline
- `documentation/rules/forms-vertical.md` — grant application forms (cross-cutting)

If you use Cursor as your editor, the project includes `.cursor/rules/` files that provide contextually relevant guidance as you edit code. These rules activate automatically based on the file path you are working in — for example, editing a file under `api/src/api/` will surface the API route conventions. These rule files contain the same conventions as the Tier 2 documents but are formatted as must-follow directives optimized for LLM consumption.

The Architecture Decision Records in `documentation/decisions/adr/` remain the authoritative source for understanding *why* major technical decisions were made. When you are deciding between two approaches and want to understand the team's reasoning, start with the ADRs.

When you discover a convention that is not documented, or when you find that an existing convention has evolved, please contribute back to these documents. The goal is for this documentation to be a living resource that grows with the project, not a snapshot that becomes stale. The best way to start is by opening an issue describing the convention you've observed, including PR references where you saw it enforced.
