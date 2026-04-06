# Explain Architecture

Understand how a file or module fits into the simpler-grants-gov architecture.

## What I Need From You

Either:
- Open the file you want explained
- Or ask: "How does the search service fit into the architecture?"
- Or ask: "What's the data flow from the frontend form to the database?"

## What Happens Next

1. Loads the relevant architecture section via MCP
2. Identifies the file's layer (route → service → database, or component → hook → service)
3. Explains the file's responsibilities, what calls it, and what it calls
4. Shows how it relates to domain rules and conventions
5. Identifies the applicable rules and key ALWAYS/NEVER directives

## Tip

If architecture context isn't loading or MCP tools return errors, run `/tooling-health-check` to verify MCP servers are connected and the toolkit is properly configured.
