> **Before reading this:** This guide assumes you've read [Agents Reference](05-agents-reference.md) and tried at least one agent workflow.

# Multi-File Workflows

## Chat vs. Composer: When to Use Which

Cursor has two modes for AI interaction. Understanding when to use each is key to effective multi-file work.

### Chat (Cmd+L / Ctrl+L)
- Single conversation thread
- Great for: questions, explanations, single-file generation, code review
- The AI suggests code; you copy-paste or apply
- Context: sees your open file + loaded rules

### Composer (Cmd+I / Ctrl+I)
- Multi-file editing mode
- Great for: creating multiple files, refactoring across files, applying changes everywhere
- The AI proposes diffs across multiple files; you review each one
- Context: sees specified files + loaded rules

### Decision Table

| Task | Mode | Why |
|------|------|-----|
| Ask a question about conventions | Chat | No files to change |
| Generate a single function | Chat | One file, one change |
| Create a full new endpoint (7 files) | Composer + `/new-endpoint` (or `@agent-new-endpoint`) | Multiple files need coordinated creation |
| Rename a field across API + frontend | Composer | Changes span many files |
| Review code against conventions | Chat + @pr-review | Review is read-only analysis |
| Add i18n strings + update component | Composer + `/i18n` (or `@agent-i18n`) | Translation file + component change |
| Debug a test failure | Chat | Investigation, not multi-file editing |
| Write tests for existing code | Chat or Composer | Chat for 1 test file, Composer if tests span multiple files |

## Working with Composer

### Starting a Composer Session

1. Press Cmd+I (Ctrl+I on Windows/Linux)
2. Reference an agent or notepad: use `/new-endpoint` (or `@agent-new-endpoint`)
3. Describe what you need
4. Composer shows proposed changes across files
5. Review each file's diff individually
6. Accept all, accept per-file, or reject

### Example: New Endpoint via Composer

```
/new-endpoint Create a GET /v1/organizations/<org_id>/members endpoint
that returns paginated organization members. JWT + API key auth.
The OrganizationMember model exists. Include tests.
```
(You can also type `@agent-new-endpoint` instead of `/new-endpoint`.)

Composer proposes changes to ~5 files:
- New route handler in api/src/api/organizations_v1/organization_routes.py
- New service function in api/src/services/organizations_v1/get_members.py
- New schemas in api/src/api/organizations_v1/organization_schemas.py
- New tests in api/tests/src/api/organizations/test_organization_members.py
- Blueprint registration update

Review each file. Accept the ones that look correct. Reject and re-prompt for any that need changes.

### Example: Cross-Stack Rename

```
Rename the "opportunity_status" field to "listing_status" across the entire codebase.
Update the model, migration, service functions, route schemas, frontend types,
and translations. Follow our naming conventions.
```

This is a case where Composer's multi-file editing is essential. It will propose changes to 10+ files. Review carefully — renames are where AI can miss edge cases.

### Example: Feature Flag Addition

```
Add a feature flag for the saved searches feature. Following our conventions:
1. Add FEATURE_SAVED_SEARCHES_OFF SSM parameter in infra/frontend/app-config/
2. Add the environment variable to the frontend service config
3. Add the flag check in the frontend component
4. Add the API-side ENABLE_SAVED_SEARCHES_ENDPOINTS flag in the route handlers
```

## Handling Changes That Span API + Frontend + Tests

Large features often require coordinated changes across the full stack. Here's the recommended approach:

### Strategy: Layer by Layer

Instead of asking the AI to do everything at once:

1. **API model + migration** (Composer)
   ```
   /migration Create the saved_search table and model
   ```
2. **API service + routes** (Composer)
   ```
   /new-endpoint Create the saved search endpoints using the model from step 1
   ```
3. **API tests** (Chat or Composer)
   ```
   /test Write tests for the saved search routes and services
   ```
4. **Frontend component** (Chat)
   ```
   /generate Create the SavedSearchList component
   ```
5. **Frontend tests** (Chat)
   ```
   /test Write tests for SavedSearchList
   ```
6. **i18n** (Chat)
   ```
   /i18n Add translations for the saved searches feature
   ```
7. **Self-review** (Chat)
   ```
   @pr-review Review all my changes across API and frontend
   ```

### Why Layer by Layer?

- Each step builds on the last — you can verify correctness before moving on
- The AI's context stays focused (one domain at a time)
- If something goes wrong, you know exactly which step caused it
- You can use different agents for different layers

## Handling Database Migrations with Code Changes

Migrations are special because they must be reversible and coordinated with model changes.

**Recommended order:**
1. Create/update the model first
2. Generate the migration based on the model
3. Update services and routes
4. Update tests

**Why this order?** The model defines the schema; the migration implements it. If you generate the migration first, you might discover the model needs adjustment, forcing you to regenerate.

```
Step 1: /generate Update the User model to add notification_preferences JSONB column
Step 2: /migration Generate migration for the notification_preferences column I just added
Step 3: Now create the service function for updating notification preferences
Step 4: /test Write tests for the notification preferences feature
```

## Large Refactors

For refactors touching 10+ files:

1. **Plan first.** Ask the AI to outline what needs to change before making changes:
   ```
   What files would I need to modify to rename ValidationErrorType.REQUIRED
   to ValidationErrorType.FIELD_REQUIRED across the codebase?
   ```

2. **Change in phases.** Don't try to do everything in one Composer session:
   - Phase 1: Rename in the source file + update imports
   - Phase 2: Update all usages in services
   - Phase 3: Update tests
   - Phase 4: Verify nothing is broken

3. **Use constraints.** Tell the AI exactly what to change and what to leave alone:
   ```
   Only rename the enum value. Don't change any logic, formatting, or comments.
   ```

4. **Review rigorously.** Large refactors are where the AI is most likely to make subtle errors (missed occurrences, broken imports, changed logic).

## Tips

- **Save frequently.** Accept Composer changes file by file, not all at once.
- **Start small.** Begin with 2-3 file changes before attempting 10+.
- **Use Chat for investigation.** If something looks wrong in Composer output, switch to Chat to ask "why did you generate it this way?"
- **Don't skip review.** Multi-file changes are where hidden bugs hide.

---

## Chaining Agents: `/codemod` → `/refactor` → `/pr-preparation` → `/changelog`

The agents in this toolkit are deliberately narrow so they can be chained. A common multi-day refactor looks like this:

1. **`/codemod`** does the mechanical part. Renames, import rewrites, decorator swaps. Produces fixup commits and stops at the first thing requiring judgment.
2. **`/refactor`** picks up the semantic part. It restructures the layers around the renamed symbols, moves logic between service and route layers, and updates tests to match the new shape.
3. **`/pr-preparation`** runs scoped tests, the convention checker, the PII sweep, drafts the PR title and description, and produces a self-review checklist with blocking and non-blocking findings.
4. **`/changelog`** (the `changelog-generator` agent) reads the staged commits and proposes a CHANGELOG Unreleased entry in the project's existing voice.

Each step's output is the next step's input. The clean working tree precondition that `/codemod` enforces is what makes this chain safe — every step can roll back to the last fixup commit. The chain mirrors the prompt-engineering principle from doc 08: small, bounded steps with explicit verification between them outperform one giant prompt.

A worked version of this chain (with the codemod refusal on a dirty tree) lives in [Workflow Examples Scenario 8](09-workflow-examples.md#scenario-8-codemod--rename-a-method-across-12-files).

## Subagent Fan-Out: How `api-docs-sync` Uses Quality-Gate Subagents

The `api-docs-sync` agent is a good example of fan-out — it does its main work in series and then fans out to several quality-gate subagents in parallel.

```
                +-----------------------+
                | api-docs-sync agent   |
                |                       |
                | 1. Pre-Flight context |
                | 2. Diff handlers vs.  |
                |    OpenAPI spec       |
                | 3. Patch spec +       |
                |    docstrings         |
                +-----------+-----------+
                            |
                            | (fan-out)
            +---------------+---------------+
            |               |               |
            v               v               v
   +----------------+ +-------------+ +------------------+
   | api-contract-  | | form-schema-| | documentation-   |
   | checker        | | validator   | | staleness-       |
   |                | |             | | detector         |
   | (path / param  | | (cross-     | | (README, ADRs,   |
   |  / response    | |  schema     | |  inline docs     |
   |  contract)     | |  consistency| |  agreement)      |
   +----------------+ +-------------+ +------------------+
            |               |               |
            +---------------+---------------+
                            |
                            v
                +-----------------------+
                | findings merged,      |
                | api-docs-sync fixes,  |
                | re-runs failing       |
                | gates, returns diff   |
                +-----------------------+
```

The three subagents are completely independent, so they run in parallel. Each one is a specialist that *only* invokes from another agent — none of them are usable on their own. This is the entire point of the quality-gate subagent category: extract a single sharp check, give it an explicit invocation contract, and let any workflow agent reuse it.

The same fan-out shape shows up in `pr-preparation` (which fans out to `pii-leak-detector`, `accessibility-auditor`, `dependency-health-reviewer`, and `test-quality-analyzer`) and in `dependency-update` (which fans out to `dependency-health-reviewer` and `pii-leak-detector`). The specialist map for the full set lives in `.cursor/skills/quality-gate/specialist-map.md`.

---
## See Also
- [Workflow Examples](09-workflow-examples.md) — end-to-end scenarios
- [Agents Reference](05-agents-reference.md) — agents used in multi-file workflows
- [PR Review Guide](11-pr-review-guide.md) — self-review after multi-file changes
- [Back to documentation index](README.md)
