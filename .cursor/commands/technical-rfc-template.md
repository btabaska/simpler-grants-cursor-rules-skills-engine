# Technical RFC Template

Generate a Technical RFC skeleton for simpler-grants-gov pre-populated with project context, constraints, and at least two starting alternatives.

## What I Need From You

1. A short problem statement
2. Author name
3. Scope hint (`api`, `frontend`, `infra`, `cross-domain`)
4. Optional: a draft solution and known constraints

## What Happens Next

The Technical RFC Template Agent will:
1. Load architecture sections, related ADRs, and rule files for the scope
2. Pre-populate FedRAMP, accessibility, USWDS, and performance constraints
3. Draft Problem, Goals, Background, Proposed Solution, Alternatives, Migration, Risks, and Rollout sections
4. Assign the next sequential RFC number
5. Write `documentation/rfcs/RFC-<NNNN>-<title>.md` with Status: Draft

## Tips

- Start with the problem, not the solution
- Name the constraint that makes the problem hard
- The agent never marks the RFC accepted; that's your team's call
