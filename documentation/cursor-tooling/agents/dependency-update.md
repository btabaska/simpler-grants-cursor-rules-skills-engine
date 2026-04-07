# `dependency-update` Agent — Usage Guide

## Purpose

Upgrade a single Python (uv/poetry) or JavaScript (npm) dependency, fetch its changelog, flag breaking changes, update the lock file, patch affected call sites, run scoped tests, and draft a PR description. One package per invocation.

## When to Use

- Routine patch or minor bumps to keep dependencies current
- Major-version upgrades where you want the agent to surface breaking changes and find the affected call sites
- Back-filling a version bump a PR reviewer flagged

## When NOT to Use

- Bulk upgrades across many packages — run once per package
- Security vulnerability triage — Dependabot owns that
- Pre-release / beta / rc opt-in without an explicit go-ahead
- Pinning policy changes (use an ADR)

## Invocation

```
/dependency-update
@agent-dependency-update <package> from <current> to <target> in <api|frontend>
```

## Examples

### Example 1 — Patch bump

```
@agent-dependency-update ruff from 0.6.3 to 0.6.8 in api
```

Result: changelog confirms no breaking changes, lock updated, `make test-api` green, PR draft printed.

### Example 2 — Minor bump with deprecation

```
@agent-dependency-update marshmallow from 3.19 to 3.22 in api
```

Result: one deprecation flagged, 4 call sites patched, scoped pytest pass, broad test pass, PR draft lists the deprecation and the fix.

### Example 3 — Major bump

```
@agent-dependency-update SQLAlchemy from 2.0 to 2.1 in api
```

Result: breaking changes classified Major, 12 call sites patched across services and repositories, scoped tests pass, broad `make test-api` pass, PR draft includes risk assessment and recommended reviewers.

### Example 4 — Frontend major

```
@agent-dependency-update next from 14 to 15 in frontend
```

Result: multi-version changelog read, App Router deprecations flagged, `next.config.js` and route handlers patched, `npm test` pass, PR draft calls out runtime behavior changes.

## PR Draft Shape

```markdown
## Summary
Bump <pkg> from <current> to <target>.

## Changelog
- vX.Y.Z: ...
- vA.B.C: ...

## Breaking Changes
- ...

## Call Sites Patched
- path/to/file.py — ...

## Tests
- Scoped: <result>
- Broad: <result>

## Risk
- <low | medium | high> + rationale

## Recommended Reviewers
- @owner of the affected domain
```

## Tips

- Let the agent read every intermediate version — skipping is how deprecations get missed
- Preserve the manifest's range-operator style (the agent does this; don't hand-edit after)
- Major bumps to auth, crypto, database drivers, or logging packages trigger a mandatory `pii-leak-detector` gate

## Pitfalls

- Refuses to run on a dirty working tree
- Refuses bulk upgrades
- Security-advisory responses should still go through Dependabot's workflow
- Lock file and manifest always move together — don't hand-split them
