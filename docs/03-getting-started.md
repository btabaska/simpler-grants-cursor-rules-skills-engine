# Getting Started

A step-by-step tutorial for first-time setup of the AI coding toolkit for the
HHS/simpler-grants-gov project.

The toolkit installs into either **Cursor** or **Claude Code** (or both side-by-side). Pick your
target at install time:

```bash
./setup.sh                       # interactive — pick 1 (Cursor), 2 (Claude Code), or 3 (both)
./setup.sh --target=cursor       # cursor only
./setup.sh --target=claude       # claude code only
./setup.sh --target=both         # install both
TOOLKIT_TARGET=claude ./setup.sh # via env var (for CI/non-interactive)
```

The Cursor and Claude Code installs expose the same agents, skills, slash commands, hooks, and
MCP servers — only the on-disk file layout differs. See
[`16-claude-code-vs-cursor.md`](16-claude-code-vs-cursor.md) for the parity matrix.

---

## Prerequisites

### 1. Cursor IDE _or_ Claude Code

Pick whichever you use:

- **Cursor** — download from [https://cursor.sh](https://cursor.sh). A fork of VS Code with
  built-in AI features; your extensions, themes, and keybindings carry over.
- **Claude Code** — install per [the docs](https://docs.claude.com/en/docs/claude-code). Available
  as a CLI, desktop app, web app, and IDE extensions for VS Code and JetBrains.

### 2. A Local Clone of HHS/simpler-grants-gov

You need the monorepo cloned locally:

```bash
cd ~/GitHub  # or wherever you keep repos
git clone https://github.com/HHS/simpler-grants-gov.git
```

### 3. Node.js 18+

Required for MCP servers. Verify with `node --version` (should print v18+).
Install from [https://nodejs.org](https://nodejs.org) or use `nvm` if needed.

### 4. A GitHub Personal Access Token (PAT)

The toolkit uses a PAT to access repository data (issues, pull requests, file
contents) through the MCP server. You need a **fine-grained** token scoped to the
HHS/simpler-grants-gov repository.

**How to create the PAT:**

1. Go to [GitHub Settings](https://github.com/settings/profile)
2. In the left sidebar, click **Developer Settings**
3. Click **Personal Access Tokens** then **Fine-grained tokens**
4. Click **Generate new token**
5. Give it a descriptive name (e.g., `simpler-grants-toolkit`)
6. Under **Repository access**, select **Only select repositories** and choose
   `HHS/simpler-grants-gov`
7. Under **Permissions**, grant **Read** access to:
   - **Contents** -- needed to fetch file contents
   - **Pull requests** -- needed to read PR data and diffs
   - **Issues** -- needed to read issue context
8. Click **Generate token** and copy the value immediately

Set the token as an environment variable by adding this to your shell profile
(`~/.zshrc` for macOS or `~/.bashrc` for Linux):

```bash
export GITHUB_PAT=ghp_your_token_here
```

Then reload with `source ~/.zshrc` (or `source ~/.bashrc`).

### Required Cursor Plugins

After cloning and running the setup script, install these two Cursor plugins:

**Compound Engineering:**
1. Open Cursor Settings (Cmd+, or Ctrl+,)
2. Go to Extensions / Plugins
3. Search for "compound-engineering"
4. Click Install
5. Verify: type `@compound` in Cursor chat — specialists should appear in autocomplete

**Compound Knowledge:**
1. Open Cursor Settings (Cmd+, or Ctrl+,)
2. Go to Extensions / Plugins
3. Search for "compound-knowledge"
4. Click Install
5. Open the Compound Knowledge panel
6. Add the `documentation/` directory and `.cursor/rules/` directory to the knowledge index
7. Wait for indexing to complete

These plugins are required for the full quality gate pipelines to work. Without them, the toolkit still functions (rules activate, conventions are enforced), but specialist validation and knowledge-enriched context will be unavailable.

---

## Installation

### Step 1: Clone the Toolkit Repo

Clone this toolkit repo as a **sibling** to your simpler-grants-gov directory:

```bash
cd ~/GitHub  # or wherever your repos live
git clone https://github.com/btabaska/simpler-grants-documentation-automation.git
```

Your directory structure should look like this:

```
~/GitHub/
  simpler-grants-gov/          # the monorepo
  simpler-grants-documentation-automation/  # this toolkit
```

### Step 2: Run the Setup Script

```bash
cd simpler-grants-documentation-automation
./setup.sh
```

**What setup.sh does:**

- **Detects the sibling monorepo** -- looks for `simpler-grants-gov/` next to
  the toolkit directory. If it is not found, it prompts you to enter the path.
- **Creates symlinks** into the monorepo:
  - `.cursor/` symlinks to the toolkit's `.cursor/` directory (rules, snippets,
    agents, MCP config)
  - `.cursorrules` symlinks to the toolkit's `.cursorrules` file
  - `documentation/` symlinks to the toolkit's `documentation/` directory
- **Checks for Node.js** and warns if it is missing or below version 18
- **Checks for GITHUB_PAT** and warns if the environment variable is not set
- **Optionally installs git hooks** for pre-commit checks
- **Builds the custom MCP server** if the `mcp-server/` directory is present
  (`npm install && npm run build`)

### Step 3: Open the Monorepo in Cursor

```bash
cursor ~/GitHub/simpler-grants-gov
```

Cursor will detect the `.cursor/` directory and load the rules, agents, snippets,
and MCP configuration automatically.

---

## Verification Exercises

Run through each exercise to confirm every component is working.

### Exercise 1: Rules Are Loading

Verifies that Cursor rules activate based on the file you are editing.

1. Open Cursor with the simpler-grants-gov project
2. Open the file `api/src/api/users/user_routes.py` (or any file under
   `api/src/api/`)
3. Open Cursor chat with **Cmd+L** (Mac) or **Ctrl+L** (Windows/Linux)
4. Type the following prompt:

   ```
   What conventions should I follow when writing route handlers in this project?
   ```

5. **What you should see:** The AI responds with specific conventions about:
   - Decorator stack order (`@blueprint.METHOD` first, then `@blueprint.input`,
     `@blueprint.output`, `@blueprint.doc`, `@blueprint.auth_required`,
     `@flask_db.with_db_session`)
   - Thin handlers that delegate to service functions
   - Using `raise_flask_error()` instead of `abort()`
   - Structured logging with `extra={}` dictionaries

6. **What it means if this works:** The `api-routes.mdc` rule activated
   automatically based on the file path and loaded project-specific conventions
   into the AI's context.

7. **What it means if you get generic Python advice instead:** The rules are not
   loading. See the troubleshooting section below.

### Exercise 2: Code Generation

Verifies that generated code follows project conventions.

1. Create a new file: `api/src/api/test_domain_v1/test_routes.py`
2. In Cursor chat, type:

   ```
   Generate a GET route handler at /v1/test-domain/<uuid:item_id> that retrieves
   an item by ID. Use JWT + API key auth.
   ```

3. **What you should see:** Generated code with:
   - The exact decorator stack order: `blueprint.get` then `input` then `output`
     then `doc` then `auth_required` then `with_db_session`
   - A thin handler that delegates to a service function
   - `raise_flask_error(404, ...)` for not-found cases
   - Structured logging with static messages and `extra={}` dictionaries

4. **What to check:**
   - Decorators are in the correct order (not shuffled)
   - The handler body is thin -- no business logic, just a call to a service
   - Uses `raise_flask_error()`, not `abort()`
   - Logging messages are static strings with dynamic data in `extra={}`

5. **Clean up:** Delete the test file when you are done:
   ```bash
   rm -rf api/src/api/test_domain_v1/
   ```

### Exercise 3: Agent Invocation

Verifies that agent definitions are accessible.

1. In Cursor chat, type the slash command (preferred) or agent name:

   ```
   /test Write a test for a service function that retrieves a
   user by user_id. The function is get_user(db_session, user_id) and returns a
   User model or raises a 404.
   ```
   (You can also use `@agent-test-generation` instead of `/test`.)

2. **What you should see:** A test file with:
   - `Factory.build()` or `Factory.create()` (with `enable_factory_create`
     fixture) for test data
   - Standalone test functions (not wrapped in classes)
   - Proper assertion patterns matching the project's test conventions

3. **What this confirms:** Agent definitions in `.cursor/agents/` are loading
   and the AI is following agent-specific instructions.

### Exercise 4: Snippets

Verifies that code snippets are available.

1. Open any `.py` file under `api/src/`
2. Type `sgg-route` and wait for the autocomplete dropdown to appear
3. You should see a snippet option in the list. Select it.
4. Press **Tab** to cycle through the placeholders: blueprint name, path, schema
   names, and so on
5. Fill in or dismiss the placeholders

**If no autocomplete appears:** Check that `.cursor/snippets/` exists in the
monorepo root. If it does, restart Cursor -- it needs to index new snippet files.

### Exercise 5: MCP Server

Verifies that the Model Context Protocol server is running.

1. In Cursor chat, type:

   ```
   Use the simpler-grants-context MCP server to get the conventions summary
   for this project
   ```

2. **If configured correctly:** The AI invokes the MCP tool and returns the
   project's key conventions, pulling live data from the repository.

3. **If it does not work:** The MCP server may not be built. Run:
   ```bash
   cd ~/GitHub/simpler-grants-documentation-automation/mcp-server
   npm install
   npm run build
   ```
   Then restart Cursor.

---

## "You're Ready" Checklist

- [ ] `setup.sh` completed without errors
- [ ] Rules activate when editing API files (Exercise 1)
- [ ] Generated code follows project conventions (Exercise 2)
- [ ] Agents respond when invoked via slash commands or `@agent-*` (Exercise 3)
- [ ] Snippets appear in autocomplete (Exercise 4)
- [ ] MCP server connects and returns data (Exercise 5)

All five checked? You are ready to use the toolkit for real work.

---

## Common First-Time Issues

### "setup.sh says it can't find the monorepo"

The script looks for `simpler-grants-gov/` as a sibling directory (i.e., in the
same parent folder as this toolkit). If your monorepo is elsewhere, enter the
full absolute path when the script prompts you.

### "Rules seem to load but the AI gives mixed advice"

Restart Cursor completely (quit and reopen, not just reload the window). The first
time rules are loaded, Cursor sometimes needs a full restart to pick them up
consistently.

### "Snippets don't appear"

Cursor needs to index the snippet files after they are first created or symlinked.
Restart Cursor and wait approximately 10 seconds for indexing to complete, then
try typing the snippet prefix again.

### "MCP server fails to build"

Verify Node.js 18+ with `node --version`. If the version is correct but the
build still fails, try a clean install:

```bash
cd ~/GitHub/simpler-grants-documentation-automation/mcp-server
rm -rf node_modules && npm install && npm run build
```

### "GITHUB_PAT warning during setup"

The `GITHUB_PAT` environment variable is not set in your current shell session.
Add `export GITHUB_PAT=ghp_your_token_here` to your shell profile (`~/.zshrc`
or `~/.bashrc`), replacing the placeholder with your actual token, then run
`source ~/.zshrc` (or `source ~/.bashrc`) to reload.

---

## How to Invoke Each Primitive

Once setup is complete, here is the canonical way to reach each of the five primitives:

| Primitive | Invocation |
|---|---|
| **Rule** | Open a file whose path matches the rule's `globs`. The rule loads automatically. You never type the rule name. |
| **Workflow agent** | Type `/<command-name>` (e.g., `/new-endpoint`, `/codemod`, `/pr-preparation`) or `@agent-<name>` in chat or Composer. |
| **Quality-gate subagent** | Do **not** invoke directly. They are called by other agents during a Quality Gate Pipeline. If you want one to run standalone, invoke the workflow agent that owns it. |
| **Read-only onboarding agent** | Type `@agent-interactive-codebase-tour`, `@agent-architecture-decision-navigator`, etc. These never write files. |
| **Multi-file workflow skill** | `@skill-pr-review`, `@skill-quality-gate`, `@skill-flag-cleanup`, `@skill-onboarding`, or invoke the matching slash command. |
| **Single-file `skill-*` skill** | `/skill-<name>` (e.g., `/skill-generate-factory`, `/skill-openapi-sync`, `/skill-sql-explain`). |
| **Hook** | Never invoked directly. The Cursor harness fires the registered command on the configured lifecycle event. |

## How to Add a New Artifact

The toolkit is meant to grow. To add a new artifact of any primitive:

1. **Pick the primitive.** Use the decision rule: deterministic event-driven enforcement → hook; passive context loaded by file glob → rule; multi-step workflow → agent; reusable focused capability → skill; quick named entry point → command.
2. **Create the file in the right directory** under `.cursor/`:
   - Rule → `.cursor/rules/<name>.mdc` with `description`, `globs`, and `alwaysApply: false` frontmatter.
   - Agent → `.cursor/agents/<name>.md` with `name` and `description` frontmatter, then a Pre-Flight Context Loading section, the workflow body, and a Quality Gate Pipeline section.
   - Skill → `.cursor/skills/<name>/SKILL.md` (and any supporting files in the same directory).
   - Command → `.cursor/commands/<name>.md` that points at the agent or skill.
   - Hook → register the script in `.cursor/hooks.json` and place the implementation under `.cursor/hooks/handlers/` or `.cursor/hooks/scripts/`.
3. **Write the companion prose doc** under `documentation/cursor-tooling/<category>/<name>.md`. This is the human-facing explanation of why the artifact exists, when to use it, and what it produces.
4. **Add a CHANGELOG Unreleased entry** describing the addition.
5. **Update the relevant numbered doc** in `docs/` so the inventory stays accurate (rule → 04, agent → 05, skill → skills-reference, hook → hooks-reference).

## What's Next

Now that you are set up:

- Read the [Prompt Engineering guide](08-prompt-engineering.md) for best results
- Browse the [Agents Reference](05-agents-reference.md) to see available workflows
- Try the [Prompt Cookbook](appendix/prompt-cookbook.md) for copy-paste ready prompts

---

## See Also

- [What Is This Toolkit?](01-what-is-this-toolkit.md) -- overview of what you just installed
- [Prompt Engineering](08-prompt-engineering.md) -- how to write effective prompts
- [Troubleshooting](13-troubleshooting.md) -- comprehensive problem-solving guide
- [Back to documentation index](README.md)
