# Feature Flag

Scaffold a boolean feature flag end-to-end across Terraform SSM, the API config + branching, the frontend hook, `.env.development`, and the cleanup tracker.

## What I Need From You

1. **Flag name or feature description**
2. **Affected backend files**
3. **Affected frontend files**
4. **Default value** (usually `false`)
5. **Owner**
6. **Target cleanup date** (mandatory — flags without a cleanup date are refused)

## What Happens Next

The Feature Flag Agent will:
1. Normalize the flag name into SSM path, API env var, frontend env var, and TS key
2. Add the Terraform SSM parameter
3. Extend the API config loader and insert branching at the named backend files
4. Call `useFeatureFlag` at the named frontend files with identical off-path behavior
5. Update `.env.development`
6. Append a cleanup-tracker entry to `documentation/feature-flags/active.md`
7. Present the full diff before writing, grouped by layer

## Tips for Better Results
- Keep branching to ~3 sites per layer — extract a helper if you need more
- Never default a flag to `true` in production environments
- Pair long-lived flags with `/adr-from-pr` so the rationale is captured
- Use `/flag-cleanup` (the skill) to remove the flag later; the tracker points at it
