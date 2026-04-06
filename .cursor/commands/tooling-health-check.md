# Tooling Health Check

Run a comprehensive diagnostic of the Simpler Grants AI Coding Toolkit to verify that all Cursor primitives, MCP servers, plugins, and dependencies are correctly configured on this machine.

## What To Do

Run the health check script and report results:

1. Execute `.cursor/hooks/health-check.ts` using Bun (or fall back to manual checks if Bun is not available)
2. Present the results organized by category
3. For any failures, provide the specific fix command or troubleshooting steps

If the script cannot be executed (Bun not installed, permissions issue), perform each check manually using shell commands and report the same structured output.

## Health Check Categories

### Category 1: Runtime Dependencies

Check that the tools the toolkit depends on are installed and accessible:

| Dependency | Check Command | Required By |
|-----------|---------------|-------------|
| Node.js (≥18) | `node --version` | Frontend, commands, skills |
| npm | `npm --version` | Frontend dependencies |
| Python (≥3.11) | `python3 --version` | API |
| pip | `pip3 --version` | API dependencies |
| Bun | `bun --version` | Hooks (TypeScript dispatchers) |
| ruff | `ruff --version` | Hooks (auto-formatter for Python) |
| Terraform | `terraform --version` | Infra rules, hooks (terraform fmt) |
| jq | `jq --version` | Hooks (JSON parsing fallback) |
| git | `git --version` | Agents, hooks (session summary, test runner) |
| gh (GitHub CLI) | `gh --version` | PR review skill, GitHub MCP |
| Prettier | `npx prettier --version` | Hooks (auto-formatter for TS/JS) |
| ESLint | `npx eslint --version` | Frontend convention checks |
| pytest | `python3 -m pytest --version` | API test runner hook |
| Playwright | `npx playwright --version` | E2E test agent workflows |

For each: report version if found, or ❌ NOT FOUND with install instructions.

### Category 2: Cursor Directory Structure

Verify the `.cursor/` directory has the expected structure. Check for existence of each path:

```
.cursor/
├── rules/                          # Must exist, must contain .mdc files
│   ├── api-routes.mdc
│   ├── api-services.mdc
│   ├── api-database.mdc
│   ├── api-auth.mdc
│   ├── api-validation.mdc
│   ├── api-error-handling.mdc
│   ├── api-form-schema.mdc
│   ├── api-tests.mdc
│   ├── api-tasks.mdc
│   ├── api-adapters.mdc
│   ├── api-workflow.mdc
│   ├── api-search.mdc
│   ├── frontend-components.mdc
│   ├── frontend-hooks.mdc
│   ├── frontend-services.mdc
│   ├── frontend-i18n.mdc
│   ├── frontend-tests.mdc
│   ├── frontend-e2e-tests.mdc
│   ├── frontend-app-pages.mdc
│   ├── accessibility.mdc
│   ├── cross-domain.mdc
│   ├── forms-vertical.mdc
│   ├── ci-cd.mdc
│   └── infra.mdc
│
├── agents/                         # Must exist, must contain .md files
│   ├── debugging.md
│   ├── refactor.md
│   ├── new-endpoint.md
│   ├── orchestrator.md
│   ├── code-generation.md
│   ├── test-generation.md
│   ├── migration.md
│   ├── i18n.md
│   └── adr.md
│
├── commands/                       # Must exist, must contain .md files
│   ├── debug.md
│   ├── refactor.md
│   ├── new-endpoint.md
│   ├── generate.md
│   ├── test.md
│   ├── migration.md
│   ├── i18n.md
│   ├── adr.md
│   ├── review-pr.md
│   ├── check-conventions.md
│   ├── explain-architecture.md
│   └── tooling-health-check.md
│
├── skills/                         # Must exist, must contain SKILL.md dirs
│   ├── pr-review/
│   │   └── SKILL.md
│   ├── quality-gate/
│   │   └── SKILL.md
│   ├── onboarding/
│   │   └── SKILL.md
│   └── flag-cleanup/
│       └── SKILL.md
│
├── hooks.json                      # Must exist, must be valid JSON
├── hooks/                          # Must exist
│   ├── dispatchers/                # Must contain .ts files
│   ├── handlers/                   # Must contain handler subdirectories
│   ├── lib/                        # Must contain shared utilities
│   ├── types.ts
│   └── package.json
│
└── mcp.json                        # Must exist, must be valid JSON
```

For each expected file/directory:
- ✅ Present
- ❌ MISSING — with the exact file that should be there
- ⚠️ UNEXPECTED — files that exist but aren't in the expected list (might be fine, flag for review)

Report summary: "24/24 rules, 9/9 agents, 12/12 commands, 4/4 skills, 6/6 dispatchers"

### Category 3: Rule File Integrity

For each `.mdc` file in `.cursor/rules/`:

1. **Frontmatter check:** Does it have valid YAML frontmatter with `description`, `globs`, and `alwaysApply` fields?
2. **Non-empty body:** Does it have content below the frontmatter (at least 10 lines)?
3. **Glob validity:** If globs are specified, do the glob patterns match at least one file in the actual repository? (Run `find` or `ls` against each glob pattern)
4. **Cross-references:** Does the file reference other rules that actually exist? (Parse `*.mdc` references and verify the target files exist)

Report:
- ✅ Valid — frontmatter OK, body present, globs match files, cross-refs valid
- ⚠️ Warning — frontmatter OK but globs match zero files (rule may never activate)
- ⚠️ Warning — references a rule file that doesn't exist
- ❌ Invalid — missing frontmatter, empty body, or malformed YAML

### Category 4: Agent File Integrity

For each `.md` file in `.cursor/agents/`:

1. **Frontmatter check:** Does it have valid YAML frontmatter with `name`, `description`, `model` fields?
2. **Non-empty body:** Does it have a substantive workflow (at least 50 lines)?
3. **MCP references:** Does it reference MCP tools that exist in `mcp.json`?
4. **Cross-references:** Does it reference rules, skills, or other agents that exist?

### Category 5: Command File Integrity

For each `.md` file in `.cursor/commands/`:

1. **No frontmatter:** Commands should NOT have YAML frontmatter (plain Markdown)
2. **Non-empty body:** Does it have content (at least 5 lines)?
3. **References valid agents/skills:** If it routes to an agent or skill, does that target exist?

### Category 6: Skill Integrity

For each directory in `.cursor/skills/`:

1. **SKILL.md exists:** Does the directory contain a SKILL.md file?
2. **Frontmatter check:** Does SKILL.md have valid YAML frontmatter with `name` and `description`?
3. **Supporting files:** Are there companion files alongside SKILL.md? List them.
4. **Non-empty body:** Does SKILL.md have substantive content (at least 20 lines)?

### Category 7: Hooks Integrity

1. **hooks.json validity:**
   - Is it valid JSON?
   - Does it have `"version": 1`?
   - Does it reference all 6 lifecycle events? (`beforeShellExecution`, `beforeMCPExecution`, `beforeReadFile`, `beforeSubmitPrompt`, `afterFileEdit`, `stop`)
   - For each event, does the referenced command script exist?

2. **Hook script permissions:**
   - For each script referenced in hooks.json, check:
     - Does the file exist?
     - Is it executable? (`ls -la` and check for `x` permission)
     - Can it be parsed without syntax errors? (For TypeScript: `bun check`, for bash: `bash -n`)

3. **Hook dependencies:**
   - Does `.cursor/hooks/package.json` exist?
   - Have dependencies been installed? (Check for `node_modules/` or `bun.lockb`)
   - If Bun is required, is it installed?

4. **Hook logs directory:**
   - Does `.cursor/hooks/logs/` exist? (Create it if not)
   - Is it in `.gitignore`?

### Category 8: MCP Server Configuration

1. **mcp.json validity:**
   - Is it valid JSON?
   - Does it define the expected servers?

2. **Server connectivity:** For each MCP server defined in `mcp.json`:
   - `simpler-grants-context`: Can you call `list_rules()` and get a response?
   - `github`: Can you call a basic GitHub tool and get a response?
   - `filesystem`: Can you access the project directory?

   For each server:
   - ✅ Connected — tool call returned a valid response
   - ❌ Not connected — error message or timeout
   - ⚠️ Degraded — connected but returning unexpected results

3. **MCP tool inventory:** List all available tools from each server and verify the expected tools exist:
   - `simpler-grants-context`: `get_architecture_section`, `get_rules_for_file`, `get_rule_detail`, `get_conventions_summary`, `list_rules`
   - Report any missing or extra tools

### Category 9: Plugin Configuration

Check that Cursor plugins are installed and configured:

1. **Compound Engineering:**
   - Is the plugin installed? (Check Cursor's extension/plugin list if possible, or check for configuration artifacts)
   - Are the expected specialists available? List expected: `security-sentinel`, `performance-oracle`, `architecture-strategist`, `kieran-python-reviewer`, `kieran-typescript-reviewer`, `julik-frontend-races-reviewer`, `code-simplicity-reviewer`, `pattern-recognition-specialist`, `codebase-conventions-reviewer`, `data-integrity-guardian`, `git-history-analyzer`
   - Note: Plugin verification may be limited to checking for configuration files or documentation references, since Cursor's plugin system may not be queryable from the command line.

2. **Compound Knowledge:**
   - Is the plugin installed?
   - Is the documentation index configured to include the `documentation/` directory, architecture guide, and rule files?

Report:
- ✅ Configured — plugin artifacts detected
- ⚠️ Cannot verify — no programmatic way to check (provide manual verification steps)
- ❌ Not configured — expected artifacts missing

### Category 10: Repository Health

Quick checks on the actual codebase:

1. **Git status:** Is the repo clean? Are there uncommitted changes? Is the branch up to date with remote?
2. **Python environment:** Does `api/` have a virtual environment or are dependencies installed? Can `import flask` succeed?
3. **Node modules:** Does `frontend/node_modules/` exist? Is it up to date with `package-lock.json`?
4. **Terraform initialized:** Has `terraform init` been run in the infra directory?
5. **Environment files:** Do `.env.development` (or equivalent local env files) exist where expected?

## Output Format

Present results as a structured report:

```
═══════════════════════════════════════════════════
  SIMPLER GRANTS AI TOOLKIT — HEALTH CHECK REPORT
═══════════════════════════════════════════════════

Run at: [timestamp]
Machine: [hostname]

───────────────────────────────────────────────────
  1. RUNTIME DEPENDENCIES
───────────────────────────────────────────────────

  ✅ Node.js          v22.1.0
  ✅ npm              v10.8.0
  ✅ Python           v3.12.3
  ✅ Bun              v1.1.34
  ✅ ruff             v0.5.1
  ❌ Terraform        NOT FOUND
     → Install: brew install terraform
  ✅ git              v2.44.0
  ⚠️ gh               v2.50.0 (not authenticated)
     → Run: gh auth login

  Result: 11/14 passed, 1 failed, 2 warnings

───────────────────────────────────────────────────
  2. DIRECTORY STRUCTURE
───────────────────────────────────────────────────

  Rules:    24/24 ✅
  Agents:    9/9  ✅
  Commands: 12/12 ✅
  Skills:    4/4  ✅
  Hooks:     6/6  ✅
  MCP:       1/1  ✅

  Result: all files present

[... continue for all 10 categories ...]

═══════════════════════════════════════════════════
  SUMMARY
═══════════════════════════════════════════════════

  ✅ Passed:    87
  ⚠️ Warnings:   5
  ❌ Failed:     2

  OVERALL STATUS: ⚠️ NEEDS ATTENTION

  Priority fixes:
  1. ❌ [specific fix with command]
  2. ⚠️ [specific fix with command]

═══════════════════════════════════════════════════
```

## What To Do When Checks Fail

For each failure category, provide specific remediation steps:

### Runtime Dependencies
```bash
# Node.js
brew install node  # macOS
# or: nvm install 22

# Bun
curl -fsSL https://bun.sh/install | bash

# ruff
pip install ruff --break-system-packages

# Terraform
brew install terraform

# GitHub CLI
brew install gh && gh auth login

# Prettier (project-local)
cd frontend && npm install

# Playwright
cd frontend && npx playwright install
```

### Missing Files
```bash
# If rule/agent/command/skill files are missing, the toolkit may need
# to be re-generated. Check git status for accidentally deleted files:
git status
git checkout -- .cursor/path/to/missing/file
```

### Hook Issues
```bash
# Make hooks executable
chmod +x .cursor/hooks/dispatchers/*.ts
chmod +x .cursor/hooks/handlers/**/*.ts

# Install hook dependencies
cd .cursor/hooks && bun install

# Create logs directory
mkdir -p .cursor/hooks/logs
echo "logs/" >> .cursor/hooks/.gitignore

# Verify hooks work
echo '{"hook_event_name":"test","file_path":"test.py","workspace_roots":[],"conversation_id":"test","generation_id":"test"}' | bun run .cursor/hooks/dispatchers/after-file-edit.ts
```

### MCP Server Issues
```bash
# If simpler-grants-context MCP is not responding:
# 1. Check that mcp.json has the correct server configuration
# 2. Verify the MCP server process is running
# 3. Check the server logs for errors
# 4. Restart Cursor to reconnect MCP servers

# If GitHub MCP is not responding:
# 1. Verify gh auth status
# 2. Check that the GitHub token has the required scopes
# 3. Restart Cursor
```

### Plugin Issues
```
Compound Engineering and Compound Knowledge are Cursor plugins.
To verify they're installed:
1. Open Cursor Settings (Cmd+,)
2. Navigate to Extensions/Plugins
3. Search for "Compound Engineering" and "Compound Knowledge"
4. If not installed, install from the Cursor marketplace
5. Restart Cursor after installation
```

## Agent-Only Checks

Some checks require Cursor-internal knowledge that a shell script cannot access. After running the script, also perform these checks directly:

1. **MCP server connectivity** — actually call MCP tools (`list_rules()`, etc.) to verify they respond
2. **Plugin availability** — check if Compound Engineering specialists can be invoked
3. **Rule activation** — verify that opening a file with a specific glob pattern causes the expected rule to activate
