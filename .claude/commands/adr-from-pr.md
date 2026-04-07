# ADR From PR

Extract an architectural decision that has already been made inside a pull request and emit a sequentially-numbered ADR for the simpler-grants-gov project.

## What I Need From You

Provide one of:

1. **`gh pr view` JSON output** — `gh pr view <num> --json title,body,commits,files`
2. **A pasted PR description** — title + body, including any "why", "alternatives", "risks", "follow-ups" sections
3. **A commit message with a `Decision:` / `Why:` block**

If the PR mentions only one alternative, have a second one ready — the agent will ask before drafting rather than fabricate.

## What Happens Next

The ADR-From-PR Agent will:
1. Load existing ADRs and architectural context, then determine the next sequential ADR number
2. Extract the decision, alternatives, constraints (FedRAMP, accessibility, USWDS, open-source, performance), and consequences from the PR
3. Detect supersession of any existing ADRs and cross-reference them
4. Draft `documentation/decisions/adr/NNNN-<title>.md` using the canonical template, including a `Source:` line citing the PR
5. Validate with `codebase-conventions-reviewer` and `architecture-strategist` quality gates

## Tips for Better Results
- Prefer `gh pr view --json` over copy-paste — it parses more reliably
- Name the specific constraint that ruled out each alternative
- If the PR removes or replaces a documented pattern, mention the prior ADR number so it can be marked Superseded
