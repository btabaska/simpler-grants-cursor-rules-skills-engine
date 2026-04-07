# `fedramp-compliance-checker` Agent — Usage Guide

## Purpose

Validate Terraform plan diffs for simpler-grants-gov against the FedRAMP Moderate baseline. Flags unauthorized services, missing FIPS 140-2 encryption, non-approved regions, exposed network paths, and gaps against NIST 800-53 Rev 5.

## When to Use

- Any PR touching `infra/`
- Pre-merge gate for cloud resource additions or modifications
- Back-fill compliance evidence for already-merged infra changes

## When NOT to Use

- Application-only changes (use `@agent-authority-to-operate-checklist` instead)
- Non-AWS providers (out of scope for the current SSP)

## Invocation

```
/fedramp-compliance-checker
@agent-fedramp-compliance-checker
```

Provide a Terraform JSON plan, text plan diff, or resource-change list.

## Output

`documentation/compliance/fedramp-reports/PR-<num>-fedramp.md` with severity-rated findings, NIST control mapping, and `path:line` evidence per finding.

## Tips

- Run `terraform show -json plan.bin` and pipe the output for the cleanest mapping.
- Encrypted-by-default does not satisfy FIPS 140-2 alone — confirm CMK and FIPS endpoint.
- Region must match the approved list documented in the SSP.

## Pitfalls

- Don't rely on this for application-layer (auth, PII) findings — use the ATO Checklist agent.
- Don't override Gap findings without an explicit ADR or compliance-officer note.
