# Skills Reference

> **Before reading this:** Familiarity with [How It Works](02-how-it-works.md) and the Quality Gate Pipeline pattern is helpful but not required. Each skill below is self-contained.

The toolkit ships **25 skills** under `.cursor/skills/`. Skills encapsulate focused, reusable capabilities. Unlike workflow agents, they are meant to be cheap to invoke and composable — agents call skills, and developers can call skills directly.

Skills come in two shapes:

- **Multi-file workflow skills** (4) — a directory containing `SKILL.md` plus supporting checklists, dispatch tables, or templates. These encode multi-pass workflows.
- **Single-file `skill-*` skills** (21) — a single `SKILL.md` describing one focused task with explicit invocation, inputs, and outputs.

Companion prose docs live under `documentation/cursor-tooling/skills/`.

---

## How to Invoke a Skill

| Skill type | How |
|---|---|
| Multi-file workflow skill | `@skill-pr-review`, `@skill-quality-gate`, `@skill-flag-cleanup`, `@skill-onboarding`, or the matching slash command if one is registered |
| Single-file `skill-*` | `/<skill-name>` (e.g., `/skill-generate-factory`) or `@<skill-name>` in chat |
| Skill called by agent | The agent invokes it as part of its Quality Gate Pipeline or workflow body — no user action required |

---

## Multi-File Workflow Skills

### `pr-review/`

**Purpose:** Comprehensive PR review with severity classification and a friendly voice.
**Files:** `SKILL.md`, `dispatch-table.md`, `checklist-template.md`, `severity-guide.md`, `voice-guide.md`.
**When to use:** Reviewing any pull request against project conventions. The dispatch table maps changed files to the rules that should be enforced; the severity guide enforces the `bug:` / `a11y:` / `testing:` / `suggestion:` / `question:` / `nit:` prefixes; the voice guide keeps comments collaborative.
**Companion guide:** `documentation/cursor-tooling/skills/` (see PR review docs).

### `quality-gate/`

**Purpose:** The shared Quality Gate Pipeline pattern that every workflow agent reuses.
**Files:** `SKILL.md`, `specialist-map.md`, `gate-checklist.md`, `parallel-execution.md`.
**When to use:** Indirectly — every workflow agent invokes this skill after generating code. You rarely call it yourself; instead, you invoke a workflow agent and the quality-gate skill runs as part of its pipeline.
**Why it matters:** This is the source of record for which specialist runs at which gate, and the parallel-execution guide explains which gates can run concurrently versus sequentially.

### `flag-cleanup/`

**Purpose:** Safely remove a fully-rolled-out feature flag across all surfaces.
**Files:** `SKILL.md`, `cleanup-checklist.md`, `blast-radius-template.md`.
**When to use:** When a feature flag is at 100% and ready to be deleted from Terraform SSM, the API service/route layer, frontend hooks, `.env.development`, and the cleanup tracker. The blast-radius template forces a written impact assessment before any deletion.

### `onboarding/`

**Purpose:** Guided onboarding for new developers joining simpler-grants-gov.
**Files:** `SKILL.md`, `setup-checklist.md`, `architecture-tour.md`, `first-pr-guide.md`.
**When to use:** Day one for a new contributor. The setup checklist walks them through environment setup, the architecture tour traces a real request through the stack, and the first-PR guide scopes their first contribution.

---

## Single-File `skill-*` Skills

Each skill is a single `SKILL.md` under `.cursor/skills/skill-<name>/`. Each is paired with a slash command of the same name in `.cursor/commands/`.

| Skill | Purpose |
|---|---|
| `skill-accessibility-check` | Run a focused WCAG 2.1 AA / Section 508 check on the current frontend file or component |
| `skill-api-contract-test` | Generate or update an API contract test for a route handler against the OpenAPI spec |
| `skill-bundle-size-check` | Report bundle-size impact of a frontend change against the project budget |
| `skill-check-conventions` | Run the convention-checker across changed files and summarize violations |
| `skill-cross-browser-checklist` | Produce a cross-browser test checklist scoped to the touched component |
| `skill-dead-code-finder` | Identify unreferenced exports, unused i18n keys, and orphaned files in a touched directory |
| `skill-diff-summary` | Summarize a `git diff` in human-readable, reviewer-friendly form |
| `skill-explain-codebase-area` | Read-only explanation of how a code area works, with file citations |
| `skill-explain-pattern` | Explain a project pattern (decorator stack, three-schema form, etc.) with examples from the codebase |
| `skill-feature-flag-audit` | Audit feature flag usage and surface flags that are stale or ready to clean up |
| `skill-generate-factory` | Generate a `factory_boy` factory matching project conventions |
| `skill-generate-mock` | Generate a mock or stub for a service or external adapter |
| `skill-generate-story` | Generate a Storybook CSF3 story file for a frontend component |
| `skill-generate-test-data` | Generate realistic test data for a model or form |
| `skill-impact-analysis` | Trace the blast radius of a proposed change before you make it |
| `skill-migration-safety-check` | Verify an Alembic migration includes both `upgrade()` and `downgrade()`, has no destructive operations, and is reversible |
| `skill-openapi-sync` | Detect and fix drift between APIFlask handlers / Marshmallow schemas and the OpenAPI spec |
| `skill-run-relevant-tests` | Run the scoped pytest / npm test surface for the files touched in the working tree |
| `skill-sql-explain` | Run `EXPLAIN` on a SQLAlchemy query and surface index suggestions |
| `skill-uat-checklist` | Generate a user acceptance testing checklist for a feature |
| `skill-update-translations` | Synchronize translation keys across `frontend/src/i18n/messages/` |

---

## Skills vs. Agents vs. Notepads

Quick decision rule:

- Need a **multi-step workflow** that spans many files and runs a Quality Gate Pipeline → invoke an **agent**.
- Need a **focused, repeatable capability** that does one thing well → invoke a **skill**.
- Need to **attach background knowledge** to a conversation without triggering a workflow → attach a **notepad**.

Skills are also the right primitive when you want an agent to "do that one specific check" without spinning up a full workflow. Most workflow agents call several `skill-*` skills internally as part of their Pre-Flight or quality gates.

---

## See Also

- [Agents Reference](05-agents-reference.md) — workflow agents, quality-gate subagents, onboarding agents
- [Notepads Reference](06-notepads-reference.md) — pre-loaded context documents
- [Code Snippets Reference](07-code-snippets-reference.md) — `sgg-*` tab-completion templates
- [How It Works](02-how-it-works.md) — the Quality Gate Pipeline pattern in detail
- [Back to documentation index](README.md)
