# Simpler.Grants.gov AI Coding Toolkit — Documentation

This is the reference library for the AI coding toolkit used by the [HHS/simpler-grants-gov](https://github.com/HHS/simpler-grants-gov) development team. It explains how every part of the toolkit works, how to use it effectively, and what to expect from AI-assisted coding on this project.

The toolkit gives Cursor IDE project-specific knowledge extracted from 1,459 merged pull requests — so instead of generic Python or TypeScript suggestions, the AI understands your team's actual conventions.

---

## Prerequisites

Before using this toolkit, ensure you have:
- **Cursor IDE** installed
- **Compound Engineering** plugin installed (provides specialist sub-agents for quality validation)
- **Compound Knowledge** plugin installed (provides documentation indexing for context enrichment)
- **Node.js 18+** (for MCP servers)
- **GITHUB_PAT** environment variable set (for GitHub MCP server)

See [Getting Started](03-getting-started.md) for full installation instructions.

---

## Start Here

Choose your path based on where you are:

### "I'm brand new to this toolkit"

1. [What Is This Toolkit?](01-what-is-this-toolkit.md) — understand what it does and why it exists
2. [Getting Started](03-getting-started.md) — install, configure, and verify it works
3. [Prompt Engineering](08-prompt-engineering.md) — learn how to get good results from the AI

### "I'm already set up and need a quick reference"

- [Rule Files Quick Reference](appendix/rule-files-quick-reference.md) — one-page summary of all rules
- [Prompt Cookbook](appendix/prompt-cookbook.md) — copy-paste ready prompts organized by task
- [Agents Reference](05-agents-reference.md) — how to invoke each agent

### "I'm skeptical and want to understand what's happening"

1. [How It Works](02-how-it-works.md) — deep technical explanation of every layer, no black boxes
2. [Capabilities and Limitations](12-capabilities-and-limitations.md) — honest assessment of what AI can and cannot do
3. [FAQ for Skeptics](14-faq-for-skeptics.md) — answers to common concerns from experienced developers

---

## Full Table of Contents

| # | Document | Description |
|---|----------|-------------|
| 01 | [What Is This Toolkit?](01-what-is-this-toolkit.md) | Overview of every component, how it was built, and what it is not |
| 02 | [How It Works](02-how-it-works.md) | Technical deep dive into rules, agents, MCP servers, and the PR review skill |
| 03 | [Getting Started](03-getting-started.md) | Step-by-step setup, verification exercises, and first-use tutorial |
| 04 | [Auto-Activating Rules](04-auto-activating-rules.md) | Complete reference for all 18 rule files with examples |
| 05 | [Agents Reference](05-agents-reference.md) | Deep reference for every agent: when to use, how to invoke, example prompts |
| 06 | [Notepads Reference](06-notepads-reference.md) | When and how to use each notepad with example prompts |
| 07 | [Code Snippets Reference](07-code-snippets-reference.md) | All 15 snippets with generated code examples |
| 08 | [Prompt Engineering](08-prompt-engineering.md) | How to write effective prompts, with 10+ before/after comparisons |
| 09 | [Workflow Examples](09-workflow-examples.md) | 6 end-to-end annotated scenarios showing real development tasks |
| 10 | [Multi-File Workflows](10-multi-file-workflows.md) | Chat vs. Composer, complex multi-file changes, large refactors |
| 11 | [PR Review Guide](11-pr-review-guide.md) | How to use the PR review skill, interpret output, and customize reviews |
| 12 | [Capabilities and Limitations](12-capabilities-and-limitations.md) | Honest guide to what the AI does well, struggles with, and cannot do |
| 13 | [Troubleshooting](13-troubleshooting.md) | Symptom-based troubleshooting for every common issue |
| 14 | [FAQ for Skeptics](14-faq-for-skeptics.md) | 15+ questions with substantive answers for experienced developers |
| 15 | [Glossary](15-glossary.md) | Every project-specific and AI-tooling term defined |

### Appendix

| Document | Description |
|----------|-------------|
| [Rule Files Quick Reference](appendix/rule-files-quick-reference.md) | Printable one-page summary of all rules and top directives |
| [Prompt Cookbook](appendix/prompt-cookbook.md) | 40+ copy-paste ready prompts organized by task type |

---

## What's in the `.cursor/` Directory

```
.cursor/
├── rules/                              # Auto-activating and manually invoked rules
│   ├── api-auth.mdc                    # JWT + API key multi-auth patterns
│   ├── api-database.mdc               # SQLAlchemy models, UUID PKs, lookup tables
│   ├── api-error-handling.mdc          # raise_flask_error(), ValidationErrorDetail
│   ├── api-form-schema.mdc            # Three-schema form architecture
│   ├── api-routes.mdc                 # Decorator stack order, thin handlers
│   ├── api-services.mdc              # Service layer, db_session first param
│   ├── api-tests.mdc                 # Factory .build()/.create(), test structure
│   ├── api-validation.mdc            # ValidationErrorType enum, error details
│   ├── ci-cd.mdc                     # GitHub Actions, three-job pipeline
│   ├── cross-domain.mdc             # Structured logging, naming, error responses
│   ├── forms-vertical.mdc           # Three-schema forms, custom validator
│   ├── frontend-components.mdc      # RSC default, domain-based organization
│   ├── frontend-hooks.mdc           # useClientFetch, custom hook patterns
│   ├── frontend-i18n.mdc            # Single translation file, camelCase keys
│   ├── frontend-services.mdc        # requesterForEndpoint(), server-only
│   ├── frontend-tests.mdc           # jest-axe, Playwright E2E
│   ├── infra.mdc                    # Three-layer Terraform architecture
│   ├── pr-review.mdc               # Comprehensive PR review checklist (manual)
│   ├── agent-new-endpoint.mdc       # Create a complete API endpoint (manual)
│   ├── agent-code-generation.mdc    # Domain-aware code generation (manual)
│   ├── agent-test-generation.mdc    # pytest / Jest / Playwright tests (manual)
│   ├── agent-migration.mdc          # Alembic database migrations (manual)
│   ├── agent-i18n.mdc              # Translation management (manual)
│   └── agent-adr.mdc               # Architecture Decision Records (manual)
├── notepads/                          # Pre-loaded context documents
│   ├── architecture-overview.md      # Condensed architecture guide
│   ├── new-api-endpoint.md          # Endpoint creation checklist
│   ├── new-frontend-page.md         # Next.js page creation guide
│   ├── new-form-field.md            # Three-schema form field guide
│   ├── new-database-table.md        # Model + migration checklist
│   └── debug-api-error.md           # Error flow and debugging guide
├── snippets/                          # Code snippet templates
│   ├── python-api.code-snippets     # sgg-route, sgg-service, sgg-model, etc.
│   └── typescript-frontend.code-snippets  # sgg-component, sgg-hook, etc.
├── mcp.json                           # MCP server configuration
└── settings.json                      # Cursor project settings
```

---

[Back to main README](../README.md)
