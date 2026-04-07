# OpenAPI Sync

Detect drift between the API OpenAPI spec and frontend TypeScript types, and print the regeneration command.

## What I Need From You

- Nothing required — defaults to comparing against `origin/main`.
- Optional: `base_ref=<git-ref>`, `scope=endpoints|schemas|all`.

## What Happens Next

1. Diffs `api/openapi.generated.yml` and `frontend/src/types/` against the base ref.
2. Classifies each change as BREAKING, ADDITIVE, or DOC.
3. Locates affected frontend fetchers and call sites.
4. Prints the exact regeneration command (`make openapi-sync` or the npm equivalent).
5. Read-only — never regenerates or edits files.

## Tips

- Run before opening a PR that touches API schemas or routes.
- Pair with `/skill-api-contract-test` after regeneration.
- Treat `frontend/src/types/` as generated — never hand-edit.
- BREAKING changes require a release-notes entry and a frontend reviewer.
