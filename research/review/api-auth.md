# API Auth — Pattern Review

**Reviewer(s):** chouinar
**PRs analyzed:** 21
**Rules proposed:** 18 (15 patterns + 3 anti-patterns)
**Open questions:** 2

---

> **IMPORTANT: A note on inconsistencies**
>
> This extraction will surface patterns that are inconsistent — where the codebase
> does things two or three different ways. Some of these inconsistencies may be
> intentional (different contexts warranting different approaches) or evolutionary
> (the team moved from approach A to approach B but hasn't migrated everything).
>
> A big part of this review is resolving that ambiguity — deciding which patterns
> are canonical, which are legacy, and which represent intentional variation.
> Please don't assume that the most common pattern is automatically the right one.

---

## How to Review

For each pattern below, check one box and optionally add notes:
- **CONFIRMED** — This is the canonical pattern. Enforce it.
- **DEPRECATED** — This pattern is legacy. The correct approach is noted in your comments.
- **NEEDS NUANCE** — The rule is directionally correct but needs caveats or exceptions.
- **SPLIT** — This is actually two or more valid patterns for different contexts.

---

## Patterns

### 1. One Module Per Auth Mechanism

**Confidence:** High
**Frequency:** 21/21 PRs follow this structure; 3 PRs added new auth modules
**Source PRs:** #4954, #5417

**Proposed Rule:**
> ALWAYS create a separate module file in `api/src/auth/` for each distinct authentication mechanism.

**Rationale:**
Separation of concerns -- each auth scheme has its own verify_token handler, configuration, and test suite. Makes it straightforward to add or deprecate auth approaches independently.

**Code Examples:**
```python
# From PR #4954 — Multi-auth composition module
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

```python
# From PR #5417 — Internal JWT auth module
internal_jwt_auth = JwtUserHttpTokenAuth(
    "ApiKey", header="X-SGG-Internal-Token", security_scheme_name="InternalApiJwtAuth"
)
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 2. Register Every Auth Scheme in `auth_utils.py`

**Confidence:** High
**Frequency:** 3/21 PRs (every PR that added a new auth mechanism)
**Source PRs:** #5417

**Proposed Rule:**
> ALWAYS register new auth mechanisms in `get_app_security_scheme()` in `auth_utils.py` with their header name and OpenAPI scheme name.

**Rationale:**
Centralizes OpenAPI security scheme definitions. Ensures all auth methods appear in generated API docs and are available for endpoint configuration.

**Code Examples:**
```python
# From PR #5417 — Registering InternalApiJwtAuth
def get_app_security_scheme() -> dict[str, Any]:
    return {
        "ApiKeyAuth": {"type": "apiKey", "in": "header", "name": "X-Auth"},
        "ApiJwtAuth": {"type": "apiKey", "in": "header", "name": "X-SGG-Token"},
        "InternalApiJwtAuth": {"type": "apiKey", "in": "header", "name": "X-SGG-Internal-Token"},
    }
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 3. Mirror Test Files for Auth Modules

**Confidence:** High
**Frequency:** 3/3 new auth module PRs (100%)
**Source PRs:** #5417, #4954

**Proposed Rule:**
> ALWAYS create a corresponding `api/tests/src/auth/test_{module_name}.py` file for each new auth module.

**Rationale:**
One-to-one test coverage. Each auth mechanism has distinct behavior that needs independent verification.

**Code Examples:**
```python
# From PR #5417 — test_internal_jwt_auth.py created alongside internal_jwt_auth.py
```

```python
# From PR #4954 — test_multi_auth.py created alongside multi_auth.py
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 4. Mini-App Test Pattern for Auth

**Confidence:** High
**Frequency:** 3/3 new auth module test files (100%)
**Source PRs:** #4954, #5417

**Proposed Rule:**
> ALWAYS use an isolated Flask mini-app fixture with dummy endpoints when testing auth modules. The fixture MUST monkeypatch `register_blueprints` and `setup_logging`, then yield within a logging context.

**Rationale:**
Tests auth in isolation, avoiding interference with other test fixtures or blueprints. Module scope ensures the mini-app is created once per test module.

**Code Examples:**
```python
# From PR #4954 — test_multi_auth.py mini-app fixture
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

```python
# From PR #5417 — Same pattern for test_internal_jwt_auth.py, with @mini_app.auth_required(internal_jwt_auth).
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 5. Multi-Auth Composition via `MultiHttpTokenAuth`

**Confidence:** High
**Frequency:** 4/21 PRs (growing pattern)
**Source PRs:** #4954, #5434

**Proposed Rule:**
> ALWAYS define multi-auth compositions as module-level constants in `multi_auth.py` using `MultiHttpTokenAuth`. Each composition MUST have a corresponding `_security_schemes` constant for OpenAPI docs.

**Rationale:**
Module-level constants avoid re-creating auth objects per request. Paired security scheme lists keep OpenAPI docs in sync.

**Code Examples:**
```python
# From PR #4954 — Initial two-scheme composition
jwt_or_key_multi_auth = MultiHttpTokenAuth(api_jwt_auth, api_key_auth)
jwt_or_key_security_schemes = [api_jwt_auth.security_scheme_name, api_key_auth.security_scheme_name]
```

```python
# From PR #5434 — Three-scheme composition for internal use
jwt_key_or_internal_multi_auth = MultiHttpTokenAuth(api_jwt_auth, internal_jwt_auth)

jwt_key_or_internal_security_schemes = _get_security_requirement(
    [api_jwt_auth.security_scheme_name, internal_jwt_auth.security_scheme_name,]
)
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 6. Multi-Auth Requires Flask Decorators, Not APIFlask

**Confidence:** High
**Frequency:** 4/21 PRs
**Source PRs:** #5434, #4954

**Proposed Rule:**
> ALWAYS use `@multi_auth.login_required` and `@blueprint.doc(security=...)` for multi-auth endpoints. NEVER use `@blueprint.auth_required()` with multi-auth -- APIFlask does not support it.

**Rationale:**
APIFlask's `auth_required` decorator expects a single auth scheme and cannot parse `MultiAuth`. Using Flask's native `login_required` with manual OpenAPI annotation is the documented workaround.

**Code Examples:**
```python
# From PR #5434 — Switching endpoint to multi-auth
@application_blueprint.doc(responses=[200, 401, 404], security=jwt_key_or_internal_security_schemes)
@jwt_key_or_internal_multi_auth.login_required
@flask_db.with_db_session()
def application_form_get(db_session: db.Session, application_id: UUID, app_form_id: UUID):
    ...
```

```python
# From PR #4954 — Documentation in documentation/api/authentication.md
# Instead of doing @example_blueprint.auth_required(auth_class), do auth_class.login_required.
# This changes nothing about how the auth actually works, it just avoids APIFlask from trying to parse it.
```

**Conflicting Examples:**
None found. Open question: Will APIFlask ever add native multi-auth support?

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 7. `MultiAuthUser` Dataclass with Type Discrimination

**Confidence:** High
**Frequency:** 3/21 PRs
**Source PRs:** #5434

**Proposed Rule:**
> ALWAYS use `isinstance()` checks on `MultiAuthUser.user` to determine auth type after multi-auth. The `MultiAuthUser` union type MUST be extended when new auth mechanisms are added.

**Rationale:**
Type-safe discrimination of auth results. The `auth_type` StrEnum enables logging and branching, while `isinstance` checks enable type narrowing for the linter.

**Code Examples:**
```python
# From PR #5434 — Discriminating user types in a route handler
multi_auth_user = jwt_key_or_internal_multi_auth.get_user()
if isinstance(multi_auth_user.user, UserTokenSession):
    user = multi_auth_user.user.user
else:
    user = None  # Internal token, skip access checks
```

```python
# From PR #5434 — Extended union type
@dataclass
class MultiAuthUser:
    user: UserTokenSession | ApiKeyUser | ShortLivedInternalToken
    auth_type: AuthType
```

**Conflicting Examples:**
None found. Open question: As more auth types are added, will this scale or need a more generic dispatch mechanism?

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 8. JWT Create/Parse Function Pairs

**Confidence:** High
**Frequency:** 2 auth modules (api_jwt_auth, internal_jwt_auth)
**Source PRs:** #5417, #4378

**Proposed Rule:**
> ALWAYS expose `create_jwt_for_{purpose}` and `parse_jwt_for_{purpose}` function pairs in JWT auth modules. Create functions MUST generate a UUID token_id, build claims, store a DB session record, and return `(token_string, session_record)`.

**Rationale:**
Symmetric create/parse ensures every JWT can be validated by the same module that created it. DB-backed sessions enable revocation.

**Code Examples:**
```python
# From PR #5417 — internal_jwt_auth.py
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

```python
# From PR #4378 — api_jwt_auth.py adds session_duration_minutes to JWT payload
payload = {
    ...
    "session_duration_minutes": config.token_expiration_minutes,
}
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 9. Targeted `selectinload` for Auth Queries

**Confidence:** High
**Frequency:** 1 corrective PR (#5048), affects all auth queries going forward
**Source PRs:** #5048

**Proposed Rule:**
> NEVER use `selectinload("*")` in auth queries. ALWAYS specify exact relationships (e.g., `selectinload(UserTokenSession.user)`).

**Rationale:**
`selectinload("*")` recursively loads all relationships, causing excessive queries. The User model connects to saved opportunities, searches, etc., creating an explosion of unnecessary data fetching. Reviewer (chouinar) noted: "I wouldn't be surprised if we see some faster API calls after this change."

**Code Examples:**
```python
# From PR #5048 — Before (anti-pattern)
.options(selectinload("*"))

# After (correct)
.options(selectinload(UserTokenSession.user))
```

```python
# From PR #5048 — Same fix in login_gov_callback_handler
.options(selectinload(LinkExternalUser.user))
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 10. Flat Snake_Case Log Keys, with `auth.` Prefix for Auth-Specific Fields

**Confidence:** High
**Frequency:** 2/21 PRs (corrective); applies to all code going forward
**Source PRs:** #4965, #5417

**Proposed Rule:**
> ALWAYS use flat snake_case keys in `extra={}` log parameters (e.g., `user_id`, `application_id`). NEVER use dotted/nested keys (e.g., `application.application_id`). Auth-specific fields MAY use the `auth.` prefix (e.g., `auth.user_id`, `auth.token_id`) for New Relic distinction.

**Rationale:**
Flat keys enable cross-system log querying in New Relic. Dotted keys like `application.application_id` were inconsistent and harder to search. The `auth.` prefix is a deliberate exception for distinguishing auth token types in monitoring dashboards.

**Code Examples:**
```python
# From PR #4965 — Before
extra={"user.id": str(user_id), "opportunity.id": json_data["opportunity_id"]}

# After
extra={"user_id": user_id, "opportunity_id": json_data["opportunity_id"]}
```

```python
# From PR #5417 — Auth-prefixed log fields (reviewer-requested)
extra={"auth.short_lived_internal_token_id": str(token_id)}
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 11. Rename Classes to Avoid Ambiguity with DB Models

**Confidence:** Medium (1 instance, but clearly enforced)
**Frequency:** 1/21 PRs
**Source PRs:** #4954

**Proposed Rule:**
> NEVER name a dataclass `User` in auth modules. ALWAYS use a qualified name (e.g., `ApiKeyUser`) to avoid confusion with the `User` database model.

**Rationale:**
Prevents confusion between auth-context user objects and SQLAlchemy User models, especially when both appear in multi-auth code paths.

**Code Examples:**
```python
# From PR #4954 — Rename in api_key_auth.py
# Before
@dataclass
class User:
    username: str

# After
@dataclass
class ApiKeyUser:
    username: str
```

**Conflicting Examples:**
None found. Reviewer comment (chouinar): "I renamed this for now to avoid it having the same name as our User table objects which I found confusing."

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 12. Do Not Name Auth Classes After Infrastructure Providers

**Confidence:** High
**Frequency:** 1/21 PRs (enforced by reviewer)
**Source PRs:** #6051

**Proposed Rule:**
> NEVER reference AWS, Login.gov, or other infrastructure provider names in auth class names visible to API consumers. Use abstract names (e.g., `ApiUserKeyAuth` not `ApiGatewayKeyAuth`).

**Rationale:**
API abstractions should not leak infrastructure details. If the underlying provider changes, the public API name should remain stable.

**Code Examples:**
```python
# From PR #6051 — Reviewer (chouinar) renamed ApiGatewayKeyAuth to ApiUserKeyAuth
# because "the user/API should not care about the underlying infrastructure provider."
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 13. Selective Auth for Sensitive Endpoints

**Confidence:** High
**Frequency:** 1/21 PRs (enforced by reviewer in #5434)
**Source PRs:** #5434

**Proposed Rule:**
> NEVER add generic API key auth to endpoints that handle user-specific data (e.g., application forms). These MUST use user JWT auth or internal JWT auth only.

**Rationale:**
Generic API keys are system-to-system credentials with no user identity. Allowing them on user-specific endpoints would bypass access control.

**Code Examples:**
```python
# From PR #5434 — Reviewer (chouinar) blocked adding api_key_auth to application form endpoint:
# "We want this to be only JWT auth or internal key auth, we don't want our generic key auth
# to be valid for this. If we allow our generic keys, we'd be letting anyone who ever asked
# for a key be able to access other users applications."

# Resulting multi-auth composition excluded api_key_auth:
jwt_key_or_internal_multi_auth = MultiHttpTokenAuth(api_jwt_auth, internal_jwt_auth)
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 14. Use `logger.info()` for Expected Auth Failures, Not `logger.warning()`

**Confidence:** High
**Frequency:** 2/21 PRs (corrective); applies globally
**Source PRs:** #4936, #5417

**Proposed Rule:**
> NEVER use `logger.warning()` for expected authentication failures (401, 403). ALWAYS use `logger.info()` with structured `extra={}` parameters.

**Rationale:**
Warning-level logs trigger alerts in New Relic. Client auth failures (expired tokens, invalid credentials) are expected operational events, not system problems.

**Code Examples:**
```python
# From PR #4936 — Reviewer (chouinar): "Warning logs will alert us, we don't want to be alerted for 4xx errors."
```

```python
# From PR #5417 — Auth failure logged correctly
logger.info(
    "Internal JWT Authentication Failed for provided token",
    extra={"auth.issue": e.message}
)
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 15. Auth Test Fixtures in `conftest.py`

**Confidence:** High
**Frequency:** Enforced in review (PR #6051)
**Source PRs:** #4954, #6051

**Proposed Rule:**
> ALWAYS define reusable auth token fixtures (`api_auth_token`, `user_auth_token`, `user_api_key`) in `api/tests/conftest.py`, not inline in individual test files.

**Rationale:**
Reduces duplication across test files. Ensures consistent auth token generation for all tests.

**Code Examples:**
```python
# From PR #4954 — Test uses shared api_auth_token fixture
def test_multi_auth_happy_path(mini_app, enable_factory_create, db_session, api_auth_token):
    ...
    resp = mini_app.test_client().get("/dummy_auth_endpoint", headers={"X-Auth": api_auth_token})
    assert resp.status_code == 200
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 16. Anti-Pattern: Using `selectinload("*")` Wildcard

**Confidence:** High
**Frequency:** 1 corrective PR (#5048)
**Source PRs:** #5048

**Proposed Rule:**
> NEVER use `selectinload("*")` in queries. ALWAYS specify exact relationships to load.

**Rationale:**
Wildcard loading recursively loads all relationships, causing query explosion. See Pattern 9 for details.

**Code Examples:**
```python
# From PR #5048 — Before (anti-pattern)
.options(selectinload("*"))
# After (correct)
.options(selectinload(UserTokenSession.user))
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 17. Anti-Pattern: Using `noload` for Relationships

**Confidence:** High
**Frequency:** 1 corrective PR (#5048)
**Source PRs:** #5048

**Proposed Rule:**
> NEVER use `noload` -- it forces values to `None` with weird behaviors. Use `lazyload` instead, which is the default.

**Rationale:**
The SQLAlchemy docs recommend never using `noload`. It forces values to `None` silently, leading to hard-to-debug issues.

**Code Examples:**
```python
# From PR #5048 — Reviewer note: "the docs recommend never using it"
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 18. Anti-Pattern: Both `auth_required` and `login_required` on Same Endpoint

**Confidence:** High
**Frequency:** 1 corrective PR (#5015)
**Source PRs:** #5015

**Proposed Rule:**
> NEVER have both `@blueprint.auth_required()` and `@multi_auth.login_required` on the same endpoint. Only the latter should be used with multi-auth.

**Rationale:**
Having both decorators creates conflicting auth processing. Multi-auth endpoints must use only `@multi_auth.login_required` with manual `@blueprint.doc(security=...)`.

**Code Examples:**
```python
# From PR #5015 — Detected and corrected during review
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

## Coverage Gaps

1. **No documented strategy for auth scheme deprecation/migration.** The codebase has evolved from `jwt_or_key_multi_auth` to `jwt_or_api_user_key_multi_auth`, but there is no formal process for migrating older endpoints.

2. **No automated enforcement of auth naming conventions.** The ban on provider names in auth classes (Pattern 12) is enforced only by reviewer diligence.

3. **No guidance on `logger.error()` vs `logger.exception()` in auth code.** The `info` for 4xx rule is clear, but when auth code encounters actual server errors, the correct log level and method is not documented. (Cross-domain gap: GAP-5 from Pass 3)

## Inconsistencies Requiring Resolution

1. **Auth object name evolution (Cross-domain INC-4):** The multi-auth object naming evolved over time: `jwt_or_key_multi_auth` -> `jwt_or_api_user_key_multi_auth`. Older endpoints have not been migrated. Which is the current canonical name, and should older endpoints be migrated?

2. **Authorization utility duplication (Cross-domain INC-7):** The API has both `verify_access()` and `check_user_access()` doing overlapping work (flagged in PR #8632). Tech lead resolution is needed to determine which is canonical.
