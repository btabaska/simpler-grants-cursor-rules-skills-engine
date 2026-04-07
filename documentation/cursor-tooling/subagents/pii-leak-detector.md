# pii-leak-detector

## Purpose

Specialist reviewer subagent that scans diffs, logs, fixtures, docs, and post-mortems for PII, secrets, tokens, and FedRAMP-sensitive data. The last line of defense before content leaves the repo.

## Who calls it

- `pr-preparation` (Gate 2, hard block)
- `incident-response` (Gate 2)
- `changelog-generator` (Gate 2 on Security entries)
- `dependency-update` (when sensitive packages change)
- `debugging` (when pasted logs contain user data)

## What it checks

- Secrets: AWS keys, JWTs, private keys, generic API keys, DB URLs with passwords
- PII: emails, SSN, EIN, phones, full names with DOB/address, IP addresses
- Embargoed CVE detail ahead of disclosure date
- Structured logging: flags `log.info(f"...{user}...")` f-string interpolation
- `.env` files committed

## Output format

JSON with severity summary and findings. Secret values are redacted to first 4 characters plus `...`. See `.cursor/agents/pii-leak-detector.md`.

## Example

```
Invoke pii-leak-detector with:
  content_type: "diff"
  diff: "<unified diff>"
  calling_agent: "pr-preparation"
```

## Policy

Any secret, credential, SSN, EIN, or embargoed CVE always blocks. No exceptions.
