# `runbook-generator` Agent — Usage Guide

## Purpose

Produce an operational runbook for a simpler-grants-gov service. Pulls topology from Terraform, deploy/rollback commands from workflows, monitoring from infra, and writes a structured document an on-call operator can follow.

## When to Use

- New service launch
- Stale runbook refresh
- Pre-incident readiness review

## When NOT to Use

- During an active incident (use `@agent-incident-response`)
- For ad-hoc scripts that have no production deploy

## Invocation

```
/runbook-generator
@agent-runbook-generator
```

Provide the service name and optional environment.

## Output

`documentation/runbooks/<service>.md` with Overview, Topology, Dependencies, Deploy, Rollback, Smoke Test, Monitoring, Common Issues, Escalation, and References. Every command and dashboard is cited.

## Tips

- Make sure the service exists in `infra/` before invoking
- Add a smoke-test target to the Makefile so the agent can cite it
- Pair with `@agent-incident-response` to keep incidents and runbooks aligned

## Pitfalls

- Don't accept a runbook without deploy AND rollback
- Don't include secrets — the agent refuses, but verify
- Don't skip the smoke test; it gates Gate 3
