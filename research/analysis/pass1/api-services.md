# Pattern Discovery: API Services Layer (`api/src/services/`)

**Source:** 231 merged PRs from HHS/simpler-grants-gov
**Analysis Date:** 2026-03-27
**Domain:** `api/src/services/` -- service layer code patterns

---

## 1. Structural Patterns

### 1.1 Service Files Are Organized by Domain, One Function Per File

**Frequency:** Very high (~80% of service PRs)
**Confidence:** High
**Trend:** Consistent throughout the project lifetime

Service code lives in domain-specific subdirectories under `api/src/services/`. Each service file typically contains one primary public function (the service entry point) plus any private helper functions prefixed with `_`.

Directory examples:
- `api/src/services/opportunities_v1/` -- opportunity search, versioning
- `api/src/services/applications/` -- create, update, get, submit, attachments
- `api/src/services/organizations_v1/` -- user management, roles, removal
- `api/src/services/users/` -- login, saved opportunities, profiles
- `api/src/services/agencies_v1/` -- search, listing
- `api/src/services/xml_generation/` -- XML generation with sub-packages for transformers, utils, validation
- `api/src/services/legacy_users/` -- legacy system utilities

**Exemplar PRs:** #4528 (legacy_users/utils.py), #6651 (remove_user_from_organization.py), #8620 (opportunity_update.py)

### 1.2 Service Functions Accept `db_session` as First Parameter

**Frequency:** Very high (~90% of service functions)
**Confidence:** High
**Trend:** Consistent

Nearly every service function takes `db_session: db.Session` as its first argument. The session is passed down from the route handler, which obtains it via the `@flask_db.with_db_session()` decorator.

```python
def update_opportunity(
    db_session: db.Session, user: User, opportunity_id: uuid.UUID, opportunity_data: dict
) -> Opportunity:
```

**Exemplar PRs:** #4314 (update_application_form), #8620 (opportunity_update), #6651 (remove_user_from_organization)

### 1.3 Route Layer Handles Transaction Boundaries, Not Services

**Frequency:** High (~70% of route handlers)
**Confidence:** High
**Trend:** Increasing -- reviewer explicitly enforces this

Route handlers wrap service calls in `with db_session.begin():` blocks. Services operate within that transaction but do not manage commits themselves. The reviewer (chouinar) specifically asked contributors to add `with self.db_session.begin():` wrappers for Task classes too (PR #4550).

```python
with db_session.begin():
    db_session.add(user_token_session)
    opportunity = update_opportunity(db_session, user, opportunity_id, json_data)
```

**Exemplar PRs:** #4550 (reviewer comment about begin()), #6645 (create_application routes), #8620 (opportunity_update route)

### 1.4 Shared Utilities Are Extracted to `_utils.py` or `service_utils.py`

**Frequency:** Medium (~15 PRs)
**Confidence:** High
**Trend:** Increasing -- reviewers actively request extraction of shared logic

When two service modules need the same helper, it gets extracted to a shared utilities file:
- `api/src/services/service_utils.py` -- shared search filter logic
- `api/src/services/organizations_v1/organization_user_utils.py` -- shared org-user validation
- `api/src/services/opportunities_grantor_v1/opportunity_utils.py` -- shared opportunity validation
- `api/src/util/sam_gov_utils.py` -- shared SAM.gov entity linking

Reviewer explicitly requested extraction in PRs #6651, #4493, #5385, and #8620.

**Exemplar PRs:** #6651 (organization_user_utils), #4493 (service_utils), #8620 (opportunity_utils)

---

## 2. Code Patterns

### 2.1 Standard Logger Setup Per Module

**Frequency:** Very high (every service file)
**Confidence:** High
**Trend:** Consistent

Every service file starts with:
```python
import logging
logger = logging.getLogger(__name__)
```

**Exemplar PRs:** #4528, #5385, #6651

### 2.2 Error Handling via `raise_flask_error()`

**Frequency:** Very high (~85% of service functions with error cases)
**Confidence:** High
**Trend:** Consistent

Services use `raise_flask_error(status_code, message)` from `src.api.route_utils` for HTTP-level errors (404, 403, 422). They do NOT raise raw exceptions or return error tuples.

```python
if not application:
    raise_flask_error(404, f"Application with ID {application_id} not found")
```

**Exemplar PRs:** #4314 (404 for missing form), #6651 (404 for missing user), #8620 (422 for non-draft)

### 2.3 SQLAlchemy `select()` + `scalar_one_or_none()` for Single Record Lookups

**Frequency:** Very high
**Confidence:** High
**Trend:** Consistent

Pattern for fetching a single record or returning None:
```python
result = db_session.execute(
    select(Model).where(Model.id == some_id)
).scalar_one_or_none()

if not result:
    raise_flask_error(404, "Not found message")
```

**Exemplar PRs:** #4314 (form lookup), #5385 (SAM entity lookup), #6651 (org user validation)

### 2.4 `selectinload()` for Eager Loading Relationships

**Frequency:** High (~25+ PRs)
**Confidence:** High
**Trend:** Increasing -- reviewer explicitly enforces this and warns against `selectinload("*")`

Services explicitly specify which relationships to eagerly load. The reviewer (chouinar) explicitly warned against `selectinload("*")` in PR #8620 because it loads everything unnecessarily.

```python
select(Application)
    .options(selectinload(Application.application_forms))
    .options(selectinload(Application.application_users))
```

**Exemplar PRs:** #4550 (task with selectinload), #6714 (get_application with auth), #8620 (reviewer warning against selectinload("*"))

### 2.5 Pydantic `BaseModel` for Service Input Parameters

**Frequency:** High (~15+ search/filter service files)
**Confidence:** High
**Trend:** Consistent

Search/filter parameters are modeled as Pydantic BaseModel classes within service files:
```python
class OpportunityFilters(BaseModel):
    funding_applicant_type: StrSearchFilter | None = None
    opportunity_status: StrSearchFilter | None = None
    agency: StrSearchFilter | None = None

class SearchOpportunityParams(BaseModel):
    pagination: PaginationParams
    filters: OpportunityFilters | None = Field(default=None)
    query: str | None = None
```

**Exemplar PRs:** #4493 (AgencySearchParams), #4553 (pagination params), #5420 (filter params)

### 2.6 RBAC Pattern: `can_access()` / `verify_access()` for Authorization

**Frequency:** High (~15+ PRs, all recent organization/grantor work)
**Confidence:** High
**Trend:** Increasing -- replacing older manual membership checks

Authorization uses a centralized `can_access()` or `verify_access()` utility from `src.auth.endpoint_access_util`. The reviewer explicitly requested replacing manual membership validation with this approach.

```python
verify_access(user, {Privilege.UPDATE_OPPORTUNITY}, opportunity.agency_record)
```

The old pattern (`_validate_organization_membership` with direct DB queries) was removed in PR #6645 in favor of `can_access()`.

**Exemplar PRs:** #6645 (replacing manual check with can_access), #6651 (remove user requires MANAGE_ORG_MEMBERS), #8620 (verify_access for update)

### 2.7 Service Functions Return Domain Objects, Not Dicts

**Frequency:** High
**Confidence:** High
**Trend:** Consistent

Service functions typically return SQLAlchemy model instances or tuples of (model, warnings). The route layer handles serialization via Marshmallow schemas and `response.ApiResponse`.

```python
def update_opportunity(...) -> Opportunity:
def get_application_form(...) -> tuple[ApplicationForm, list[ValidationErrorDetail]]:
```

**Exemplar PRs:** #4314 (returns form + warnings), #4513 (returns tuple), #8620 (returns Opportunity)

### 2.8 Validation as Warnings (Not Blocking) for Form Data

**Frequency:** Medium (~10 PRs)
**Confidence:** High
**Trend:** Consistent for the application form domain

Form validation issues are returned as warnings (list of `ValidationErrorDetail`) rather than blocking errors. Blocking only happens at submission time. The reviewer explicitly explained this design in PR #4314.

```python
warnings: list[ValidationErrorDetail] = validate_json_schema_for_form(
    application_response, form
)
```

**Exemplar PRs:** #4314, #4513, #5443

### 2.9 Factory Pattern for Tests: `.build()` for Unit, `.create()` for Integration

**Frequency:** Very high
**Confidence:** High
**Trend:** Increasing -- reviewer explicitly recommends `.build()` when DB not needed

Tests use factory_boy factories. Use `.build()` when no database is needed (pure unit tests), `.create()` when records need to persist (integration tests). The reviewer flagged this explicitly in PR #8614.

```python
# No DB needed
form = ApplicationFormFactory.build(application_response=response_data)

# DB needed
application = ApplicationFactory.create()
```

**Exemplar PRs:** #8614 (reviewer asks why not use factory .build()), #4493 (factories for search tests), #6651 (factories for org tests)

---

## 3. Corrective Patterns (Reviewer Enforcement)

### 3.1 "Don't Log Sensitive Data (Emails, PII)"

**Frequency:** Medium (~5 explicit corrections)
**Confidence:** High
**Trend:** Consistent enforcement

Reviewer (chouinar) explicitly told contributors not to log user emails in PR #5385: "Also - don't log the users email."

**Exemplar PRs:** #5385 (don't log email), #8632 (avoid variable data in log messages)

### 3.2 "Put Variable Data in `extra`, Not in Log Message Strings"

**Frequency:** High (~10+ corrections)
**Confidence:** High
**Trend:** Consistent enforcement

Structured logging: IDs and variable data go in the `extra` dict, not interpolated into the message string.

```python
# Correct
logger.info("Updated opportunity", extra={"opportunity_id": opportunity_id})

# Wrong
logger.info(f"Updated opportunity {opportunity_id}")
```

Reviewer comment in PR #8632: "Avoid putting variable data in log messages, makes it harder to find them. Always put any IDs in the extra."

**Exemplar PRs:** #8632, #4550, #6651

### 3.3 "Don't Import Private Functions (Prefixed with `_`)"

**Frequency:** Low (~3 explicit corrections)
**Confidence:** High
**Trend:** Consistent enforcement

In PR #8620, reviewer stated: "We should avoid importing things that start with `_` - python won't disallow it, but it's the pythonic way of saying something is private."

**Exemplar PRs:** #8620

### 3.4 "Reuse Existing Service Functions Instead of Duplicating Logic"

**Frequency:** High (~15+ corrections)
**Confidence:** High
**Trend:** Consistent and strong enforcement

Reviewer consistently pushes contributors to use existing utility functions rather than writing duplicate logic. Examples:
- PR #6645: "We can remove `_validate_organization_membership` as the `can_access` you added below does that and more."
- PR #8620: "Reuse the function that does the check for opportunity being null and 404s for consistency."
- PR #6651: "I think the update user service also has this function, could we move it to a central location?"

**Exemplar PRs:** #6645, #8620, #6651

### 3.5 "Check Authorization Before Business Logic"

**Frequency:** Medium (~5 explicit corrections)
**Confidence:** High
**Trend:** Increasing in later PRs

In PR #6645, reviewer requested: "Could we move the `validate_competition_open`, `_validate_organization_expiration` and `_validate_applicant_type` to all happen _after_ the `can_access` check? The first meaningful check we should do (after request validation + 404s) is checking roles."

Standard order: 1) Request validation, 2) 404 checks, 3) Authorization, 4) Business logic validation.

**Exemplar PRs:** #6645

### 3.6 "PUT Means Full Replacement, Not Partial Update"

**Frequency:** Low (~2 explicit corrections)
**Confidence:** High
**Trend:** Enforced when applicable

In PR #8620, reviewer stated: "Since this is a PUT endpoint, we should always update every field." The recommended pattern:
```python
for field, value in opportunity_data.items():
    setattr(opportunity, field, value)
```

For nullable fields, the schema must set `load_default=None` so omitted fields default to None (clearing existing values).

**Exemplar PRs:** #8620

### 3.7 "Avoid Walrus Operator (`:=`) Unless It Significantly Improves Readability"

**Frequency:** Low (~2 mentions)
**Confidence:** Medium
**Trend:** Stated preference

In PR #5443, reviewer said: "I try to avoid `:=` except when it really really makes things cleaner because it's not a super well known feature of Python."

**Exemplar PRs:** #5443

### 3.8 "Boolean Field Names Should Read as Questions (is/has/can)"

**Frequency:** Low (~2 explicit corrections)
**Confidence:** High
**Trend:** Consistent

In PR #4493, reviewer requested renaming `active` to `has_active_opportunity`: "we should really make booleans be named as sorta-questions (is/has/are/was/can, whatever makes sense in the context)."

**Exemplar PRs:** #4493

---

## 4. Anti-Patterns (Things to Avoid)

### 4.1 Do NOT Use `selectinload("*")`

**Confidence:** High
**Frequency of correction:** Explicit in PR #8620

Reviewer stated: "don't do `selectinload("*")` - that loads everything unnecessarily." Instead, explicitly list the relationships you need.

### 4.2 Do NOT Expose Internal URLs or Sensitive Fields in API Responses

**Confidence:** High
**Frequency of correction:** PR #4230

Reviewer caught an internal S3 URL being exposed: "Why did this get added? We don't want to expose our internal s3 urls to users."

### 4.3 Do NOT Change Privileges/Behavior of Unrelated Endpoints

**Confidence:** High
**Frequency of correction:** Strong enforcement in PR #8632

Reviewer (chouinar) forcefully stated: "Don't change this - this 100% needs to be left alone, changing this changes the functionality of every endpoint that uses this utility. Don't do that."

### 4.4 Do NOT Write Custom Helper Functions When Standard Patterns Exist

**Confidence:** High
**Frequency:** Multiple corrections across PRs

Examples:
- PR #8614: "I am curious why we would use this instead of a factory?"
- PR #6712: "These shouldn't be in here, they should be in the configuration."
- PR #5385: Extract to shared utility rather than duplicating

### 4.5 Do NOT Flush/Re-query Within a Transaction Unnecessarily

**Confidence:** High
**Frequency of correction:** PR #8620

Reviewer stated: "None of this should be needed. Anything fetched from the DB will be in the DB session. There isn't anything we need to flush."

### 4.6 Do NOT Rename Schema Fields to Differ From DB Model Fields

**Confidence:** Medium
**Frequency of correction:** PR #5424

Reviewer stated: "I don't think we want to rename things, otherwise the JSON doesn't match the DB model which can be confusing to look at later."

---

## 5. Domain-Specific Patterns

### 5.1 Search Service Pattern (OpenSearch)

**Frequency:** High (agencies, opportunities)
**Confidence:** High
**Trend:** Stable, well-established

Search services follow a consistent template:
1. Define `Params` Pydantic model with filters, pagination, query
2. Define a field name mapping dict (e.g., `OPP_REQUEST_FIELD_NAME_MAPPING`)
3. Build search query using `SearchQueryBuilder`
4. Call shared `_add_search_filters()` from `service_utils.py`
5. Parse response, build `PaginationInfo.from_search_response()`
6. Deserialize records via schema

**Exemplar PRs:** #4493 (agency search), #4553 (10k pagination), #5420 (top-level agency filter)

### 5.2 XML Generation Service Pattern

**Frequency:** High (~15+ PRs in batches 3-5)
**Confidence:** High
**Trend:** Rapidly growing, following established conventions

Each form has a `FORM_XML_TRANSFORM_RULES` dict with:
- `_xml_config` metadata (namespaces, XSD URL, root element, attachment_fields)
- Field mappings with `xml_transform` targets
- Tests validate against XSD schemas

**Exemplar PRs:** #7337 (CD511), #7355 (GG_LobbyingForm), #7378 (batch of small forms)

### 5.3 Application Validation Pattern (Action-Based Config)

**Frequency:** Medium (~8 PRs)
**Confidence:** High
**Trend:** Stable

Application validation uses `ApplicationAction` enum (START, GET, MODIFY, SUBMIT) mapped to `JsonRuleConfig` objects that determine which validation steps run:

```python
ACTION_RULE_CONFIG_MAP = {
    ApplicationAction.START: START_JSON_RULE_CONFIG,
    ApplicationAction.GET: GET_JSON_RULE_CONFIG,
    ...
}
```

**Exemplar PRs:** #5443 (rule validation), #6714 (access checks)

---

## 6. Conflicts / Multiple Ways of Doing Things

### 6.1 `verify_access()` vs `check_user_access()` vs `can_access()`

**Confidence:** Medium
**Status:** Acknowledged but not resolved

In PR #8632, reviewer noted: "why do we have `verify_access` and `check_user_access`? We seem to have made a duplicate of this same functionality." The contributor explained `check_user_access` loads roles for performance, but there is acknowledged duplication.

### 6.2 Auth Checking in Routes vs Services

**Confidence:** Medium
**Status:** Evolving

Some PRs check auth in routes (checking `UserTokenSession` type), others push auth checks into service functions (via `can_access`). The trend is toward pushing auth into services with explicit parameters like `is_internal_user: bool`.

**Exemplar PRs:** #5434 (route-level auth type checking), #6714 (service-level with can_access)

### 6.3 `db_session.add(token_session)` Placement Inconsistency

**Confidence:** Medium
**Status:** Becoming more consistent

Route handlers need to call `db_session.add(token_session)` to attach the user's token session to the current DB session before passing it to services. This was missing in several early PRs and added later. It is now consistently present in later PRs but the positioning varies (sometimes before `begin()`, sometimes after).

**Exemplar PRs:** #6645 (added db_session.add), #6714 (added in multiple routes)

---

## 7. Summary: What a New Developer Should Know

1. **File structure:** Create a new file per service function in the domain subdirectory (`api/src/services/{domain}/`).
2. **Function signature:** First parameter is always `db_session: db.Session`. Return domain objects, not dicts.
3. **Transaction management:** Routes call `with db_session.begin():` around service calls. Services never commit.
4. **Error handling:** Use `raise_flask_error(status_code, message)` for all HTTP errors.
5. **DB queries:** Use `select()` + `scalar_one_or_none()` for lookups. Use explicit `selectinload()` for relationships -- never `selectinload("*")`.
6. **Authorization:** Use `can_access()` / `verify_access()` from `endpoint_access_util`. Check auth after 404 checks but before business logic.
7. **Logging:** Use `logger = logging.getLogger(__name__)`. Put IDs in `extra`, not in message strings. Never log PII.
8. **Testing:** Use factory `.build()` for unit tests (no DB), `.create()` for integration tests.
9. **Shared logic:** Extract to `_utils.py` files when two+ services need the same helper. Don't duplicate.
10. **PUT semantics:** Always update all fields. Use `load_default=None` on nullable schema fields.
