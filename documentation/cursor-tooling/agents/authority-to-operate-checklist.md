# `authority-to-operate-checklist` Agent — Usage Guide

## Purpose

Convert a pull request diff into the structured artifacts the FedRAMP Moderate ATO process needs: NIST 800-53 Rev 5 control mapping matrix, Mermaid data-flow diagram for PII, RBAC inventory, and an SSP excerpt with evidence.

## When to Use

- A PR touches `api/src/auth`, `api/src/api`, `api/src/services`, `api/src/db/models`, `frontend/src/services`, or `infra/`.
- Compliance asks for control evidence on a recent change.
- You need to back-fill ATO artifacts for a merged change.

## When NOT to Use

- Pure cosmetic / docs PR with no security surface.
- Live system monitoring (not this agent's job).
- Automated remediation (out of scope).

## Invocation

```
/authority-to-operate-checklist
@agent-authority-to-operate-checklist
```

Provide `gh pr view <num> --json title,body,files` plus `gh pr diff <num>`, or paste a unified diff.

## Output

`documentation/compliance/ato-bundles/PR-<num>-<slug>.md` containing the control mapping summary, Mermaid PII flow diagram, RBAC inventory, SSP excerpt, and remediation items. Every claim is cited as `path:line`.

## Tips

- Pull diffs with `gh pr diff` so line numbers match.
- Name the field if PII is involved; it will appear in the data-flow diagram.
- Ambiguous findings are marked Review Needed rather than guessed.

## Pitfalls

- Don't accept "Compliant" findings without verifying the cited file exists.
- Don't expand the bundle to include policies or training records — out of scope.
- Don't run on infrastructure-only PRs without also providing the relevant ADR or rationale.
