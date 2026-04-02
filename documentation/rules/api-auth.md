# API Authentication & Authorization -- Conventions & Rules

> **Status:** Draft -- pending tech lead validation. Items marked with a trailing
> flag are awaiting team confirmation. All other patterns reflect high-confidence
> conventions observed consistently across the codebase.

## Overview

The Simpler Grants API uses a modular authentication architecture where each auth
mechanism lives in its own file under `api/src/auth/`. The system supports API key
auth, user JWT auth (via Login.gov), short-lived internal JWT auth, and
database-backed user API keys. These schemes are composed into multi-auth
configurations using a custom `MultiHttpTokenAuth` subclass of Flask-HTTPAuth's
`MultiAuth`, allowing endpoints to accept multiple credential types.

Authorization is handled through a separate RBAC layer in `endpoint_access_util.py`,
which maps roles to context-specific privileges (organization, application, agency,
internal). The auth architecture enforces a strict separation: auth classes never
reference infrastructure providers (AWS, Login.gov) in their public names, and
sensitive endpoints restrict which auth schemes are permitted based on the data
they protect.

For the overall API layered architecture and how auth fits into the decorator stack
and transaction management, see the API Routes conventions document. For how auth
errors are raised and structured, see the API Error Handling conventions document.

## Rules

### Module Organization

#### Rule: One Module Per Auth Mechanism
**Confidence:** High
**Observed in:** 21 of 21 PRs | PR refs: #4954, #5417

Each authentication scheme gets its own module file in `api/src/auth/`. This
includes `api_jwt_auth.py`, `api_key_auth.py`, `internal_jwt_auth.py`,
`multi_auth.py`, and `auth_utils.py`.

**DO:**
```python
# From PR #5417 -- new internal JWT auth mechanism gets its own file
# api/src/auth/internal_jwt_auth.py
internal_jwt_auth = JwtUserHttpTokenAuth(
    "ApiKey", header="X-SGG-Internal-Token", security_scheme_name="InternalApiJwtAuth"
)
```

**DON'T:**
```python
# Anti-pattern -- cramming multiple auth mechanisms into one file
# api/src/auth/all_auth.py
api_jwt_auth = JwtUserHttpTokenAuth(...)
api_key_auth = HTTPTokenAuth(...)
internal_jwt_auth = JwtUserHttpTokenAuth(...)
```

> **Rationale:** Separation of concerns -- each auth scheme has its own
> `verify_token` handler, configuration, and test suite. This makes it
> straightforward to add or deprecate auth approaches independently.

---

#### Rule: Register Every Auth Scheme in `auth_utils.py`
**Confidence:** High
**Observed in:** 3 of 21 PRs (every PR adding a new auth mechanism) | PR refs: #5417, #6051

New auth mechanisms must be registered in `get_app_security_scheme()` in
`auth_utils.py` with their header name and OpenAPI scheme name.

**DO:**
```python
# From PR #5417 -- registering InternalApiJwtAuth alongside existing schemes
def get_app_security_scheme() -> dict[str, Any]:
    return {
        "ApiKeyAuth": {"type": "apiKey", "in": "header", "name": "X-Auth"},
        "ApiJwtAuth": {"type": "apiKey", "in": "header", "name": "X-SGG-Token"},
        "InternalApiJwtAuth": {"type": "apiKey", "in": "header", "name": "X-SGG-Internal-Token"},
    }
```

**DON'T:**
```python
# Anti-pattern -- defining security scheme only in the auth module without
# registering it centrally. The scheme will not appear in OpenAPI docs.
internal_jwt_auth = JwtUserHttpTokenAuth(
    "ApiKey", header="X-SGG-Internal-Token", security_scheme_name="InternalApiJwtAuth"
)
# Missing registration in get_app_security_scheme()
```

> **Rationale:** Centralizes OpenAPI security scheme definitions. Ensures all auth
> methods appear in generated API docs and are available for endpoint configuration.

---

#### Rule: Mirror Test Files for Auth Modules
**Confidence:** High
**Observed in:** 3 of 3 new auth module PRs (100%) | PR refs: #4954, #5417, #6051

Every new auth module must have a corresponding test file at
`api/tests/src/auth/test_{module_name}.py`.

**DO:**
```python
# From PR #5417 -- test file created alongside internal_jwt_auth.py
# api/tests/src/auth/test_internal_jwt_auth.py
class TestInternalJwtAuth:
    def test_valid_internal_token(self, mini_app, ...):
        ...
```

**DON'T:**
```python
# Anti-pattern -- adding auth tests to an existing unrelated test file
# api/tests/src/auth/test_api_jwt_auth.py
class TestInternalJwtAuth:  # Wrong file!
    ...
```

> **Rationale:** One-to-one test coverage. Each auth mechanism has distinct behavior
> that needs independent verification.

---

### Auth Testing

#### Rule: Mini-App Test Pattern for Auth
**Confidence:** High
**Observed in:** 3 of 3 new auth module test files (100%) | PR refs: #4954, #5417

Auth tests must use an isolated Flask mini-app fixture with dummy endpoints. The
fixture must monkeypatch `register_blueprints` and `setup_logging`, then yield
within a logging context.

**DO:**
```python
# From PR #4954 -- mini-app fixture for multi-auth testing
@pytest.fixture(scope="module")
def mini_app(monkeypatch_module):
    def stub(app):
        pass
    monkeypatch_module.setattr(app_entry, "register_blueprints", stub)
    monkeypatch_module.setattr(app_entry, "setup_logging", stub)
    mini_app = app_entry.create_app()

    @mini_app.get("/dummy_auth_endpoint")
    @mini_app.auth_required(jwt_or_key_multi_auth)
    def dummy_endpoint():
        user = jwt_or_key_multi_auth.get_user()
        return {"message": "ok", "auth_type": user.auth_type}

    with src.logging.init(__package__):
        yield mini_app
```

**DON'T:**
```python
# Anti-pattern -- testing auth against the full application with all blueprints
@pytest.fixture
def app():
    return create_app()  # Loads everything, slow and fragile
```

> **Rationale:** Tests auth in isolation, avoiding interference with other test
> fixtures or blueprints. Module scope ensures the mini-app is created once per
> test module for performance.

---

#### Rule: Auth Test Fixtures in `conftest.py`
**Confidence:** High
**Observed in:** Enforced in review | PR refs: #4954, #6051

Reusable auth token fixtures (`api_auth_token`, `user_auth_token`, `user_api_key`)
must be defined in `api/tests/conftest.py`, not inline in individual test files.

**DO:**
```python
# From PR #4954 -- test uses shared fixture from conftest.py
def test_multi_auth_happy_path(mini_app, enable_factory_create, db_session, api_auth_token):
    resp = mini_app.test_client().get(
        "/dummy_auth_endpoint", headers={"X-Auth": api_auth_token}
    )
    assert resp.status_code == 200
```

**DON'T:**
```python
# Anti-pattern -- creating auth tokens inline in individual test files
def test_multi_auth_happy_path(mini_app, enable_factory_create, db_session):
    token = create_api_key(db_session, "test-key")  # Duplicated setup
    resp = mini_app.test_client().get(
        "/dummy_auth_endpoint", headers={"X-Auth": token}
    )
```

> **Rationale:** Reduces duplication across test files. Ensures consistent auth
> token generation for all tests.

---

### Multi-Auth Composition

#### Rule: Multi-Auth via `MultiHttpTokenAuth` Constants
**Confidence:** High
**Observed in:** 4 of 21 PRs (growing pattern) | PR refs: #4954, #5015, #5434, #6051

Multi-auth compositions must be defined as module-level constants in `multi_auth.py`
using `MultiHttpTokenAuth`. Each composition must have a corresponding
`_security_schemes` constant for OpenAPI docs.

**DO:**
```python
# From PR #4954 -- module-level constant with paired security schemes
jwt_or_key_multi_auth = MultiHttpTokenAuth(api_jwt_auth, api_key_auth)
jwt_or_key_security_schemes = [
    api_jwt_auth.security_scheme_name, api_key_auth.security_scheme_name
]
```

**DON'T:**
```python
# Anti-pattern -- creating multi-auth objects inside route handlers
def my_route():
    auth = MultiHttpTokenAuth(api_jwt_auth, api_key_auth)  # Re-created per request
```

> **Rationale:** Module-level constants avoid re-creating auth objects per request.
> Paired security scheme lists keep OpenAPI docs in sync with actual auth behavior.

---

#### Rule: Multi-Auth Requires Flask Decorators, Not APIFlask
**Confidence:** High
**Observed in:** 4 of 21 PRs | PR refs: #4954, #5015, #5434, #6051

Multi-auth endpoints must use `@multi_auth.login_required` and
`@blueprint.doc(security=...)`. Never use `@blueprint.auth_required()` with
multi-auth -- APIFlask does not support it.

**DO:**
```python
# From PR #5434 -- correct multi-auth decorator usage
@application_blueprint.doc(
    responses=[200, 401, 404],
    security=jwt_key_or_internal_security_schemes,
)
@jwt_key_or_internal_multi_auth.login_required
@flask_db.with_db_session()
def application_form_get(db_session: db.Session, application_id: UUID, app_form_id: UUID):
    ...
```

**DON'T:**
```python
# Anti-pattern -- using APIFlask's auth_required with MultiAuth (will not parse)
@application_blueprint.auth_required(jwt_key_or_internal_multi_auth)
def application_form_get(...):
    ...
```

> **Rationale:** APIFlask's `auth_required` decorator expects a single auth scheme
> and cannot parse `MultiAuth`. Using Flask's native `login_required` with manual
> OpenAPI annotation is the documented workaround.

---

#### Rule: Get Authenticated User from Matching Multi-Auth Object
**Confidence:** High
**Observed in:** Enforced in 2+ reviews, bug source when violated | PR refs: #9155, #5015, #9114

Always call `.get_user()` on the same multi-auth object that decorates the endpoint.
Never use `api_jwt_auth.current_user` or `api_jwt_auth.get_user_token_session()`
on a multi-auth endpoint.

**DO:**
```python
# From PR #9114 -- correct: retrieve user from the multi-auth object
user = jwt_or_api_user_key_multi_auth.get_user()
```

**DON'T:**
```python
# Anti-pattern -- using JWT-only retrieval on a multi-auth endpoint
# This silently fails when the request uses API key auth
token_session = api_jwt_auth.get_user_token_session()
user = token_session.user
```

> **Rationale:** Using the wrong auth object to retrieve the user will silently fail
> when a request arrives via API key auth instead of JWT, causing runtime errors
> that are difficult to diagnose.

---

### User Type Discrimination

#### Rule: `MultiAuthUser` Dataclass with `isinstance()` Discrimination
**Confidence:** High
**Observed in:** 3 of 21 PRs | PR refs: #4954, #5434

Always use `isinstance()` checks on `MultiAuthUser.user` to determine auth type.
The `MultiAuthUser` union type must be extended when new auth mechanisms are added.

**DO:**
```python
# From PR #5434 -- type-safe discrimination of auth results
multi_auth_user = jwt_key_or_internal_multi_auth.get_user()
if isinstance(multi_auth_user.user, UserTokenSession):
    user = multi_auth_user.user.user
else:
    user = None  # Internal token, skip access checks
```

**DON'T:**
```python
# Anti-pattern -- checking auth_type string without isinstance
if multi_auth_user.auth_type == "jwt":
    user = multi_auth_user.user.user  # No type narrowing for linter
```

> **Rationale:** The `auth_type` StrEnum enables logging and branching, while
> `isinstance` checks enable type narrowing for the linter. Both are needed for
> type-safe auth handling.

---

### JWT Token Management

#### Rule: JWT Create/Parse Function Pairs
**Confidence:** High
**Observed in:** 2 auth modules | PR refs: #5417, #4378

Each JWT-based auth module must expose `create_jwt_for_{purpose}` and
`parse_jwt_for_{purpose}` function pairs. Create functions must generate a UUID
token_id, build claims, store a DB session record, and return
`(token_string, session_record)`.

**DO:**
```python
# From PR #5417 -- create/parse pair in internal_jwt_auth.py
def create_jwt_for_internal_token(
    expires_at: datetime, db_session: db.Session, config: ApiJwtConfig | None = None,
) -> Tuple[str, ShortLivedInternalToken]:
    token_id = uuid.uuid4()
    current_time = datetime_util.utcnow()
    short_lived_token = ShortLivedInternalToken(
        short_lived_internal_token_id=token_id, expires_at=expires_at, is_valid=True,
    )
    db_session.add(short_lived_token)
    payload = {
        "sub": str(token_id), "iat": current_time,
        "aud": config.audience, "iss": config.issuer,
    }
    return jwt.encode(payload, config.private_key, algorithm="RS256"), short_lived_token
```

**DON'T:**
```python
# Anti-pattern -- JWT creation without DB-backed session record
def create_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id}, SECRET_KEY)  # No revocation support
```

> **Rationale:** Symmetric create/parse ensures every JWT can be validated by the
> same module that created it. DB-backed sessions enable token revocation.

---

### Query Performance

#### Rule: Targeted `selectinload` for Auth Queries
**Confidence:** High
**Observed in:** 1 corrective PR, affects all auth queries going forward | PR refs: #5048

Never use `selectinload("*")` in auth queries. Always specify exact relationships.

**DO:**
```python
# From PR #5048 -- targeted relationship loading
.options(selectinload(UserTokenSession.user))
```

**DON'T:**
```python
# From PR #5048 -- anti-pattern that caused excessive queries
.options(selectinload("*"))
```

> **Rationale:** `selectinload("*")` recursively loads all relationships, causing
> excessive queries. The User model connects to saved opportunities, searches, etc.,
> creating an explosion of unnecessary data fetching. Reviewer noted: "I wouldn't be
> surprised if we see some faster API calls after this change."

---

### Logging

#### Rule: Flat Snake_Case Log Keys with `auth.` Prefix
**Confidence:** High
**Observed in:** 2 of 21 PRs (corrective) | PR refs: #4965, #5417

Use flat snake_case keys in `extra={}` log parameters. Never use dotted/nested keys.
Auth-specific fields may use the `auth.` prefix for New Relic distinction.

**DO:**
```python
# From PR #5417 -- auth-prefixed log fields
logger.info(
    "Internal JWT Authentication Failed for provided token",
    extra={"auth.issue": e.message},
)
```

**DON'T:**
```python
# From PR #4965 -- before correction
extra={"user.id": str(user_id), "opportunity.id": json_data["opportunity_id"]}
```

> **Rationale:** Flat keys enable cross-system log querying in New Relic. Dotted
> keys like `application.application_id` were inconsistent and harder to search.
> The `auth.` prefix is a deliberate exception for distinguishing auth token types
> in monitoring dashboards.

---

#### Rule: Use `logger.info()` for Expected Auth Failures
**Confidence:** High
**Observed in:** 2 of 21 PRs (corrective) | PR refs: #4936, #5417

Never use `logger.warning()` for expected authentication failures (401, 403).
Always use `logger.info()` with structured `extra={}` parameters.

**DO:**
```python
# From PR #5417 -- expected auth failure logged at info level
logger.info(
    "Internal JWT Authentication Failed for provided token",
    extra={"auth.issue": e.message},
)
```

**DON'T:**
```python
# Anti-pattern -- warning for expected auth failure triggers New Relic alerts
logger.warning("Authentication failed for user %s", user_id)
```

> **Rationale:** Warning-level logs trigger alerts in New Relic. Client auth failures
> (expired tokens, invalid credentials) are expected operational events, not system
> problems requiring immediate attention.

---

### Naming Conventions

#### Rule: Rename Classes to Avoid Ambiguity with DB Models (⏳)
**Confidence:** Medium
**Observed in:** 1 of 21 PRs | PR refs: #4954

Never name a dataclass `User` in auth modules. Always use a qualified name
(e.g., `ApiKeyUser`) to avoid confusion with the `User` database model.

**DO:**
```python
# From PR #4954 -- qualified name avoids confusion with User DB model
@dataclass
class ApiKeyUser:
    username: str
```

**DON'T:**
```python
# Anti-pattern -- ambiguous name conflicts with User DB model
@dataclass
class User:
    username: str
```

> **Rationale:** Prevents confusion between auth-context user objects and SQLAlchemy
> User models, especially when both appear in multi-auth code paths. Reviewer
> (chouinar): "I renamed this for now to avoid it having the same name as our User
> table objects which I found confusing."

---

#### Rule: Do Not Name Auth Classes After Infrastructure Providers
**Confidence:** High
**Observed in:** 1 of 21 PRs (enforced by reviewer) | PR refs: #6051

Never reference AWS, Login.gov, or other infrastructure provider names in auth class
names visible to API consumers.

**DO:**
```python
# From PR #6051 -- abstract name that does not reference infrastructure
class ApiUserKeyAuth(HTTPTokenAuth):
    ...
```

**DON'T:**
```python
# Anti-pattern -- leaks infrastructure details into public API
class ApiGatewayKeyAuth(HTTPTokenAuth):
    ...
```

> **Rationale:** API abstractions should not leak infrastructure details. If the
> underlying provider changes, the public API name should remain stable. Reviewer
> (chouinar): "the user/API should not care about the underlying infrastructure
> provider."

---

### Endpoint Security

#### Rule: Selective Auth for Sensitive Endpoints
**Confidence:** High
**Observed in:** 1 of 21 PRs (enforced by reviewer) | PR refs: #5434

Never add generic API key auth to endpoints that handle user-specific data (e.g.,
application forms). These must use user JWT auth or internal JWT auth only.

**DO:**
```python
# From PR #5434 -- sensitive endpoint excludes generic api_key_auth
jwt_key_or_internal_multi_auth = MultiHttpTokenAuth(api_jwt_auth, internal_jwt_auth)
```

**DON'T:**
```python
# Anti-pattern -- allowing generic API key auth on user-specific endpoint
all_auth = MultiHttpTokenAuth(api_jwt_auth, api_key_auth, internal_jwt_auth)
# api_key_auth has no user identity -- anyone with a key could access other users' data
```

> **Rationale:** Generic API keys are system-to-system credentials with no user
> identity. Allowing them on user-specific endpoints would bypass access control.
> Reviewer (chouinar): "We don't want our generic key auth to be valid for this.
> If we allow our generic keys, we'd be letting anyone who ever asked for a key be
> able to access other users applications."

---

#### Rule: Multi-Auth Default for New Endpoints
**Confidence:** High
**Observed in:** Enforced in 3+ reviews, all new endpoints since Jan 2026 | PR refs: #9114, #9155, #5015

New user-facing endpoints should default to `jwt_or_api_user_key_multi_auth` unless
there is a documented reason not to.

**DO:**
```python
# From PR #9114 -- new endpoint uses JWT + User API Key multi-auth
from src.auth.multi_auth import (
    jwt_or_api_user_key_multi_auth,
    jwt_or_api_user_key_security_schemes,
)

@user_blueprint.get("/<uuid:user_id>/saved-opportunities/notifications")
@user_blueprint.output(UserSavedOpportunityNotificationsResponseSchema)
@user_blueprint.doc(responses=[200, 401, 403], security=jwt_or_api_user_key_security_schemes)
@jwt_or_api_user_key_multi_auth.login_required
@flask_db.with_db_session()
def user_get_saved_opportunity_notifications(
    db_session: db.Session, user_id: UUID
) -> response.ApiResponse:
    ...
```

**DON'T:**
```python
# Anti-pattern -- using JWT-only auth on a new endpoint without justification
@user_blueprint.auth_required(api_jwt_auth)
def user_get_saved_opportunity_notifications(...):
    ...
```

> **Rationale:** Supporting both JWT and API key auth reduces friction for testing
> in staging environments. Reviewer (chouinar): "getting an API key is a lot easier
> than figuring out a JWT in staging if you want to call it directly for
> testing/demos."

---

## Anti-Patterns

### AP-1: Using `selectinload("*")` Wildcard
Never use `selectinload("*")` in queries. Always specify exact relationships to
load. The wildcard eagerly loads all relationships, causing excessive queries and
loading large portions of the database. (PR #5048)

### AP-2: Using `noload` for Relationships
Never use `noload` -- it forces values to `None` with unpredictable behaviors. Use
`lazyload` instead, which is the default. The SQLAlchemy docs recommend never using
`noload`. (PR #5048)

### AP-3: Both `auth_required` and `login_required` on Same Endpoint
Never have both `@blueprint.auth_required()` and `@multi_auth.login_required` on
the same endpoint. Only the latter should be used with multi-auth. (PR #5015)

### AP-4: Variable Text in Log Messages
Never embed dynamic values in log message strings. Always put them in `extra={}`
dict. Static messages enable log aggregation and count charts in New Relic.
(PRs #4936, #4965)

## Known Inconsistencies

### Multi-Auth Object Name Evolution
The multi-auth object naming evolved over time: `jwt_or_key_multi_auth` was the
original name, while `jwt_or_api_user_key_multi_auth` is the newer canonical name.
Older endpoints have not been migrated. Tech lead should clarify whether older
endpoints should be updated.

### `verify_access()` vs `check_user_access()` Duplication
The API has both `verify_access()` and `check_user_access()` performing overlapping
authorization work (flagged in PR #8632). Tech lead resolution is needed to
determine which is canonical.

## Related Documents

- **API Error Handling** -- `output/rules/api-error-handling.md` -- covers
  `raise_flask_error()`, `ValidationErrorDetail`, and HTTP status code conventions
  used in auth error responses.
- **API Routes** -- covers decorator stack order, thin route handlers, and
  transaction block patterns that auth integrates with.
- **API Services** -- covers `can_access()` / `verify_access()` authorization
  patterns used downstream of authentication.
- **Cross-Domain Synthesis** -- CCP-2 (log level discipline), CCP-4 (error
  contract), CCP-9 (no wildcard eager loading).
