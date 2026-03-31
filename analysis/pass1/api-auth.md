# Pattern Discovery: API Auth (`api/src/auth/`)

**Source:** 21 merged PRs analyzed from HHS/simpler-grants-gov
**Date range:** 2025-03-31 to 2025-10-02
**Primary authors:** chouinar, mikehgrantsgov, btabaska, babebe

---

## 1. Structural Patterns

### SP-1: Auth module per authentication mechanism
Each authentication scheme gets its own module file within `api/src/auth/`:
- `api_jwt_auth.py` (user JWT via Login.gov)
- `api_key_auth.py` (legacy environment-based API keys)
- `api_user_key_auth.py` (database-backed API Gateway keys)
- `internal_jwt_auth.py` (short-lived internal tokens)
- `multi_auth.py` (composition of multiple auth schemes)
- `auth_utils.py` (shared OpenAPI security scheme registration)
- `endpoint_access_util.py` (RBAC privilege checking)

**Frequency:** Consistent across all 21 PRs
**Trend:** Growing; new auth files added over time (multi_auth, internal_jwt_auth, api_user_key_auth, endpoint_access_util)
**Confidence:** High

### SP-2: Security scheme registry in `auth_utils.py`
Every new auth mechanism must be registered in `get_app_security_scheme()` with its header name and OpenAPI scheme name.

**Exemplar PRs:** #5417 (InternalApiJwtAuth), #6051 (ApiUserKeyAuth)
**Frequency:** 3/21 PRs
**Trend:** Enforced by reviewer whenever new auth added
**Confidence:** High

### SP-3: Test files mirror auth module structure
Auth tests follow `api/tests/src/auth/test_{module_name}.py` pattern. Each new auth module gets a corresponding test file.

**Exemplar PRs:** #4954 (test_multi_auth.py), #5417 (test_internal_jwt_auth.py), #6051 (test_api_user_key_auth.py)
**Frequency:** 3/3 new auth module PRs
**Confidence:** High

### SP-4: Mini-app test pattern for auth
Auth tests create isolated Flask mini-apps with dummy endpoints to test auth in isolation, avoiding interference with other test fixtures. Pattern: monkeypatch `register_blueprints` and `setup_logging`, create app, define dummy endpoint with auth decorator, yield within logging context.

**Exemplar PRs:** #4954, #5417, #6051
**Frequency:** 3/3 new auth module PRs (100%)
**Trend:** Established convention, consistently followed
**Confidence:** High

---

## 2. Code Patterns

### CP-1: Multi-auth composition via `MultiHttpTokenAuth`
When an endpoint needs multiple auth schemes, the project uses a custom `MultiHttpTokenAuth` subclass of flask-httpauth's `MultiAuth`. Each composition is defined as a module-level constant with a corresponding `_security_schemes` list for OpenAPI docs.

Pattern:
```python
jwt_or_key_multi_auth = MultiHttpTokenAuth(api_jwt_auth, api_key_auth)
jwt_or_key_security_schemes = _get_security_requirement([...])
```

**Exemplar PRs:** #4954, #5015, #5434, #6051
**Frequency:** 4/21 PRs (growing)
**Trend:** Increasing; started with 2 schemes, grew to 4 auth types
**Confidence:** High

### CP-2: Multi-auth requires Flask-style decorators, not APIFlask
Because APIFlask does not support `MultiAuth`, endpoints using multi-auth must use `@multi_auth.login_required` instead of `@blueprint.auth_required()`, and manually add `@blueprint.doc(security=...)`. This is a documented workaround.

**Exemplar PRs:** #4954 (documented pattern), #5015, #5434, #6051
**Frequency:** 4/21 PRs
**Trend:** Stable, documented in `documentation/api/authentication.md`
**Confidence:** High

### CP-3: `MultiAuthUser` dataclass for auth type discrimination
After multi-auth, the handler calls `multi_auth.get_user()` which returns a `MultiAuthUser` with `user` and `auth_type` fields. The `auth_type` is a `StrEnum` and the `user` is a union type that grows as new auth mechanisms are added. Type discrimination uses `isinstance()` checks.

**Exemplar PRs:** #4954, #5434, #6051
**Frequency:** 3/21 PRs
**Trend:** Union type grows with each new auth mechanism
**Confidence:** High

### CP-4: SQLAlchemy `selectinload` for targeted relationship loading
Auth queries explicitly specify which relationships to load using `selectinload(Model.relationship)` rather than `selectinload("*")`. The wildcard `*` was replaced because it loaded too many relationships.

**Exemplar PRs:** #5048
**Frequency:** 1 PR but changes affected auth and multiple services
**Trend:** Corrective; moved away from wildcard loading
**Confidence:** High

### CP-5: Structured logging with flat key names
Log extra fields use flat, snake_case names (e.g., `user_id`, `application_id`) rather than nested/dotted names (e.g., `auth.user_id`, `application.application_id`). Auth-related fields use the `auth.` prefix only for distinguishing auth token types in New Relic.

**Exemplar PRs:** #4965, #5417
**Frequency:** 2/21 PRs
**Trend:** Enforced; PR #4965 was a systematic cleanup of dotted names
**Confidence:** High

### CP-6: JWT token creation/parse function pairs
Each JWT-based auth module exposes `create_jwt_for_*` and `parse_jwt_for_*` functions. These follow a consistent pattern: create generates a UUID token_id, builds JWT claims, stores a DB session record, returns (token_string, session_record).

**Exemplar PRs:** #5417 (internal_jwt_auth), #4378 (api_jwt_auth)
**Frequency:** 2 auth modules
**Confidence:** High

### CP-7: Auth migration from api_key_auth to user JWT
Application endpoints progressively moved from `api_key_auth` to `api_jwt_auth` authentication, reflecting the shift from system-to-system to user-based auth for the apply flow.

**Exemplar PRs:** #5015
**Frequency:** 1 PR but affected 6 endpoints
**Trend:** Directional; API key auth is being deprecated for user-facing endpoints
**Confidence:** High

### CP-8: Test fixtures for auth tokens in conftest.py
Reusable auth fixtures (`api_auth_token`, `user_auth_token`, `user_api_key`, `user_api_key_id`) are defined in `api/tests/conftest.py` rather than in individual test files.

**Exemplar PRs:** #6051 (reviewer requested moving fixture to conftest)
**Frequency:** Enforced in review
**Trend:** Stable convention
**Confidence:** High

---

## 3. Corrective Patterns (Reviewer Enforcement)

### RE-1: Rename classes to avoid ambiguity
Reviewer (chouinar) requested renaming `User` dataclass to `ApiKeyUser` to avoid confusion with the User DB model.

**Exemplar PRs:** #4954
**Confidence:** Medium (one instance, but clearly enforced)

### RE-2: Pre-define security scheme constants
Reviewer directed that security scheme lists be defined as module-level constants rather than calling helper functions at each endpoint.

**Exemplar PRs:** #5015, #5434
**Frequency:** 2/21 PRs
**Confidence:** High

### RE-3: Use correct HTTPTokenAuth base class
Reviewer caught that `JwtUserHttpTokenAuth` was used for a non-JWT key auth, directing use of plain `HTTPTokenAuth` instead.

**Exemplar PRs:** #6051
**Confidence:** High

### RE-4: Naming should not reference AWS services
Reviewer (chouinar) renamed `ApiGatewayKeyAuth` to `ApiUserKeyAuth` because the user/API should not care about the underlying infrastructure provider.

**Exemplar PRs:** #6051
**Confidence:** High

### RE-5: Wrap DB operations in explicit transactions
Reviewer enforced using `with db_session.begin():` around DB operations and committing changes, even when SQLAlchemy might handle it implicitly.

**Exemplar PRs:** #6051
**Confidence:** High

### RE-6: Test fixtures should not duplicate setup
Reviewer directed that auth tokens/keys used across tests be defined as fixtures in conftest.py rather than created inline in each test.

**Exemplar PRs:** #6051
**Confidence:** High

### RE-7: Be selective about which endpoints get new auth
Reviewer blocked adding new API key auth to form endpoints that need strict access control, preferring to wait for role-based access.

**Exemplar PRs:** #6051
**Confidence:** High

---

## 4. Anti-Patterns (Flagged as Wrong)

### AP-1: Using `selectinload("*")` wildcard
Loading all relationships eagerly was flagged as causing performance issues. Replaced with targeted `selectinload(Model.specific_relationship)`.

**Exemplar PRs:** #5048
**Confidence:** High

### AP-2: Using `noload` for relationship loading
SQLAlchemy docs recommend against `noload`; it was replaced with `lazyload` which is safer and the default behavior.

**Exemplar PRs:** #5048
**Confidence:** High

### AP-3: Warning-level logs for expected 4xx errors
Reviewer flagged that `logger.warning()` should not be used for expected client errors (4xx). These trigger alerts in New Relic unnecessarily. Use `logger.info()` instead.

**Exemplar PRs:** #4936 (in validation context, but applies to auth)
**Confidence:** High

### AP-4: Putting variable text in log messages
Embedding dynamic values (IDs, statuses) directly in log message strings was flagged. Variables should go in `extra={}` dict to enable consistent log querying.

**Exemplar PRs:** #4936, #4965
**Confidence:** High

### AP-5: Both `auth_required` and `login_required` decorators
When switching to multi-auth, having both `@blueprint.auth_required()` and `@multi_auth.login_required` is incorrect. Only the latter should be used.

**Exemplar PRs:** #5015
**Confidence:** High

---

## 5. Connections to Other Domains

### CD-1: Auth <-> Validation
Auth errors (unauthorized access, expired tokens) use the same `raise_flask_error` and `ValidationErrorDetail` infrastructure as form validation. Validation error types for auth are defined in `validation_constants.py` (e.g., `UNAUTHORIZED_APPLICATION_ACCESS`).

**Exemplar PRs:** #5076, #6426
**Connection strength:** Strong

### CD-2: Auth <-> Frontend Hooks
JWT payload changes (e.g., `session_duration_minutes` in #4378) directly affect frontend auth types (`SimplerJwtPayload`). Frontend hooks (`useClientFetch`, `useUser`) depend on auth token expiration and refresh behavior. The `X-SGG-Token` header is the contract between frontend and API auth.

**Exemplar PRs:** #4378, #4521, #4874
**Connection strength:** Strong

### CD-3: Auth <-> Application Services
Auth is progressively being woven into application service functions. Service functions evolved from no user parameter to requiring `User` objects, then to optional `User | None` with `is_internal_user` flags for internal auth bypass.

**Exemplar PRs:** #5076, #5434
**Connection strength:** Strong

### CD-4: Auth <-> RBAC/Privileges
The endpoint_access_util introduced role-based access control that layers on top of existing auth. Roles are context-specific (organization, application, agency, internal) and map to privilege enums.

**Exemplar PRs:** #6426, #6520
**Connection strength:** Growing
