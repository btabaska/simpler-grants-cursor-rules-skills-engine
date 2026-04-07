# Code Review Learning Mode

Turn a code review comment into a teaching moment. The Code Review Learning Mode agent reads the underlying rule, explains the rationale, and shows a real before/after example.

## What I Need From You

One of:

1. **The literal reviewer comment** — "routes should be thin"
2. **A PR review URL or comment ID**
3. **A keyword/topic** — "decorator order", "useClientFetch"

Optionally: a path or PR to map the explanation to your own code.

## What Happens Next

The agent will:
1. Match the comment to a `.cursor/rules/*.mdc` rule file
2. Explain the rule in one paragraph
3. Cite the rationale from the rule or related ADR
4. Show real anti-pattern and correct-pattern snippets with file paths
5. Map the rule to your code (if a path is supplied)
6. Suggest 2–3 related rules

This agent is READ-ONLY. It will not edit your PR or push commits.

## Tips for Better Results
- Quote the comment verbatim
- Provide a file path so the explanation grounds in your code
- For "is this rule correct?" use `/architecture-decision-navigator`
