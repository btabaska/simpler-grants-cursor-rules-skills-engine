# Dependency Update

Upgrade a single Python or JavaScript dependency end-to-end: fetch the changelog, flag breaking changes, update the lock file, patch affected call sites, run scoped tests, and draft a PR description.

## What I Need From You

```
<package-name> from <current> to <target> in <api|frontend>
```

If you omit the current version or the layer, the agent will infer from the manifest. Pre-release / beta / rc targets require explicit confirmation.

## What Happens Next

The Dependency Update Agent will:
1. Verify clean working tree and the correct package manager (uv/poetry or npm)
2. Fetch the changelog for every version between current and target
3. Classify breaking changes as None / Minor / Major
4. Update the manifest and lock file in a single checkpoint commit
5. `rg` for removed/renamed symbols and patch each call site in a follow-up commit
6. Run scoped tests, then the broader domain test
7. Run convention, language-quality, and dependency-health quality gates
8. Draft a PR description (not push)

## Tips for Better Results
- One package at a time — bulk upgrades are refused
- Pair major-version bumps with `/adr-from-pr` if the upgrade changes an architectural constraint
- Do security-vuln triage with Dependabot; this agent is for version moves
