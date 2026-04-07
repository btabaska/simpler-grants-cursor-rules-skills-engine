# Runbook Generator

Generate an operational runbook for a simpler-grants-gov service or feature, grounded in Terraform, workflows, and architecture docs.

## What I Need From You

1. Service or feature name (e.g., `opportunity-search-api`)
2. Optional environment

## What Happens Next

The Runbook Generator Agent will:
1. Resolve the service to Terraform modules, ECS task definitions, and workflows
2. Extract topology, dependencies, and monitoring config
3. Pull deploy / rollback commands from GitHub Actions and Makefile targets
4. Add a smoke test, common debug paths, and escalation
5. Write `documentation/runbooks/<service>.md` with `path:line` citations

## Tips

- Name services as they appear in `infra/`
- The agent never invents dashboards or contacts
- Pair with `@agent-incident-response` during live incidents
