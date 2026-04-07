# Architecture Decision Navigator

Look up the "why" behind a simpler-grants-gov technology or architectural choice. The Architecture Decision Navigator agent reads the relevant ADR(s) and surfaces context, decision, alternatives, consequences, and related decisions.

## What I Need From You

One of:

1. **A direct question** — "why Flask instead of FastAPI?", "why PostgreSQL?"
2. **A technology or library** — "Marshmallow", "OpenSearch", "Login.gov"
3. **An architectural concern** — "how do we handle background jobs?"

## What Happens Next

The agent will:
1. Search the ADR index in `documentation/decisions/adr/`
2. Read the matching ADR(s) in full
3. Return Context, Decision, Rationale, Alternatives Considered, Consequences, Status
4. Cite the governing `.cursor/rules/*.mdc` file
5. Suggest related and superseding ADRs

This agent is READ-ONLY. It will not propose new ADRs or supersede existing ones.

## Tips for Better Results
- Ask one decision at a time
- If no ADR exists, the agent will say so rather than guessing
- Pair with `/convention-quick-lookup` for the rule that operationalizes the decision
