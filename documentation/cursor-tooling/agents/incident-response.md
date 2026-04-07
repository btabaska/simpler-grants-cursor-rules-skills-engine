# `incident-response` Agent — Usage Guide

## Purpose

Triage production incidents in simpler-grants-gov: classify severity, trace code paths, separate immediate mitigation from root-cause fix, and draft a blameless post-mortem the on-call engineer can finalize.

## When to Use

- A production alert just fired and you need a quick trace of the likely code path
- An incident just resolved and you need a post-mortem draft fast
- You want a second pair of eyes on mitigation options before you act
- You need to correlate an incident with a recent PR

## When NOT to Use

- You need to actually perform the remediation — this agent only recommends
- You need customer communications or compliance notifications
- You are debugging a reproducible local issue (use `@agent-debugging`)
- You need alert / monitoring configuration changes

## Invocation

```
/incident-response
@agent-incident-response <symptom, time window, logs>
```

## Examples

### Example 1 — Database connection pool exhaustion
```
@agent-incident-response 500s on POST /v1/opportunities starting 14:23 UTC. Logs show "QueuePool limit of size 10 overflow 10 reached".
```
Result: sev2 classified, trace to `opportunity_service.submit()`, hypothesis narrowed to long-held transaction in search adapter, mitigation "disable submission flag + rotate db pool", post-mortem draft written.

### Example 2 — Frontend regression
```
@agent-incident-response Users report "Save draft" silently failing on the application form since 09:00 UTC. No backend errors.
```
Result: sev3, trace to client-side mutation, hypothesis "recent `useFormData` refactor dropped error propagation", investigation plan lists Sentry query + git blame, PR #4321 flagged via `git-history-analyzer`.

### Example 3 — Intermittent search timeouts
```
@agent-incident-response Search timing out for ~5% of requests over last hour. p99 latency jumped from 300ms to 8s.
```
Result: sev2, trace to opensearch adapter, two hypotheses (missing index after last migration vs. cache eviction storm), investigation plan lists the exact queries to run.

### Example 4 — Post-mortem after resolution
```
@agent-incident-response Incident resolved at 16:45 UTC. Root cause was a bad feature-flag default. Need the post-mortem document.
```
Result: full post-mortem draft at `documentation/incidents/2026-04-07-flag-default-regression.md`.

## Tips

- Paste real logs — the PII scrub runs automatically
- Name a suspect PR if you have one; the agent will verify
- Keep the symptom description short and factual; save narrative for the post-mortem

## Pitfalls

- Don't let the agent commit to a single root cause without evidence
- Don't skip the PII gate when sharing the post-mortem externally
- Don't use this for non-production issues — it is tuned for sev1/2/3 urgency
