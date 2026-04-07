# Slash Commands Reference

Complete reference for all 65 slash commands in the Simpler.Grants.gov AI Coding Toolkit. Commands work identically in **Cursor** (`.cursor/commands/`) and **Claude Code** (`.claude/commands/`); only the file location differs.

Each entry below: command, what it does, and one usage example you can paste into chat.

---

## Core scaffolding

### `/new-endpoint`
Scaffold a new API endpoint end-to-end (route, schema, service, repository, tests, OpenAPI).
> `/new-endpoint POST /v1/agencies/{agency_id}/users to invite a user to an agency`

### `/generate`
Generate code following project patterns when no specialized command fits.
> `/generate a Marshmallow schema for the agency invitation request body with email, role, and optional message fields`

### `/migration`
Generate an Alembic database migration with safety checks.
> `/migration add an invited_at timestamp column to agency_users, nullable, indexed`

### `/test`
Generate tests (pytest / Jest / Playwright) following project patterns.
> `/test generate factory + service tests for AgencyInvitationService.invite()`

### `/feature-flag`
Scaffold a boolean feature flag end-to-end across Terraform SSM, API config, frontend hook, env files, and the cleanup tracker.
> `/feature-flag enable_agency_invitations, target cleanup 2026-06-01`

### `/i18n`
Add or modify translations in the frontend.
> `/i18n add the keys for the agency invitation modal: title, body, submit, cancel`

---

## Code review & quality

### `/review-pr`
Run a comprehensive code review against project standards on the current branch or a PR number.
> `/review-pr PR #4218`

### `/check-conventions`
Run a convention compliance check on the current file or a specified path.
> `/check-conventions api/src/api/agencies/agency_routes.py`

### `/pr-preparation`
Validate a branch for PR submission: scoped tests, per-file conventions, title check, draft description, self-review checklist.
> `/pr-preparation` _(run on the current branch before pushing)_

### `/regression-detector`
Analyze a PR diff for hidden dependencies, untested paths, contract changes, and performance risks.
> `/regression-detector PR #4218`

### `/performance-audit`
Audit an endpoint or page for N+1 queries, missing indexes, wasteful re-renders, bundle bloat.
> `/performance-audit GET /v1/opportunities/search`

### `/code-review-learning-mode`
Turn a code review comment into a teaching moment: rule, rationale, before/after example.
> `/code-review-learning-mode the reviewer told me to use raise_flask_error instead of raising HTTPException directly`

---

## Refactoring & change management

### `/refactor`
Restructure code without changing behavior. Maps blast radius, stages execution, runs gates.
> `/refactor extract the agency permission checks from agency_routes.py into a new permissions.py module`

### `/codemod`
Plan and execute a mechanical, large-scale transformation in batches with rollback. Uses `libcst` (Python) and `ts-morph` (TypeScript).
> `/codemod rename log.info("...", extra=dict(...)) to log.info("...", extra={...}) across api/src/`

### `/dependency-update`
Upgrade a single Python or JavaScript dependency end-to-end.
> `/dependency-update bump SQLAlchemy from 2.0.25 to 2.0.36`

---

## Debugging & investigation

### `/debug`
Investigate and fix a bug. Reads stack traces, traces likely call paths, proposes a minimal fix.
> `/debug agency invitation emails are silently dropped when role=admin — see error logs in api/logs/2026-04-07.log`

### `/incident-response`
Triage a production incident: severity, likely code path, immediate mitigation, root-cause hypotheses, post-mortem draft.
> `/incident-response 5xx spike on /v1/opportunities/search starting 14:32 UTC, see dashboard link`

### `/explain-architecture`
Understand how a file or module fits into the architecture.
> `/explain-architecture api/src/services/opportunities_v1/search_opportunities.py`

### `/architecture-decision-navigator`
Look up the "why" behind a technology or architectural choice via the relevant ADR(s).
> `/architecture-decision-navigator why do we use OpenSearch instead of PostgreSQL full-text search?`

### `/convention-quick-lookup`
Get the canonical answer to "how do we handle X?" with file-path citations.
> `/convention-quick-lookup how do we structure error responses?`

### `/pattern-catalog`
Browse curated implementation patterns with anti-pattern vs. correct-pattern examples.
> `/pattern-catalog show me the correct pattern for batch background tasks`

---

## Documentation & ADRs

### `/adr`
Write an Architecture Decision Record from scratch.
> `/adr we are switching from psycopg2 to psycopg3 for async support`

### `/adr-from-pr`
Extract an architectural decision already made inside a PR and emit a sequentially-numbered ADR.
> `/adr-from-pr PR #4101`

### `/api-docs-sync`
Detect drift between APIFlask routes / Marshmallow schemas and the committed OpenAPI spec, then update the spec.
> `/api-docs-sync` _(run after editing route handlers)_

### `/changelog-generator`
Draft a categorized release section for `CHANGELOG.md` from merged PRs since a cutoff.
> `/changelog-generator since 2026-03-15`

### `/release-notes-drafter`
Generate user-facing release notes from merged PRs in a date range.
> `/release-notes-drafter from 2026-03-01 to 2026-04-01, audience = grant applicants`

### `/sprint-summary-generator`
Produce a stakeholder-ready sprint summary from merged PRs in a sprint window.
> `/sprint-summary-generator sprint 92, 2026-03-25 → 2026-04-08`

### `/glossary-auto-updater`
Propose glossary entries for new domain terms, jargon, and acronyms introduced by a PR.
> `/glossary-auto-updater PR #4218`

### `/user-guide-updater`
Find user-facing documentation affected by a feature change and draft updates.
> `/user-guide-updater the agency invitation flow now requires an admin to approve before the email is sent`

### `/runbook-generator`
Generate an operational runbook for a service or feature, grounded in Terraform + workflows + architecture.
> `/runbook-generator opportunity-search service`

### `/technical-rfc-template`
Generate a Technical RFC skeleton pre-populated with project context and starting alternatives.
> `/technical-rfc-template adopting feature-flag-as-a-service for opt-in beta features`

---

## Compliance, security & accessibility

### `/fedramp-compliance-checker`
Validate a Terraform plan diff against the FedRAMP Moderate baseline.
> `/fedramp-compliance-checker terraform plan output for infra/networking/`

### `/authority-to-operate-checklist`
Generate a FedRAMP ATO artifact bundle (NIST 800-53 Rev 5 control matrix, PII data-flow, RBAC inventory, SSP excerpt) from a PR diff.
> `/authority-to-operate-checklist PR #4218`

### `/privacy-impact-assessment`
Draft an HHS Privacy Impact Assessment from a PR diff that touches PII.
> `/privacy-impact-assessment PR #4218`

### `/section-508-report-generator`
Generate a Section 508 / VPAT 2.4 Rev 508 conformance report from jest-axe and pa11y JSON output.
> `/section-508-report-generator frontend/test-results/axe-report.json`

---

## Testing

### `/e2e-scenario`
Generate a Playwright end-to-end test for a described user workflow.
> `/e2e-scenario applicant invites a co-author to a grant application`

### `/visual-regression`
Scaffold Storybook stories and visual regression baselines across viewports and states.
> `/visual-regression frontend/src/components/AgencyInvitationModal.tsx`

### `/load-test-generator`
Generate a k6 or Locust load test scenario from the OpenAPI spec with realistic ramps and SLO assertions.
> `/load-test-generator GET /v1/opportunities/search at 500 RPS sustained for 10 minutes`

### `/test-plan-generator`
Generate a QA-executable manual test plan: happy path, edge, error, a11y, cross-browser, responsive, locale.
> `/test-plan-generator agency invitation feature`

---

## Onboarding & exploration

### `/onboarding`
Interactive code-reading tour of a feature from frontend page → API service → database → back.
> `/onboarding opportunity-search`

### `/interactive-codebase-tour`
Trace one canonical request flow end-to-end through the stack.
> `/interactive-codebase-tour POST /v1/applications`

### `/good-first-issue`
Identify small, well-scoped contribution opportunities and draft GitHub issues with acceptance criteria.
> `/good-first-issue 3 issues touching frontend i18n`

### `/good-first-issue-assistant`
Get a guided walkthrough of an existing `good-first-issue` from the repo.
> `/good-first-issue-assistant issue #4112`

---

## Diagnostics

### `/tooling-health-check`
Comprehensive diagnostic of toolkit setup: rules, agents, MCP servers, plugins, dependencies.
> `/tooling-health-check`

---

## Task skills (`skill-*`)

Focused, single-purpose skills exposed as slash commands. These are quick utilities that don't warrant a full agent workflow.

| Command | What it does | Example |
|---|---|---|
| `/skill-accessibility-check` | WCAG 2.1 AA audit on the active frontend file | `/skill-accessibility-check src/components/AgencyInvitationModal.tsx` |
| `/skill-api-contract-test` | Generate a contract test that validates an endpoint against the OpenAPI spec | `/skill-api-contract-test POST /v1/agencies/{id}/users` |
| `/skill-bundle-size-check` | Compare Next.js bundle sizes against a baseline and flag oversize imports | `/skill-bundle-size-check` |
| `/skill-check-conventions` | Reusable convention compliance check (skill form of `/check-conventions`) | `/skill-check-conventions api/src/services/agencies/` |
| `/skill-cross-browser-checklist` | Generate a diff-scoped manual cross-browser test checklist | `/skill-cross-browser-checklist` |
| `/skill-dead-code-finder` | Find unreferenced exports, components, modules | `/skill-dead-code-finder frontend/src/components/` |
| `/skill-diff-summary` | Summarize a git diff into a PR description | `/skill-diff-summary HEAD~3..HEAD` |
| `/skill-explain-codebase-area` | Walkthrough of a directory or subsystem | `/skill-explain-codebase-area api/src/search/` |
| `/skill-explain-pattern` | In-place explanation of an idiom, function, decorator, or hook | `/skill-explain-pattern @authentication_required decorator` |
| `/skill-feature-flag-audit` | Inventory all feature flags and shortlist removal candidates | `/skill-feature-flag-audit` |
| `/skill-generate-factory` | Generate a test-data factory for a model or type | `/skill-generate-factory AgencyUser` |
| `/skill-generate-mock` | Generate a mock for an interface, service, or module | `/skill-generate-mock OpportunitySearchService` |
| `/skill-generate-story` | Generate a Storybook CSF3 story for a component | `/skill-generate-story AgencyInvitationModal` |
| `/skill-generate-test-data` | Generate synthetic fixture files | `/skill-generate-test-data 50 opportunity records, FY2026, mixed agencies` |
| `/skill-impact-analysis` | Map the downstream blast radius of a change before merging | `/skill-impact-analysis SearchOpportunitiesService.search()` |
| `/skill-migration-safety-check` | Audit an Alembic migration for safety, backward compat, audit requirements | `/skill-migration-safety-check api/migrations/versions/2026_04_07_add_invited_at.py` |
| `/skill-openapi-sync` | Detect drift between OpenAPI spec and frontend TS types; print regen command | `/skill-openapi-sync` |
| `/skill-run-relevant-tests` | Identify and execute only the test suites affected by current changes | `/skill-run-relevant-tests` |
| `/skill-sql-explain` | Analyze a SQL or SQLAlchemy query and report bottlenecks + missing indexes | `/skill-sql-explain SELECT * FROM opportunities WHERE agency_id = :id ORDER BY posted_date DESC` |
| `/skill-uat-checklist` | Generate a UAT checklist from a feature spec or PR | `/skill-uat-checklist agency invitation flow` |
| `/skill-update-translations` | Add new i18n keys, audit drift across locales, or report unused keys | `/skill-update-translations audit` |

---

## Notes

- **Argument syntax.** In Cursor, arguments after the slash command are passed to the agent as natural-language context. In Claude Code, the same arguments are exposed via `$ARGUMENTS` in the command body.
- **Discovery.** In either assistant, type `/` and the autocomplete will show every command. Both targets see the same 65 commands (the `.claude/commands/` tree is generated from `.cursor/commands/` by `scripts/build-claude-target.py`).
- **Source files.** Each command is a single markdown file. To customize one, edit `.cursor/commands/<name>.md` and re-run the generator (`python3 scripts/build-claude-target.py`).
- See [`05-agents-reference.md`](05-agents-reference.md) for the agent each command routes to, and [`16-claude-code-vs-cursor.md`](16-claude-code-vs-cursor.md) for the dual-target layout.
