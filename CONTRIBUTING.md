# Contributing to the AI Coding Toolkit

## Updating Rules

Rules may need updating when:
- The team adopts a new convention
- An existing convention changes
- A new domain area is added to the codebase
- PR review feedback reveals a pattern not yet captured

### Manual Rule Update

1. Edit the `.mdc` file in `.cursor/rules/`
2. Update the corresponding detailed doc in `documentation/rules/`
3. If the glob patterns changed, update the dispatch table in `.cursor/skills/pr-review/dispatch-table.md`

### Re-running the Analysis Pipeline

The research pipeline scripts live in `research/`. To regenerate rules from recent PRs:

```bash
# 1. Set your GitHub token
export GITHUB_PAT=ghp_your_token_here

# 2. Extract recent PR data
python research/extract.py

# 3. Prepare batch for analysis
python research/prepare_batch.py

# 4. Run analysis passes (manual step — uses LLM)
# Follow the research/analysis/ directory structure for pass1 → pass2 → pass3
```

### Using the Refresh Script

```bash
./research/refresh.sh
```

This will re-extract PRs, diff against current rules, and show what changed.

## Adding a New Domain Rule

1. Create `.cursor/rules/<domain>.mdc` with YAML frontmatter:
   ```yaml
   ---
   description: "When working on <domain> files"
   globs: ["path/to/files/**/*.ext"]
   ---
   ```
2. Write rules using the ALWAYS/NEVER/MUST directive style
3. Include real codebase examples
4. Add the domain to the dispatch table in `.cursor/skills/pr-review/dispatch-table.md`
5. Create `documentation/rules/<domain>.md` with detailed analysis
6. Update `README.md` tables

## Adding a New Agent

1. Create `.cursor/agents/<name>.md` as a Cursor subagent file
2. Include YAML frontmatter with `name`, `description`, and `model` fields
3. Write step-by-step workflow instructions referencing domain rules by name
4. Include pre-flight MCP context loading and quality gate pipeline steps
5. Create a corresponding slash command in `.cursor/commands/<name>.md`
6. Update the MCP server if the agent should be discoverable via `list_agents()`
7. Update `README.md` agents table

## Adding a New Notepad

1. Create `.cursor/notepads/<name>.md`
2. Focus on actionable checklists and code skeletons
3. Keep it scannable (tables, bullet points, code blocks)
4. Update `README.md` notepads table

## Adding Code Snippets

1. Edit the appropriate file in `.cursor/snippets/`:
   - `python-api.code-snippets` for Python/API snippets
   - `typescript-frontend.code-snippets` for TypeScript/frontend snippets
2. Use the `sgg-` prefix for all snippet prefixes
3. Follow VS Code snippet syntax with tabstops (`$1`, `$2`, `$0`)
4. Update `README.md` snippets list

## Adding a New Skill

1. Create a directory `.cursor/skills/<name>/`
2. Add a `SKILL.md` file with YAML frontmatter (`name`, `description`) and detailed instructions
3. Add supporting files (checklists, templates, guides) in the same directory
4. Update the MCP server if the skill should be discoverable via `list_skills()`
5. Update `README.md` skills table

## Adding a New Slash Command

1. Create `.cursor/commands/<name>.md`
2. Write the command prompt that invokes the corresponding agent or skill
3. Keep it concise — the command is an entry point, not the full workflow
4. Update `README.md` if the command represents a new capability

## Adding or Modifying Hooks

1. Edit `.cursor/hooks.json` to configure lifecycle event handlers
2. Create handler files in `.cursor/hooks/handlers/<event>/`
3. Create or update the dispatcher in `.cursor/hooks/dispatchers/`
4. TypeScript hooks require Bun runtime — test with `bun run <dispatcher>`
5. Update `docs/hooks-reference.md` and `docs/hook-coverage-matrix.md`

## Building the MCP Server

```bash
cd mcp-server
npm install
npm run build
```

To add a new tool to the MCP server, edit `mcp-server/src/index.ts` and rebuild.

## Versioning

- Tag releases with semver (e.g., `v1.0.0`)
- Update `CHANGELOG.md` with rule changes
- Team members can check their version by looking at the git tag

## Testing Changes

After making changes:
1. Run `./setup.sh` to re-symlink (or verify symlinks are current)
2. Open the monorepo in Cursor
3. Edit a file matching the rule's glob pattern — verify the rule activates
4. Test agents by invoking them in Cursor chat
5. Test snippets by typing the `sgg-` prefix
6. Rebuild MCP server if modified: `cd mcp-server && npm run build`
