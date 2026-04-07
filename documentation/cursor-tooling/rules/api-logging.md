# api-logging

## Purpose
Define structured logging conventions for the Python API: logger acquisition, static messages, extras, levels, PII handling, request context, and exceptions.

## Scope / Globs
`api/src/**/*.py`

## Conventions Enforced
- `logger = logging.getLogger(__name__)` at module scope
- Static messages, dynamic values in `extra={}` with flat snake_case keys
- `info` for expected 4xx; `warning` reserved for alerting; `error`/`exception` with `exc_info`
- No PII or secrets in logs
- `add_extra_data_to_current_request_logs` for request-scoped context
- Correlation IDs propagated to background tasks

## Examples
Correct: `logger.info("User login", extra={"user_id": user_id})`.
Incorrect: `logger.info(f"user {user_id} logged in")`.

## Related Rules
`cross-domain`, `api-routes`, `api-error-handling`, `data-privacy`, `security`.
