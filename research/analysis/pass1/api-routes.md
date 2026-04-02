# Pattern Discovery: API Routes/Handlers (`api/src/api/`)

**Domain:** API route definitions, request/response handling, endpoint configuration
**Source:** 153 merged PRs from HHS/simpler-grants-gov (April 2025 -- March 2026)
**Analysis date:** 2026-03-27

---

## 1. Structural Patterns

### 1.1 Blueprint-per-Domain Organization

**Frequency:** Universal (every route file)
**Confidence:** High
**Trend:** Stable throughout the entire period

Each API domain gets its own directory under `api/src/api/` containing:
- `<domain>_blueprint.py` -- Flask/APIFlask blueprint definition
- `<domain>_routes.py` (or `<domain>_route.py`) -- route handler functions
- `<domain>_schemas.py` (or `<domain>_schema.py`) -- Marshmallow schemas for request/response

Observed domains: `agencies_v1`, `opportunities_v1`, `opportunities_grantor_v1`, `users`, `application_alpha`, `competition_alpha`, `form_alpha`, `organizations_v1`, `extracts_v1`.

**Exemplar PRs:** #4493 (agency search), #5611 (application form inclusion), #9114 (user saved opportunity notifications)

### 1.2 Separate Schema and Route Files

**Frequency:** Universal
**Confidence:** High
**Trend:** Stable

Schemas are always defined in a separate `*_schemas.py` or `*_schema.py` file from routes, never inline. Response schemas always extend `AbstractResponseSchema`. Request schemas extend `Schema`.

**Exemplar PRs:** #9114, #9256, #4493

### 1.3 Service Layer Separation

**Frequency:** Universal
**Confidence:** High
**Trend:** Strengthening -- reviewers explicitly push logic out of routes into services

Route handlers are thin. Business logic lives in `api/src/services/<domain>/` with one function per operation (e.g., `create_application.py`, `get_opportunity.py`, `submit_application.py`). Routes call service functions inside `with db_session.begin():` blocks.

Reviewer chouinar consistently enforces this. In PR #4513, they asked to move validation into the service function rather than keeping it in the route. In PR #5611, they pushed back on building custom response objects in the route, saying "Marshmallow can fetch the values out of the DB models."

**Exemplar PRs:** #4936 (submit_application service), #9114 (get_saved_opportunity_notification_preferences service), #5611

### 1.4 Test File per Route/Feature

**Frequency:** Universal
**Confidence:** High
**Trend:** Stable

Tests live in `api/tests/src/api/<domain>/` with one test file per feature or route group. Tests use factories (`tests/src/db/models/factories.py`) extensively to create test data.

**Exemplar PRs:** #9114, #9155, #7323

---

## 2. Route Handler Code Patterns

### 2.1 Decorator Stack Order

**Frequency:** Universal
**Confidence:** High
**Trend:** Stable

Every route handler follows this exact decorator order (top to bottom):

```python
@blueprint.METHOD("/path/<type:param>")
@blueprint.input(RequestSchema, location="json")       # if applicable
@blueprint.output(ResponseSchema)
@blueprint.doc(responses=[200, 401, ...], security=...) # if multi-auth
@auth_mechanism.login_required  OR  @blueprint.auth_required(auth)
@flask_db.with_db_session()
def handler_function(db_session: db.Session, ...) -> response.ApiResponse:
```

**Exemplar PRs:** #9114, #9155, #4936

### 2.2 Structured Logging with `add_extra_data_to_current_request_logs`

**Frequency:** Nearly universal (all non-trivial route handlers)
**Confidence:** High
**Trend:** Strengthening -- PR #4965 was a dedicated cleanup of log field naming

Every route handler calls `add_extra_data_to_current_request_logs({"entity_id": value})` before the first `logger.info()` call. This attaches request-scoped metadata to all subsequent log lines.

**Key naming convention (enforced in PR #4965):** Use flat field names like `application_id`, `user_id`, `opportunity_id` -- NOT nested names like `application.application_id` or `user.id`. Also, do NOT call `str()` on UUIDs; the logging framework handles serialization.

**Anti-pattern flagged:** Putting variable data in log message strings. Use `extra={}` instead. Reviewer chouinar in PR #4936: "To make it easier to look things up, we should try to avoid putting any variable text in the message."

**Exemplar PRs:** #4965, #4936, #9155

### 2.3 `response.ApiResponse` Return Type

**Frequency:** Universal
**Confidence:** High
**Trend:** Stable

All route handlers return `response.ApiResponse(message="Success", data=..., pagination_info=..., warnings=...)`. The `data` field is typically a DB model object that Marshmallow serializes automatically, NOT a manually constructed dict.

**Anti-pattern flagged:** Building custom response dicts in the route when the Marshmallow schema can dump the DB model directly (PR #5611, reviewer chouinar).

**Exemplar PRs:** #4936, #5611, #9114

### 2.4 `with db_session.begin():` Transaction Block

**Frequency:** Universal
**Confidence:** High
**Trend:** Stable

All database work inside route handlers is wrapped in `with db_session.begin():`. The service function is called inside this block.

```python
with db_session.begin():
    result = service_function(db_session, ...)
return response.ApiResponse(message="Success", data=result)
```

**Exemplar PRs:** #9114, #4936, #9256

### 2.5 Error Handling with `raise_flask_error`

**Frequency:** Universal for error cases
**Confidence:** High
**Trend:** Stable

Errors are raised via `from src.api.route_utils import raise_flask_error` with an HTTP status code and message. For validation errors, pass `validation_issues=[ValidationErrorDetail(...)]`.

**Anti-pattern flagged:** Using `logger.warning()` for 4xx errors. Reviewer chouinar in PR #4936: "Warning logs will alert us, we don't want to be alerted for 4xx errors." Use `logger.info()` instead with structured extra data.

**Exemplar PRs:** #4936, #9256, #9114

### 2.6 User Identity Verification Pattern

**Frequency:** All user-scoped endpoints
**Confidence:** High
**Trend:** Stable

For endpoints that operate on a specific user's data, verify the authenticated user matches the URL parameter:

```python
user = jwt_or_api_user_key_multi_auth.get_user()
if user.user_id != user_id:
    raise_flask_error(403, "Forbidden")
```

Earlier PRs used `api_jwt_auth.get_user_token_session()` and checked `user_token_session.user_id != user_id` with a 401 status. The later pattern uses the multi-auth helper and 403.

**Exemplar PRs:** #9114, #9155, #4989

---

## 3. Authentication Patterns

### 3.1 Default to JWT + User API Key Multi-Auth

**Frequency:** All new endpoints from late 2025 onward
**Confidence:** High
**Trend:** Strengthening -- explicitly requested by reviewers

New endpoints should support both JWT and User API Key authentication by default. This is done via:
```python
from src.auth.multi_auth import jwt_or_api_user_key_multi_auth, jwt_or_api_user_key_security_schemes

@blueprint.doc(security=jwt_or_api_user_key_security_schemes)
@jwt_or_api_user_key_multi_auth.login_required
```

Reviewer chouinar in PR #9114: "I'd suggest for any new endpoints, we make them support JWT + User API Key auth unless we have a strong reason not to. One major benefit of API key auth -- getting an API key is a lot easier than figuring out a JWT in staging."

Reviewer chouinar in PR #9155: "If there isn't a reason to not have a particular auth, can we default to having JWT + user api key auth on all our endpoints from now on?"

**Anti-pattern:** Using only `@blueprint.auth_required(api_jwt_auth)` on new user-facing endpoints. Also, using `@blueprint.auth_required()` combined with `@multi_auth.login_required` -- only the latter should be used (PR #5015).

**Exemplar PRs:** #9114, #9155, #5015

### 3.2 Getting the Authenticated User

**Frequency:** All authenticated endpoints
**Confidence:** High
**Trend:** Evolving -- moving toward `multi_auth.get_user()`

- **JWT-only endpoints:** `api_jwt_auth.get_user_token_session()` returns the `UserTokenSession`
- **API Key endpoints:** `api_user_key_auth.get_user()` returns the `User` directly (added in PR #7151)
- **Multi-auth endpoints:** `jwt_or_api_user_key_multi_auth.get_user()` returns the `User`

**Anti-pattern flagged:** Using `api_jwt_auth.current_user` directly when the endpoint uses multi-auth -- it only works for JWT, not API key auth (PR #9155, reviewer mikehgrantsgov).

**Exemplar PRs:** #9155, #7151, #5015

### 3.3 `db_session.add(user)` After Getting User from Auth

**Frequency:** Appears in multi-auth endpoints
**Confidence:** Medium
**Trend:** Emerging pattern in recent PRs

When getting a user from the auth system and then operating within a new `db_session.begin()` block, the user object must be added to the session:
```python
user = jwt_or_api_user_key_multi_auth.get_user()
with db_session.begin():
    db_session.add(user)
    result = service_function(db_session, user)
```

This is because the user object was loaded in a previous session context.

**Exemplar PRs:** #9114, #7151

---

## 4. Schema Patterns

### 4.1 Marshmallow Schema Conventions

**Frequency:** Universal
**Confidence:** High
**Trend:** Stable

- Response schemas extend `AbstractResponseSchema` and have a `data` field using `fields.Nested(DataSchema)`
- Request schemas extend `Schema` directly
- Fields include `metadata={"description": "...", "example": ...}` for OpenAPI docs
- UUID fields use `fields.UUID()` with no custom example needed (has a built-in default)
- Required fields must explicitly set `required=True` (default is `required=False`)
- Nullable required fields use `required=True, allow_none=True`

**Anti-pattern flagged:** Not marking fields as `required=True` when they are mandatory causes silent 500s instead of clean 422s (PR #9155, reviewer chouinar: "Default is `required=False` so if you did this, it would cause the endpoint to 500").

**Anti-pattern flagged:** Using string "False" instead of boolean `False` for example values in schema metadata (PR #4589, reviewer chouinar).

**Exemplar PRs:** #9155, #4589, #9256

### 4.2 `@validates_schema` for Cross-Field Validation

**Frequency:** Occasional (when needed)
**Confidence:** High
**Trend:** Stable

For validation rules that span multiple fields, use `@validates_schema`:
```python
@validates_schema
def validate_category_explanation(self, data: dict, **kwargs: dict) -> None:
    if data.get("category") == OpportunityCategory.OTHER:
        explanation = data.get("category_explanation", "")
        if explanation.strip() == "":
            raise ValidationError([MarshmallowErrorContainer(...)])
```

**Exemplar PRs:** #9256

### 4.3 Search/Filter Schema Builders

**Frequency:** All search/filter endpoints
**Confidence:** High
**Trend:** Stable

Search filter schemas use dedicated builder classes: `StrSearchSchemaBuilder`, `BoolSearchSchemaBuilder`, `IntegerSearchSchemaBuilder` from `src.api.schemas.search_schema`. These produce consistent filter structures across all search endpoints.

```python
class AgencySearchFilterV1Schema(Schema):
    has_active_opportunity = fields.Nested(
        BoolSearchSchemaBuilder("HasActiveOpportunityFilterV1Schema")
        .with_one_of(example=True)
        .build()
    )
```

**Anti-pattern flagged:** Not following the established filter pattern from opportunity search when building new search endpoints (PR #4493, reviewer chouinar).

**Exemplar PRs:** #4493, #4589, #7323

### 4.4 Pagination Schema Generation

**Frequency:** All list/search endpoints
**Confidence:** High
**Trend:** Stable

Pagination uses `generate_pagination_schema()` from `src.pagination.pagination_schema`:
```python
pagination = fields.Nested(
    generate_pagination_schema(
        "AgencySearchPaginationV1Schema",
        ["agency_code", "agency_name"],
        default_sort_order=[{"order_by": "agency_code", "sort_direction": "ascending"}],
    ),
    required=True,
)
```

The schema name must be unique across all endpoints to avoid OpenAPI conflicts.

**Exemplar PRs:** #4493, #7326

---

## 5. Service Layer Patterns

### 5.1 Pydantic Models for Service Input Validation

**Frequency:** Common in service functions
**Confidence:** High
**Trend:** Stable

Service functions often define a Pydantic `BaseModel` to validate and type their input:
```python
class OpportunityCreateRequest(BaseModel):
    opportunity_title: str
    category: OpportunityCategory
    assistance_listing_number: str

def create_opportunity(db_session, user, opportunity_data: dict) -> Opportunity:
    request = OpportunityCreateRequest.model_validate(opportunity_data)
```

**Exemplar PRs:** #9256, #9155, #4493

### 5.2 Soft Delete Pattern

**Frequency:** All user-facing delete operations (from PR #4989 onward)
**Confidence:** High
**Trend:** Established mid-2025, now standard

Deletes are implemented as soft deletes by setting `is_deleted = True` on the record rather than physically removing it. Queries must filter with `.where(Model.is_deleted.isnot(True))`.

Reviewer chouinar strongly prefers the "fetch then update" pattern over `UPDATE ... WHERE` queries because it validates exactly 0 or 1 records were affected, preventing accidental bulk updates.

**Exemplar PRs:** #4989

### 5.3 Audit Event Recording

**Frequency:** All write operations on applications (from PR #7034 onward)
**Confidence:** High
**Trend:** Established late 2025

All non-GET application endpoints add an audit event via `add_audit_event()` from `src.services.applications.application_audit`. This is called in the service layer, not the route, except for error cases that require a separate transaction.

**Exemplar PRs:** #7034

---

## 6. Corrective Patterns (Reviewer Enforced)

### 6.1 Keep Routes Thin, Push Logic to Services

Reviewer chouinar consistently pushes logic out of route handlers into service functions. Examples: validation logic (PR #4513), response building (PR #5611), access checks (PR #7151).

### 6.2 Boolean Naming Convention

Reviewer chouinar in PR #4493: Boolean fields should be named as "sorta-questions" using prefixes like `is_`, `has_`, `can_`, `was_`. Example: `has_active_opportunity` instead of `active`.

### 6.3 Do Not Delete Test Data in Fixtures

Reviewer chouinar in PR #4989: Tests should not rely on deleting all existing data and then counting results. Instead, query for specific records by their IDs. Use `cascade_delete_from_db_table` for cleanup if needed, but prefer specific queries in assertions.

### 6.4 Log Levels for Error Cases

- 4xx errors: Use `logger.info()` (not `.warning()`)
- 5xx errors: These are unexpected and will naturally produce error logs
- Warning logs trigger alerts in New Relic, so they should be reserved for actual operational concerns

### 6.5 Required vs Nullable in Marshmallow

`required` and `allow_none` are independent concepts. A field can be both `required=True` (must be present in the request) and `allow_none=True` (its value can be `null`). Failing to set `required=True` when a field is mandatory leads to silent 500 errors.

### 6.6 Schema Names Must Be Unique

When using `generate_pagination_schema()` or schema builders, the string name passed as the first argument must be globally unique. Duplicate names cause OpenAPI schema collisions. PR #4553 renamed schemas to fix this.

---

## 7. Anti-Patterns (Things to Avoid)

### 7.1 Variable Text in Log Messages

**Bad:** `logger.info(f"Processing application {application_id}")`
**Good:** `logger.info("Processing application", extra={"application_id": application_id})`

Variable text in messages makes log aggregation and searching harder in New Relic.

### 7.2 Using Both `auth_required` and `login_required`

When using multi-auth, only use `@multi_auth.login_required`, NOT `@blueprint.auth_required(auth)`. Using both causes conflicts (PR #5015).

### 7.3 Accessing `current_user` Directly from Wrong Auth Object

When using multi-auth (`jwt_or_api_user_key_multi_auth`), always call `.get_user()` on the multi-auth object, not on `api_jwt_auth` -- the latter only works for JWT-authenticated requests (PR #9155).

### 7.4 Building Custom Response Dicts in Routes

Let Marshmallow serialize DB model objects directly via `data=model_instance`. Do not manually build `{"field": model.field, ...}` dicts in route handlers (PR #5611).

### 7.5 Physical Deletes

Since PR #4989, all user-facing deletes should be soft deletes. Physical deletes (`db_session.delete()`) are only for internal/migration operations.

---

## 8. Conflicts / Multiple Approaches

### 8.1 Auth Header Names

Two different auth headers are in use:
- `X-Auth` -- used for the older API key auth (`api_key_auth`)
- `X-SGG-Token` -- used for JWT auth (`api_jwt_auth`)
- `X-API-Key` -- used for User API Key auth (`api_user_key_auth`)

This is an intentional evolution, not a conflict. New endpoints should use JWT + User API Key (the latter two).

### 8.2 File Naming: Singular vs Plural

Some domains use singular (`agency_schema.py`, `competition_route.py`) while others use plural (`opportunity_routes.py`, `user_routes.py`). This inconsistency exists but is not actively being corrected.

### 8.3 Schema Naming: `Schema` Suffix Consistency

Some schema files use `*_schema.py` (agencies, competition, extract, form) while others use `*_schemas.py` (opportunities, users, applications). Both patterns coexist.

### 8.4 `auth_required` vs `login_required`

For single-auth endpoints, `@blueprint.auth_required(auth_obj)` is used. For multi-auth endpoints, `@multi_auth.login_required` with `@blueprint.doc(security=...)` is used. These are different patterns for different needs, not a conflict, but new developers need to know which to use.

---

## 9. Evolution Timeline

| Period | Key Changes |
|--------|------------|
| Apr 2025 | UUID migration for primary keys (PRs #4316, #4392), initial route patterns established |
| May 2025 | JWT auth replaces API key auth for application endpoints (PR #5015), log naming standardized (PR #4965) |
| Jul 2025 | Major UUID migration for opportunities (PR #5621), legacy ID support added |
| Nov-Dec 2025 | Audit events added to all write operations (PR #7034), pagination added to list endpoints (PR #7326), User API Key auth introduced (PR #7151) |
| Jan-Mar 2026 | JWT + User API Key multi-auth becomes the default for new endpoints (PRs #9114, #9155), grantor endpoints added (PR #9256) |

---

## 10. Summary: What a New Developer Needs to Know

1. **Follow the decorator stack order exactly** (route, input, output, doc, auth, db_session).
2. **Use `jwt_or_api_user_key_multi_auth`** for auth on new endpoints unless you have a strong reason not to.
3. **Keep routes thin** -- all business logic goes in service functions under `src/services/`.
4. **Return `response.ApiResponse`** with the DB model as `data` and let Marshmallow serialize it.
5. **Wrap DB calls in `with db_session.begin():`** and call service functions inside this block.
6. **Use `add_extra_data_to_current_request_logs`** with flat field names before logging.
7. **Mark required schema fields as `required=True`** explicitly; the default is `False`.
8. **Use `raise_flask_error`** for error responses; log 4xx at info level, not warning.
9. **Use soft deletes** (`is_deleted = True`) for user-facing delete operations.
10. **Name boolean fields as questions** (`is_active`, `has_opportunity`, etc.).
