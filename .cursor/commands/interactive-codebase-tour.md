# Interactive Codebase Tour

Trace one canonical request flow through simpler-grants-gov from frontend submission to database and back. Complements `/onboarding`, which tours a feature area.

## What I Need From You

One of:

1. **A built-in flow** — `login-and-fetch-opportunities`, `submit-grant-application`, `search-for-grants`
2. **A custom flow** described in plain English
3. **"default"** — runs `login-and-fetch-opportunities`

## What Happens Next

The Interactive Codebase Tour agent will:
1. Read the entry-point component, the fetch hook, the HTTP transport, the route, the service, the adapter, and the model — in that order
2. Cite exact file paths, line ranges, and the governing `.cursor/rules/*.mdc` per layer
3. Name the architectural constraint (FedRAMP, USWDS, accessibility, Grants.gov coexistence) at each layer
4. Trace an example payload back up the stack
5. Suggest the next tour or rule file to explore

This agent is READ-ONLY.

## Tips for Better Results
- Pick one flow per invocation
- After the tour, drill into the layer that was least clear
- Pair with `/architecture-decision-navigator` to read the ADRs behind each layer
