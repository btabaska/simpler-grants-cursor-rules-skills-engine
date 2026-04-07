# Authority to Operate Checklist

Generate a FedRAMP Moderate ATO artifact bundle (NIST 800-53 Rev 5 control matrix, PII data-flow diagram, RBAC inventory, SSP excerpt) from a simpler-grants-gov PR diff.

## What I Need From You

Provide one of:

1. **`gh pr view` JSON + `gh pr diff`** — preferred
2. **A unified diff plus PR description**
3. **A list of changed files with rationale**

If the PR rationale is missing for a security-relevant change, the agent will ask before mapping rather than guess.

## What Happens Next

The Authority to Operate Checklist Agent will:
1. Load FedRAMP, auth, audit, and encryption conventions plus relevant ADRs
2. Classify each modified file by layer and map to NIST 800-53 Rev 5 controls (AC, AU, CM, CP, IA, SC, SI)
3. Render PII data flows as Mermaid with control IDs annotated
4. Catalog every RBAC role, permission, and enforcement point touched
5. Draft an SSP excerpt with file:line evidence for every claim
6. Write the bundle to `documentation/compliance/ato-bundles/PR-<num>-<slug>.md`

## Tips for Better Results

- Use `gh pr diff` rather than copy-paste — line numbers stay accurate
- Name the field if PII is touched; the agent will surface it in the data-flow diagram
- The agent will not invent a control mapping; if a change has no clear control, supply rationale
