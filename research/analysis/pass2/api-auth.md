# Pass 2: Pattern Codification -- API Auth (`api/src/auth/`)

**Source:** 21 merged PRs, 10 sampled in detail
**Date range:** 2025-03-31 to 2025-10-02
**Primary authors:** chouinar, mikehgrantsgov, mdragon, babebe

---

## Pattern 1: One Module Per Auth Mechanism

**Rule Statement:** ALWAYS create a separate module file in `api/src/auth/` for each distinct authentication mechanism.

**Confidence:** High
**Frequency:** 21/21 PRs follow this structure; 3 PRs added new auth modules

**Code Examples:**

1. PR #4954 -- Added `api/src/auth/multi_auth.py` for multi-auth composition:
```python
from flask_httpauth import MultiAuth
from .api_jwt_auth import api_jwt_auth
from .api_key_auth import ApiKeyUser, api_key_auth

class MultiHttpTokenAuth(MultiAuth):
    def get_user(self) -> MultiAuthUser:
        current_user = self.current_user()
        if isinstance(current_user, ApiKeyUser):
            return MultiAuthUser(current_user, AuthType.API_KEY_AUTH)
        elif isinstance(current_user, UserTokenSession):
            return MultiAuthUser(current_user, AuthType.USER_JWT_AUTH)
        raise Exception("Unknown user type %s", type(current_user))
```

2. PR #5417 -- Added `api/src/auth/internal_jwt_auth.py` for short-lived internal tokens:
```python
internal_jwt_auth = JwtUserHttpTokenAuth(
    "ApiKey", header="X-SGG-Internal-Token", security_scheme_name="InternalApiJwtAuth"
)
```

**Rationale:** Separation of concerns -- each auth scheme has its own verify_token handler, configuration, and test suite. Makes it straightforward to add or deprecate auth approaches independently.

**Open Questions:** None. This pattern is fully established.

---

## Pattern 2: Register Every Auth Scheme in `auth_utils.py`

**Rule Statement:** ALWAYS register new auth mechanisms in `get_app_security_scheme()` in `auth_utils.py` with their header name and OpenAPI scheme name.

**Confidence:** High
**Frequency:** 3/21 PRs (every PR that added a new auth mechanism)

**Code Examples:**

1. PR #5417 -- Registering InternalApiJwtAuth:
```python
def get_app_security_scheme() -> dict[str, Any]:
    return {
        "ApiKeyAuth": {"type": "apiKey", "in": "header", "name": "X-Auth"},
        "ApiJwtAuth": {"type": "apiKey", "in": "header", "name": "X-SGG-Token"},
        "InternalApiJwtAuth": {"type": "apiKey", "in": "header", "name": "X-SGG-Internal-Token"},
    }
```

**Rationale:** Centralizes OpenAPI security scheme definitions. Ensures all auth methods appear in generated API docs and are available for endpoint configuration.

**Open Questions:** None.

---

## Pattern 3: Mirror Test Files for Auth Modules

**Rule Statement:** ALWAYS create a corresponding `api/tests/src/auth/test_{module_name}.py` file for each new auth module.

**Confidence:** High
**Frequency:** 3/3 new auth module PRs (100%)

**Code Examples:**

1. PR #5417 -- `api/tests/src/auth/test_internal_jwt_auth.py` created alongside `internal_jwt_auth.py`
2. PR #4954 -- `api/tests/src/auth/test_multi_auth.py` created alongside `multi_auth.py`

**Rationale:** One-to-one test coverage. Each auth mechanism has distinct behavior that needs independent verification.

**Open Questions:** None.

---

## Pattern 4: Mini-App Test Pattern for Auth

**Rule Statement:** ALWAYS use an isolated Flask mini-app fixture with dummy endpoints when testing auth modules. The fixture MUST monkeypatch `register_blueprints` and `setup_logging`, then yield within a logging context.

**Confidence:** High
**Frequency:** 3/3 new auth module test files (100%)

**Code Examples:**

1. PR #4954 -- `test_multi_auth.py`:
```python
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

2. PR #5417 -- Same pattern for `test_internal_jwt_auth.py`, with `@mini_app.auth_required(internal_jwt_auth)`.

**Rationale:** Tests auth in isolation, avoiding interference with other test fixtures or blueprints. Module scope ensures the mini-app is created once per test module.

**Open Questions:** None.

---

## Pattern 5: Multi-Auth Composition via `MultiHttpTokenAuth`

**Rule Statement:** ALWAYS define multi-auth compositions as module-level constants in `multi_auth.py` using `MultiHttpTokenAuth`. Each composition MUST have a corresponding `_security_schemes` constant for OpenAPI docs.

**Confidence:** High
**Frequency:** 4/21 PRs (growing pattern)

**Code Examples:**

1. PR #4954 -- Initial two-scheme composition:
```python
jwt_or_key_multi_auth = MultiHttpTokenAuth(api_jwt_auth, api_key_auth)
jwt_or_key_security_schemes = [api_jwt_auth.security_scheme_name, api_key_auth.security_scheme_name]
```

2. PR #5434 -- Three-scheme composition for internal use:
```python
jwt_key_or_internal_multi_auth = MultiHttpTokenAuth(api_jwt_auth, internal_jwt_auth)

jwt_key_or_internal_security_schemes = _get_security_requirement(
    [api_jwt_auth.security_scheme_name, internal_jwt_auth.security_scheme_name,]
)
```

**Rationale:** Module-level constants avoid re-creating auth objects per request. Paired security scheme lists keep OpenAPI docs in sync.

**Open Questions:** None.

---

## Pattern 6: Multi-Auth Requires Flask Decorators, Not APIFlask

**Rule Statement:** ALWAYS use `@multi_auth.login_required` and `@blueprint.doc(security=...)` for multi-auth endpoints. NEVER use `@blueprint.auth_required()` with multi-auth -- APIFlask does not support it.

**Confidence:** High
**Frequency:** 4/21 PRs

**Code Examples:**

1. PR #5434 -- Switching endpoint to multi-auth:
```python
@application_blueprint.doc(responses=[200, 401, 404], security=jwt_key_or_internal_security_schemes)
@jwt_key_or_internal_multi_auth.login_required
@flask_db.with_db_session()
def application_form_get(db_session: db.Session, application_id: UUID, app_form_id: UUID):
    ...
```

2. PR #4954 -- Documentation in `documentation/api/authentication.md`:
```
Instead of doing @example_blueprint.auth_required(auth_class), do auth_class.login_required.
This changes nothing about how the auth actually works, it just avoids APIFlask from trying to parse it.
```

**Rationale:** APIFlask's `auth_required` decorator expects a single auth scheme and cannot parse `MultiAuth`. Using Flask's native `login_required` with manual OpenAPI annotation is the documented workaround.

**Open Questions:** Will APIFlask ever add native multi-auth support?

---

## Pattern 7: `MultiAuthUser` Dataclass with Type Discrimination

**Rule Statement:** ALWAYS use `isinstance()` checks on `MultiAuthUser.user` to determine auth type after multi-auth. The `MultiAuthUser` union type MUST be extended when new auth mechanisms are added.

**Confidence:** High
**Frequency:** 3/21 PRs

**Code Examples:**

1. PR #5434 -- Discriminating user types in a route handler:
```python
multi_auth_user = jwt_key_or_internal_multi_auth.get_user()
if isinstance(multi_auth_user.user, UserTokenSession):
    user = multi_auth_user.user.user
else:
    user = None  # Internal token, skip access checks
```

2. PR #5434 -- Extended union type:
```python
@dataclass
class MultiAuthUser:
    user: UserTokenSession | ApiKeyUser | ShortLivedInternalToken
    auth_type: AuthType
```

**Rationale:** Type-safe discrimination of auth results. The `auth_type` StrEnum enables logging and branching, while `isinstance` checks enable type narrowing for the linter.

**Open Questions:** As more auth types are added, will this scale or need a more generic dispatch mechanism?

---

## Pattern 8: JWT Create/Parse Function Pairs

**Rule Statement:** ALWAYS expose `create_jwt_for_{purpose}` and `parse_jwt_for_{purpose}` function pairs in JWT auth modules. Create functions MUST generate a UUID token_id, build claims, store a DB session record, and return `(token_string, session_record)`.

**Confidence:** High
**Frequency:** 2 auth modules (api_jwt_auth, internal_jwt_auth)

**Code Examples:**

1. PR #5417 -- `internal_jwt_auth.py`:
```python
def create_jwt_for_internal_token(
    expires_at: datetime, db_session: db.Session, config: ApiJwtConfig | None = None,
) -> Tuple[str, ShortLivedInternalToken]:
    token_id = uuid.uuid4()
    current_time = datetime_util.utcnow()
    short_lived_token = ShortLivedInternalToken(
        short_lived_internal_token_id=token_id, expires_at=expires_at, is_valid=True,
    )
    db_session.add(short_lived_token)
    payload = {"sub": str(token_id), "iat": current_time, "aud": config.audience, "iss": config.issuer}
    return jwt.encode(payload, config.private_key, algorithm="RS256"), short_lived_token
```

2. PR #4378 -- `api_jwt_auth.py` adds `session_duration_minutes` to JWT payload for frontend:
```python
payload = {
    ...
    "session_duration_minutes": config.token_expiration_minutes,
}
```

**Rationale:** Symmetric create/parse ensures every JWT can be validated by the same module that created it. DB-backed sessions enable revocation.

**Open Questions:** None.

---

## Pattern 9: Targeted `selectinload` for Auth Queries

**Rule Statement:** NEVER use `selectinload("*")` in auth queries. ALWAYS specify exact relationships (e.g., `selectinload(UserTokenSession.user)`).

**Confidence:** High
**Frequency:** 1 corrective PR (#5048), affects all auth queries going forward

**Code Examples:**

1. PR #5048 -- Before (anti-pattern):
```python
.options(selectinload("*"))
```
After (correct):
```python
.options(selectinload(UserTokenSession.user))
```

2. PR #5048 -- Same fix in login_gov_callback_handler:
```python
.options(selectinload(LinkExternalUser.user))
```

**Rationale:** `selectinload("*")` recursively loads all relationships, causing excessive queries. The User model connects to saved opportunities, searches, etc., creating an explosion of unnecessary data fetching. Reviewer (chouinar) noted: "I wouldn't be surprised if we see some faster API calls after this change."

**Open Questions:** None.

---

## Pattern 10: Flat Snake_Case Log Keys, with `auth.` Prefix for Auth-Specific Fields

**Rule Statement:** ALWAYS use flat snake_case keys in `extra={}` log parameters (e.g., `user_id`, `application_id`). NEVER use dotted/nested keys (e.g., `application.application_id`). Auth-specific fields MAY use the `auth.` prefix (e.g., `auth.user_id`, `auth.token_id`) for New Relic distinction.

**Confidence:** High
**Frequency:** 2/21 PRs (corrective); applies to all code going forward

**Code Examples:**

1. PR #4965 -- Before:
```python
extra={"user.id": str(user_id), "opportunity.id": json_data["opportunity_id"]}
```
After:
```python
extra={"user_id": user_id, "opportunity_id": json_data["opportunity_id"]}
```

2. PR #5417 -- Auth-prefixed log fields (reviewer-requested):
```python
extra={"auth.short_lived_internal_token_id": str(token_id)}
```

**Rationale:** Flat keys enable cross-system log querying in New Relic. Dotted keys like `application.application_id` were inconsistent and harder to search. The `auth.` prefix is a deliberate exception for distinguishing auth token types in monitoring dashboards.

**Open Questions:** None.

---

## Pattern 11: Rename Classes to Avoid Ambiguity with DB Models

**Rule Statement:** NEVER name a dataclass `User` in auth modules. ALWAYS use a qualified name (e.g., `ApiKeyUser`) to avoid confusion with the `User` database model.

**Confidence:** Medium (1 instance, but clearly enforced)
**Frequency:** 1/21 PRs

**Code Examples:**

1. PR #4954 -- Rename in `api_key_auth.py`:
```python
# Before
@dataclass
class User:
    username: str

# After
@dataclass
class ApiKeyUser:
    username: str
```
Reviewer comment (chouinar): "I renamed this for now to avoid it having the same name as our User table objects which I found confusing."

**Rationale:** Prevents confusion between auth-context user objects and SQLAlchemy User models, especially when both appear in multi-auth code paths.

**Open Questions:** None.

---

## Pattern 12: Do Not Name Auth Classes After Infrastructure Providers

**Rule Statement:** NEVER reference AWS, Login.gov, or other infrastructure provider names in auth class names visible to API consumers. Use abstract names (e.g., `ApiUserKeyAuth` not `ApiGatewayKeyAuth`).

**Confidence:** High
**Frequency:** 1/21 PRs (enforced by reviewer)

**Code Examples:**

1. PR #6051 -- Reviewer (chouinar) renamed `ApiGatewayKeyAuth` to `ApiUserKeyAuth` because "the user/API should not care about the underlying infrastructure provider."

**Rationale:** API abstractions should not leak infrastructure details. If the underlying provider changes, the public API name should remain stable.

**Open Questions:** None.

---

## Pattern 13: Selective Auth for Sensitive Endpoints

**Rule Statement:** NEVER add generic API key auth to endpoints that handle user-specific data (e.g., application forms). These MUST use user JWT auth or internal JWT auth only.

**Confidence:** High
**Frequency:** 1/21 PRs (enforced by reviewer in #5434)

**Code Examples:**

1. PR #5434 -- Reviewer (chouinar) blocked adding `api_key_auth` to application form endpoint:
```
We want this to be only JWT auth or internal key auth, we don't want our generic key auth to be valid for this.
If we allow our generic keys, we'd be letting anyone who ever asked for a key be able to access other users applications.
```

Resulting multi-auth composition excluded `api_key_auth`:
```python
jwt_key_or_internal_multi_auth = MultiHttpTokenAuth(api_jwt_auth, internal_jwt_auth)
```

**Rationale:** Generic API keys are system-to-system credentials with no user identity. Allowing them on user-specific endpoints would bypass access control.

**Open Questions:** None.

---

## Pattern 14: Use `logger.info()` for Expected Auth Failures, Not `logger.warning()`

**Rule Statement:** NEVER use `logger.warning()` for expected authentication failures (401, 403). ALWAYS use `logger.info()` with structured `extra={}` parameters.

**Confidence:** High
**Frequency:** 2/21 PRs (corrective); applies globally

**Code Examples:**

1. PR #4936 -- Reviewer (chouinar): "Warning logs will alert us, we don't want to be alerted for 4xx errors."
2. PR #5417 -- Auth failure logged correctly:
```python
logger.info(
    "Internal JWT Authentication Failed for provided token",
    extra={"auth.issue": e.message}
)
```

**Rationale:** Warning-level logs trigger alerts in New Relic. Client auth failures (expired tokens, invalid credentials) are expected operational events, not system problems.

**Open Questions:** None.

---

## Pattern 15: Auth Test Fixtures in `conftest.py`

**Rule Statement:** ALWAYS define reusable auth token fixtures (`api_auth_token`, `user_auth_token`, `user_api_key`) in `api/tests/conftest.py`, not inline in individual test files.

**Confidence:** High
**Frequency:** Enforced in review (PR #6051)

**Code Examples:**

1. PR #4954 -- Test uses shared `api_auth_token` fixture:
```python
def test_multi_auth_happy_path(mini_app, enable_factory_create, db_session, api_auth_token):
    ...
    resp = mini_app.test_client().get("/dummy_auth_endpoint", headers={"X-Auth": api_auth_token})
    assert resp.status_code == 200
```

**Rationale:** Reduces duplication across test files. Ensures consistent auth token generation for all tests.

**Open Questions:** None.

---

## Anti-Patterns

### AP-1: Using `selectinload("*")` wildcard
**Rule Statement:** NEVER use `selectinload("*")` in queries. ALWAYS specify exact relationships to load.
**Confidence:** High (PR #5048)

### AP-2: Using `noload` for relationships
**Rule Statement:** NEVER use `noload` -- it forces values to `None` with weird behaviors. Use `lazyload` instead, which is the default.
**Confidence:** High (PR #5048, reviewer note: "the docs recommend never using it")

### AP-3: Both `auth_required` and `login_required` on same endpoint
**Rule Statement:** NEVER have both `@blueprint.auth_required()` and `@multi_auth.login_required` on the same endpoint. Only the latter should be used with multi-auth.
**Confidence:** High (PR #5015)

### AP-4: Variable text in log messages
**Rule Statement:** NEVER embed dynamic values in log message strings. ALWAYS put them in `extra={}` dict.
**Confidence:** High (PR #4936, #4965)
