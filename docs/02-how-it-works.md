# How It Works

This document explains every layer of the toolkit. There is no magic here -- just text files, pattern matching, and a small TypeScript server. If you can read a YAML frontmatter block and understand glob patterns, you already know how the system works.

---

## Rules (.mdc Files)

### Anatomy of a Rule File

Every rule lives in `.cursor/rules/` as a `.mdc` file (Markdown for Cursor). Each file has two parts: a YAML frontmatter block and a Markdown body.

Here is the frontmatter from `api-routes.mdc`:

```yaml
---
description: When working on API route handlers in api/src/api/
globs: ["api/src/api/**/*.py"]
---
```

The frontmatter has three possible fields:

- **`description`** -- A human-readable summary of when this rule applies. Cursor displays this in its UI. It has no effect on matching logic; it exists for you, the developer.
- **`globs`** -- An array of file path patterns. When you open or edit a file whose path matches any of these patterns, Cursor loads the rule into the AI's context window. Standard glob syntax: `**` matches any directory depth, `*` matches any filename.
- **`alwaysApply`** -- Optional boolean. When `true`, the rule loads into every AI interaction regardless of which files are open. Most rules omit this field (defaults to `false`).

### How Cursor Loads Rules

Cursor's rule activation is straightforward pattern matching. When you open or edit a file, Cursor iterates through every `.mdc` file in `.cursor/rules/`, checks the file path against each rule's `globs` array, and loads every rule that matches.

There is no priority system, no override mechanism, no inheritance. Every matching rule is concatenated into the AI's context window alongside your code.

### Concrete Scenario: Opening a Route File

You open `api/src/api/users/user_routes.py`. Here is exactly what happens:

1. Cursor checks every rule's glob patterns against the path `api/src/api/users/user_routes.py`.
2. **`api-routes.mdc`** matches -- its glob is `api/src/api/**/*.py`.
3. **`api-error-handling.mdc`** matches -- its glob is `api/src/**/*.py`, which is broader and catches all API source files.
4. **`cross-domain.mdc`** matches -- its glob is `**/*`, which matches every file in the repository.
5. All three rule files are injected into the AI's context window.
6. When you ask the AI a question or request a code change, it sees your code AND all three rule files as part of its prompt.

That is the entire mechanism. The AI receives text. It reads it. It follows the instructions -- the same way a developer would read a wiki page before writing code.

### Annotated Rule File: api-routes.mdc

Below is the content of `api-routes.mdc` with annotations explaining each section. This is the actual file from the repository, not a simplified example.

**Frontmatter:**

```yaml
---
description: When working on API route handlers in api/src/api/
globs: ["api/src/api/**/*.py"]
---
```

Tells Cursor: activate this rule whenever the developer is working on any Python file under the `api/src/api/` directory tree.

**Decorator Stack Order Rule:**

```markdown
## Decorator Stack Order

ALWAYS apply decorators in this exact top-to-bottom order: (1) `@blueprint.METHOD("/path")`,
(2) `@blueprint.input(...)`, (3) `@blueprint.output(...)`, (4) `@blueprint.doc(...)`,
(5) auth decorator, (6) `@flask_db.with_db_session()`.
```

This tells the AI the exact order decorators must appear on route handler functions. The codebase uses APIFlask, which is sensitive to decorator order. The rule includes a real code example from `user_routes.py` showing the correct stack.

**Thin Route Handlers Rule:**

```markdown
## Thin Route Handlers

ALWAYS keep route handlers thin. NEVER put business logic in route handlers. MUST delegate
to service functions under `src/services/<domain>/`.
```

This enforces the project's architectural boundary: routes are thin dispatchers, business logic lives in the service layer.

**Authentication Rule:**

```markdown
## Authentication

ALWAYS use `jwt_or_api_user_key_multi_auth` for new user-facing endpoints. ALWAYS pair
`@blueprint.doc(security=...)` with `@jwt_or_api_user_key_multi_auth.login_required`.
NEVER combine `@blueprint.auth_required(...)` with `@multi_auth.login_required` on the
same handler.
```

This prevents a specific class of bugs: mixing two different authentication mechanisms on the same endpoint, which causes silent auth bypasses.

Each section follows the same structure: a directive (ALWAYS/NEVER/MUST), an explanation of why, and a real code example from the codebase.

### The ALWAYS / NEVER / MUST Directive Format

Rules are written in imperative mood using three directive keywords:

- **ALWAYS** -- The AI must do this in every case. No exceptions. Example: "ALWAYS use `raise_flask_error()` for error responses."
- **NEVER** -- The AI must not do this under any circumstances. Example: "NEVER put business logic in route handlers."
- **MUST** -- A required constraint, typically for a specific detail within a broader pattern. Example: "MUST delegate to service functions under `src/services/<domain>/`."

These are not special tokens or syntax the AI parses differently. They are just English words written in uppercase for emphasis. The AI reads them as strong instructions, the same way a developer reads "NEVER commit secrets to the repository" in a contributing guide.

The directives work because large language models are instruction-following systems. Clear, unambiguous imperatives produce more consistent behavior than hedged suggestions. "NEVER use `logger.warning()` for client errors" is more effective than "Consider using `logger.info()` instead of `logger.warning()` for client errors."

### The Pending Validation Marker

Some conventions in the rules were extracted from codebase patterns but have not yet been formally validated by the full team. These are tracked as "pending validation" in the PR review system.

The `pr-review.mdc` rule defines a severity policy based on confidence level:

- **High-confidence rule violation** (no pending marker) -- treated as `bug:` severity. These are team-agreed conventions.
- **Medium-confidence rule violation** (pending validation) -- treated as `suggestion:` severity. Flagged but does not block merge.
- **Low-confidence / emerging convention** -- treated as `nit:` severity. Informational only.

This allows the toolkit to encode patterns the team is still discussing without treating them as hard requirements.

### What the AI Actually Does with Rules

The AI reads rule files as instructions, the same way it reads any text in its context window. There is no special training, no fine-tuning, no custom model. The rules are plain text injected into the prompt.

When the AI generates code, it tries to follow the instructions in the rules. When it reviews code, it checks against the directives. The quality of the output depends on:

1. How clearly the rules are written
2. How much context window space is available (rules compete with code for space)
3. Whether the rules conflict with each other (they should not, but it can happen)

If a rule is poorly written or ambiguous, the AI will produce inconsistent results. This is why the rules use the directive format -- it minimizes ambiguity.

---

## Agents

### What Makes an Agent Different from a Rule

Agents live in `.cursor/agents/` as standalone Markdown files (not `.mdc` rule files). They are discovered by Cursor as proper subagents.

Unlike auto-activating rules that provide passive context via glob matching, agents are explicitly invoked — either via slash commands (`/new-endpoint`, `/debug`, `/refactor`) or by referencing their name in chat. Structurally, agents contain multi-step workflows with checklists, pre-flight context loading, and quality gate pipelines.

### Agent Content: Step-by-Step Workflows

The `new-endpoint.md` agent file contains:

1. **A "Before You Start" section** that tells the AI to ask the developer for inputs: domain name, endpoint path, HTTP methods, auth requirements, whether new database models are needed.
2. **Seven sequential steps**: create blueprint file, create route file, create schema file, create service file, create test file, register the blueprint, create factory (if needed).
3. **A checklist** at the end for the AI to verify its own output.

Each step includes the exact file path pattern to create, the exact code structure to follow, and references to the same conventions enforced by the auto-activating rules.

### How Agents Compose with Auto-Activating Rules

This is where the system becomes more than the sum of its parts. When you invoke an agent while editing files, the AI sees both the agent's instructions and any auto-activated rules for the files you have open.

Walk through what happens when you type `/new-endpoint Create a GET /v1/agencies` in Cursor's chat:

1. **The `new-endpoint` agent loads** because you explicitly invoked it via the slash command.
2. **Auto-active rules for your open files also load.** If you have `api/src/api/users/user_routes.py` open, then `api-routes.mdc`, `api-error-handling.mdc`, and `cross-domain.mdc` all activate.
3. **The AI reads the agent's step-by-step workflow.** It knows to create a blueprint, routes, schemas, services, tests, and register the blueprint.
4. **The AI also reads the auto-active rules.** It knows the decorator stack order, the thin handler pattern, the authentication conventions, the structured logging rules.
5. **The AI generates code that follows both.** The agent tells it what files to create; the auto-active rules tell it what patterns to use inside those files.

This composition is automatic. You do not need to configure it. The agent does not reference the auto-activating rules -- it does not need to. Cursor loads both, and the AI sees both.

### Pre-Flight Context Loading

Every workflow agent in `.cursor/agents/` opens with a "Pre-Flight Context Loading" section that runs *before* the agent generates anything. The pre-flight loads architectural context from MCP server tools and Compound Knowledge so the agent's first edit is already grounded:

1. `get_conventions_summary()` — top-level project conventions.
2. `get_rules_for_file(path)` — for each file the agent expects to touch, list the rules that apply.
3. `get_architecture_section(name)` — pull the relevant numbered section of `documentation/architecture-guide.md`.
4. Compound Knowledge query — fetch indexed prose docs and ADRs that match the task.

The pre-flight is deterministic: the agent must complete every load step before it is allowed to write a file. If a load fails, the agent reports the failure and stops rather than generating from a partial context. This is what prevents agents from drifting into "I'll just guess what the convention is here" behavior.

### The Quality Gate Pipeline Pattern

After the agent generates code, it runs a multi-gate validation pipeline rather than handing the diff straight to the user. This is the **Quality Gate Pipeline** pattern, defined in `.cursor/skills/quality-gate/SKILL.md` and reused by every workflow agent.

Each gate is a Compound Engineering specialist (or a quality-gate specialist subagent from `.cursor/agents/`). The gates run in a fixed order, with conditional gates added based on the change type:

```
                        +-------------------------+
                        | 1. Pre-Flight Context   |
                        |    (MCP + Compound      |
                        |     Knowledge)          |
                        +-----------+-------------+
                                    |
                                    v
                        +-------------------------+
                        | 2. Generate code        |
                        |    (agent main body)    |
                        +-----------+-------------+
                                    |
                                    v
   Gate 1 ----------------> codebase-conventions-reviewer
        (always runs)             |
                                  v
   Gate 2 ----------------> domain specialists (parallel)
        (varies by agent)         |
                                  v
   Gate 3 ----------------> language reviewer
        (kieran-python or kieran-typescript)
                                  |
                                  v
   Gate 4+ --------------> conditional specialists (parallel)
        (e.g., security-sentinel for auth changes,
         pii-leak-detector for log/error edits,
         data-migration-expert for migrations,
         accessibility-auditor for UI components)
                                  |
                                  v
                        +-------------------------+
                        | Findings merged,        |
                        | agent fixes issues,     |
                        | re-runs failing gates,  |
                        | then returns the diff   |
                        +-------------------------+
```

If any gate finds a blocker, the agent fixes the issue and re-runs at least the failing gate before presenting output. This means agent-generated code has been validated by multiple expert reviewers before you see it. The pattern is identical across `new-endpoint`, `codemod`, `feature-flag`, `pr-preparation`, and every other workflow agent — only the specific specialists in Gate 2 and Gate 4+ change.

### Available Agents

The toolkit includes 51 agents, grouped into four categories. The original nine workflow agents are:

| Agent | Slash Command | Purpose |
|---|---|---|
| `orchestrator` | — | Route tasks to the appropriate specialist agent |
| `new-endpoint` | `/new-endpoint` | Generate a complete new API endpoint with all required files |
| `code-generation` | `/generate` | General-purpose code generation following project conventions |
| `test-generation` | `/test` | Generate test files with proper structure and coverage |
| `migration` | `/migration` | Create database migration files with Alembic |
| `i18n` | `/i18n` | Add internationalization support to frontend components |
| `adr` | `/adr` | Write an Architecture Decision Record |
| `debugging` | `/debug` | Investigate errors, stack traces, and failing tests |
| `refactor` | `/refactor` | Plan and execute multi-file structural changes |

Each agent includes pre-flight MCP context loading and a quality gate pipeline using Compound Engineering specialists. The other 42 agents (extended workflow, quality-gate subagents, and read-only onboarding agents) are catalogued in [Agents Reference](05-agents-reference.md).

---

## The PR Review Skill

The PR review capability now lives as a skill in `.cursor/skills/pr-review/SKILL.md` with supporting files for the dispatch table, severity guide, voice guide, and checklist template. It instructs the AI to perform a structured, multi-perspective code review.

### The Dispatch Table

The core of `pr-review.mdc` is a dispatch table that maps changed file paths to which rule files should be enforced during review:

```markdown
| Changed files match                         | Enforce rules from            |
|---------------------------------------------|-------------------------------|
| `api/src/api/**/*.py`                       | `api-routes.mdc`              |
| `api/src/services/**/*.py`                  | `api-services.mdc`            |
| `api/src/db/**/*.py`                        | `api-database.mdc`            |
| `api/src/auth/**/*.py`                      | `api-auth.mdc`                |
| `api/src/validation/**/*.py`                | `api-validation.mdc`          |
| `api/src/form_schema/**/*.py`               | `api-form-schema.mdc`         |
| `api/tests/**/*.py`                         | `api-tests.mdc`               |
| `api/src/**/*.py` (any)                     | `api-error-handling.mdc`      |
| `frontend/src/components/**/*`              | `frontend-components.mdc`     |
| `frontend/src/hooks/**/*`                   | `frontend-hooks.mdc`          |
| `frontend/src/services/**/*`                | `frontend-services.mdc`       |
| `frontend/src/i18n/**/*`                    | `frontend-i18n.mdc`           |
| `frontend/tests/**/*`, `frontend/e2e/**/*`  | `frontend-tests.mdc`          |
| `infra/**/*.tf`                             | `infra.mdc`                   |
| `.github/**/*.yml`                          | `ci-cd.mdc`                   |
| `**/form*/**/*`                             | `forms-vertical.mdc`          |
| Any file                                    | `cross-domain.mdc`            |
```

When the AI reviews a PR, it identifies which files changed, looks up the applicable rules from this table, and checks the diff against those rules. A PR that modifies both `api/src/api/users/user_routes.py` and `frontend/src/components/UserCard.tsx` triggers both backend and frontend rule enforcement.

### The Specialist Execution Protocol

The rule instructs the AI to review the PR from multiple specialist perspectives:

**Mandatory core specialists (every PR):**
- `codebase-conventions-reviewer` -- checks changed code against the dispatch table rules. Highest priority.
- `security-sentinel` -- security vulnerabilities, auth/authz, input validation, secret handling.
- `performance-oracle` -- query performance, render performance, complexity risks.
- `code-simplicity-reviewer` -- unnecessary complexity, YAGNI violations, simplification opportunities.
- `architecture-strategist` -- pattern compliance, layer boundaries, architectural integrity.

**Language-specific specialists (based on changed files):**
- `kieran-typescript-reviewer` -- for TypeScript/JavaScript frontend files.
- `kieran-python-reviewer` -- for Python backend files.

**Auto-activated specialists (based on change type):**
- `data-integrity-guardian`, `data-migration-expert`, `schema-drift-detector` -- for database migrations.
- `julik-frontend-races-reviewer` -- for frontend async/lifecycle changes.
- `pattern-recognition-specialist` -- for cross-module duplication concerns.

These are not separate AI agents, separate processes, or separate API calls. They are instructions telling a single AI to analyze the same diff from different perspectives, then merge its findings into a unified review. The AI role-plays each specialist, collects findings, de-duplicates them, and produces one cohesive output.

### The Severity System

Every review comment must use a severity prefix:

| Prefix | Meaning | Merge impact |
|---|---|---|
| `bug:` | Likely functional, security, or data issue | Should be fixed before merge |
| `a11y:` | Accessibility issue | Should be fixed for user-facing changes |
| `testing:` | Missing critical test coverage | Needs attention |
| `suggestion:` | Meaningful improvement | Non-blocking |
| `question:` | Clarification request | Non-blocking |
| `nit:` | Minor style or preference | Not a blocker |

The severity maps to the confidence system described earlier. A violation of a high-confidence, team-agreed rule (like decorator stack order) gets `bug:` severity. A violation of a pending convention gets `suggestion:` severity.

### The Comment Style Guide

The rule includes a detailed style guide that instructs the AI to write comments in a specific voice -- friendly, collaborative, using "we" and contractions. This is not cosmetic. Review comments written in a robotic or adversarial tone get ignored. Comments written in a human, collaborative tone get addressed.

Example output the AI produces when following this style guide:

> **suggestion:** Per our `api-routes` convention (Rule: Thin Route Handlers), business logic should live in the service layer, not in the route handler. Would it make sense to extract this into a service method?

> **bug:** Heads up, I think this could throw if `response.data` comes back as `undefined`. We'll want to add a null check here to be safe.

> **nit:** This variable name is a bit generic. Would something like `grantApplicationStatus` be clearer here? Makes it easier for folks reading this later.

Every comment references the specific rule it enforces (when applicable), uses the severity prefix, and frames the feedback collaboratively.

---

## MCP Servers

### What MCP Is

MCP stands for Model Context Protocol. It is an open standard that lets AI tools access external data sources through a lightweight server interface. The AI sends a tool call ("get me section 4 of the architecture guide"), the MCP server returns the data, and the AI incorporates it into its response.

### Three Configured Servers

The toolkit configures three MCP servers in `.cursor/mcp.json`:

**1. GitHub Server**

```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${env:GITHUB_PAT}"
  }
}
```

This is the official GitHub MCP server from the Model Context Protocol project. It gives the AI access to pull requests, issues, and repository metadata. When the AI reviews a PR, it can fetch the actual diff, read PR comments, and check issue context through this server.

**2. Filesystem Server**

```json
"filesystem": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "./documentation"]
}
```

This gives the AI direct read access to the `documentation/` directory, which contains the architecture guide and detailed rule documentation. The server provides file listing and reading capabilities scoped to that directory.

**3. Custom simpler-grants-context Server**

```json
"simpler-grants-context": {
  "command": "node",
  "args": ["./mcp-server/dist/index.js"]
}
```

This is the only custom code in the entire MCP setup: approximately 300 lines of TypeScript in `mcp-server/src/index.ts`. It serves targeted sections of the project's documentation rather than loading everything at once.

### Why a Custom Server

The architecture guide for simpler-grants-gov is approximately 50KB. The detailed rule documentation totals approximately 500KB. Loading all of that into the AI's context window on every interaction would waste thousands of tokens on irrelevant information.

The custom server solves this by exposing ten targeted tools:

| Tool | Purpose |
|---|---|
| `get_architecture_section` | Returns a specific section of the architecture guide by name or number |
| `get_rules_for_file` | Given a file path, returns only the rules that apply to it |
| `get_rule_detail` | Returns the full documentation for a single named rule |
| `get_conventions_summary` | Returns a high-level summary of key conventions |
| `list_rules` | Lists all available rules with brief descriptions |
| `list_agents` | Lists all available agents with descriptions |
| `list_commands` | Lists all available slash commands |
| `list_skills` | Lists all available skills with descriptions |
| `get_agent_detail` | Returns the full content of a specific agent |
| `get_skill_detail` | Returns the full content of a skill and its supporting files |

The server includes the same file-path-to-rule mapping as the `pr-review.mdc` dispatch table, implemented as an array of regex patterns:

```typescript
const FILE_RULE_MAP: Array<{ pattern: RegExp; rules: string[] }> = [
  { pattern: /api\/src\/api\//, rules: ["api-routes", "api-error-handling"] },
  { pattern: /api\/src\/services\//, rules: ["api-services", "api-error-handling"] },
  { pattern: /api\/src\/db\//, rules: ["api-database"] },
  // ... and so on for each domain
];
```

When the AI calls `get_rules_for_file("api/src/api/users/user_routes.py")`, the server matches the path against these patterns and returns only `api-routes`, `api-error-handling`, and `cross-domain` (which always applies). The AI gets exactly the rules it needs, not the entire documentation corpus.

### Everything Runs Locally

All three MCP servers run on your local machine as child processes of Cursor. The GitHub server communicates with the GitHub API (using your personal access token). The filesystem server reads files from your local disk. The custom server reads from local documentation files.

No data leaves your machine except through Cursor's normal AI API calls -- the same calls that happen with or without MCP servers configured.

---

## Plugin Architecture: Compound Engineering and Compound Knowledge

### Compound Engineering — Specialist Sub-Agents

Every agent and domain rule in this toolkit can invoke specialist sub-agents from the Compound Engineering plugin. These specialists are domain experts that validate specific aspects of generated code:

**Core specialists (available on every review):**
- `codebase-conventions-reviewer` — validates code against all ALWAYS/NEVER/MUST directives
- `security-sentinel` — security vulnerabilities, auth/authz, input validation
- `performance-oracle` — query/render performance, complexity risks
- `code-simplicity-reviewer` — unnecessary complexity, simplification opportunities
- `architecture-strategist` — pattern compliance, layering, boundary integrity

**Language specialists (conditional):**
- `kieran-python-reviewer` — Python quality (when Python files are involved)
- `kieran-typescript-reviewer` — TypeScript quality (when TS/JS files are involved)

**Domain specialists (conditional by change type):**
- `data-integrity-guardian` — data consistency (DB changes)
- `data-migration-expert` — migration safety (migrations)
- `schema-drift-detector` — schema consistency across layers (schema changes)
- `deployment-verification-agent` — deployment safety (infra/CI changes)
- `julik-frontend-races-reviewer` — async/race conditions (async UI changes)
- `pattern-recognition-specialist` — duplication detection
- `agent-native-reviewer` — agent/tooling quality
- `git-history-analyzer` — historical context (on-demand)

**How it works in practice:**

When you invoke `agent-new-endpoint`, the agent:
1. Loads architectural context via MCP server tools (pre-flight)
2. Generates all endpoint files following project conventions
3. Runs Gate 1: `codebase-conventions-reviewer` validates convention compliance
4. Runs Gate 2: `architecture-strategist` validates route/service layering + `security-sentinel` validates auth patterns (in parallel)
5. Runs Gate 3: `kieran-python-reviewer` validates Python quality
6. Runs Gate 4 (conditional): `performance-oracle` if the endpoint is query-heavy
7. Returns the validated, corrected output

When a domain rule like `api-routes.mdc` activates during editing, the specialist invocation is conditional on complexity:
- Simple changes (< 20 lines): rule directives alone are sufficient
- Moderate changes: `codebase-conventions-reviewer` validates
- Complex changes: multiple specialists run in parallel

### Compound Knowledge — Documentation Context

Compound Knowledge indexes your project documentation and makes it available as AI context. The toolkit instructs the AI to consult this indexed knowledge for:
- Architecture Decision Records (ADRs) and their rationale
- Historical patterns and conventions
- Domain-specific documentation from the architecture guide
- Precedents for similar code changes

This means the AI doesn't just follow rules — it understands the *why* behind them.

### MCP Server Tools — Dynamic Context Loading

The custom `simpler-grants-context` MCP server provides 10 tools that agents and rules call for targeted context:
- `get_architecture_section(section)` — retrieve a specific section of the architecture guide
- `get_rules_for_file(file_path)` — discover which rules apply to a given file
- `get_rule_detail(rule_name)` — load the full text of a specific rule
- `get_conventions_summary()` — get cross-cutting project conventions
- `list_rules()` — list all available rules
- `list_agents()` — list all available agents with descriptions
- `list_commands()` — list all available slash commands
- `list_skills()` — list all available skills with descriptions
- `get_agent_detail(agent_name)` — get full content of a specific agent
- `get_skill_detail(skill_name)` — get full content of a skill and its supporting files

This avoids dumping the entire 50KB architecture guide into context. Instead, agents load only the sections they need.

---

## You Are Always In Control

Every layer of this toolkit operates within strict boundaries:

**The AI never executes code.** It suggests changes as diffs in Cursor's interface. You review every line before accepting.

**The AI never pushes commits or creates PRs.** It can read PR data through the GitHub MCP server, but it cannot write to the repository. Every commit is yours.

**Rules guide suggestions but do not force anything.** If the AI suggests something based on a rule and you disagree, you ignore the suggestion. The rule does not prevent you from writing code however you choose.

**Every rule file is a plain text file you can read and edit.** Open `.cursor/rules/api-routes.mdc` in any text editor. Change a directive. Delete a section. Add a new convention. The rules are not compiled, encrypted, or hidden.

**You can disable the toolkit entirely.** Remove the `.cursor/rules/` directory, delete the MCP configuration from `.cursor/mcp.json`, and everything goes back to stock Cursor behavior. If you used the symlink setup, removing the symlinks is even simpler.

The toolkit exists to make the AI a better pair programmer for this specific codebase. It does not take any action you have not explicitly approved.

---

## See Also

- [What Is This Toolkit?](01-what-is-this-toolkit.md) -- overview and value proposition
- [Auto-Activating Rules](04-auto-activating-rules.md) -- complete reference for all 24 rule files
- [PR Review Guide](11-pr-review-guide.md) -- how to use the PR review skill
- [Back to documentation index](README.md)
