# Incident Response

Triage a production incident: classify severity, trace the likely code path, propose an immediate mitigation, outline root-cause investigation, and draft a post-mortem.

## What I Need From You

1. **Symptom** — user-visible failure, alert name, or pasted log/stack trace
2. **Time window** — when the incident started (and ended, if known)
3. **Scope** (optional) — affected users, endpoints, environments

## What Happens Next

The Incident Response Agent will:
1. Classify severity and category
2. Trace the error to a specific service function and call chain
3. Propose the lowest-risk immediate mitigation (naming who must approve)
4. Enumerate 2–3 root-cause hypotheses with supporting evidence
5. List investigation steps that discriminate between hypotheses
6. Draft a post-mortem at `documentation/incidents/YYYY-MM-DD-<slug>.md`
7. Run PII scrub and recent-PR regression checks

The agent never executes remediation — all actions are recommendations.

## Tips for Better Results
- Paste the raw log lines (the agent will scrub PII before writing the post-mortem)
- Include the endpoint or user flow, not just the stack trace
- If you suspect a specific recent PR, say so — the agent will verify with `git-history-analyzer`
- Invoke during the incident for live triage, or immediately after for the post-mortem draft
