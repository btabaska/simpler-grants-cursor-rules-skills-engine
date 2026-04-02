# API Error Handling -- Conventions & Rules

> **Status:** Draft -- pending tech lead validation. Items marked with a trailing
> flag are awaiting team confirmation. All other patterns reflect high-confidence
> conventions observed consistently across the codebase.

## Overview

The Simpler Grants API uses a centralized error handling pattern built around three
key components: `raise_flask_error()` for raising HTTP errors, `ValidationErrorDetail`
for structured error payloads, and `ValidationErrorType` (a `StrEnum`) for typed
error codes that serve as the API-frontend contract. This architecture ensures that
every error response follows a consistent structure that the frontend can reliably
parse and map to localized user messages.

Error handling follows the project's layered architecture. Route handlers raise simple
errors (403 for identity mismatches, 404 for missing resources). Service functions
use `raise_flask_error()` for business logic violations (422 for invalid state
transitions, 403 for authorization failures). Validation functions either raise
immediately for precondition failures or return aggregated `ValidationErrorDetail`
lists for form validation where multiple errors can coexist. In all cases, expected
client errors (4xx) are logged at `info` level -- never `warning` -- to avoid
triggering New Relic alerts.

This document synthesizes error handling patterns from across the API routes,
services, validation, and auth domains. For the overall API layered architecture,
see the API Routes conventions document. For auth-specific error scenarios, see the
API Authentication conventions document.

## Rules

### Core Error Mechanism

#### Rule: Use `raise_flask_error()` for All HTTP Errors
**Confidence:** High
**Observed in:** ~85% of service functions with error cases, 100% of route error handling | PR refs: #4936, #6651, #8620, #9114

Always use `raise_flask_error(status_code, message, validation_issues=[...])` from
`src.api.route_utils` for error responses. Never raise raw exceptions or return
error tuples from services.

**DO:**
```python
# From PR #6651 -- standard 404 in service function
if not org_user:
    raise_flask_error(404, message=f"Could not find User with ID {user_id}")
```

```python
# From PR #8620 -- 422 for business rule violation in shared utility
def validate_opportunity_is_draft(opportunity: Opportunity) -> None:
    if not opportunity.is_draft:
        raise_flask_error(422, message="Only draft opportunities can be updated")
```

```python
# From PR #9114 -- simple 403 in route handler for identity mismatch
if user.user_id != user_id:
    raise_flask_error(403, "Forbidden")
```

**DON'T:**
```python
# Anti-pattern -- raising raw exceptions from service functions
if not org_user:
    raise ValueError(f"User {user_id} not found")

# Anti-pattern -- returning error tuples
def get_user(db_session, user_id):
    user = db_session.get(User, user_id)
    if not user:
        return None, "Not found"  # Caller must check
    return user, None
```

> **Rationale:** `raise_flask_error` provides a consistent mechanism for service
> functions to signal HTTP-level errors. The framework catches these and serializes
> them into standard error responses. Using this single mechanism keeps error
> handling uniform across the entire codebase.

---

#### Rule: Include `ValidationErrorDetail` for Validation Errors
**Confidence:** High
**Observed in:** 6 of 10 validation PRs | PR refs: #4936, #5000, #5073

When raising validation errors, include `ValidationErrorDetail` objects in the
`validation_issues` parameter. Each detail must include a `type` from
`ValidationErrorType` and a human-readable `message`. Optionally include `field`
and `value` for field-specific errors.

**DO:**
```python
# From PR #4936 -- validation error with typed detail
raise_flask_error(
    403,
    message,
    validation_issues=[
        ValidationErrorDetail(
            type=ValidationErrorType.NOT_IN_PROGRESS,
            message="Application cannot be submitted, not currently in progress",
        )
    ],
)
```

```python
# From PR #5000 -- validation error with field reference
raise_flask_error(
    422,
    "Cannot start application - competition is not yet open for applications",
    validation_issues=[
        ValidationErrorDetail(
            type=ValidationErrorType.COMPETITION_NOT_YET_OPEN,
            message="Competition is not yet open for applications",
            field="opening_date",
        )
    ],
)
```

```python
# From PR #5073 -- validation error with field and value
ValidationErrorDetail(
    message=f"Form {required_form.form_name} is required",
    type=ValidationErrorType.MISSING_REQUIRED_FORM,
    field="form_id",
    value=required_form.form_id,
)
```

**DON'T:**
```python
# Anti-pattern -- raising error without typed validation details
raise_flask_error(422, "Something went wrong with the form")
# Frontend cannot map this to a localized message
```

> **Rationale:** Standardized error structure that the frontend can reliably parse.
> The `type` field is the primary contract for frontend message mapping; the
> `message` is a fallback for direct API consumers.

---

### Validation Error Types

#### Rule: Centralize Error Types in `ValidationErrorType` StrEnum
**Confidence:** High
**Observed in:** 7 of 10 validation PRs modify this file | PR refs: #4936, #5073, #5146

All validation error types must be defined as members of
`ValidationErrorType(StrEnum)` in `api/src/validation/validation_constants.py`.
Never define error type strings inline.

**DO:**
```python
# From PR #5073 -- adding new types to centralized StrEnum
class ValidationErrorType(StrEnum):
    MIN_VALUE = "min_value"
    MAX_VALUE = "max_value"
    NOT_IN_PROGRESS = "not_in_progress"
    MISSING_REQUIRED_FORM = "missing_required_form"
    APPLICATION_FORM_VALIDATION = "application_form_validation"
    COMPETITION_NOT_OPEN = "competition_not_open"
```

**DON'T:**
```python
# Anti-pattern -- inline error type strings
raise_flask_error(
    422,
    "Form error",
    validation_issues=[
        ValidationErrorDetail(
            type="missing_form",  # Not in ValidationErrorType!
            message="Required form is missing",
        )
    ],
)
```

> **Rationale:** Single source of truth for all error type strings. These values
> serve as the API-frontend contract -- the frontend maps them to localized user
> messages. Centralizing them prevents typos and makes the full set of error
> scenarios discoverable.

---

#### Rule: Use Specific, Descriptive Error Types
**Confidence:** High
**Observed in:** 2 of 10 PRs (explicitly enforced) | PR refs: #5000, #5073

Use specific, descriptive error type strings that the frontend can map to localized
messages. Never use generic error types when a more specific one would be useful.

**DO:**
```python
# From PR #5073 -- distinct types for different form validation scenarios
MISSING_REQUIRED_FORM = "missing_required_form"
APPLICATION_FORM_VALIDATION = "application_form_validation"
```

**DON'T:**
```python
# Anti-pattern -- generic type that frontend cannot act on
VALIDATION_ERROR = "validation_error"  # Too generic for localized messages
```

> **Rationale:** The frontend uses `ValidationErrorType` values to determine which
> localized message to show users. Generic types force the frontend to parse message
> strings, which is fragile and not localizable. Reviewer (chouinar): "The type is
> effectively what the frontend will use to map error scenarios to messages."

---

#### Rule: Consolidate Closely Related Error Types
**Confidence:** High
**Observed in:** 1 of 10 PRs (explicit refactoring) | PR refs: #5146

Do not create separate error types for closely related scenarios when the frontend
does not need to distinguish them.

**DO:**
```python
# From PR #5146 -- single consolidated type for competition-not-open
COMPETITION_NOT_OPEN = "competition_not_open"
```

**DON'T:**
```python
# Anti-pattern -- unnecessary fragmentation of closely related types
COMPETITION_NOT_YET_OPEN = "competition_not_yet_open"
COMPETITION_ALREADY_CLOSED = "competition_already_closed"
# Frontend treated both identically
```

> **Rationale:** Consolidating related error types when the frontend does not need
> to distinguish them reduces enum clutter and simplifies the error contract.
> `COMPETITION_NOT_YET_OPEN` and `COMPETITION_ALREADY_CLOSED` were consolidated
> into `COMPETITION_NOT_OPEN` because the frontend handled both identically.

---

### Error Propagation Patterns

#### Rule: Raise for Preconditions, Return for Form Aggregation
**Confidence:** High
**Observed in:** 6 of 10 validation PRs | PR refs: #5146, #5073

Use the raise pattern (`raise_flask_error`) for precondition checks that should halt
execution. Use the return pattern (returning `list[ValidationErrorDetail]`) for form
validation where multiple errors can coexist and should be aggregated.

**DO:**
```python
# From PR #5146 -- raise pattern for binary precondition check
def validate_competition_open(competition: Competition, action: ApplicationAction) -> None:
    if not competition.is_open:
        message = f"Cannot {action} application - competition is not open"
        raise_flask_error(422, message, validation_issues=[
            ValidationErrorDetail(
                type=ValidationErrorType.COMPETITION_NOT_OPEN,
                message="Competition is not open for application",
            )
        ])
```

```python
# From PR #5073 -- return pattern for aggregated form errors
def get_required_form_errors(application: Application) -> list[ValidationErrorDetail]:
    required_form_errors: list[ValidationErrorDetail] = []
    for required_form in required_forms:
        if required_form.form_id not in existing_application_form_ids:
            required_form_errors.append(
                ValidationErrorDetail(
                    message=f"Form {required_form.form_name} is required",
                    type=ValidationErrorType.MISSING_REQUIRED_FORM,
                    field="form_id",
                    value=required_form.form_id,
                )
            )
    return required_form_errors
```

**DON'T:**
```python
# Anti-pattern -- raising on first form error, hiding subsequent errors
def validate_forms(application: Application) -> None:
    for form in application.forms:
        if not form.is_valid:
            raise_flask_error(422, f"Form {form.name} is invalid")
            # User only sees one error at a time!
```

> **Rationale:** Preconditions (wrong status, competition closed) are binary --
> either the action can proceed or it cannot. Form validation, however, can have
> multiple simultaneous issues that the user should see at once for efficient
> correction.

---

#### Rule: Non-Blocking Warnings During Save, Blocking at Submission
**Confidence:** High
**Observed in:** ~10 PRs across the application form domain | PR refs: #4314, #5073, #5443

Form validation issues must be returned as warnings during save/update operations.
Only block (raise errors) during submission.

**DO:**
```python
# From PR #4314 -- during save, return warnings without blocking
warnings: list[ValidationErrorDetail] = validate_json_schema_for_form(
    application_response, form
)
return application_form, warnings

# From PR #5073 -- during submission, block if errors exist
validate_forms(application, ApplicationAction.SUBMIT)  # raises 422 if issues
```

**DON'T:**
```python
# Anti-pattern -- blocking saves on validation errors
def update_application_form(db_session, form_id, response_data):
    errors = validate_json_schema_for_form(response_data, form)
    if errors:
        raise_flask_error(422, "Form has errors")  # Blocks partial saves!
```

> **Rationale:** Users should be able to save partial form progress without being
> blocked. Validation warnings guide them toward completion. Only at submission time
> is completeness enforced as a hard gate. Reviewer (chouinar): "if a user
> partially fills out a form, we'll note down what is still needed/incorrect, but
> not block them from saving their answers."

---

#### Rule: Error Response Propagation to Frontend
**Confidence:** High
**Observed in:** Cross-domain pattern | PR refs: #5000, #5073

The error contract between API and frontend follows a specific structure. The
`ValidationErrorType` value is the primary key the frontend uses to select
localized messages. The `message` field is a fallback. The optional `field` and
`value` provide context for field-level error display.

**DO:**
```python
# From PR #5073 -- two-level error reporting for form validation
def get_application_form_errors(
    application: Application,
) -> tuple[list[ValidationErrorDetail], dict[str, list[ValidationErrorDetail]]]:
    form_error_map: dict[str, list[ValidationErrorDetail]] = {}
    form_errors: list[ValidationErrorDetail] = []
    for application_form in application.application_forms:
        form_validation_errors = validate_json_schema_for_form(
            application_form.application_response, application_form.form
        )
        if form_validation_errors:
            form_error_map[str(application_form.application_form_id)] = form_validation_errors
            form_errors.append(
                ValidationErrorDetail(
                    type=ValidationErrorType.APPLICATION_FORM_VALIDATION,
                    message="The application form has outstanding errors.",
                    field="application_form_id",
                    value=application_form.application_form_id,
                )
            )
    return form_errors, form_error_map
```

**DON'T:**
```python
# Anti-pattern -- unstructured error response the frontend cannot parse
raise_flask_error(422, "Forms have errors: form1 missing field X, form2 has invalid Y")
```

> **Rationale:** Two-level error reporting: top-level errors identify which forms
> have issues (using the form ID in `value`), while the `form_error_map` in the
> response `detail` field contains specific field-level errors. This lets the
> frontend navigate users to the correct form and field.

---

### HTTP Status Code Conventions

#### Rule: Standard Status Codes for Standard Situations
**Confidence:** High
**Observed in:** All error-handling code across examined PRs | PR refs: #9114, #9256, #4936, #8620, #6645

Use consistent HTTP status codes: 403 for identity/authorization failures, 404 for
missing resources, 422 for business rule violations and validation failures.

**DO:**
```python
# From PR #9114 -- 403 for identity mismatch (user IS authenticated but wrong user)
if user.user_id != user_id:
    raise_flask_error(403, "Forbidden")

# From PR #9256 -- 404 for missing resource
if record is None:
    raise_flask_error(
        404, message=f"Could not find Assistance Listing Number {assist_list_nbr}"
    )

# From PR #8620 -- 422 for business rule violation
if not opportunity.is_draft:
    raise_flask_error(422, message="Only draft opportunities can be updated")

# From PR #6645 -- 403 for authorization failure
if not can_access(user, {Privilege.START_APPLICATION}, organization):
    raise_flask_error(403, "Forbidden")
```

**DON'T:**
```python
# Anti-pattern -- using 401 for authorization failures (user IS authenticated)
if user.user_id != user_id:
    raise_flask_error(401, "Unauthorized user")  # Should be 403

# Anti-pattern -- using 400 for business rule violations
if not opportunity.is_draft:
    raise_flask_error(400, "Bad request")  # Should be 422
```

> **Rationale:** 401 means "not authenticated" (missing/invalid credentials). 403
> means "authenticated but not authorized." The shift from 401 to 403 for identity
> mismatches (seen in PR #4989 to #9114) reflects this semantic distinction. 422
> is used for requests that are syntactically valid but violate business rules.

---

#### Rule: Check Authorization After 404 Checks, Before Business Logic
**Confidence:** High
**Observed in:** ~5 explicit corrections | PR refs: #6645, #8620

Follow this validation order in service functions: (1) request validation,
(2) 404 checks (does the entity exist?), (3) authorization (does the user have
permission?), (4) business logic validation.

**DO:**
```python
# From PR #8620 -- correct ordering: fetch -> auth -> business logic
# 1. Fetch + 404
opportunity = get_opportunity_for_grantors(db_session, user, opportunity_id)
# 2. Auth
verify_access(user, {Privilege.UPDATE_OPPORTUNITY}, opportunity.agency_record)
# 3. Business logic
validate_opportunity_is_draft(opportunity)
```

**DON'T:**
```python
# Anti-pattern -- business logic validation before auth check (leaks information)
opportunity = get_opportunity(db_session, opportunity_id)
validate_opportunity_is_draft(opportunity)  # Reveals state to unauthorized users!
verify_access(user, {Privilege.UPDATE_OPPORTUNITY}, opportunity.agency_record)
```

> **Rationale:** Checking auth before business rules prevents information leakage.
> If a user does not have permission, they should get a 403 -- not a 422 that
> reveals details about the state of the resource. Reviewer (chouinar): "The first
> meaningful check we should do (after request validation + 404s) is checking roles
> to avoid giving info to users that shouldn't have it."

---

### Logging Errors

#### Rule: Use `logger.info()` for Expected Client Errors (4xx)
**Confidence:** High
**Observed in:** Corrective enforcement in 2+ PRs per domain | PR refs: #4936, #5146, #5417

Never use `logger.warning()` for expected client errors (401, 403, 404, 422). Always
use `logger.info()` with structured `extra={}` parameters.

**DO:**
```python
# From PR #5146 -- validation failure logged at info level
logger.info(
    "Cannot start application - competition is not open",
    extra={
        "opening_date": competition.opening_date,
        "closing_date": competition.closing_date,
        "grace_period": competition.grace_period,
        "application_action": action,
    },
)
raise_flask_error(422, message, validation_issues=[...])
```

**DON'T:**
```python
# Anti-pattern -- warning level triggers New Relic alerts for expected errors
logger.warning(
    "Application submission failed - not in progress",
    extra={"application_status": application.application_status},
)
```

> **Rationale:** Warning-level logs trigger alerts in New Relic. Client validation
> failures and auth failures are expected operational events, not system problems
> requiring immediate attention. Reviewer (chouinar): "Warning logs will alert us,
> we don't want to be alerted for 4xx errors."

---

#### Rule: Static Log Messages with Dynamic Data in `extra={}`
**Confidence:** High
**Observed in:** 10+ explicit corrections across PRs | PR refs: #4936, #4965, #8632

Never embed dynamic values (IDs, statuses, dates) in log message strings. Always
put dynamic values in the `extra={}` parameter.

**DO:**
```python
# From PR #8620 -- static message with data in extra
logger.info(
    "Updated opportunity",
    extra={"opportunity_id": opportunity_id},
)
```

**DON'T:**
```python
# From PR #8632 -- anti-pattern corrected by reviewer
logger.info(f"Getting saved opportunities for user {user_id}")
```

> **Rationale:** Static log messages are searchable and aggregatable in log
> management systems. Dynamic values in messages produce unique strings that defeat
> log grouping, searching, and count chart creation in New Relic.

---

### Validation Architecture

#### Rule: Validation Logic in Service Layer, Not Route Layer
**Confidence:** High
**Observed in:** 10 of 10 validation PRs | PR refs: #4936, #5073, #5146

Validation functions must live in `api/src/services/applications/` (e.g.,
`application_validation.py`). Never put validation logic directly in route handlers.

**DO:**
```python
# From PR #5073 -- dedicated validation module in service layer
# api/src/services/applications/application_validation.py
def validate_forms(application: Application) -> None:
    form_errors, form_error_map = get_application_form_errors(application)
    if len(form_errors) > 0:
        raise_flask_error(
            422,
            "The application has issues in its form responses.",
            detail={"form_validation_errors": form_error_map} if form_error_map else {},
            validation_issues=form_errors,
        )
```

**DON'T:**
```python
# Anti-pattern -- validation logic embedded in route handler
@application_blueprint.post("/applications/<uuid:application_id>/submit")
def application_submit(db_session, application_id):
    application = get_application(db_session, application_id)
    if application.status != "in_progress":
        raise_flask_error(403, "Not in progress")  # Validation in route!
    for form in application.forms:
        if not form.is_valid:
            raise_flask_error(422, "Invalid form")  # More validation in route!
```

> **Rationale:** Keeps route handlers thin and focused on request/response handling.
> Validation logic can be unit-tested independently of HTTP concerns. Multiple
> routes can share the same validation functions.

---

#### Rule: Consolidate Duplicate Validation into Shared Modules
**Confidence:** High
**Observed in:** 1 explicit refactoring PR, ongoing consolidation trend | PR refs: #5146

Consolidate validation logic used by multiple services into shared modules like
`application_validation.py`. Never duplicate the same validation check in separate
service files.

**DO:**
```python
# From PR #5146 -- single consolidated function used by multiple services
# api/src/services/applications/application_validation.py
def validate_competition_open(competition: Competition, action: ApplicationAction) -> None:
    if not competition.is_open:
        message = f"Cannot {action} application - competition is not open"
        logger.info(message, extra={
            "opening_date": competition.opening_date,
            "closing_date": competition.closing_date,
        })
        raise_flask_error(422, message, validation_issues=[...])

# Used in create_application.py:
validate_competition_open(competition, ApplicationAction.START)

# Used in submit_application.py:
validate_competition_open(application.competition, ApplicationAction.SUBMIT)
```

**DON'T:**
```python
# Anti-pattern -- duplicating competition-open check in two service files
# create_application.py
if not competition.is_open:
    raise_flask_error(422, "Competition is not open")

# submit_application.py
if not competition.is_open:  # Same check, different file
    raise_flask_error(422, "Competition not open for submissions")
```

> **Rationale:** DRY principle. Ensures consistent validation behavior across all
> code paths. A single change to the validation rule propagates everywhere
> automatically.

---

#### Rule: `ApplicationAction` Enum for Context-Aware Error Messages
**Confidence:** High
**Observed in:** 1 of 10 PRs introduced it, used across multiple validation functions | PR refs: #5146

Use the `ApplicationAction(StrEnum)` enum (START, SUBMIT, MODIFY) to parameterize
validation error messages. Never hardcode action-specific text in shared validation
functions.

**DO:**
```python
# From PR #5146 -- enum-parameterized validation messages
class ApplicationAction(StrEnum):
    START = "start"
    SUBMIT = "submit"
    MODIFY = "modify"

def validate_application_in_progress(
    application: Application, action: ApplicationAction,
):
    if application.application_status != ApplicationStatus.IN_PROGRESS:
        message = f"Cannot {action} application. It is currently in status: {application.application_status}"
        raise_flask_error(403, message, validation_issues=[...])
```

**DON'T:**
```python
# Anti-pattern -- separate functions for each action
def validate_can_start(application):
    if application.status != "in_progress":
        raise_flask_error(403, "Cannot start application")

def validate_can_submit(application):
    if application.status != "in_progress":
        raise_flask_error(403, "Cannot submit application")
```

> **Rationale:** Allows the same validation function to produce contextually
> appropriate messages for different operations without code duplication.

---

### Special Error Cases

#### Rule: Audit Failed Submissions in Separate Transaction
**Confidence:** High
**Observed in:** Established in 1 PR, applied to all application write endpoints since | PR refs: #7034

When a submission fails with a 422, record an audit event in a separate transaction
(the main transaction was rolled back). Wrap the audit in try/except to prevent
audit failures from masking the original error.

**DO:**
```python
# From PR #7034 -- error-case audit in separate transaction
def _handle_submit_error(
    db_session: db.Session, error: HTTPError, application_id: UUID, user_id: UUID
) -> Never:
    if error.status_code != 422:
        raise error
    try:
        if db_session.is_active:
            db_session.rollback()
        with db_session.begin():
            add_audit_event_by_id(
                db_session,
                application_id=application_id,
                user_id=user_id,
                audit_event=ApplicationAuditEvent.APPLICATION_SUBMIT_REJECTED,
            )
    except Exception:
        logger.exception("Failed to add audit event for failed submission")
    raise error
```

**DON'T:**
```python
# Anti-pattern -- trying to audit within the failed transaction
try:
    with db_session.begin():
        submit_application(db_session, application_id, user)
except HTTPError as e:
    # This will fail -- the transaction was rolled back
    add_audit_event(db_session, audit_event=ApplicationAuditEvent.SUBMIT_REJECTED)
    raise e
```

> **Rationale:** Failed submission audits require a separate transaction because the
> main transaction was rolled back on the validation error. The try/except ensures
> that an audit failure does not mask the original submission error.

---

## Anti-Patterns

### AP-1: Duplicating Validation Logic Across Services
Never copy the same validation check into multiple service files. Always extract
shared validation into `application_validation.py` or an appropriate utility module.
(PR #5146 -- competition-open check was duplicated in `create_application.py` and
`submit_application.py`)

### AP-2: Overly Specific Error Types That Fragment Unnecessarily
Never create separate error types for closely related scenarios when the frontend
does not need to distinguish them. Consolidate when appropriate. (PR #5146 --
`COMPETITION_NOT_YET_OPEN` and `COMPETITION_ALREADY_CLOSED` consolidated into
`COMPETITION_NOT_OPEN`)

### AP-3: Dynamic IDs in Error Messages (⏳)
**Confidence:** Medium. Never include dynamic IDs in error message strings (e.g.,
`f"Competition with ID {competition_id} not found"`). Use static messages (e.g.,
`"Competition not found"`) since the ID is already in request context logs.
(PR #5000)

### AP-4: Warning-Level Logs for Expected Client Errors
Never use `logger.warning()` for expected 4xx errors. These trigger New Relic alerts
unnecessarily. Use `logger.info()` instead. (PRs #4936, #5146)

### AP-5: Variable Text in Log Message Strings
Never embed dynamic values directly in log message strings. Always put them in
`extra={}` dict to enable consistent log querying and count charts in New Relic.
(PRs #4936, #4965, #8632)

## Known Inconsistencies

### 401 vs 403 for Identity Mismatches
Older endpoints use `raise_flask_error(401, "Unauthorized user")` when the
authenticated user does not match the URL user_id parameter. Newer endpoints
correctly use `raise_flask_error(403, "Forbidden")`. The semantic distinction:
401 = not authenticated, 403 = authenticated but not authorized. Tech lead should
determine whether older endpoints should be migrated.

### Validation Framework Dual Stack
The API uses two validation libraries in parallel: Marshmallow schemas with
`@validates_schema` for route-level cross-field validation, and Pydantic
`BaseModel` with `model_validate()` for service-level input parsing. Both coexist
and this duality is acknowledged but not resolved.

## Related Documents

- **API Authentication** -- `output/rules/api-auth.md` -- covers auth-specific
  error scenarios (401/403 for auth failures, logging conventions for auth errors).
- **API Routes** -- covers decorator stack order, thin route handlers, and the
  `raise_flask_error` usage patterns in route context.
- **API Services** -- covers `raise_flask_error` in service functions,
  `can_access()` / `verify_access()` authorization patterns, and the validation
  ordering convention.
- **API Validation (Pass 2)** -- covers `ValidationErrorType`, `ValidationErrorDetail`,
  form validation patterns, and the rule processing system.
- **Cross-Domain Synthesis** -- CCP-2 (log level discipline), CCP-4 (error contract
  with `raise_flask_error` + `ValidationErrorDetail`).
