# documentation-staleness-detector

## Purpose

Specialist reviewer subagent that detects drift between code and prose documentation — README sections, markdown guides, docstrings, ADRs, and example snippets.

## Who calls it

Optional gate for: `api-docs-sync`, `user-guide-updater`, `codemod`, `refactor`, `migration`, `new-endpoint`.

## What it checks

- Symbols changed in the diff that still appear in docs with stale signatures
- Code examples that will no longer compile
- Env vars, CLI flags, route paths out of sync
- ADRs that document now-reversed decisions without successor entries
- Stale docstrings on touched functions

## Output format

JSON with severity summary and per-reference findings. See `.cursor/agents/documentation-staleness-detector.md`.

## Example

```
Invoke documentation-staleness-detector with:
  changed_files: ["api/src/api/applications/applications_routes.py"]
  doc_globs: ["README.md", "docs/**/*.md"]
  calling_agent: "refactor"
```

## Policy

Public-facing API renamed or removed in docs without redirect → block.
