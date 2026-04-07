# dependency-health-reviewer

## Purpose

Specialist reviewer subagent that audits package manifests and lockfiles for transitive regressions, duplicate installs, license drift, and known CVEs. Enforces the CC0 / permissive license policy required for federal open-source distribution.

## Who calls it

- `dependency-update` (Gate 2)
- `pr-preparation` (optional, when lockfiles change)

## What it checks

- Added / removed / upgraded / downgraded packages (including transitive)
- License allowlist (MIT, BSD, Apache-2.0, ISC, CC0, Python-2.0, MPL-2.0)
- Known CVEs
- Duplicate installs
- Registry source drift, missing integrity hashes
- Major bumps on auth / crypto / db driver / logging packages

## Output format

JSON with severity summary and per-package findings. See `.cursor/agents/dependency-health-reviewer.md`.

## Example

```
Invoke dependency-health-reviewer with:
  manifests: ["api/poetry.lock", "frontend/package-lock.json"]
  changed_packages: [{"name": "flask", "old": "2.3.0", "new": "3.0.0", "ecosystem": "pypi"}]
  calling_agent: "dependency-update"
```

## Policy

License violations, known CVEs, and duplicate installs always block.
