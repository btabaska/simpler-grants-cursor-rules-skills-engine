# Claude Code Prompt: Final QA/QC Audit Before Team-Wide Release

## Context
You are operating inside `simpler-grants-documentation-automation`, the context engineering toolkit for the HHS/simpler-grants-gov project. This toolkit ships for both Cursor and Claude Code. It contains: 39 auto-activating rules, 52 agents, 65 slash commands, 25 Cursor skills (70 Claude Code skills including rule translations), 6 notepads, 2 snippet files, 6 hook scripts per target, 3 MCP server configurations, a custom MCP server (`mcp-server/`), generator scripts, setup infrastructure, and a 20+ file documentation library. The toolkit is about to be shared with the wider Simpler Grants engineering team for the first time. This audit is the final quality gate before that happens.

## Objective
Perform a comprehensive, no-stone-unturned QA/QC sweep of the entire repository. Find and fix every broken link, every stale count, every invalid reference, every parse error, every missing file, every inconsistency between the Cursor and Claude Code trees, every hook that references a nonexistent script, every MCP config that won't resolve, every documentation claim that contradicts the repo's actual state, and every dead-on-arrival artifact that would embarrass the team on day one. **Do not introduce new features. Do not restructure anything. Do not change how anything works.** Fix only what is broken, stale, or incorrect. This is a pure correctness pass.

## Criticality
This audit directly affects whether the team's first experience with the toolkit is "this is impressively polished" or "half of this is broken." Treat every finding as something that will be discovered live in a demo. Be thorough enough that a hostile reviewer running `find`, `grep`, `jq`, `shellcheck`, and manual spot-checks on every file would not find anything you missed.

## Files You Must Read Before Starting
Read each of these in full. Do not skip any. Build an internal model of the repo's intended structure before you start flagging issues.

1. `.claude/CLAUDE.md` — the Claude Code project memory and tool-calling contract
2. `.cursorrules` — the Cursor project rules entrypoint
3. `.claude/settings.json` — hook registrations for Claude Code
4. `.cursor/hooks.json` — hook registrations for Cursor
5. `.mcp.json` — MCP server config for Claude Code
6. `.cursor/mcp.json` — MCP server config for Cursor (may be the same file or different)
7. `setup.sh` — installer script
8. `scripts/build-claude-target.py` — generator that produces `.claude/` from `.cursor/`
9. `scripts/check-tooling-inventory.py` — existing inventory checker
10. `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
11. Every file under `docs/` (22 files including subdirectories)
12. Every file under `documentation/` (architecture guide + rules mirror)

## Audit Scope — Seven Passes

You must execute all seven passes in order. For each pass, produce findings inline and fix them immediately. At the end, produce a consolidated report.

---

### Pass 1: File Existence and Cross-Reference Integrity

**Goal:** Every file referenced by any other file actually exists on disk. Every internal link resolves.

**Procedure:**

1. Parse `.claude/settings.json`. For every `command` value in the `hooks` block, verify the script path exists on disk and is executable. The current registrations are:
   - `bun run .claude/hooks/dispatchers/before-shell.ts`
   - `bash .claude/hooks/scripts/pre-commit-pii-scanner.sh`
   - `bash .claude/hooks/scripts/pre-commit-convention-checker.sh`
   - `bun run .claude/hooks/dispatchers/after-file-edit.ts`
   - `bash .claude/hooks/scripts/background-accessibility-monitor.sh`
   - `bash .claude/hooks/scripts/stale-documentation-detector.sh`
   - `bun run .claude/hooks/dispatchers/on-stop.ts`
   - `bash .claude/hooks/scripts/background-test-runner.sh`
   - `bash .claude/hooks/scripts/pr-auto-labeler.sh`
   For each: does the file exist? Is it executable (`-x`)? Does it parse cleanly (`bash -n` for .sh, `bun check` or `tsc --noEmit` for .ts)?

2. Parse `.cursor/hooks.json`. For every handler entry, verify the script path exists and is executable.

3. Parse `.mcp.json`. For each server:
   - `github`: verify `npx` is describable (it will be, but confirm the args are valid JSON).
   - `filesystem`: verify the `./documentation` path exists.
   - `simpler-grants-context`: verify `./mcp-server/dist/index.js` exists. If not, note that `npm run build` in `mcp-server/` is required and check if `mcp-server/src/` compiles cleanly.

4. For every `.cursor/agents/*.md` file (52 files): grep for references to other agents, skills, rules, or commands. Verify each reference resolves to a real file on disk. Flag any reference to a nonexistent artifact.

5. For every `.claude/agents/*.md` file (52 files): same check.

6. For every `.cursor/commands/*.md` file (65 files): if the command body references an agent by name (e.g., "invoke the `debugging` agent"), verify that agent exists in `.cursor/agents/`.

7. For every `.claude/commands/*.md` file (65 files): same check against `.claude/agents/`.

8. For every SKILL.md (25 Cursor, 70 Claude Code): if it references helper scripts, other skills, or external files, verify they exist.

9. For every `.cursor/rules/*.mdc` file (39 files): verify the `globs` field contains syntactically valid glob patterns and doesn't reference impossible paths.

10. Scan all `docs/*.md` and `documentation/*.md` files for markdown links (`[text](path)` and `[text]: path`). Verify every relative link resolves. Flag every 404.

11. Scan `README.md` and `CONTRIBUTING.md` for all links. Verify each one.

**Fix strategy:** For broken internal links, fix them. For references to nonexistent files, either create a stub or remove the reference — do not leave dead references. For scripts that aren't executable, `chmod +x` them.

---

### Pass 2: Cursor ↔ Claude Code Parity

**Goal:** Every artifact in `.cursor/` has a correctly translated counterpart in `.claude/`, and vice versa. No orphans in either direction.

**Procedure:**

1. List all `.cursor/agents/*.md` (52 files). List all `.claude/agents/*.md` (52 files). Diff the two filename lists. Flag any file that exists in one tree but not the other.

2. List all `.cursor/commands/*.md` (65 files). List all `.claude/commands/*.md` (65 files). Diff. Flag orphans.

3. For skills: `.cursor/skills/` has 25 SKILL.md directories. `.claude/skills/` has 70 (includes rule translations and notepad translations). Verify:
   - Every Cursor skill dir has a matching Claude Code skill dir.
   - Every `rule-*` skill in `.claude/skills/` corresponds to a `.cursor/rules/*.mdc` file.
   - Every `notepad-*` skill in `.claude/skills/` corresponds to a `.cursor/notepads/*.md` file.
   - No orphaned skill directories with missing SKILL.md files inside them.

4. For hooks: verify that every event/script pair in `.cursor/hooks.json` has a corresponding entry in `.claude/settings.json` with the correct event name mapping:
   - Cursor `beforeShellExecution` → Claude Code `PreToolUse` matcher `Bash`
   - Cursor `afterFileEdit` → Claude Code `PostToolUse` matcher `Edit|Write|MultiEdit`
   - Cursor `stop` → Claude Code `Stop`
   Flag any hook registered on one side but not the other.

5. Verify `.cursorrules` and `.claude/CLAUDE.md` contain equivalent content (not identical — translated, but semantically equivalent). Flag major omissions where one has a section the other lacks entirely.

6. Verify `.cursor/mcp.json` and `.mcp.json` configure the same MCP servers with the same args.

**Fix strategy:** For missing counterparts, run `scripts/build-claude-target.py` and verify it produces the missing file. If the generator doesn't handle the case, add the file manually (as a one-off fix, not a generator change — that would be a feature).

---

### Pass 3: Frontmatter and Schema Validation

**Goal:** Every artifact's frontmatter/metadata parses correctly and contains all required fields per its spec.

**Procedure:**

1. For every `.cursor/rules/*.mdc` (39 files): parse the YAML frontmatter between `---` delimiters. Required fields: `description` (non-empty string), `globs` (string or array of strings), `alwaysApply` (boolean). Flag missing or malformed fields. Flag `globs` patterns that would never match anything in the HHS/simpler-grants-gov repo structure (e.g., referencing paths that don't exist like `app/src/` instead of `api/src/`).

2. For every `.claude/agents/*.md` (52 files): check whether the file has YAML frontmatter. If Claude Code agents use frontmatter (check the current spec at https://docs.claude.com/en/docs/claude-code/sub-agents), validate it. If they don't use frontmatter (just a markdown body), verify the body is non-empty and starts with a role/purpose statement.

3. For every SKILL.md (all 70 in `.claude/skills/`): verify the file is non-empty. If the Claude Code skill spec requires frontmatter, validate it. If it uses only a markdown body, verify the body contains at minimum a description and a procedure section.

4. For every `.cursor/commands/*.md` and `.claude/commands/*.md` (65 each): verify the body is non-empty. If the command spec requires a specific structure (e.g., a `$ARGUMENTS` placeholder or a description header), verify it's present.

5. For `.claude/settings.json`: validate it parses as valid JSON. Validate the `hooks` block structure matches the Claude Code settings schema: `{ hooks: { EventName: [ { matcher?: string, hooks: [ { type: "command", command: string } ] } ] } }`.

6. For `.cursor/hooks.json`: validate it parses as valid JSON. Validate its structure matches the Cursor hooks schema.

**Fix strategy:** Add missing required fields with sensible defaults. Fix malformed YAML/JSON. Do not change the semantic content of any artifact.

---

### Pass 4: Documentation Accuracy

**Goal:** Every claim in every documentation file matches the repo's actual state as of right now.

**Procedure:**

1. `README.md`:
   - Every file count mentioned (rules, agents, commands, skills, etc.) must match the actual count on disk. The current actual counts are: 39 rules, 52 agents, 65 commands, 25 Cursor skills (70 Claude Code skills), 6 notepads, 2 snippet files.
   - Every feature bullet must correspond to a real artifact.
   - Every link must resolve.
   - The install instructions must match what `setup.sh` actually does (including the Cursor vs Claude Code target selection if that has been added).

2. `docs/01-what-is-this-toolkit.md` through `docs/15-glossary.md` plus `docs/16-claude-code-vs-cursor.md`, `docs/17-slash-commands-reference.md`, `docs/hooks-reference.md`, `docs/hook-coverage-matrix.md`, `docs/skills-reference.md`:
   - Every reference table (rules table in `04`, agents table in `05`, etc.) must have a row for every actual file on disk. Flag missing rows and extra rows.
   - Every hook event mapping must match `.claude/settings.json` and `.cursor/hooks.json`.
   - Every cross-reference between docs must resolve.
   - Any "coming soon" or "TODO" placeholder that references something that now exists should be updated.

3. `documentation/architecture-guide.md`:
   - Verify the architecture description matches the current repo structure.
   - Verify MCP server descriptions match `.mcp.json`.
   - Verify any file counts or category lists are current.

4. `documentation/rules/*.md`:
   - Verify there is a mirror doc for every `.cursor/rules/*.mdc` rule (or document which ones are intentionally missing).

5. `CHANGELOG.md`:
   - Verify the most recent entry accurately describes the state of the repo. If there are uncommitted changes, note them.
   - Verify the entry format is consistent with prior entries.

6. `CONTRIBUTING.md`:
   - Verify setup instructions work and reference correct paths.
   - Verify any "prerequisites" list is current.

7. `docs/README.md` (the docs index):
   - Every file in `docs/` should have a row in this index.
   - Every row should link to a real file.

**Fix strategy:** Update stale counts, fix broken links, add missing table rows, remove references to nonexistent files. Preserve the existing voice and style of each doc. Make minimal, surgical edits.

---

### Pass 5: Script and Infrastructure Health

**Goal:** Every script, config, and build artifact works end-to-end.

**Procedure:**

1. `setup.sh`:
   - Run `bash -n setup.sh` to verify it parses.
   - Run `shellcheck setup.sh` (install shellcheck first if needed: `apt-get install -y shellcheck`). Fix any errors. Warnings are acceptable if they are false positives; add `# shellcheck disable=SCXXXX` with a comment explaining why.
   - Read the script line by line. Verify every path it references (`$TOOLKIT_DIR/.cursor`, `$TOOLKIT_DIR/.cursorrules`, `$TOOLKIT_DIR/documentation`, `$TOOLKIT_DIR/mcp-server/package.json`, `$TOOLKIT_DIR/.githooks`, `.cursor/rules/*.mdc`, `.cursor/agents/*.md`, `.cursor/skills/`, `.cursor/commands/*.md`, `.cursor/hooks.json`, `.cursor/notepads/*.md`, `.cursor/snippets/*.code-snippets`) exists in the repo.
   - If the script has a Claude Code install path (checking for `.claude/`, `.mcp.json`), verify those paths exist.
   - Verify the rule count check on line ~209 matches the actual count. If it says `RULE_COUNT -eq 24` but there are 39 rules, fix the count.
   - Verify the verification section reports the correct artifact categories and counts.
   - Verify the final "What's now available" summary matches reality.

2. `scripts/build-claude-target.py`:
   - Run `python3 -c "import ast; ast.parse(open('scripts/build-claude-target.py').read())"` to verify it parses.
   - Read it and verify it handles all current artifact types: rules → skills, agents → agents, commands → commands, skills → skills, hooks → settings.json + hook scripts, notepads → notepad skills, .cursorrules → CLAUDE.md.
   - If it has a `--check` mode, run it and verify it exits 0 against the current repo state. If it doesn't exit 0, the generated tree has drifted and you should regenerate.

3. `scripts/check-tooling-inventory.py`:
   - Run `python3 -c "import ast; ast.parse(open('scripts/check-tooling-inventory.py').read())"`.
   - Read it and verify its checks are current (not checking for stale file counts, not referencing removed files).

4. `mcp-server/`:
   - Verify `mcp-server/package.json` exists and has a `build` script.
   - If `mcp-server/dist/index.js` exists, check that `mcp-server/src/` has not been modified more recently (which would mean the dist is stale).
   - If `mcp-server/dist/index.js` does not exist, run `cd mcp-server && npm install && npm run build` and verify it succeeds.
   - Read `mcp-server/src/index.ts` (or `.js`) briefly and verify the MCP tools it exposes (`get_architecture_section`, `get_rules_for_file`, `get_rule_detail`, `get_conventions_summary`, `list_rules`, `list_agents`, `list_commands`, `list_skills`) actually work against the current file tree. If any tool references hardcoded paths, verify those paths exist.

5. Hook scripts:
   - For every `.sh` script under `.claude/hooks/scripts/`: run `bash -n <file>` to verify it parses. Run `shellcheck <file>` and fix errors.
   - For every `.ts` script under `.claude/hooks/dispatchers/`: verify the TypeScript is syntactically valid.
   - For every hook script under `.cursor/hooks/`: same checks.

6. `.githooks/` (if present):
   - List contents. Verify each hook script parses and is executable.

**Fix strategy:** Fix parse errors, update hardcoded counts, `chmod +x` scripts, rebuild stale dist. Do not refactor scripts.

---

### Pass 6: Content Quality Spot-Check

**Goal:** A random sample of artifacts is actually useful, well-written, and non-empty.

**Procedure:**

Randomly select and read in full (do not skim):
- 5 rules from `.cursor/rules/` — verify each has a meaningful body (not just frontmatter), includes conventions, anti-patterns, and examples.
- 5 agents from `.cursor/agents/` — verify each has a clear role, procedure, tools section, and is not a copy-paste of another agent.
- 5 commands from `.cursor/commands/` — verify each has a clear description and invocation body.
- 5 skills from `.cursor/skills/` — verify each SKILL.md has a procedure section and is not a stub.
- 3 Claude Code rule-translation skills from `.claude/skills/rule-*/` — verify the SKILL.md contains the translated rule content, not just a pointer.
- 3 Claude Code notepad-translation skills from `.claude/skills/notepad-*/` — verify content is present.
- All 6 notepads from `.cursor/notepads/` — verify non-empty with useful reference content.
- Both snippet files from `.cursor/snippets/` — verify they parse as valid JSON and contain real snippets.

For each sampled file, check:
- Is it non-empty (more than 10 lines of real content)?
- Does it reference real file paths from HHS/simpler-grants-gov (not invented paths)?
- Is it free of placeholder text like `TODO`, `FIXME`, `placeholder`, `lorem ipsum`?
- Is it free of duplicate agent names (e.g., two agents with identical bodies but different filenames)?

**Fix strategy:** Replace stubs with minimal but real content. Remove placeholder text. Flag duplicates in the report but do not merge them (that would be a structural change). For empty or near-empty files, add a `<!-- STUB: needs real content -->` comment and flag in the report.

---

### Pass 7: End-to-End Smoke Test

**Goal:** A developer installing the toolkit for the first time would have a working setup.

**Procedure:**

1. Simulate a fresh install. Create a temporary directory, initialize a git repo, and run `setup.sh` against it with `TOOLKIT_TARGET=cursor` (or simulate the interactive choice). Verify:
   - The symlinks are created correctly.
   - The MCP server builds (or is already built).
   - The verification block reports correct counts.
   - The final summary prints without errors.

2. Repeat with `TOOLKIT_TARGET=claude` (if the target-selection refactor has landed). Verify:
   - `.claude/` is linked.
   - `.mcp.json` is linked.
   - `CLAUDE.md` is accessible.
   - The verification block reports correct counts.

3. If the setup script does not yet support target selection, document this as a finding and verify the Cursor-only path works end-to-end.

4. After install, verify the MCP server responds. Run:
   ```
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node ./mcp-server/dist/index.js
   ```
   Confirm the response includes the expected tool names.

5. Verify at least one slash command is well-formed enough that Claude Code would accept it. Read `.claude/commands/debug.md` and confirm it is valid markdown with a clear invocation body.

**Fix strategy:** Fix any issue that would cause a first-time user to see an error. Do not change the install flow.

---

## Output: Consolidated Audit Report

After all seven passes, produce a file `_FINAL_QC_REPORT.md` in the repo root with the following structure:

```markdown
# Final QC Audit Report — [date]

## Executive Summary
- Total findings: N
- Critical (blocks release): N
- Major (embarrassing but not blocking): N
- Minor (cosmetic): N
- Fixed in this pass: N
- Deferred (documented but not fixed): N

## Pass 1: File Existence and Cross-Reference Integrity
### Findings
[numbered list of every finding with severity, file path, and fix applied or reason deferred]

## Pass 2: Cursor ↔ Claude Code Parity
### Findings
[same format]

## Pass 3: Frontmatter and Schema Validation
### Findings

## Pass 4: Documentation Accuracy
### Findings

## Pass 5: Script and Infrastructure Health
### Findings

## Pass 6: Content Quality Spot-Check
### Findings

## Pass 7: End-to-End Smoke Test
### Findings

## Deferred Items
[Any finding that was not fixed, with justification and recommended follow-up]

## Artifact Inventory (verified)
| Category | Cursor count | Claude Code count | Parity |
|---|---|---|---|
| Rules (.mdc) | N | N/A (translated to skills) | — |
| Rule-translation skills | N/A | N | matches rule count: yes/no |
| Agents | N | N | match: yes/no |
| Commands | N | N | match: yes/no |
| Skills | N | N | — |
| Notepads | N | N/A (translated to skills) | — |
| Notepad-translation skills | N/A | N | matches notepad count: yes/no |
| Snippets | N | N/A | — |
| Hook scripts | N | N | match: yes/no |
| Hook registrations | N events | N events | match: yes/no |
| MCP servers | N | N | match: yes/no |
```

Place the report at the repo root so it is the first thing a reviewer sees.

## Rules of Engagement
- **Zero new features.** Do not add agents, skills, rules, commands, hooks, or docs that don't already exist.
- **Zero structural changes.** Do not rename directories, reorganize file trees, or merge artifacts.
- **Zero behavior changes.** Do not rewrite agent logic, hook scripts, or command templates. If an agent's body is wrong, flag it in the report; do not rewrite it.
- **Fix only what is objectively broken:** missing files, broken links, stale counts, parse errors, permission bits, invalid JSON/YAML, dead references, factually incorrect documentation.
- **When in doubt, flag and defer.** Add it to the Deferred Items section rather than making a judgment call.
- **Leave changes unstaged.** Do not commit. The human will review the diff and commit.

## Acceptance Criteria
- [ ] `_FINAL_QC_REPORT.md` exists at the repo root with all seven pass sections populated.
- [ ] Every Critical finding is either fixed or explicitly deferred with justification.
- [ ] `bash -n setup.sh` exits 0.
- [ ] `shellcheck setup.sh` has no errors (warnings acceptable with inline disables).
- [ ] `python3 -c "import ast; ast.parse(open('scripts/build-claude-target.py').read())"` exits 0.
- [ ] `python3 -c "import ast; ast.parse(open('scripts/check-tooling-inventory.py').read())"` exits 0.
- [ ] `.claude/settings.json` parses as valid JSON.
- [ ] `.cursor/hooks.json` parses as valid JSON.
- [ ] `.mcp.json` parses as valid JSON.
- [ ] Every hook script referenced by settings.json and hooks.json exists on disk and is executable.
- [ ] `mcp-server/dist/index.js` exists and was built from the current source.
- [ ] The artifact inventory table in the report matches reality (verify with `find` and `wc -l`).
- [ ] No file in the repo contains the literal strings `TODO`, `FIXME`, or `placeholder` unless it is inside a code example demonstrating those patterns.
- [ ] No documentation file references a file count that disagrees with the actual count on disk.
- [ ] The changes are unstaged and uncommitted, ready for human review.
