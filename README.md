# Simpler.Grants.gov Cursor Tooling

Cursor IDE rules, agents, and MCP servers for the [HHS/simpler-grants-gov](https://github.com/HHS/simpler-grants-gov) monorepo. Derived from **1,459 merged pull requests**, 50 ADRs, and pattern analysis across 14 codebase domains.

> **New here?** Start with the [Documentation Library](docs/README.md) or jump to the [Prompt Cookbook](docs/appendix/prompt-cookbook.md).

## Quick Start

```bash
# Clone alongside your monorepo
git clone https://github.com/btabaska/simpler-grants-documentation-automation.git
cd simpler-grants-documentation-automation

# Run setup (creates symlinks into monorepo — nothing is copied or modified)
./setup.sh

# Open monorepo in Cursor
cursor ../simpler-grants-gov
```

**Prerequisites:** [Cursor IDE](https://cursor.sh), [Node.js 18+](https://nodejs.org/), a clone of the monorepo, and a `GITHUB_PAT` env var.

## What's Included

| Category | Count | Description |
|----------|-------|-------------|
| **Domain Rules** | 18 | Auto-activating `.mdc` rules for API, Frontend, Infra, CI/CD |
| **Custom Agents** | 6 | Manually invoked agents for common workflows |
| **Notepads** | 6 | Pre-loaded context documents for common tasks |
| **Code Snippets** | 15 | `sgg-*` prefixed snippets for project patterns |
| **MCP Servers** | 3 | GitHub, filesystem, and custom architecture context |

## Domain Rules

Auto-activate when you edit files matching their glob patterns:

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

## Agents

Invoke in Cursor chat by referencing the rule name:

| Agent | Use when... |
|-------|-------------|
| `agent-new-endpoint` | Creating a complete new API endpoint |
| `agent-code-generation` | Generating code with the right domain rules applied |
| `agent-test-generation` | Writing tests following project patterns |
| `agent-migration` | Creating Alembic database migrations |
| `agent-i18n` | Adding or modifying translations |
| `agent-adr` | Documenting an architecture decision |

## Notepads

Reference in Cursor chat for pre-loaded context:

| Notepad | Content |
|---------|---------|
| `architecture-overview` | Condensed 2-page architecture guide |
| `new-api-endpoint` | Step-by-step checklist with code skeletons |
| `new-frontend-page` | RSC page template with data fetching |
| `new-form-field` | Three-schema form field addition guide |
| `new-database-table` | Model + migration + factory checklist |
| `debug-api-error` | Error flow diagram and debugging guide |

## Code Snippets

Type `sgg-` in any file to see all available snippets:

**Python (API):** `sgg-route`, `sgg-service`, `sgg-model`, `sgg-schema`, `sgg-test`, `sgg-migration`, `sgg-log`, `sgg-error`

**TypeScript (Frontend):** `sgg-component`, `sgg-client-component`, `sgg-hook`, `sgg-fetcher`, `sgg-i18n-key`, `sgg-test-component`, `sgg-test-e2e`

## MCP Servers

| Server | Purpose |
|--------|---------|
| **GitHub** | PR review, issue lookup, repository context |
| **Filesystem** | Direct access to architecture guide and rule docs |
| **simpler-grants-context** | Architecture section retrieval, file-to-rule dispatch, conventions summary |

The custom `simpler-grants-context` server exposes: `get_architecture_section()`, `get_rules_for_file()`, `get_rule_detail()`, `get_conventions_summary()`, `list_rules()`.

## Recommended Plugins

- **Compound Engineering** — 15 specialist sub-agents for quality validation (security, performance, conventions, etc.)
- **Compound Knowledge** — Documentation indexing for context enrichment

## Documentation

This toolkit is designed for developers at all experience levels with AI tooling. The [Documentation Library](docs/README.md) covers everything from first setup to advanced workflows.

**Getting started:**
- [What Is This Toolkit?](docs/01-what-is-this-toolkit.md) — what it does and why it exists
- [How It Works](docs/02-how-it-works.md) — technical deep dive into rules, agents, MCP servers, and plugins
- [Getting Started](docs/03-getting-started.md) — step-by-step setup with verification exercises

**Using the toolkit:**
- [Auto-Activating Rules](docs/04-auto-activating-rules.md) — complete reference for all 18 domain rules
- [Agents Reference](docs/05-agents-reference.md) — when and how to invoke each agent
- [Prompt Engineering](docs/08-prompt-engineering.md) — how to write effective prompts, with before/after comparisons
- [Workflow Examples](docs/09-workflow-examples.md) — 6 end-to-end annotated scenarios
- [PR Review Guide](docs/11-pr-review-guide.md) — using the PR review skill and interpreting output

**Reference:**
- [Prompt Cookbook](docs/appendix/prompt-cookbook.md) — 40+ copy-paste ready prompts
- [Rule Files Quick Reference](docs/appendix/rule-files-quick-reference.md) — printable one-page summary
- [Troubleshooting](docs/13-troubleshooting.md) — symptom-based fixes for common issues
- [FAQ for Skeptics](docs/14-faq-for-skeptics.md) — substantive answers for experienced developers
- [Capabilities and Limitations](docs/12-capabilities-and-limitations.md) — honest assessment of what AI can and can't do
- [Glossary](docs/15-glossary.md) — every project-specific and AI-tooling term defined

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

**Cursor Toolkit** (what your team uses):
```
.cursor/            — Rules, agents, notepads, snippets, MCP config
.cursorrules        — Root conventions index
documentation/      — Architecture guide + detailed rule docs
mcp-server/         — Custom MCP server for architecture context
setup.sh            — Team onboarding script
docs/               — 18-file documentation library
```

**Pattern Research** (how the rules were derived):
```
research/
  analysis/         — Multi-pass LLM analysis (pass1 → pass2 → pass3)
  review/           — Human pattern reviews
  extracted_data/   — Raw PR JSON data (gitignored, ~29MB)
  extract.py        — GitHub PR extraction script
  prepare_batch.py  — Batch preparation for LLM analysis
  refresh.sh        — Rule refresh pipeline
```

## Updating Rules

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to update rules when project conventions change.
