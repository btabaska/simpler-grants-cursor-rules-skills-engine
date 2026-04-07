# `code-review-learning-mode` Agent — Usage Guide

## Purpose

Convert a code review comment into a teaching moment by surfacing the underlying rule, its rationale, the canonical documentation citation, and a real before/after example. Read-only.

## When to Use

- A reviewer leaves a pattern-based comment ("routes should be thin")
- Self-review against a pattern you half-remember
- Mentoring a contributor on a recurring rule
- Onboarding contributors who have seen the same comment more than once

## When NOT to Use

- Debugging (use `@agent-debugging`)
- Style/taste comments (no rule applies)
- Challenging whether a rule is correct (use `@agent-architecture-decision-navigator`)
- Generic programming tutorials

## Invocation

```
/code-review-learning-mode
@agent-code-review-learning-mode "<reviewer comment>"
```

## Examples

### Example 1 — Verbatim comment
```
@agent-code-review-learning-mode "routes should be thin — move business logic to services"
```

### Example 2 — Topic
```
@agent-code-review-learning-mode decorator order
```

### Example 3 — With code mapping
```
@agent-code-review-learning-mode "use server components by default" frontend/src/components/search/SearchForm.tsx
```

## Output Shape

Rule name and file, one-paragraph "what it says", "why it exists", real anti-pattern and correct-pattern snippets with citations, mapping to the contributor's code, and 2–3 related rules.

## Tips

- Quote the reviewer comment verbatim
- Provide a file path so the explanation grounds in your own code
- Use the related-rules list to deepen understanding rather than chasing every comment in isolation

## Pitfalls

- Will not edit your PR or push commits
- Will not debate whether the rule is correct
- Will not invent rule names — if no match exists, it says so
