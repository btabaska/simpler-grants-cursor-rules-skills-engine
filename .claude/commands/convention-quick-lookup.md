# Convention Quick Lookup

Get the canonical answer to "how do we handle X?" with file-path citations. The Convention Quick Lookup agent searches the `.cursor/rules/*.mdc` rule files and the architecture guide.

## What I Need From You

One of:

1. **A "how do we ..." question** — "how do we structure error responses?"
2. **A keyword** — "decorator stack", "soft delete", "useClientFetch"
3. **A layer** — "API routes", "frontend hooks"

## What Happens Next

The agent will:
1. Identify the affected layer and rule file
2. Read the relevant section
3. Return a one-paragraph canonical answer
4. Quote a 3-line snippet
5. Cite the rule file and section
6. Suggest related conventions

This agent is READ-ONLY.

## Tips for Better Results
- Be specific about the layer (api, frontend, forms, database)
- For *why* a convention exists use `/architecture-decision-navigator`
- For full implementation walkthroughs use `/interactive-codebase-tour`
