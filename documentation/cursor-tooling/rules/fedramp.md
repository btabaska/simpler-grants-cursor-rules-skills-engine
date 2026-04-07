# fedramp

## Purpose
Keep code, infrastructure, and data flows aligned with the FedRAMP Moderate authorization boundary.

## Scope / Globs
`api/src/**/*.py`, `frontend/src/**/*.{ts,tsx}`, `infra/**/*.tf`, `**/Dockerfile*`, `.github/workflows/**/*.yml`

## Conventions Enforced
- No new outbound dependencies without SSP entry + ATO
- Least-privilege IAM, MFA for humans, rotated secrets
- Structured, tamper-evident audit logging
- TLS 1.2+ in transit; KMS encryption at rest
- Terraform-managed config; pinned images and dependencies
- SCA/SAST/container scanning gates in CI
- Correlation/trace IDs in logs for incident response
- Grants.gov interconnections stay inside the boundary

## Examples
Correct: new integration via `api/src/adapters/`, documented in SSP.
Incorrect: direct call from route handler to an unlisted SaaS endpoint.

## Related Rules
`security`, `data-privacy`, `api-logging`, `docker`, `infra`, `ci-cd`.
