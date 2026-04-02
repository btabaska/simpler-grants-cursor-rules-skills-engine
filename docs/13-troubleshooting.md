<!--
  title: Troubleshooting
  description: Symptom-based troubleshooting guide for the Simpler.Grants.gov AI Coding Toolkit
  category: reference
  audience: all toolkit users
  last_updated: 2026-04-02
-->

# Troubleshooting

Symptom-based guide organized by category. Each entry: **Symptom** then **Likely
Cause** then **Fix** then **Prevention**. For setup help see
[Getting Started](03-getting-started.md). For rule details see
[Auto-Activating Rules](04-auto-activating-rules.md).

---

## 1. Setup Issues

### setup.sh fails / symlinks broken

**Symptom:** `setup.sh` exits with "does not appear to be a git repository" or
symlinks in the monorepo point to non-existent paths.

**Likely Cause:** The monorepo is not a sibling directory, or you moved
directories after running setup.

**Fix:**
1. Verify the monorepo: `ls -la ~/GitHub/simpler-grants-gov/.git`
2. Check symlinks: `ls -la ~/GitHub/simpler-grants-gov/.cursor`
3. Re-run setup from the toolkit directory: `./setup.sh`
4. Enter the absolute path if prompted (no `~`, use `/Users/yourname/...`).

**Prevention:** Keep toolkit and monorepo as siblings. Re-run `setup.sh` after
moving either directory.

### MCP servers not connecting

**Symptom:** MCP tools unavailable in Cursor chat after setup completes.

**Likely Cause:** MCP server not built, or Cursor not restarted.

**Fix:**
1. Check for build output: `ls ~/GitHub/simpler-grants-documentation-automation/mcp-server/dist/`
2. If missing: `cd ~/GitHub/simpler-grants-documentation-automation/mcp-server && npm install && npm run build`
3. Quit Cursor completely (Cmd+Q) and reopen.

**Prevention:** Always restart Cursor after `setup.sh`.

### GITHUB_PAT not recognized

**Symptom:** Yellow warning during setup or auth errors from MCP.

**Likely Cause:** Variable not exported in shell profile.

**Fix:**
1. Check: `echo $GITHUB_PAT`
2. If empty: `echo 'export GITHUB_PAT=ghp_your_token_here' >> ~/.zshrc && source ~/.zshrc`
3. Restart Cursor to pick up the new variable.

**Prevention:** Set `GITHUB_PAT` in your profile immediately after creating the
token ([Getting Started](03-getting-started.md)).

### Node.js version too old

**Symptom:** MCP build fails with syntax errors. `setup.sh` warns about Node.

**Likely Cause:** Node.js missing or below v18.

**Fix:**
1. Check: `node --version`
2. Upgrade: `nvm install 18 && nvm use 18`
3. Clean rebuild: `cd ~/GitHub/simpler-grants-documentation-automation/mcp-server && rm -rf node_modules && npm install && npm run build`

**Prevention:** Use `nvm` to manage Node versions.

### Cursor not detecting rules

**Symptom:** AI gives generic advice instead of project conventions.

**Likely Cause:** Cursor opened before symlinks created, or `.cursor/` symlink broken.

**Fix:**
1. Verify: `ls ~/GitHub/simpler-grants-gov/.cursor/rules/*.mdc | wc -l` (expect 18)
2. If missing, re-run `setup.sh`.
3. Quit and reopen Cursor, then test with
   [Exercise 1](03-getting-started.md).

**Prevention:** Quit and reopen Cursor after every `setup.sh` run.

---

## 2. Rule Issues

### Rules not auto-activating (wrong glob, file not matching)

**Symptom:** File is open but AI gives generic responses without conventions.

**Likely Cause:** File path does not match the rule's glob pattern.

**Fix:**
1. Check the dispatch table in [Auto-Activating Rules](04-auto-activating-rules.md) to find which rule should match.
2. Verify your file's path against the glob. Example: `api-routes.mdc` matches `api/src/api/**/*.py` but not `api/src/utils/helper.py`.
3. Inspect the rule header: `head -5 ~/GitHub/simpler-grants-gov/.cursor/rules/api-routes.mdc`
4. Restart Cursor if the glob is correct but rules still do not fire.

**Prevention:** Consult the dispatch table before expecting a rule to activate.

### Wrong rule activating for a file

**Symptom:** AI applies conventions from an unrelated domain.

**Likely Cause:** Overlapping glob patterns. Rules stack by design.

**Fix:**
1. Check all matching rules in the dispatch table. Multiple rules activating simultaneously is expected (e.g., `cross-domain.mdc` matches `**/*`).
2. If directives conflict, state the specific convention you want in your prompt.

**Prevention:** This is inherent to rule stacking. Be explicit in prompts when working in cross-cutting areas.

### Agent rules not appearing in chat

**Symptom:** Typing `@agent-code-generation` shows no suggestions.

**Likely Cause:** `.cursor/agents/` directory missing or symlink broken.

**Fix:**
1. Verify: `ls ~/GitHub/simpler-grants-gov/.cursor/agents/`
2. If missing, re-run `setup.sh`.
3. Restart Cursor. Type `@agent` and wait for autocomplete.

**Prevention:** Restart Cursor after any setup changes.

### Rules showing stale/outdated content after update

**Symptom:** You edited a rule in the toolkit repo but Cursor uses the old version.

**Likely Cause:** Cursor caches rule content and does not detect symlinked file changes.

**Fix:**
1. Confirm source has your changes: `head -20 ~/GitHub/simpler-grants-documentation-automation/.cursor/rules/api-routes.mdc`
2. Fully quit Cursor (Cmd+Q, not reload window) and reopen.

**Prevention:** Always full-restart Cursor after modifying rules.

---

## 3. MCP Server Issues

### Custom MCP server won't start

**Symptom:** MCP tools never appear. Server process exits immediately.

**Likely Cause:** Server not built, dependencies missing, or missing env vars.

**Fix:**
1. Run manually to see errors: `cd ~/GitHub/simpler-grants-documentation-automation/mcp-server && node dist/index.js`
2. If "Cannot find module": `rm -rf node_modules dist && npm install && npm run build`
3. Verify `GITHUB_PAT` is set.

**Prevention:** Clean rebuild after any Node.js upgrade or `npm update`.

### "Tool not found" errors

**Symptom:** AI invokes an MCP tool but Cursor says it does not exist.

**Likely Cause:** MCP config references a tool name the server does not expose, or the server is not running.

**Fix:**
1. Check config: `cat ~/GitHub/simpler-grants-gov/.cursor/mcp.json`
2. Verify tool names match what the server registers.
3. Restart Cursor to force reconnection.

**Prevention:** After renaming tools in server code, rebuild and restart.

### MCP server returning empty results

**Symptom:** Tools execute but return no data.

**Likely Cause:** PAT lacks required permissions or query targets wrong paths.

**Fix:**
1. Test PAT directly: `curl -H "Authorization: Bearer $GITHUB_PAT" https://api.github.com/repos/HHS/simpler-grants-gov/contents/api`
2. If 403/404, recreate the token with Contents, Pull Requests, and Issues read permissions ([Getting Started](03-getting-started.md)).

**Prevention:** Test your PAT with `curl` before relying on it in Cursor.

### GitHub MCP rate limiting

**Symptom:** 403 errors mentioning rate limits. Intermittent empty responses.

**Likely Cause:** Exceeded 5,000 requests/hour.

**Fix:**
1. Check limits: `curl -H "Authorization: Bearer $GITHUB_PAT" https://api.github.com/rate_limit`
2. If `rate.remaining` is 0, wait until `rate.reset` time.
3. Batch your questions to reduce MCP calls.

**Prevention:** Avoid rapid successive MCP tool invocations. Frame prompts for comprehensive answers.

---

## 4. AI Quality Issues

### AI ignoring rule directives

**Symptom:** Generated code contradicts active rules (e.g., `abort()` instead of `raise_flask_error()`).

**Likely Cause:** Prompt too vague, context window saturated, or rule not actually active.

**Fix:**
1. Verify the rule is loading: ask "What conventions should I follow for this file?"
2. If generic answer, the rule is not active -- see Rule Issues above.
3. If active, be explicit: "Use raise_flask_error() for errors. Follow the decorator stack order from project conventions."

**Prevention:** Start prompts with "Following project conventions, ..." to prime the AI.

### AI generating code that doesn't match conventions

**Symptom:** Code is valid but wrong style (imports, structure, patterns).

**Likely Cause:** Wrong rule activated, or no example provided.

**Fix:**
1. Check dispatch table in [Auto-Activating Rules](04-auto-activating-rules.md).
2. Reference an example: "Follow the same pattern as `api/src/services/users/get_user.py`"
3. Use agents (`@agent-code-generation`) for extra convention context.

**Prevention:** Reference existing files as examples when generating new code.

### AI hallucinating APIs or patterns

**Symptom:** AI references functions or modules that don't exist in the project.

**Likely Cause:** AI relying on training data instead of project context.

**Fix:**
1. Use `@file` or `@folder` in chat to ground the AI in real code.
2. Ask: "Does this function actually exist in the codebase? Verify before using it."
3. Use MCP tools to pull real repository data into context.

**Prevention:** Always provide file references for generation tasks. Never rely on the AI to guess project structure.

### Responses too generic (not using project context)

**Symptom:** Textbook Python/React answers instead of project-specific guidance.

**Likely Cause:** No file open in editor, so no rules activated.

**Fix:**
1. Open a relevant file before chatting.
2. Verify rules load (see Rule Issues).
3. Explicitly reference the project: "In the simpler-grants-gov project, how should I..."
4. Use `@file` references for concrete context.

**Prevention:** Always have a relevant file open when chatting.

---

## 5. Performance Issues

### Slow responses when many rules active

**Symptom:** Noticeably longer response times for files matching many rules.

**Likely Cause:** Rule stacking adds context overhead (e.g., `api/src/api/forms/` may match 4+ rules).

**Fix:**
1. Check rule count for your path in the dispatch table ([Auto-Activating Rules](04-auto-activating-rules.md)).
2. Keep prompts concise to leave room for rule context.
3. Close unrelated editor tabs.

**Prevention:** This is a trade-off of comprehensive rules. Narrow glob patterns on broad rules if a workflow is consistently slow.

### Large file context overwhelming the AI

**Symptom:** Truncated or confused responses for files over 1000 lines.

**Likely Cause:** File exceeds context window alongside rules and history.

**Fix:**
1. Select only the relevant section, then Cmd+L to chat about that selection.
2. Reference by function name: "Look at `process_application` in `forms.py`."

**Prevention:** Work with focused selections, not entire large files.

### MCP server timeout

**Symptom:** MCP calls hang then fail with timeout errors.

**Likely Cause:** Slow GitHub API, network issues, or crashed server process.

**Fix:**
1. Test server: `cd ~/GitHub/simpler-grants-documentation-automation/mcp-server && node dist/index.js`
2. Test API speed: `time curl -H "Authorization: Bearer $GITHUB_PAT" https://api.github.com/repos/HHS/simpler-grants-gov`
3. Restart Cursor. Check for VPN/proxy throttling.

**Prevention:** On slow networks, prefer `@file` references over MCP tools.

---

## Quick Diagnosis Checklist

```bash
# Symlinks intact?
ls -la ~/GitHub/simpler-grants-gov/.cursor
ls -la ~/GitHub/simpler-grants-gov/.cursorrules
# Rule files present?
ls ~/GitHub/simpler-grants-gov/.cursor/rules/*.mdc | wc -l
# Node.js version?
node --version
# GITHUB_PAT set?
echo $GITHUB_PAT | head -c 10
# MCP server built?
ls ~/GitHub/simpler-grants-documentation-automation/mcp-server/dist/
# GitHub API accessible?
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $GITHUB_PAT" https://api.github.com/repos/HHS/simpler-grants-gov
```

Expected: symlinks to toolkit, 18 `.mdc` files, Node v18+, PAT starts with `ghp_`, `dist/` exists, HTTP 200.

---

## Plugin Issues

### Specialists aren't running during agent quality gates
**Symptom:** Agent output doesn't mention specialist validation; no quality gate messages appear.
**Likely Cause:** Compound Engineering plugin is not installed.
**Fix:**
1. Open Cursor Settings → Extensions / Plugins
2. Search for "compound-engineering" and install it
3. Restart Cursor
4. Verify: type `@compound` in chat — specialists should appear
**Prevention:** Run the setup script, which reminds you to install required plugins.

### Compound Knowledge lookups return nothing
**Symptom:** AI doesn't reference architectural context or ADR decisions when generating code.
**Likely Cause:** Compound Knowledge plugin is not installed, or project documentation hasn't been indexed.
**Fix:**
1. Install the compound-knowledge plugin from Cursor Extensions
2. Open the Compound Knowledge panel
3. Add `documentation/` and `.cursor/rules/` directories to the index
4. Wait for indexing to complete
**Prevention:** Index documentation immediately after setup.

### MCP server tools return errors
**Symptom:** "Tool not found" or empty results when agents try to load context.
**Likely Cause:** The custom MCP server hasn't been built, or `.cursor/mcp.json` is misconfigured.
**Fix:**
1. Build the MCP server: `cd mcp-server && npm install && npm run build`
2. Verify `.cursor/mcp.json` contains the `simpler-grants-context` server entry
3. Restart Cursor to reload MCP configurations
4. Verify: the MCP server panel in Cursor should show three servers (github, filesystem, simpler-grants-context)
**Prevention:** The setup script builds the MCP server automatically. If it failed, check for Node.js 18+ and npm availability.

### Specialists give irrelevant feedback
**Symptom:** Specialist validation comments don't match the project's conventions.
**Likely Cause:** Compound Knowledge hasn't indexed the project-specific documentation.
**Fix:**
1. Re-index the documentation/ directory in Compound Knowledge
2. Ensure .cursor/rules/ is also indexed
3. Verify the architecture guide exists at documentation/architecture-guide.md
**Prevention:** Keep the knowledge index up to date when rules or docs change.

---

## See Also

- [Getting Started](03-getting-started.md) -- initial setup and verification
- [Auto-Activating Rules](04-auto-activating-rules.md) -- rule glob patterns and dispatch table
- [Agents Reference](05-agents-reference.md) -- agent definitions and usage
- [Back to documentation index](README.md)
