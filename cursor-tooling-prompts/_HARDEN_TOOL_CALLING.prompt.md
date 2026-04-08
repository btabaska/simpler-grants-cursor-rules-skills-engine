# Claude Code Prompt: Audit and Harden Tool-Calling Enforcement Across the Toolkit

## Context
You are operating inside `simpler-grants-documentation-automation`. The toolkit now ships for both Cursor and Claude Code via `setup.sh --target=cursor|claude|both`, and it regenerates `.claude/` from `.cursor/` through `scripts/build-claude-target.py`. The toolkit's effectiveness depends almost entirely on **two brittle surfaces** that have drifted out of sync with the current state of the repo:

1. **The `tooling-health-check` slash command** (lives in `.cursor/commands/tooling-health-check.md` and its Claude Code mirror). It was written against an earlier version of the toolkit and no longer verifies the full current artifact inventory. It silently passes even when critical pieces are missing or misconfigured.
2. **The system prompts / project-memory entrypoints** — specifically `.cursorrules` and `.cursor/rules/*.mdc` on the Cursor side, and `.claude/CLAUDE.md` plus the `description` fields on every `.claude/agents/*.md`, `.claude/skills/*/SKILL.md`, and `.claude/commands/*.md` on the Claude Code side. These prompts do not explicitly direct the model to **call the right tool at the right moment**. They describe what each tool does but do not enforce invocation. The result is that Claude and Cursor often answer from context instead of calling the specialist subagent, skill, hook, or MCP tool that is supposed to own the decision. That is the single biggest source of brittleness in the current system.

Your job is to audit both surfaces and harden them so that the toolkit fails loudly when it is broken, and the models are unambiguously instructed to **delegate to tools rather than guess**.

## Objective
After your pass:
- `/tooling-health-check` must verify every current artifact category, every integration point, every generated file, and every registration — and must fail non-zero with a clear remediation step for every gap. It must be the single command a developer runs to know whether the toolkit is healthy on their machine and in their monorepo clone.
- Every system-prompt entrypoint (`.cursorrules`, `.cursor/rules/index.mdc` or equivalent, `.claude/CLAUDE.md`, and the descriptions on every agent/skill/command) must contain an **explicit, non-negotiable tool-calling contract** that tells the model: *"when the user asks for X, you MUST invoke tool Y before responding; do not answer from memory; do not summarize; call the tool, then report the tool's output."*
- The contract must be mechanically testable. A developer should be able to run a small eval harness that gives Claude or Cursor a representative prompt, inspects whether the expected tool call happened, and fails if it did not.

## Authoritative References (read before touching code)
1. Cursor:
   - Rules and project rules: https://docs.cursor.com/en/context/rules
   - Agents overview (tool invocation semantics): https://docs.cursor.com/en/agents/overview
   - Slash commands: https://docs.cursor.com/en/agents/slash-commands
   - Hooks: https://docs.cursor.com/en/agents/hooks
2. Claude Code:
   - Project memory / `CLAUDE.md`: https://docs.claude.com/en/docs/claude-code/memory
   - Subagent invocation (`description`-driven delegation semantics — the most important page for this task): https://docs.claude.com/en/docs/claude-code/sub-agents
   - Skills: https://docs.claude.com/en/docs/claude-code/skills
   - Settings / tool allowlists: https://docs.claude.com/en/docs/claude-code/settings
   - MCP configuration: https://docs.claude.com/en/docs/claude-code/mcp
3. Anthropic tool-use guidance (the canonical source on how to write descriptions that make the model actually call a tool): https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview and https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/tool-use-examples
4. Repo inventory — read all of:
   - `.cursor/commands/tooling-health-check.md` (current implementation)
   - `.claude/commands/tooling-health-check.md` (generated mirror, if present)
   - `.cursorrules`
   - `.cursor/rules/*.mdc` (every file — count them)
   - `.claude/CLAUDE.md`
   - `.claude/agents/*.md` (every file — count them)
   - `.claude/skills/*/SKILL.md` (every file — count them)
   - `.claude/commands/*.md` (every file — count them)
   - `.cursor/hooks.json` and `.claude/settings.json` (hook registrations)
   - `.cursor/mcp.json` and `.mcp.json`
   - `scripts/build-claude-target.py`
   - `setup.sh` (current state, including the target-selection refactor that already landed)
   - `cursor-tooling-prompts/_META_PROMPT.md` for tone and governance posture

## Part 1 — Audit and Rewrite `tooling-health-check`

### Current state (what to verify before rewriting)
Open both the Cursor and Claude Code copies of the command. List every check the current implementation performs. Compare that list to the current toolkit inventory (run `find .cursor .claude -type f` and group by directory). Produce a gap report: which checks exist, which checks are missing, which checks are stale (e.g., hardcoded file counts that no longer match reality), which checks always pass silently because of a bug.

Save the gap report to `cursor-tooling-prompts/_HEALTH_CHECK_GAPS.md` before you rewrite anything, so the diff is reviewable.

### Required checks in the new version
Group the rewritten health check into the following sections. Each check must have a clear pass/fail signal, a human-readable label, and a remediation hint on failure. Use exit code 0 on full pass, non-zero on any failure, and a summary line at the end showing `<passes>/<total>` plus a list of failures.

**A. Install integrity**
- `.cursor/` symlink present in the monorepo (if target includes cursor)
- `.claude/` symlink present in the monorepo (if target includes claude)
- `.mcp.json` present at monorepo root (claude target)
- `.cursorrules` symlink present (cursor target)
- `documentation/` symlink present
- `setup.sh` has been run since the last generator change (compare mtimes)
- The committed `.claude/` tree matches what `scripts/build-claude-target.py` would produce right now (run the generator with `--check` / dry-run mode; if that mode does not exist, add it as part of this task)

**B. Artifact inventory (dynamic, not hardcoded)**
For each category, count the files on disk and confirm the count is non-zero. Do not hardcode expected counts — compute them from the source tree and report them. The check fails only if a category is empty or if Cursor and Claude trees disagree on file count after generation.
- `.cursor/rules/*.mdc` count
- `.cursor/agents/*.md` count
- `.cursor/skills/*/SKILL.md` count
- `.cursor/commands/*.md` count
- `.cursor/hooks.json` entries vs `.cursor/hooks/*` script count
- `.claude/agents/*.md` count
- `.claude/skills/*/SKILL.md` count
- `.claude/commands/*.md` count
- `.claude/settings.json` `hooks` block entry count vs `.claude/hooks/*` script count
- `CLAUDE.md` exists and references the expected rule index

**C. Frontmatter and schema validity**
- Every `.cursor/rules/*.mdc` has valid frontmatter (`description`, `globs`, `alwaysApply`). Parse with a YAML parser; fail on invalid or missing fields.
- Every `.claude/agents/*.md` has valid frontmatter (`name`, `description`, `tools`, `model`). Validate `model` is one of the allowed strings and `tools` are on the Claude Code allowlist.
- Every `.claude/skills/*/SKILL.md` has valid frontmatter per the Claude Code skills spec.
- Every `.claude/commands/*.md` has a valid command body.

**D. Tool-calling contract enforcement**
- `.claude/CLAUDE.md` contains the verbatim tool-calling contract (see Part 2 below). Grep for a sentinel string like `<!-- tool-calling-contract v1 -->` and fail if missing or the version sentinel is stale.
- Every `.claude/agents/*.md` description contains the required triggering phrase pattern (e.g., starts with `MUST BE USED when…` or `Use PROACTIVELY to…` per Claude Code sub-agent conventions).
- Every `.claude/skills/*/SKILL.md` description contains a `MANDATORY TRIGGERS:` line with at least three trigger phrases.
- `.cursorrules` contains the verbatim Cursor tool-calling contract (see Part 2).

**E. MCP health**
- `mcp-server/dist/index.js` exists (custom server built)
- `.mcp.json` parses as valid JSON
- Every configured MCP server has a reachable command on `$PATH` (use `command -v`)
- `$GITHUB_PAT` is set if the GitHub MCP server is configured

**F. Hook wiring**
- Every hook script in `.cursor/hooks/` is executable (`-x`)
- Every hook script in `.claude/hooks/` is executable
- Every script referenced by `.claude/settings.json` exists on disk
- Every script referenced by `.cursor/hooks.json` exists on disk
- Run a dry-run invocation of one hook per event type with a synthetic payload and confirm it returns cleanly

**G. Generator parity**
- Run `scripts/build-claude-target.py --check` (add this mode if it doesn't exist). Fail on any drift between source and generated tree.

**H. Documentation freshness**
- `docs/hooks-reference.md`, `docs/04-auto-activating-rules.md`, `docs/05-agents-reference.md`, and `cursor-tooling-prompts/README.md` all contain row counts matching the live inventory from section B. Use the same dynamic counting logic from B and fail on mismatch.
- `CHANGELOG.md` has been updated since the last git tag (advisory warning only, not a hard failure)

### Implementation requirements for the new check
- Implement the check as a portable bash script under `scripts/tooling-health-check.sh`, invoked by the slash command for both targets. The slash command body should be a thin wrapper that runs the script and formats the output.
- Use color output (green check, red cross, yellow warning) gated on `isatty`.
- Support `--json` flag for machine-readable output so CI can parse it.
- Support `--fix` flag that runs the obvious fixes (regenerate `.claude/`, chmod +x on hook scripts, rebuild MCP server) and re-runs the check.
- Support `--target=cursor|claude|both` to scope the check.
- Exit code: 0 on full pass; 1 on any failure; 2 on configuration error (wrong args, missing monorepo).
- Every failure message must include a one-line remediation. Example:
  ```
  ✗ .claude/agents/accessibility-auditor.md missing `description` frontmatter
    fix: add `description: "MUST BE USED proactively after frontend edits..."` to the YAML block
  ```

### Tests for the check itself
Add `tests/test_tooling_health_check.sh` (or the equivalent in whichever test runner the repo uses). Seed fixtures that deliberately break each category one at a time, run the health check, and assert that exactly the expected failure appears. This prevents the health check from rotting again.

## Part 2 — Harden the tool-calling contract

This is the load-bearing section. The model does not reliably invoke specialist subagents, skills, or MCP tools unless it is **told to, in imperative language, at the top of the system prompt, with explicit triggers and an explicit prohibition on answering without the tool.** Fix that on both targets.

### 2a. Write the canonical tool-calling contract
Create `documentation/tool-calling-contract.md` as the single source of truth. It must contain:

1. A short preamble stating that the contract is non-negotiable and applies to every session opened inside the monorepo.
2. A **delegation table** listing, for every user-intent category, the tool that owns it and the phrase pattern the model should recognize. Example rows:
   | User intent pattern | Required tool | Prohibition |
   |---|---|---|
   | "add / create / scaffold an API endpoint" | the `new-endpoint` slash command (Cursor) or the matching Claude Code agent | do NOT write route code inline without invoking the agent |
   | "review this PR" / "check this diff" | `pr-review` skill + `agent-regression-detector` + `agent-pr-preparation` | do NOT produce a review from memory |
   | "run the tests affected by my changes" | `skill-run-relevant-tests` | do NOT answer "which tests should run" without running the skill |
   | file edit on `api/src/**/*.py` | relevant `.cursor/rules/api-*.mdc` auto-attaches (Cursor) or matching skill triggers (Claude Code) | do NOT write API code without the rule active |
   | any PR diff mentioning PII | `pii-leak-detector` subagent | do NOT assert safety without running the scanner |
   | any Terraform change | `fedramp-compliance-checker` | do NOT claim FedRAMP compliance from context |
   | any new user-facing string | `i18n-completeness-checker` | do NOT suggest hardcoded strings |
   | any SQLAlchemy query | `performance-oracle` pre-check for N+1 | do NOT ship unchecked query code |
   | any accessibility-relevant frontend change | `accessibility-auditor` | do NOT claim WCAG conformance from context |
   Fill in the full table by reading every subagent, skill, and command in the toolkit. Aim for 30+ rows.
3. A **general enforcement clause** in imperative second person, telling the model:
   - Always call the tool instead of paraphrasing what the tool would do.
   - If the required tool is missing or unavailable, stop and tell the user which tool is missing and how to install it; do not proceed with a degraded answer.
   - Cite the tool's output verbatim in responses, not a summary of what the model thinks the tool would say.
   - If the user's request matches multiple rows in the table, invoke all of them in parallel where independent.
   - Never silently fall back to general knowledge on a topic the toolkit owns (compliance, accessibility, PII, forms schema, performance).
4. A **sentinel comment** on the first line (`<!-- tool-calling-contract v1 -->`) so the health check can verify presence and version.

### 2b. Propagate the contract to both targets
- **Cursor:** prepend the contract to `.cursorrules` and create a new rule `.cursor/rules/000-tool-calling-contract.mdc` with `alwaysApply: true` and `globs: ["**/*"]` so it is always active. Reference `documentation/tool-calling-contract.md` for the full table.
- **Claude Code:** prepend the contract to `.claude/CLAUDE.md` under a top-level heading `## Tool-Calling Contract (non-negotiable)`. Import the full table via `@documentation/tool-calling-contract.md` so the table is loaded automatically.
- **Generator:** update `scripts/build-claude-target.py` to propagate the contract from the source into the generated `.claude/CLAUDE.md` so it can never drift.

### 2c. Harden every agent, skill, and command description
Walk every file in `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `.cursor/agents/`, `.cursor/skills/`, and `.cursor/commands/`. For each file:
- Rewrite the `description` field so that it begins with one of the Claude Code-recognized trigger phrases: `MUST BE USED when …`, `Use PROACTIVELY to …`, `ALWAYS invoke when …`, or `Use IMMEDIATELY on …`. This is the single most important lever for making the parent model actually delegate to the subagent.
- Include at least three concrete trigger phrases the parent model should match on (e.g., "PII", "personal information", "email in logs").
- Include the prohibition clause: "Do not answer questions in this domain without invoking this tool."
- Preserve the rest of the file body unchanged. This is a frontmatter rewrite only.

Do this mechanically with a script (`scripts/harden-descriptions.py`) that reads each file, updates the frontmatter, and writes it back. Review a random sample of 10 files by hand after running the script.

### 2d. Add a tool-calling eval harness
Create `scripts/eval-tool-calling.py` (or `.sh`). The harness:
1. Loads a YAML fixture `tests/fixtures/tool-calling-evals.yaml` containing 20+ rows of `{prompt, expected_tool_calls}`.
2. Invokes Claude Code (or Cursor, via its CLI if available) headlessly with each prompt.
3. Parses the session transcript to check whether the expected tool call happened.
4. Reports pass/fail per row and a summary.
5. Exits non-zero if any row fails.

Seed the fixture with at least these rows (add more by scanning the backlog):
- "Add a new API endpoint for listing user notifications" → expects `new-endpoint` agent or equivalent.
- "Is this PR safe to merge?" → expects `agent-pr-preparation` + specialist subagents.
- "Did I accidentally log any PII in this diff?" → expects `pii-leak-detector`.
- "Is this Terraform change FedRAMP compliant?" → expects `fedramp-compliance-checker`.
- "Does this component meet WCAG 2.1 AA?" → expects `accessibility-auditor`.
- "Are there any N+1 queries in this service?" → expects `performance-oracle`.
- "Draft the VPAT for our current accessibility state" → expects `section-508-report-generator`.
- "Summarize the last sprint" → expects `agent-sprint-summary-generator`.
- "Run the tests affected by my changes" → expects `skill-run-relevant-tests`.
- "Is this SQLAlchemy query safe from injection?" → expects `sql-injection-scanner`.

Wire the harness into CI so the contract is regression-tested.

## Implementation Steps (deterministic)
1. Pre-flight: read every file listed under Authoritative References → Repo inventory. Produce the gap report at `cursor-tooling-prompts/_HEALTH_CHECK_GAPS.md`.
2. WebFetch the authoritative docs listed above. Record verbatim the trigger-phrase patterns Claude Code recognizes for subagent delegation. Treat the live docs as authoritative over this prompt if they conflict.
3. Write `documentation/tool-calling-contract.md` with the full delegation table (30+ rows, derived from the actual toolkit inventory).
4. Prepend the contract to `.cursorrules` and create `.cursor/rules/000-tool-calling-contract.mdc`.
5. Prepend the contract to `.claude/CLAUDE.md`. Update `scripts/build-claude-target.py` so the contract is always regenerated into `.claude/CLAUDE.md` from the source.
6. Write `scripts/harden-descriptions.py`. Run it. Hand-review 10 sampled files.
7. Write `scripts/tooling-health-check.sh` with all checks from Part 1 sections A–H. Add `--json`, `--fix`, and `--target` flags.
8. Rewrite `.cursor/commands/tooling-health-check.md` and `.claude/commands/tooling-health-check.md` as thin wrappers around the script.
9. Add `scripts/build-claude-target.py --check` mode.
10. Write `tests/test_tooling_health_check.sh` fixtures covering every failure mode.
11. Write `scripts/eval-tool-calling.py` and `tests/fixtures/tool-calling-evals.yaml` with 20+ rows.
12. Run the health check end-to-end. Fix every failure. Re-run until clean.
13. Run the eval harness. Iterate on the descriptions until every row passes.
14. Update `docs/13-troubleshooting.md` with a new section "Tool calling not triggering" that points at the contract, the eval harness, and the health check `--fix` flag.
15. Update `CHANGELOG.md` under Unreleased with: the tool-calling contract, hardened descriptions, rewritten health check, and eval harness.
16. Run `shellcheck` on every shell script touched and `python3 -m py_compile` on every Python script touched.

## Acceptance Criteria
- [ ] `cursor-tooling-prompts/_HEALTH_CHECK_GAPS.md` exists and documents the gaps found in the old implementation.
- [ ] `documentation/tool-calling-contract.md` exists, has the sentinel comment, and contains a delegation table with at least 30 rows covering every agent/skill/hook/command in the toolkit.
- [ ] `.cursorrules`, `.cursor/rules/000-tool-calling-contract.mdc`, and `.claude/CLAUDE.md` all contain the contract and pass a grep for the sentinel string.
- [ ] Every file in `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, and their Cursor counterparts has a hardened description beginning with a recognized trigger phrase and containing at least three trigger keywords plus a prohibition clause.
- [ ] `scripts/tooling-health-check.sh` exists, covers every check in Part 1 sections A–H, supports `--json`, `--fix`, `--target`, exits non-zero on any failure, and prints a clear remediation on every failure.
- [ ] `.cursor/commands/tooling-health-check.md` and `.claude/commands/tooling-health-check.md` are thin wrappers around the script.
- [ ] `scripts/build-claude-target.py --check` mode exists and is invoked by the health check.
- [ ] `tests/test_tooling_health_check.sh` exists and every deliberate-breakage fixture produces the expected failure.
- [ ] `scripts/eval-tool-calling.py` and `tests/fixtures/tool-calling-evals.yaml` exist with at least 20 rows; the harness runs end-to-end and every row passes.
- [ ] `docs/13-troubleshooting.md` has the new troubleshooting section.
- [ ] `CHANGELOG.md` has an Unreleased entry covering all of the above.
- [ ] `shellcheck` clean, `py_compile` clean.
- [ ] Running `./scripts/tooling-health-check.sh --target=both` on a fresh install exits 0.
- [ ] Running `./scripts/eval-tool-calling.py` against the current toolkit exits 0.

## Out of Scope
- Implementing any of the 88 cursor-tooling-prompts inside HHS/simpler-grants-gov. This task hardens the **meta-layer** — the health check and the system prompts — not the downstream artifacts.
- Changing the behavior of any agent, skill, or hook beyond its `description` frontmatter. This is a prompt-engineering and verification pass, not a behavior change.
- Removing or consolidating any existing artifact. The toolkit inventory stays as-is.
- Introducing any new third-party dependency unless it is required by the eval harness (and if so, justify it in the CHANGELOG).
