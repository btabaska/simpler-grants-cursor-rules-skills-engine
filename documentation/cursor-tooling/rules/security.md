# security

## Purpose
Application-level security controls: authentication/authorization, input handling, secrets, dependencies, cookies/CORS, rate limiting, cryptography, and security event logging.

## Scope / Globs
`api/src/**/*.py`, `frontend/src/**/*.{ts,tsx}`, `infra/**/*.tf`, `**/Dockerfile*`

## Conventions Enforced
- `jwt_or_api_user_key_multi_auth` and 403-on-identity-mismatch
- Marshmallow edge validation; no string-interpolated SQL; no `eval`/`pickle`
- React default escaping; strict CSP and security headers
- Secrets from SSM / Secrets Manager; never committed
- SCA/SAST gating in CI; CC0-compatible licensing
- Secure cookies (`Secure`, `HttpOnly`, `SameSite`); strict CORS
- Rate limiting on auth, search, and write endpoints
- Vetted crypto (AES-GCM, Argon2id); TLS 1.2+
- Security events logged without secrets or tokens

## Examples
Correct: `raise_flask_error(403, "Forbidden")` when `user.user_id != user_id`.
Incorrect: trusting `request.json["user_id"]` for authorization.

## Related Rules
`api-auth`, `api-routes`, `api-validation`, `data-privacy`, `fedramp`, `docker`, `ci-cd`, `infra`.
