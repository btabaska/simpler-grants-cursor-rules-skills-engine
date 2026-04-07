# `adr-from-pr` Agent — Usage Guide

## Purpose

Convert the body of a merged or about-to-be-merged pull request into a properly formatted, sequentially-numbered Architecture Decision Record. Complements `@agent-adr` (which authors ADRs from scratch).

## When to Use

- A PR introduces a non-trivial pattern, technology, or trade-off that future readers will ask "why?" about.
- A reviewer asked "can you write an ADR for this?" and you have the PR description in hand.
- You're back-filling ADRs for already-merged decisions.

## When NOT to Use

- The decision has not been made yet (use an RFC instead).
- The PR is a pure refactor with no architectural impact.
- You don't have the rationale; this agent extracts, it does not invent.

## Invocation

```
/adr-from-pr
@agent-adr-from-pr
```

Provide the PR body, the output of `gh pr view <num> --json title,body,commits,files`, or a commit message containing a `Decision:` block.

## Examples

### Example 1 — From `gh pr view`

```
@agent-adr-from-pr
$(gh pr view 4321 --json title,body,commits,files)
```

Result: `documentation/decisions/adr/0043-function-based-route-handlers.md`, status Accepted, sourced from `HHS/simpler-grants-gov#4321`.

### Example 2 — Pasted PR body

```
@agent-adr-from-pr
Title: Switch caching layer from Memcached to Redis
Body:
- Why: need pub/sub + sorted sets for the new notification fan-out
- Alternatives: stay on Memcached (no pub/sub), application-level cache (cold-start cost)
- Constraint: FedRAMP-authorized managed offering required (AWS ElastiCache Redis qualifies)
- Risk: connection pool tuning under load
```

Result: ADR draft with Alternatives Considered fully populated, FedRAMP constraint cited, follow-up "tune connection pool" captured under Consequences → Neutral.

### Example 3 — Supersession

```
@agent-adr-from-pr
This PR removes the v0 opportunity-search endpoint and routes all traffic to v1/OpenSearch.
Documented in ADR-0021. Cutover date: 2026-04-15.
```

Result: New ADR marked Accepted, ADR-0021 referenced and proposed for status update to Superseded.

## Output Format

See `.cursor/agents/adr.md` for the canonical template. This agent always produces the same shape, plus a `Source:` line citing the originating PR.

## Tips

- Run `gh pr view --json` rather than copy-pasting; the agent parses it more reliably.
- If the PR mentions only one alternative, the agent will ask for a second — have it ready.
- Always state the constraint (FedRAMP, accessibility, USWDS, open-source, performance budget) that ruled out each alternative.

## Pitfalls

- Don't let the agent invent alternatives. If the PR doesn't list them, supply them yourself.
- Don't skip the supersession check — orphaned ADRs are the most common ADR-quality bug in this repo.
- Don't use this agent for RFCs (decisions not yet made); use `/adr` instead.
