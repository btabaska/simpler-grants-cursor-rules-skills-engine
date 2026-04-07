# Load Test Generator

Generate a k6 or Locust load test scenario for simpler-grants-gov API endpoints from the OpenAPI spec, with realistic virtual-user ramps, think time, and SLO assertions.

## What I Need From You

1. **Workload** — the endpoint(s) or user journey to exercise
2. **Load shape** — virtual users, ramp-up, steady-state duration, ramp-down
3. **SLOs** (optional) — p95 latency, error rate (defaults to documented targets)
4. **Framework** (optional) — `k6` (default) or `locust`

## What Happens Next

The Load Test Generator Agent will:
1. Parse the OpenAPI spec for every endpoint in the workload
2. Compose a realistic journey with think time between steps
3. Emit the load shape (stages or `LoadTestShape`)
4. Add p95 latency and error-rate thresholds from documented SLOs
5. Write the file to `tests/load/<slug>.<ext>` with a usage header
6. Run API-contract, convention, and safety gates
7. Summarize what the test exercises and how to run it

## Tips for Better Results
- Describe a full user journey, not just a single endpoint — load shape matters most when the path stresses downstream services
- Name real SLO targets if you have them; otherwise the agent uses architecture defaults
- Pair with `/performance-audit` after the first run to analyze hotspots
