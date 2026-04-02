# API Validation — Pattern Review

**Reviewer(s):** chouinar
**PRs analyzed:** 10
**Rules proposed:** 15 (plus 4 anti-patterns)
**Open questions:** 3

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

### 1. Centralized Validation Error Types in `ValidationErrorType` StrEnum

**Confidence:** High
**Frequency:** 7/10 PRs modify this file
**Source PRs:** #4936, #5073, #5146

**Proposed Rule:**
> ALWAYS define new validation error types as members of the `ValidationErrorType(StrEnum)` class in `api/src/validation/validation_constants.py`. NEVER define error type strings inline.

**Rationale:**
Single source of truth for all error type strings. These values serve as the API-frontend contract — the frontend maps them to localized user messages. Centralizing them prevents typos and makes the full set of error scenarios discoverable.

**Code Examples:**
```python
# From PR #4936 — Adding status validation error type
class ValidationErrorType(StrEnum):
    MIN_VALUE = "min_value"
    MAX_VALUE = "max_value"
    MIN_OR_MAX_VALUE = "min_or_max_value"

    NOT_IN_PROGRESS = "not_in_progress"
```

```python
# From PR #5073 — Adding form validation error types
    MISSING_REQUIRED_FORM = "missing_required_form"
    APPLICATION_FORM_VALIDATION = "application_form_validation"
```

```python
# From PR #5146 — Consolidating competition window types
    # Competition window validation error types
    COMPETITION_NOT_OPEN = "competition_not_open"
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

### 2. Validation Logic in Service Layer, Not Route Layer

**Confidence:** High
**Frequency:** 10/10 PRs follow this structure
**Source PRs:** #4936, #5000, #5073, #5146

**Proposed Rule:**
> ALWAYS place validation functions in `api/src/services/applications/` (e.g., `application_validation.py`). NEVER put validation logic directly in route handler functions.

**Rationale:**
Keeps route handlers thin and focused on request/response handling. Validation logic can be unit-tested independently of HTTP concerns. Multiple routes can share the same validation functions.

**Code Examples:**
```python
# From PR #4936 — Validation in submit_application.py (service layer)
def submit_application(db_session: db.Session, application_id: UUID) -> Application:
    logger.info("Processing application submit")
    application = get_application(db_session, application_id)

    if application.application_status != ApplicationStatus.IN_PROGRESS:
        logger.info(
            "Application cannot be submitted, not currently in progress",
            extra={"application_status": application.application_status},
        )
        raise_flask_error(403, message, validation_issues=[...])
```

```python
# From PR #5073 — Dedicated validation module application_validation.py
def validate_forms(application: Application) -> None:
    """Validate the forms for an application."""
    form_errors, form_error_map = get_application_form_errors(application)
    if len(form_errors) > 0:
        detail = {}
        if form_error_map:
            detail["form_validation_errors"] = form_error_map
        raise_flask_error(422, "The application has issues in its form responses.",
            detail=detail, validation_issues=form_errors)
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

### 3. `raise_flask_error` with `ValidationErrorDetail` List

**Confidence:** High
**Frequency:** 6/10 PRs use this pattern
**Source PRs:** #4936, #5000, #5073

**Proposed Rule:**
> ALWAYS use `raise_flask_error(status_code, message, validation_issues=[ValidationErrorDetail(...)])` to raise validation errors. Each `ValidationErrorDetail` MUST include a `type` from `ValidationErrorType` and a human-readable `message`.

**Rationale:**
Standardized error structure that the frontend can reliably parse. The `type` field is the primary contract for frontend message mapping; the `message` is a fallback for API consumers.

**Code Examples:**
```python
# From PR #4936 — Status validation
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
# From PR #5000 — Competition window validation with field parameter
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
# From PR #5073 — Form validation with value parameter
ValidationErrorDetail(
    message=f"Form {required_form.form_name} is required",
    type=ValidationErrorType.MISSING_REQUIRED_FORM,
    field="form_id",
    value=required_form.form_id,
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

### 4. Validation Error Types as Frontend-Facing Contracts

**Confidence:** High
**Frequency:** Conceptually present in all validation PRs; explicitly enforced in 2/10
**Source PRs:** #5000, #5073

**Proposed Rule:**
> ALWAYS use specific, descriptive error type strings that the frontend can map to localized messages. NEVER use generic error types when a more specific one would be useful.

**Rationale:**
The frontend uses `ValidationErrorType` values to determine which localized message to show users. Generic types force the frontend to parse message strings, which is fragile and not localizable.

**Code Examples:**
```python
# From PR #5000 — Reviewer (chouinar) requesting specific types:
# "For the type, could we put something more specific? The type is effectively
# what the frontend will use to map error scenarios to messages (our message
# should only be a fallback/for API users). Maybe something like
# `competition_not_yet_open` and `competition_closed`?"
```

```python
# From PR #5073 — Distinct types for different form validation scenarios
MISSING_REQUIRED_FORM = "missing_required_form"
APPLICATION_FORM_VALIDATION = "application_form_validation"
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

### 5. Validation Functions — Raise vs. Return

**Confidence:** High
**Frequency:** Both patterns present across 6/10 PRs
**Source PRs:** #4936, #5073, #5146

**Proposed Rule:**
> ALWAYS use the raise pattern (`raise_flask_error`) for precondition checks that should halt execution. ALWAYS use the return pattern (returning `list[ValidationErrorDetail]`) for form validation where multiple errors can coexist and should be aggregated.

**Rationale:**
Preconditions (wrong status, competition closed) are binary — either the action can proceed or it cannot. Form validation, however, can have multiple simultaneous issues that the user should see at once.

**Code Examples:**
```python
# From PR #5146 — Raise pattern for precondition check
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
# From PR #5073 — Return pattern for aggregated form errors
def get_required_form_errors(application: Application) -> list[ValidationErrorDetail]:
    required_forms = get_required_forms_for_application(application)
    existing_application_form_ids = [app_form.form_id for app_form in application.application_forms]
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

**Conflicting Examples:**
None found. The two patterns serve distinct purposes and are not in conflict.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 6. Consolidate Duplicate Validation into `application_validation.py`

**Confidence:** High
**Frequency:** 1 explicit refactoring PR (#5146), reflects ongoing consolidation trend
**Source PRs:** #5146

**Proposed Rule:**
> ALWAYS consolidate validation logic used by multiple services into `api/src/services/applications/application_validation.py`. NEVER duplicate the same validation check in separate service files.

**Rationale:**
DRY principle. Ensures consistent validation behavior across all code paths. A single change to the validation rule propagates everywhere automatically.

**Code Examples:**
```python
# From PR #5146 — Before: duplicate competition-open checks.
# After: single validate_competition_open in application_validation.py

# In create_application.py (after consolidation):
from src.services.applications.application_validation import (
    ApplicationAction,
    validate_competition_open,
)
# ...
validate_competition_open(competition, ApplicationAction.START)
```

```python
# From PR #5146 — The consolidated function in application_validation.py
def validate_competition_open(competition: Competition, action: ApplicationAction) -> None:
    if not competition.is_open:
        message = f"Cannot {action} application - competition is not open"
        logger.info(message, extra={
            "opening_date": competition.opening_date,
            "closing_date": competition.closing_date,
            "grace_period": competition.grace_period,
            "application_action": action,
        })
        raise_flask_error(422, message, validation_issues=[...])
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

### 7. `ApplicationAction` Enum for Context-Aware Validation Messages

**Confidence:** High
**Frequency:** 1/10 PRs introduced it; used across multiple validation functions
**Source PRs:** #5146

**Proposed Rule:**
> ALWAYS use the `ApplicationAction(StrEnum)` enum (START, SUBMIT, MODIFY) to parameterize validation error messages. NEVER hardcode action-specific text in validation functions.

**Rationale:**
Allows the same validation function to produce contextually appropriate messages for different operations without code duplication.

**Code Examples:**
```python
# From PR #5146 — Enum definition and usage
class ApplicationAction(StrEnum):
    START = "start"
    SUBMIT = "submit"
    MODIFY = "modify"

def validate_application_in_progress(application: Application, action: ApplicationAction):
    if application.application_status != ApplicationStatus.IN_PROGRESS:
        message = f"Cannot {action} application. It is currently in status: {application.application_status}"
        raise_flask_error(403, message, validation_issues=[...])
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

### 8. Model-Level Computed Properties for Business Rules

**Confidence:** Medium
**Frequency:** 1/10 PRs (emerging pattern)
**Source PRs:** #5146

**Proposed Rule:**
> ALWAYS define reusable business rule computations (e.g., "is this competition open?") as `@property` methods on the DB model when the logic depends only on the model's own fields. NEVER duplicate date-comparison logic across service functions.

**Rationale:**
Centralizes the logic so it can be used by both validation (`validate_competition_open`) and the API response (`is_open` field in competition schema). Eliminates the prior duplication where `create_application.py` and `submit_application.py` each computed this independently.

**Code Examples:**
```python
# From PR #5146 — Competition.is_open property on the DB model
@property
def is_open(self) -> bool:
    """The competition is open if the following are both true:
    * It is on/after the competition opening date OR the opening date is null
    * It is on/before the competition close date + grace period OR the close date is null
    """
    current_date = get_now_us_eastern_date()
    if self.opening_date is not None and current_date < self.opening_date:
        return False
    if self.closing_date is not None:
        grace_period = self.grace_period
        if grace_period is None or grace_period < 0:
            grace_period = 0
        actual_closing_date = self.closing_date + timedelta(days=grace_period)
        if current_date > actual_closing_date:
            return False
    return True
```

**Conflicting Examples:**
None found, but this pattern makes the model impure (depends on `get_now_us_eastern_date()`). Could cause issues in testing or caching.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 9. `freeze_time` for Date-Dependent Validation Tests

**Confidence:** High
**Frequency:** 3/10 PRs
**Source PRs:** #5000, #5146

**Proposed Rule:**
> ALWAYS use `@freeze_time(TEST_DATE)` from the `freezegun` library when testing date-based validation logic. ALWAYS define `TEST_DATE` as a module-level constant. ALWAYS use parametrized test cases to cover boundary conditions (before open, on open, within window, on close, after close, with grace period).

**Rationale:**
Makes time-dependent tests deterministic and reproducible. Parametrized boundary testing catches off-by-one errors in date comparisons.

**Code Examples:**
```python
# From PR #5000 — Parametrized date tests
TEST_DATE = "2023-06-15 12:00:00"

@freeze_time(TEST_DATE)
def test_application_start_before_opening_date(client, api_auth_token, enable_factory_create, db_session):
    today = get_now_us_eastern_date()
    future_opening_date = today + timedelta(days=5)
    competition = CompetitionFactory.create(opening_date=future_opening_date, closing_date=future_closing_date)
    response = client.post("/alpha/applications/start", json=request_data, headers={"X-Auth": api_auth_token})
    assert response.status_code == 422
    assert response.json["errors"][0]["type"] == ValidationErrorType.COMPETITION_NOT_YET_OPEN
```

```python
# From PR #5146 — Parametrized is_open property tests
@pytest.mark.parametrize("opening_date,closing_date,grace_period,expected_is_open", [
    (None, None, None, True),
    (date(2025, 1, 1), date(2025, 12, 31), 10, True),
    (date(2025, 1, 16), date(2025, 1, 31), 0, False),  # Day before opening
    (date(2025, 1, 1), date(2025, 1, 14), 0, False),    # Day after closing
    (date(2025, 1, 1), date(2025, 1, 10), 4, False),    # After grace period
])
@freeze_time("2025-01-15 12:00:00", tz_offset=0)
def test_competition_get_200_is_open(client, api_auth_token, enable_factory_create, ...):
    ...
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

### 10. Factory `.build()` for Unit Tests, `.create()` for Integration Tests

**Confidence:** High
**Frequency:** Consistent across all test PRs
**Source PRs:** #5073, #5000, #5076

**Proposed Rule:**
> ALWAYS use `Factory.build()` in unit tests that do not need database persistence. ALWAYS use `Factory.create()` in integration/route tests that require DB-backed objects.

**Rationale:**
`.build()` is faster and avoids test database overhead. Integration tests need `.create()` because the route handler queries the database.

**Code Examples:**
```python
# From PR #5073 — test_application_validation.py uses .build() for unit tests
# (no DB needed for validation logic testing)
```

```python
# From PR #5000 — Route tests use .create() with DB
def test_application_start_success(client, api_auth_token, enable_factory_create, db_session):
    today = get_now_us_eastern_date()
    future_date = today + timedelta(days=10)
    competition = CompetitionFactory.create(opening_date=today, closing_date=future_date)
    response = client.post("/alpha/applications/start", json=request_data, headers={"X-Auth": api_auth_token})
    assert response.status_code == 200
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

### 11. Shared Schemas Extracted to `shared_schema.py`

**Confidence:** Medium
**Frequency:** 1/10 PRs (emerging pattern)
**Source PRs:** #5146

**Proposed Rule:**
> ALWAYS extract API schemas that are used across multiple domains into `api/src/api/schemas/shared_schema.py`. NEVER duplicate schema definitions.

**Rationale:**
The competition schema needed `OpportunityAssistanceListingV1Schema`, which was previously defined in the opportunity module. Extracting it avoids cross-domain imports and makes the shared nature explicit.

**Code Examples:**
```python
# From PR #5146 — OpportunityAssistanceListingV1Schema moved to shared_schema.py
# api/src/api/schemas/shared_schema.py
class OpportunityAssistanceListingV1Schema(Schema):
    program_title = fields.String(allow_none=True, metadata={...})
    assistance_listing_number = fields.String(allow_none=True, metadata={...})
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

### 12. JSON Schema Validation for Form Responses

**Confidence:** High
**Frequency:** 1/10 PRs but foundational for the form system
**Source PRs:** #5073

**Proposed Rule:**
> ALWAYS validate application form responses against JSON Schema definitions stored on the `Form` model. ALWAYS map JSON Schema validation errors to `ValidationErrorDetail` objects for consistent error reporting.

**Rationale:**
Two-level error reporting: top-level errors identify which forms have issues (using `APPLICATION_FORM_VALIDATION` type with the form ID in `value`), while the `form_error_map` in the response `data` field contains the specific field-level errors. This lets the frontend navigate users to the correct form and field.

**Code Examples:**
```python
# From PR #5073 — JSON Schema validation integrated into form submission
def get_application_form_errors(application: Application) -> tuple[list[ValidationErrorDetail], dict[str, list[ValidationErrorDetail]]]:
    form_error_map: dict[str, list[ValidationErrorDetail]] = {}
    form_errors: list[ValidationErrorDetail] = []
    form_errors.extend(get_required_form_errors(application))
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

### 13. Rule Processing for Custom Validation Beyond JSON Schema

**Confidence:** Medium
**Frequency:** 1/10 PRs (foundational new capability)
**Source PRs:** #5264

**Proposed Rule:**
> ALWAYS use the rule processing system (`api/src/form_schema/rule_processing/`) for validation and field population logic that cannot be expressed in standard JSON Schema. Rules MUST be defined as JSON in the same shape as form responses, with rule groups (`gg_pre_population`, `gg_post_population`, `gg_validation`) at the value level.

**Rationale:**
JSON Schema cannot express cross-field validation, date ordering, or field auto-population. The rule processing system handles these using a mapper pattern that is extensible — adding new rules only requires a new function in the mapper.

**Code Examples:**
```python
# From PR #5264 — Recursive rule processor
handlers: dict[str, Callable[[JsonRuleContext, dict, list[str]], None]] = {
    "gg_pre_population": handle_pre_population,
    "gg_post_population": handle_post_population,
    "gg_validation": handle_validation,
}

def _process_rule_schema(context: JsonRuleContext, rule_schema: dict, path: list[str]) -> None:
    for k, v in rule_schema.items():
        if k in handlers:
            handlers[k](context, v, path)
        elif isinstance(v, dict):
            _process_rule_schema(context=context, rule_schema=v, path=path + [k])
```

```json
// From PR #5264 — Rule schema shape
{
  "info": {
    "opportunity_number": {
      "gg_pre_population": {
        "rule": "opportunity_number"
      }
    }
  }
}
```

**Conflicting Examples:**
None found. List fields are not yet supported. Cross-field validation is a planned future addition.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 14. Use `logger.info()` for Expected Client Errors (4xx)

**Confidence:** High
**Frequency:** 2/10 PRs (corrective); universally applicable cross-cutting pattern
**Source PRs:** #4936, #5146

**Proposed Rule:**
> NEVER use `logger.warning()` for expected client validation errors (4xx). ALWAYS use `logger.info()` with structured `extra={}` parameters.

**Rationale:**
Warning-level logs trigger alerts in New Relic. Client validation failures are expected operational events, not system problems requiring immediate attention.

**Code Examples:**
```python
# From PR #4936 — Reviewer (chouinar) enforcing this:
# "Warning logs will alert us, we don't want to be alerted for 4xx errors."
```

```python
# From PR #5146 — Correct usage in validation function
logger.info(
    message,
    extra={
        "opening_date": competition.opening_date,
        "closing_date": competition.closing_date,
        "grace_period": competition.grace_period,
        "application_action": action,
    },
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

### 15. Static Log Messages with `extra={}` for Dynamic Values

**Confidence:** High
**Frequency:** 2/10 PRs (corrective); universally applicable cross-cutting pattern
**Source PRs:** #4936, #5076

**Proposed Rule:**
> NEVER embed dynamic values (IDs, statuses, dates) in log message strings. ALWAYS put dynamic values in the `extra={}` parameter. ALWAYS use flat snake_case keys.

**Rationale:**
Static log messages enable consistent querying and count aggregation in New Relic. Dynamic values in `extra={}` appear as searchable attributes.

**Code Examples:**
```python
# From PR #4936 — Reviewer (chouinar) enforcing flat log keys:
# "To make it easier to look things up, we should try to avoid putting any
# variable text in the message as well, just make it an extra param which
# has the benefit of being able to easily make count charts in New Relic."
```

```python
# From PR #5076 — Correct pattern for access denial logging
logger.info(
    "User attempted to access an application they are not associated with",
    extra={
        "user_id": user.user_id,
        "application_id": application.application_id,
    },
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

## Anti-Patterns

### AP-1. Duplicating Validation Logic Across Services

**Confidence:** High
**Source PRs:** #5146

**Proposed Rule:**
> NEVER copy the same validation check into multiple service files. ALWAYS extract it into `application_validation.py`.

**Context:** PR #5146 — competition-open check was duplicated in `create_application.py` and `submit_application.py`.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### AP-2. Overly Specific Error Types That Fragment Unnecessarily

**Confidence:** High
**Source PRs:** #5146

**Proposed Rule:**
> NEVER create separate error types for closely related scenarios when the frontend does not need to distinguish them. Consolidate when appropriate.

**Context:** `COMPETITION_NOT_YET_OPEN` and `COMPETITION_ALREADY_CLOSED` were consolidated into `COMPETITION_NOT_OPEN` because the distinction was not useful to the frontend.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### AP-3. Dynamic IDs in Error Messages

**Confidence:** Medium
**Source PRs:** #5000

**Proposed Rule:**
> NEVER include dynamic IDs in error message strings (e.g., `f"Competition with ID {competition_id} not found"`). Use static messages (e.g., `"Competition not found"`) since the ID is already in request context logs.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### AP-4. Parametrized Tests Including Happy Path in Failure Cases

**Confidence:** Medium
**Source PRs:** #4936

**Proposed Rule:**
> NEVER include the expected-success case in a parametrized test for failure scenarios. Separate happy-path tests from error-case parametrizations.

**Context:** In PR #4936, a parametrized test for forbidden statuses included `IN_PROGRESS` as a parameter, requiring special-case handling inside the test body.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

## Coverage Gaps

1. **No validation for request body size limits** — no patterns found for enforcing maximum payload sizes on form submission endpoints
2. **No rate limiting on validation-heavy endpoints** — form submission validation can be expensive; no throttling patterns found
3. **No `value` field PII policy** — reviewer flagged potential PII concerns (PR #5073) but no formal policy exists for what data types are safe to include in `ValidationErrorDetail.value`

## Inconsistencies Requiring Resolution

1. **Model-level computed properties with side effects (Pattern 8):** `Competition.is_open` depends on `get_now_us_eastern_date()`, making the model impure. Is this the preferred approach, or should date-dependent logic stay in service functions?

2. **Validation framework across the stack (Cross-domain):** The codebase uses four different validation frameworks: Marshmallow (API schemas), Pydantic (service params), JSON Schema (form responses), and Zod (frontend server actions). Is this intentional specialization or incidental complexity?

3. **`ValidationErrorDetail.value` scope:** PR #5073 added the `value` field for form IDs. Should there be an explicit allowlist of what data types are permitted in `value` to prevent PII leakage?
