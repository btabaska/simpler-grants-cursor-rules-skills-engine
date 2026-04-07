# Onboarding Tour

Get an interactive, code-reading tour of a simpler-grants-gov feature from the frontend page through the API service and database model and back.

## What I Need From You

One of:

1. **A built-in tour name** — `opportunity-search`, `apply-for-grant`, `login`, `agency-profile`
2. **A custom feature name** — e.g. "agency settings editor"
3. **A URL or page in the running app** — "trace what happens when I click Submit on /apply/123"

If nothing is supplied, the agent runs the default `opportunity-search` tour.

## What Happens Next

The Contributor Onboarding Agent will:
1. Load architecture sections, conventions, and rule list
2. Read the entry-point page, data-fetching hook, HTTP call, route handler, service, repository/adapter, and model — in that order
3. Cite the exact file paths, line ranges, and governing rule file at every layer
4. Name the architectural constraint (FedRAMP, USWDS, accessibility, Grants.gov coexistence) that each layer exists to satisfy
5. Trace an example payload back up the stack
6. Suggest the next tour or rule file to explore

This agent is READ-ONLY. It will refuse to edit or create files. Use `/new-endpoint`, `/generate`, or `/refactor` for changes.

## Tips for Better Results
- Name a specific feature rather than asking "how does the whole app work"
- Tell the agent your background (frontend, backend, infra) and it will weight the explanations accordingly
- After the tour, ask follow-up questions about the layer that was least clear
