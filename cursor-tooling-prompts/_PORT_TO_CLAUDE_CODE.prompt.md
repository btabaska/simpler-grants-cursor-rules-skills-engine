# Claude Code Prompt: Port the Simpler Grants Toolkit to Run on Either Cursor or Claude Code

## Context
You are operating inside `simpler-grants-documentation-automation`. Today the toolkit ships only as a Cursor configuration: rules, agents, skills, slash commands, hooks, notepads, snippets, and MCP servers all live under `.cursor/` and are symlinked into a clone of `HHS/simpler-grants-gov` by `setup.sh`. The 88 implementation prompts under `cursor-tooling-prompts/` were authored against the Cursor spec, but every artifact they describe has a direct analog in Claude Code (`.claude/`). Your job is to make the entire toolkit installable and fully functional under **either** Cursor **or** Claude Code, with the user choosing at install time. Behavior must be preserved end-to-end — no feature regressions, no semantic changes — only mechanical translation of file locations, frontmatter keys, and event names where the two specs differ.

## Objective
After your work, a developer should be able to clone the repo, run `./setup.sh`, answer one prompt ("Cursor or Claude Code?"), and end up with a fully working toolkit wired into their `simpler-grants-gov` clone using whichever assistant they prefer. Both targets must reach feature parity. The 88 prompt files under `cursor-tooling-prompts/` should describe both targets so that future implementation work in HHS/simpler-grants-gov can land artifacts in either tree.

## Authoritative References (read these before writing code)
1. Cursor docs:
   - Rules: https://docs.cursor.com/en/context/rules
   - Agents: https://docs.cursor.com/en/agents/overview
   - Hooks: https://docs.cursor.com/en/agents/hooks (and any successor URL)
   - Slash commands: https://docs.cursor.com/en/agents/slash-commands
2. Claude Code docs:
   - Subagents (Task tool / `.claude/agents/`): https://docs.claude.com/en/docs/claude-code/sub-agents
   - Skills (`.claude/skills/<name>/SKILL.md`): https://docs.claude.com/en/docs/claude-code/skills and https://docs.claude.com/en/docs/agents-and-tools/agent-skills
   - Slash commands (`.claude/commands/*.md`): https://docs.claude.com/en/docs/claude-code/slash-commands
   - Hooks (`.claude/settings.json` `hooks` block + `.claude/hooks/`): https://docs.claude.com/en/docs/claude-code/hooks
   - Settings (`.claude/settings.json`, `.claude/settings.local.json`): https://docs.claude.com/en/docs/claude-code/settings
   - MCP configuration (`.mcp.json` or `~/.claude.json` `mcpServers` block): https://docs.claude.com/en/docs/claude-code/mcp
3. Repo state:
   - Read every file under `.cursor/` in this repo to inventory what must be ported.
   - Read `setup.sh` end to end before touching it.
   - Read `cursor-tooling-prompts/_META_PROMPT.md` to understand the prompt-authoring contract.
   - Read `documentation/architecture-guide.md` for the toolkit's design intent.

## Translation Matrix (Cursor → Claude Code)
You must implement and document this mapping. Verify each row against the live docs before relying on it; if any spec has changed, follow the docs and update this table.

| Concept | Cursor location | Claude Code location | Notes |
|---|---|---|---|
| Auto-activating rules | `.cursor/rules/*.mdc` (frontmatter: `description`, `globs`, `alwaysApply`) | `.claude/CLAUDE.md` (project memory) and/or per-file imports via `@path` references; rules with strict glob targeting can be expressed as conditional CLAUDE.md sections or as skills with MANDATORY TRIGGERS | Claude Code has no exact `.mdc` analog. Decide per rule whether it lives in `CLAUDE.md`, in a skill description with strong trigger phrases, or in both. Document the chosen pattern in the architecture guide. |
| Multi-step workflow agents | `.cursor/agents/*.md` | `.claude/agents/<name>.md` with YAML frontmatter `name`, `description`, `tools`, `model` | Model strings: `opus`, `sonnet`, `haiku`. Tool names follow Claude Code's allowlist. |
| Specialist subagents | `.cursor/agents/<specialist>.md` | `.claude/agents/<specialist>.md` | Same target dir as workflow agents in Claude Code; differentiate via description/role. |
| Skills | `.cursor/skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` | Same SKILL.md format. Verify frontmatter keys match. |
| Slash commands | `.cursor/commands/*.md` | `.claude/commands/*.md` | Body templating syntax differs slightly — verify `$ARGUMENTS` vs Cursor's variable syntax. |
| Hooks | `.cursor/hooks.json` + `.cursor/hooks/*` | `.claude/settings.json` `hooks` block + `.claude/hooks/*` | Event name mapping (verify against current docs): `afterFileEdit` → `PostToolUse` matcher `Edit\|Write`; `beforeShellExecution` → `PreToolUse` matcher `Bash`; `stop` → `Stop`; background/file-watcher hooks have no first-class Claude Code analog and must be implemented as a wrapper script registered via `PostToolUse` or as a separate daemon (document the limitation). |
| Notepads | `.cursor/notepads/*.md` | `.claude/skills/notepads/<name>/SKILL.md` or referenced via `@docs/...` imports in CLAUDE.md | Pick one canonical pattern. |
| Snippets | `.cursor/snippets/*.code-snippets` | No native Claude Code analog | Leave snippets as VS Code snippets (they work in any VS Code-based editor regardless of assistant); document this. |
| MCP servers | `.cursor/mcp.json` | `.mcp.json` at repo root or `~/.claude.json` user-scope | Same JSON shape (`mcpServers` key). One file can be symlinked to both locations. |
| Project rules entrypoint | `.cursorrules` (legacy) | `.claude/CLAUDE.md` | Translate `.cursorrules` content into `CLAUDE.md`. |

## Scope of Work

### 1. Build a parallel `.claude/` tree under the toolkit root
Create `/.claude/` mirroring `.cursor/` with the directory layout:
```
.claude/
  CLAUDE.md                  # translated from .cursorrules + key always-on rules
  agents/                    # all workflow agents + specialist subagents (flat dir)
  skills/<name>/SKILL.md     # all skills
  commands/                  # all slash commands
  hooks/                     # hook scripts
  settings.json              # hook event registration + tool allowlist
```
Plus a top-level `.mcp.json` (or symlink) carrying the same MCP server config as `.cursor/mcp.json`.

For every existing artifact under `.cursor/`, generate the Claude Code equivalent by mechanical translation:
- Rules: read each `.mdc`, decide whether it becomes a section in `CLAUDE.md` (cross-cutting/always-on) or a skill in `.claude/skills/rule-<name>/SKILL.md` (file-glob-targeted, with MANDATORY TRIGGERS describing the file types). Default to `CLAUDE.md` for rules with `alwaysApply: true` and to a skill for rules with narrow `globs`. Preserve all rule content verbatim except for the frontmatter shape.
- Agents and subagents: copy each `.md`, replace the frontmatter with Claude Code's YAML schema (`name`, `description`, `tools`, `model`). Map model strings sensibly (opus for orchestrators, sonnet for general agents, haiku for fast scanners). Preserve the system-prompt body unchanged.
- Skills: copy each `SKILL.md` and any helper files. Verify frontmatter keys match Claude Code's spec; adjust if needed.
- Slash commands: copy each `.md`, translate any Cursor-specific argument placeholders to Claude Code's `$ARGUMENTS` convention. Preserve body.
- Hooks: read `.cursor/hooks.json`. For each registered hook, generate (a) the script under `.claude/hooks/` and (b) a `hooks` entry in `.claude/settings.json` with the correct event name and matcher. Where the Cursor event has no clean Claude Code analog (background watchers), document the gap in `.claude/hooks/README.md` and provide the closest equivalent.
- MCP: create `.mcp.json` at the repo root copied from `.cursor/mcp.json`. Verify the schema matches Claude Code's expectation.

Do **not** delete or modify the existing `.cursor/` tree. Both must coexist as siblings of the same source content.

### 2. Refactor source-of-truth so the two trees do not drift
The two trees must stay in sync forever. Pick one of these patterns and implement it (recommend option A):

- **Option A — Single source + generator (recommended).** Move the canonical artifacts into a new top-level directory `toolkit-source/` (or keep them in `.cursor/` as the master) and add a script `scripts/build-targets.sh` (or `.py`) that generates both `.cursor/` and `.claude/` trees from the master. `setup.sh` calls the generator before symlinking. Add a CI check that fails if either generated tree is out of sync with the master.
- **Option B — Symlink the shared content.** For artifacts whose body is identical (skills, commands, hook scripts), symlink `.claude/skills/<name>` → `.cursor/skills/<name>` etc. Only frontmatter shims live separately. This avoids a generator but couples the trees and may confuse Claude Code's spec validation.

Document the chosen pattern in `documentation/architecture-guide.md` under a new "Multi-target Layout" section.

### 3. Rewrite `setup.sh` to support both targets
Edit `setup.sh` so the very first interactive step (after the banner, before locating the monorepo) asks:

```
Which assistant are you installing the toolkit for?
  1) Cursor
  2) Claude Code
  3) Both
Choice [1/2/3]:
```

Accept a non-interactive override via env var `TOOLKIT_TARGET=cursor|claude|both` and a CLI flag `--target=cursor|claude|both` so CI can run unattended. Then:

- If `cursor` (or `both`): run the existing symlink flow for `.cursor/`, `.cursorrules`, MCP config to `.cursor/mcp.json`, Cursor plugins reminder, Cursor verification block.
- If `claude` (or `both`): symlink (or copy) `.claude/` from this repo into `$MONOREPO_DIR/.claude/`, place `.mcp.json` at `$MONOREPO_DIR/.mcp.json`, write/merge `$MONOREPO_DIR/.claude/settings.json` from the toolkit version (be careful not to clobber a user's existing settings — back up first, same pattern as `.cursor` backup), and skip the Cursor-plugin reminder.
- If `both`: run both flows. Symlinks must not collide.

Update the verification block at the end of `setup.sh` to count and report the right artifacts for the chosen target:
- Cursor target: existing `.cursor/rules/*.mdc`, `.cursor/agents/*.md`, etc. counts.
- Claude Code target: `.claude/agents/*.md` count, `.claude/skills/*/SKILL.md` count, `.claude/commands/*.md` count, `.claude/hooks/*` count, `.claude/settings.json` exists, `.mcp.json` exists, `CLAUDE.md` exists.

Update the final "What's now available" summary block to reflect the chosen target. Use a function so the two summaries are not duplicated inline.

Preserve all existing functionality: monorepo auto-detect, prerequisite checks, MCP server build step, optional git hooks, GITHUB_PAT warning. Do not break any existing flag or behavior for users who pick Cursor.

### 4. Update the 88 prompts under `cursor-tooling-prompts/`
Do **not** rewrite the bodies. Instead, update **section 5 ("File(s) to Create or Modify")** of every prompt to list **both** target paths:
- Cursor path (existing): e.g. `.cursor/rules/<name>.mdc`
- Claude Code path (new): e.g. `.claude/skills/rule-<name>/SKILL.md` or `.claude/CLAUDE.md` insertion, per the translation matrix.

Add a new short subsection at the end of section 6 ("Exact Specification") titled "Claude Code variant" that gives the equivalent frontmatter and any spec divergences. Keep the change minimal and mechanical — do this with a script that walks every file, parses the section headers, and inserts the new content idempotently. Run the script once and verify a sample of files by hand.

Also update `cursor-tooling-prompts/_META_PROMPT.md` to require future prompts to specify both target paths from the start.

### 5. Update documentation
- `README.md` (root): add a "Choosing your assistant" section explaining the two targets and pointing at `setup.sh`. Update install instructions.
- `CHANGELOG.md`: add an Unreleased entry under `### Added` for "Claude Code target support" and `### Changed` for "setup.sh target selection".
- `docs/01-what-is-this-toolkit.md`, `docs/02-how-it-works.md`, `docs/03-getting-started.md`: explain that the toolkit now ships for either assistant.
- `docs/04-auto-activating-rules.md`: add a column noting how each rule is realized in Claude Code (CLAUDE.md section vs skill).
- `docs/05-agents-reference.md`: add a column for Claude Code path.
- `docs/13-troubleshooting.md`: add a "Claude Code: agent not loading" section, "settings.json hooks not firing" section, "MCP server not appearing" section.
- `documentation/architecture-guide.md`: add the "Multi-target Layout" section described in step 2.
- Create `docs/16-claude-code-vs-cursor.md` as a new doc explaining the parity matrix, gaps, and chosen patterns. Cite the Cursor and Claude Code doc URLs from the Authoritative References section above.

### 6. CI / lint
If a `pre-commit` config or GH workflow exists, add a job that runs the sync generator (option A) in `--check` mode, plus a `find` assertion that every file in `.cursor/agents/` has a counterpart in `.claude/agents/` (and same for skills, commands, hooks). Fail the build on drift.

## Implementation Steps (deterministic)
1. Pre-flight: list `.cursor/`, `.claude/` (if any), `cursor-tooling-prompts/`, `setup.sh`, `documentation/`, `docs/`, `README.md`, `CHANGELOG.md`. Inventory every artifact you must port.
2. WebFetch the Claude Code doc URLs above; record exact frontmatter keys, event names, matcher syntax, and file paths. Treat the live docs as authoritative over this prompt if they conflict.
3. Decide on the source-of-truth pattern (option A recommended). Implement the generator under `scripts/`.
4. Generate the initial `.claude/` tree by running the generator once. Hand-inspect at least: one rule (CLAUDE.md insertion + skill variant), one agent, one skill, one command, one hook, one MCP entry, and the `.claude/settings.json` produced.
5. Edit `setup.sh` to add target selection, branching install logic, and per-target verification + summary blocks. Test interactively for each of the three choices.
6. Write the `cursor-tooling-prompts/` updater script. Run it. Verify a sample of files.
7. Update `_META_PROMPT.md`, `README.md`, `CHANGELOG.md`, and the `docs/`/`documentation/` files listed in step 5.
8. Add CI drift check.
9. Run any existing lints/tests. Run `bash -n setup.sh` and `shellcheck setup.sh` if available.
10. Manually walk through `./setup.sh` against a scratch clone of `simpler-grants-gov` for each of the three target choices to confirm the resulting tree works end-to-end. For Claude Code, open the scratch clone, launch `claude`, and verify at least one agent loads, one skill triggers, one slash command runs, one hook fires, and the MCP server is reachable.

## Acceptance Criteria
- [ ] `.claude/` tree exists with full parity to `.cursor/` per the translation matrix.
- [ ] Source-of-truth pattern implemented and documented; both trees regenerate cleanly from a single source.
- [ ] `setup.sh` first prompts for `cursor | claude | both`, supports `TOOLKIT_TARGET` env var and `--target=` flag, and installs only what the user chose.
- [ ] All existing Cursor functionality is preserved exactly when the user picks Cursor.
- [ ] A clean Claude Code install (target=claude) produces a working `.claude/` directory in the monorepo, a working `.mcp.json`, a working `CLAUDE.md`, and verification reports the correct counts.
- [ ] Every file in `cursor-tooling-prompts/` lists both target paths in section 5 and has a "Claude Code variant" subsection in section 6.
- [ ] `_META_PROMPT.md`, `README.md`, `CHANGELOG.md`, and the listed `docs/`/`documentation/` files are updated.
- [ ] `docs/16-claude-code-vs-cursor.md` exists and documents every gap (notably background hooks, snippets, alwaysApply rules).
- [ ] CI drift check passes; `shellcheck setup.sh` passes (or documented exceptions only).
- [ ] Manual end-to-end walkthrough succeeds for all three target choices.

## Out of Scope
- Implementing any of the 88 prompts inside `HHS/simpler-grants-gov`. This task only ports the toolkit's installer and authoring surface.
- Rewriting the bodies of agents, skills, commands, or hooks. Translation must be mechanical (frontmatter and file location only) so behavior is preserved exactly.
- Removing or deprecating the `.cursor/` tree. Cursor remains a first-class target.
- Building a unified UI or wrapper around both assistants. The toolkit just installs into whichever the user chose.
