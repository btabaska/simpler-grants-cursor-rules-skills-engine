# Simpler.Grants.gov AI Coding Toolkit

An AI-powered coding toolkit for [HHS/simpler-grants-gov](https://github.com/HHS/simpler-grants-gov) that enforces project conventions, provides contextual guidance, and accelerates development through Cursor IDE integration.

Built from analysis of **1,459 merged pull requests** spanning 12 months of development history, 50 Architecture Decision Records, and cross-domain pattern synthesis across 14 codebase domains.

**New to this toolkit?** Read the **[User Guide](GUIDE.md)** — it covers everything from setup to prompt engineering, with real-world workflow examples, agent tutorials, and an FAQ for skeptics.

## What's Included

| Category | Count | Description |
|----------|-------|-------------|
| **Domain Rules** | 18 | Auto-activating `.mdc` rules for API, Frontend, Infra, CI/CD |
| **Custom Agents** | 6 | Manually invoked agents for common workflows |
| **Notepads** | 6 | Pre-loaded context documents for common tasks |
| **Code Snippets** | 15 | `sgg-*` prefixed snippets for project patterns |
| **MCP Servers** | 3 | GitHub, filesystem, and custom architecture context |

## Quick Start

### Prerequisites

- [Cursor IDE](https://cursor.sh)
- [Node.js](https://nodejs.org/) 18+ (for MCP servers)
- A clone of [HHS/simpler-grants-gov](https://github.com/HHS/simpler-grants-gov)
- `GITHUB_PAT` environment variable (for GitHub MCP server)

### Setup (3 steps)

```bash
# 1. Clone this toolkit alongside your monorepo
git clone https://github.com/btabaska/simpler-grants-documentation-automation.git
cd simpler-grants-documentation-automation

# 2. Run the setup script
./setup.sh

# 3. Open the monorepo in Cursor
cursor ../simpler-grants-gov
```

The setup script creates symlinks from this toolkit into your monorepo clone. No files are copied or modified in the monorepo itself.

## Domain Rules (auto-activate)

These rules activate automatically when you edit files matching their glob patterns:

| Rule | Activates on | Key conventions |
|------|-------------|-----------------|
| `api-routes` | `api/src/api/**/*.py` | Decorator stack order, thin handlers |
| `api-services` | `api/src/services/**/*.py` | `db_session` first param, business logic layer |
| `api-database` | `api/src/db/**/*.py` | `Mapped[T]` syntax, UUID PKs, singular names |
| `api-auth` | `api/src/auth/**/*.py` | JWT + API key multi-auth |
| `api-validation` | `api/src/validation/**/*.py` | `ValidationErrorType` enum, error details |
| `api-error-handling` | `api/src/**/*.py` | `raise_flask_error()`, structured errors |
| `api-form-schema` | `api/src/form_schema/**/*.py` | Three-schema architecture |
| `api-tests` | `api/tests/**/*.py` | Factory `.build()`/`.create()`, test structure |
| `frontend-components` | `frontend/src/components/**/*` | RSC default, domain-based organization |
| `frontend-hooks` | `frontend/src/hooks/**/*` | `useClientFetch`, custom hook patterns |
| `frontend-services` | `frontend/src/services/**/*` | `requesterForEndpoint()`, server-only |
| `frontend-i18n` | `frontend/src/i18n/**/*` | Single translation file, camelCase keys |
| `frontend-tests` | `frontend/tests/**/*` | jest-axe, Playwright E2E |
| `infra` | `infra/**/*.tf` | Three-layer Terraform architecture |
| `ci-cd` | `.github/**/*.yml` | Three-job pipeline, reusable workflows |
| `cross-domain` | All files | Structured logging, naming, error responses |
| `forms-vertical` | Form-related files | Three-schema forms, custom validator |
| `pr-review` | Manual invocation | Comprehensive PR review checklist |

## Custom Agents (manually invoked)

Invoke these in Cursor chat by referencing the rule name:

| Agent | Use when... |
|-------|-------------|
| `agent-new-endpoint` | Creating a complete new API endpoint (blueprint + routes + schemas + service + tests) |
| `agent-code-generation` | Generating any code and want the right domain rules applied automatically |
| `agent-test-generation` | Writing tests (pytest or Jest/Playwright) following project patterns |
| `agent-migration` | Creating Alembic database migrations |
| `agent-i18n` | Adding or modifying user-facing text/translations |
| `agent-adr` | Documenting an architecture decision |

## Notepads (reference in chat)

Reference these in Cursor chat for pre-loaded context:

| Notepad | Content |
|---------|---------|
| `architecture-overview` | Condensed 2-page version of the 50KB architecture guide |
| `new-api-endpoint` | Step-by-step checklist with code skeletons |
| `new-frontend-page` | RSC page template with data fetching patterns |
| `new-form-field` | Three-schema form field addition guide |
| `new-database-table` | Model + migration + factory checklist |
| `debug-api-error` | Error flow diagram and debugging guide |

## Code Snippets

Type `sgg-` in any file to see all available snippets:

### Python (API)
- `sgg-route` — Route handler with full decorator stack
- `sgg-service` — Service function with `db_session` parameter
- `sgg-model` — SQLAlchemy model with `ApiSchemaTable` + `TimestampMixin`
- `sgg-schema` — Marshmallow request/response schemas
- `sgg-test` — Route test with factory pattern
- `sgg-migration` — Alembic migration template
- `sgg-log` — Structured log statement
- `sgg-error` — `raise_flask_error()` with `ValidationErrorDetail`

### TypeScript (Frontend)
- `sgg-component` — React Server Component
- `sgg-client-component` — Client component with `"use client"`
- `sgg-hook` — Custom hook
- `sgg-fetcher` — `requesterForEndpoint()` server-side fetcher
- `sgg-i18n-key` — Translation key block
- `sgg-test-component` — Component test with jest-axe
- `sgg-test-e2e` — Playwright E2E test

## MCP Servers

| Server | Purpose |
|--------|---------|
| **GitHub** | PR review, issue lookup, repository context |
| **Filesystem** | Direct access to architecture guide and detailed rule docs |
| **simpler-grants-context** | Custom server with targeted architecture section retrieval, file-to-rule dispatch, and conventions summary |

### Custom MCP Server Tools

The `simpler-grants-context` server exposes:

- `get_architecture_section(section)` — Get a specific section of the architecture guide
- `get_rules_for_file(file_path)` — Get applicable rules for a file path
- `get_rule_detail(rule_name)` — Get full detailed documentation for a rule
- `get_conventions_summary()` — Get key project conventions
- `list_rules()` — List all available rules with descriptions

## Recommended Cursor Plugins

Install these Cursor community plugins for the best experience:

- **compound-engineering** — Specialist review sub-agents (security, performance, simplicity) used by the PR review rule
- **compound-knowledge** — Knowledge indexing for project documentation

## Detailed Documentation

For the full analysis behind each rule (with PR references, confidence levels, and rationale):

- **Architecture Guide**: `documentation/architecture-guide.md` (50KB comprehensive guide)
- **Detailed Rule Docs**: `documentation/rules/*.md` (18 files, ~12,000 lines total)

## How It Works

```
This Toolkit Repo                    Your Monorepo Clone
==================                   ====================

.cursor/                 ──symlink──>  .cursor/
  rules/                               (auto-activating rules)
  notepads/                            (reference in chat)
  snippets/                            (type sgg-*)
  mcp.json                             (MCP server config)
.cursorrules             ──symlink──>  .cursorrules
documentation/           ──symlink──>  documentation/
mcp-server/                            (custom MCP server)
```

## Repository Structure

This repo has two parts:

**Cursor Toolkit** (what your team uses):
```
.cursor/            — Rules, agents, notepads, snippets, MCP config
.cursorrules        — Root conventions index
documentation/      — Architecture guide + detailed rule docs (used by MCP server)
mcp-server/         — Custom MCP server for architecture context
setup.sh            — Team onboarding script
```

**Pattern Research** (how the rules were generated):
```
research/
  analysis/         — Multi-pass LLM analysis (pass1 → pass2 → pass3)
  review/           — Human pattern reviews
  cursor-test/      — Original cursor rule prototypes
  cursor-rules-generated/ — Generated .mdc copies
  extracted_data/   — Raw PR JSON data (gitignored, ~29MB)
  extract.py        — GitHub PR extraction script
  prepare_batch.py  — Batch preparation for LLM analysis
  refresh.sh        — Rule refresh pipeline
```

## Updating Rules

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to update rules when project conventions change.
