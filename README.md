# Simpler.Grants.gov AI Coding Toolkit

Rules, agents, skills, slash commands, hooks, and MCP servers for the [HHS/simpler-grants-gov](https://github.com/HHS/simpler-grants-gov) monorepo. Ships for **either Cursor or Claude Code** (or both side-by-side). Derived from **1,459 merged pull requests**, 50 ADRs, and pattern analysis across 14 codebase domains.

The `.cursor/` tree is the canonical authoring source; `.claude/` is generated from it by `scripts/build-claude-target.py` (idempotent; CI enforces drift-free).

> **New here?** Start with the [Documentation Library](docs/README.md), the [Cursor vs Claude Code parity matrix](docs/16-claude-code-vs-cursor.md), or the [Prompt Cookbook](docs/appendix/prompt-cookbook.md).

## Quick Start

```bash
git clone https://github.com/btabaska/simpler-grants-documentation-automation.git
cd simpler-grants-documentation-automation

# Interactive: pick cursor / claude / both
./setup.sh

# Or non-interactive
./setup.sh --target=claude
TOOLKIT_TARGET=both ./setup.sh
```

## Choosing your assistant

| Target | What gets installed in your monorepo clone | When to pick it |
|---|---|---|
| `cursor` | `.cursor/`, `.cursorrules`, `documentation/` symlinks | You use Cursor IDE |
| `claude` | `.claude/`, `.mcp.json` symlinks | You use Claude Code |
| `both`   | All of the above | You switch between the two |

Both targets expose the same agents, skills, slash commands, hooks, and MCP servers — only the file layout and frontmatter differ. See [`docs/16-claude-code-vs-cursor.md`](docs/16-claude-code-vs-cursor.md) for the parity matrix and known gaps (notably the three Cursor hook events with no Claude Code analog).

**Prerequisites:** [Cursor IDE](https://cursor.sh) or [Claude Code](https://docs.claude.com/en/docs/claude-code), [Node.js 18+](https://nodejs.org/), [Bun](https://bun.sh) (for hooks), a clone of the monorepo, and a `GITHUB_PAT` env var.

## What's Included

| Category | Count | Description |
|----------|-------|-------------|
| **Domain Rules** | 24 | Auto-activating `.mdc` rules for API, Frontend, Infra, CI/CD |
| **Standalone Agents** | 9 | Cursor subagents for structured multi-step workflows |
| **Skills** | 4 | Reusable capabilities (PR review, quality gate, onboarding, flag cleanup) |
| **Slash Commands** | 12 | Quick invocation entry points for agents and skills |
| **Hook Lifecycle Events** | 6 | Event-driven automation for security, quality, and audit |
| **Notepads** | 6 | Pre-loaded context documents for common tasks |
| **Code Snippets** | 15 | `sgg-*` prefixed snippets for project patterns |
| **MCP Servers** | 3 | GitHub, filesystem, and custom architecture context (10 tools) |

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
| `api-adapters` | `api/src/adapters/**/*.py` | External service adapter patterns |
| `api-search` | `api/src/search/**/*.py` | OpenSearch integration patterns |
| `api-tasks` | `api/src/task/**/*.py` | Background task patterns |
| `api-workflow` | `api/src/workflow/**/*.py` | Workflow orchestration patterns |
| `accessibility` | `frontend/src/**/*.tsx`, `frontend/src/**/*.ts` | WCAG 2.1 AA, Section 508 compliance |
| `frontend-components` | `frontend/src/components/**/*` | RSC default, domain-based organization |
| `frontend-hooks` | `frontend/src/hooks/**/*` | `useClientFetch`, custom hook patterns |
| `frontend-services` | `frontend/src/services/**/*` | `requesterForEndpoint()`, server-only |
| `frontend-i18n` | `frontend/src/i18n/**/*` | Single translation file, camelCase keys |
| `frontend-tests` | `frontend/tests/**/*` | jest-axe, Playwright E2E |
| `frontend-app-pages` | `frontend/src/app/**/*` | Next.js App Router pages, RSC layouts |
| `frontend-e2e-tests` | `frontend/tests/e2e/**/*` | Playwright E2E test patterns |
| `infra` | `infra/**/*.tf` | Three-layer Terraform architecture |
| `ci-cd` | `.github/**/*.yml` | Three-job pipeline, reusable workflows |
| `cross-domain` | All files | Structured logging, naming, error responses |
| `forms-vertical` | Form-related files | Three-schema forms, custom validator |

## Agents

Invoke via slash commands (preferred) or by name in Cursor chat:

| Agent | Slash Command | Use when... |
|-------|---------------|-------------|
| `orchestrator` | — | Routing tasks to the right specialist agent |
| `new-endpoint` | `/new-endpoint` | Creating a complete new API endpoint |
| `code-generation` | `/generate` | Generating code with the right domain rules applied |
| `test-generation` | `/test` | Writing tests following project patterns |
| `migration` | `/migration` | Creating Alembic database migrations |
| `i18n` | `/i18n` | Adding or modifying translations |
| `adr` | `/adr` | Documenting an architecture decision |
| `debugging` | `/debug` | Investigating errors, stack traces, failing tests |
| `refactor` | `/refactor` | Multi-file structural changes with blast radius mapping |

## Skills

| Skill | Use when... |
|-------|-------------|
| `pr-review` | Reviewing PRs against team conventions |
| `quality-gate` | Running multi-gate specialist validation on generated code |
| `flag-cleanup` | Safely removing a fully-rolled-out feature flag |
| `onboarding` | Guided onboarding for new developers |

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

The custom `simpler-grants-context` server exposes 10 tools: `get_architecture_section()`, `get_rules_for_file()`, `get_rule_detail()`, `get_conventions_summary()`, `list_rules()`, `list_agents()`, `list_commands()`, `list_skills()`, `get_agent_detail()`, `get_skill_detail()`.

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
- [Auto-Activating Rules](docs/04-auto-activating-rules.md) — complete reference for all 24 domain rules
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

`.cursor/` is the canonical authoring source. `.claude/` and `.mcp.json` are generated from it by `scripts/build-claude-target.py`. `setup.sh` symlinks whichever target(s) you chose into your monorepo clone.

```
This Toolkit Repo                    Your Monorepo Clone
==================                   ====================

# When --target=cursor (or both)
.cursor/                 ──symlink──>  .cursor/
.cursorrules             ──symlink──>  .cursorrules
documentation/           ──symlink──>  documentation/

# When --target=claude (or both)
.claude/                 ──symlink──>  .claude/
  agents/                              (51 subagents)
  skills/                              (70 skills: 39 rule-skills + 25 + 6 notepads)
  commands/                            (64 slash commands)
  hooks/                               (Bun/TS dispatchers + scripts)
  settings.json                        (hook event registration)
  CLAUDE.md                            (project memory)
.mcp.json                ──symlink──>  .mcp.json
```

## Repository Structure

```
.cursor/                       — Canonical: rules, agents, skills, commands, hooks, notepads, snippets, mcp.json
.cursorrules                   — Cursor project memory (source for CLAUDE.md)
.claude/                       — Generated from .cursor/ by scripts/build-claude-target.py
.mcp.json                      — Generated from .cursor/mcp.json
scripts/build-claude-target.py — Idempotent generator (run with --check in CI)
documentation/                 — Architecture guide + detailed rule docs
mcp-server/                    — Custom MCP server for architecture context (10 tools)
setup.sh                       — Team onboarding script (--target=cursor|claude|both)
docs/                          — 20-file documentation library
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
