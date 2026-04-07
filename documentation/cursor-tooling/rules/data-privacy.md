# data-privacy

## Purpose
PII classification, redaction, retention, and FedRAMP-aligned privacy controls across API, frontend, and infrastructure.

## Scope / Globs
`api/src/**/*.py`, `frontend/src/**/*.{ts,tsx}`, `infra/**/*.tf`

## Conventions Enforced
- Classify data as Public / Internal / Confidential / PII
- No PII in logs, analytics, error tracking, URLs, or client storage
- Field-level authorization enforced in services
- Soft delete + scheduled hard delete honoring retention policy
- Third-party data flows only through approved adapters within the FedRAMP boundary
- Grants.gov-sourced applicant data treated as PII by default

## Examples
Correct: log `{"application_id": id}`; reference records by UUID.
Incorrect: log emails, SSNs, or full request bodies.

## Related Rules
`api-logging`, `security`, `fedramp`, `api-database`, `cross-domain`.
