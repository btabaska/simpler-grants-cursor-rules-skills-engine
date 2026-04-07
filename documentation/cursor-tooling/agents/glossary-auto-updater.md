# `glossary-auto-updater` Agent — Usage Guide

## Purpose

Propose glossary entries for new domain terms, jargon, and acronyms in a simpler-grants-gov PR. Extracts definitions from PR descriptions, code comments, and commits; never invents meaning.

## When to Use

- A PR introduces new domain terms or acronyms
- Periodic glossary refresh
- Cross-team alignment on terminology

## When NOT to Use

- Translating the glossary (i18n is a separate process)
- Bulk renaming code identifiers

## Invocation

```
/glossary-auto-updater
@agent-glossary-auto-updater
```

Provide a PR number or diff.

## Output

`documentation/glossary-proposals/PR-<num>.md` containing proposed entries (with category, source citation, and confidence), a Needs Definition list, and a review checklist. The canonical glossary is never modified directly.

## Tips

- Define terms inline in the PR body for High confidence
- Expand acronyms parenthetically the first time they appear in code or docs
- Pair with `@agent-convention-quick-lookup` for terminology already settled

## Pitfalls

- Don't merge proposals without human review — confidence is heuristic
- Don't expect the agent to define an acronym it cannot find expanded anywhere
- Don't skip stoplist tuning if the proposals are noisy
