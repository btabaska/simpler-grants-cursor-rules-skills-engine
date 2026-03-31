# Pattern Discovery: API Validation (`api/src/validation/`)

**Source:** 10 merged PRs analyzed from HHS/simpler-grants-gov
**Date range:** 2025-05-06 to 2025-06-23
**Primary authors:** chouinar, mikehgrantsgov

---

## 1. Structural Patterns

### SP-1: Centralized validation error types in `validation_constants.py`
All validation error types are defined as a single `ValidationErrorType(StrEnum)` class in `api/src/validation/validation_constants.py`. Each new validation scenario adds a new enum value.

**Exemplar PRs:** #4936 (NOT_IN_PROGRESS), #5000 (COMPETITION_NOT_YET_OPEN, COMPETITION_ALREADY_CLOSED), #5073 (MISSING_REQUIRED_FORM, APPLICATION_FORM_VALIDATION), #5076 (UNAUTHORIZED_APPLICATION_ACCESS), #5146 (COMPETITION_NOT_OPEN, consolidating), #5221 (MISSING_APPLICATION_FORM), #5264 (RULE_VALIDATION, INVALID_FIELD_VALUE)
**Frequency:** 7/10 PRs modify this file
**Trend:** Growing; the enum is the single source of truth for all error type strings
**Confidence:** High

### SP-2: Validation logic lives in service layer, not route layer
Validation functions are placed in `api/src/services/applications/` (e.g., `application_validation.py`, `submit_application.py`) rather than in route handlers. Route handlers call service functions which call validation functions.

**Exemplar PRs:** #4936, #5000, #5073, #5146
**Frequency:** Consistent across all 10 PRs
**Trend:** Stable convention
**Confidence:** High

### SP-3: Validation consolidation into `application_validation.py`
Over time, validation logic that was initially spread across `create_application.py` and `submit_application.py` was consolidated into a central `application_validation.py` module.

**Exemplar PRs:** #5146 (moved validate_competition_open from submit_application.py and create_application.py into application_validation.py)
**Frequency:** 1 explicit refactoring PR, but reflects ongoing trend
**Trend:** Consolidating
**Confidence:** High

### SP-4: Shared schemas extracted to `api/src/api/schemas/shared_schema.py`
Schemas reused across multiple API domains (e.g., `OpportunityAssistanceListingV1Schema`) are extracted into a shared schema file rather than duplicated.

**Exemplar PRs:** #5146
**Frequency:** 1/10 PRs
**Trend:** Emerging; created when competition schema needed opportunity-domain schemas
**Confidence:** Medium

---

## 2. Code Patterns

### CP-1: `raise_flask_error` with `ValidationErrorDetail` list
The standard pattern for raising validation errors is:
```python
raise_flask_error(
    status_code,
    message,
    validation_issues=[
        ValidationErrorDetail(
            type=ValidationErrorType.SOME_TYPE,
            message="Human-readable description",
            field="field_name",  # optional
            value=some_value,    # optional
        )
    ],
)
```
The `type` field is what the frontend uses to map error scenarios to user messages. The `message` is a fallback.

**Exemplar PRs:** #4936, #5000, #5073
**Frequency:** 6/10 PRs use this pattern
**Trend:** Stable; established early and consistently followed
**Confidence:** High

### CP-2: Validation error types as frontend-facing contracts
Error type strings (the `ValidationErrorType` enum values) serve as a contract between API and frontend. The frontend maps these to localized messages. Reviewer explicitly called this out.

**Exemplar PRs:** #5000 (reviewer: "The type is effectively what the frontend will use to map error scenarios to messages")
**Frequency:** Conceptually present in all validation PRs
**Trend:** Intentional API design pattern
**Confidence:** High

### CP-3: `ValidationErrorDetail` with optional `field` and `value`
The `ValidationErrorDetail` dataclass was extended to include `value` in addition to `field`, allowing richer error context without putting values in log messages.

**Exemplar PRs:** #5073 (added `value` field)
**Frequency:** 1 PR but affects all subsequent validation
**Trend:** Expanding the error detail structure incrementally
**Confidence:** High

### CP-4: Model-level computed properties for business rules
Business logic like "is a competition open" was moved from service functions into model `@property` methods (e.g., `Competition.is_open`). This allows the property to be used in both validation and API responses.

**Exemplar PRs:** #5146 (Competition.is_open property on the DB model)
**Frequency:** 1/10 PRs
**Trend:** Emerging; centralizes business logic on the model
**Confidence:** Medium

### CP-5: Validation functions that raise vs. return errors
Two patterns coexist:
1. **Raise pattern:** Functions like `validate_application_in_progress()` and `validate_competition_open()` call `raise_flask_error` directly, halting execution on failure.
2. **Return pattern:** Functions like `get_application_form_errors()` return lists of `ValidationErrorDetail`, allowing the caller to aggregate errors.

The raise pattern is used for precondition checks. The return pattern is used for form validation where multiple errors can coexist.

**Exemplar PRs:** #4936 (raise), #5073 (return), #5146 (both)
**Frequency:** Both present throughout
**Trend:** Stable dual pattern
**Confidence:** High

### CP-6: `ApplicationAction` enum for context-aware error messages
An `ApplicationAction(StrEnum)` enum (START, SUBMIT, MODIFY) provides context for validation messages, allowing the same validation function to produce appropriate messages for different actions (e.g., "Cannot submit application" vs "Cannot start application").

**Exemplar PRs:** #5146
**Frequency:** 1/10 PRs, but used across multiple validation functions
**Trend:** Growing; new actions added as needed
**Confidence:** High

### CP-7: JSON Schema validation for form responses
Application form responses are validated against JSON Schema definitions stored on the `Form` model. Validation errors from the JSON Schema library are mapped to `ValidationErrorDetail` objects.

**Exemplar PRs:** #5073
**Frequency:** 1/10 PRs but foundational
**Trend:** Extended by rule processing (#5264)
**Confidence:** High

### CP-8: Rule processing schema for custom validation beyond JSON Schema
A rule processing system was introduced for validation and field population logic that cannot be expressed in standard JSON Schema. Rules are defined as JSON in the same shape as form responses.

**Exemplar PRs:** #5264
**Frequency:** 1/10 PRs
**Trend:** New capability; foundational for future form complexity
**Confidence:** Medium

### CP-9: `freeze_time` for date-dependent validation tests
Tests for date-based validation (competition open/close windows) use `@freeze_time(TEST_DATE)` decorator from the `freezegun` library with parametrized date scenarios.

**Exemplar PRs:** #5000, #5146
**Frequency:** 3/10 PRs
**Trend:** Standard approach for time-dependent tests
**Confidence:** High

### CP-10: Factory `.build()` for unit tests, `.create()` for integration tests
Validation unit tests that do not need database persistence use `Factory.build()`, while integration/route tests use `Factory.create()` which commits to the database.

**Exemplar PRs:** #5073 (test_application_validation.py uses .build()), #5076 (test_application_routes.py uses .create())
**Frequency:** Consistent across all test PRs
**Trend:** Stable convention
**Confidence:** High

---

## 3. Corrective Patterns (Reviewer Enforcement)

### RE-1: Use specific validation error types, not generic ones
Reviewer (chouinar) pushed for specific error types (e.g., `competition_not_yet_open` instead of a generic error) because the frontend uses these for message mapping.

**Exemplar PRs:** #5000 ("For the type, could we put something more specific?")
**Frequency:** 2/10 PRs
**Confidence:** High

### RE-2: Use `logger.info()` not `logger.warning()` for 4xx errors
Warning-level logs trigger alerts in New Relic. Client validation errors (4xx) are expected and should be logged at info level.

**Exemplar PRs:** #4936 ("Warning logs will alert us, we don't want to be alerted for 4xx errors")
**Frequency:** 1/10 PRs but universally applicable
**Confidence:** High

### RE-3: No variable text in log messages
Log messages should be static strings. Dynamic values go in `extra={}` parameter to enable consistent querying in New Relic.

**Exemplar PRs:** #4936 ("To make it easier to look things up, we should try to avoid putting any variable text in the message")
**Frequency:** 1/10 PRs
**Confidence:** High

### RE-4: Consolidate duplicate validation logic
When the same validation (e.g., competition open check) was implemented separately in `create_application.py` and `submit_application.py`, reviewer directed consolidation into `application_validation.py`.

**Exemplar PRs:** #5146
**Frequency:** 1/10 PRs
**Trend:** Refactoring toward DRY validation
**Confidence:** High

### RE-5: Flatten log key names
Dotted/nested log keys (e.g., `application.application_id`) were corrected to flat keys (e.g., `application_id`) for consistency and easier cross-system querying.

**Exemplar PRs:** #4936 (reviewer referenced issue #4806)
**Frequency:** 1/10 PRs
**Confidence:** High

### RE-6: Be cautious about logging PII in validation errors
Reviewer flagged potential PII concerns when adding `value` field to error responses. The team decided to limit `value` to non-PII data like UUIDs.

**Exemplar PRs:** #5073
**Frequency:** 1/10 PRs
**Confidence:** Medium

---

## 4. Anti-Patterns (Flagged as Wrong)

### AP-1: Validation logic duplicated across services
Having the same date-comparison logic in both `create_application.py` and `submit_application.py` was refactored into a single `validate_competition_open()` function.

**Exemplar PRs:** #5146
**Confidence:** High

### AP-2: Overly specific error types that fragment unnecessarily
`COMPETITION_NOT_YET_OPEN` and `COMPETITION_ALREADY_CLOSED` were consolidated into a single `COMPETITION_NOT_OPEN` type because the distinction was not useful to the frontend.

**Exemplar PRs:** #5146
**Confidence:** High

### AP-3: Including dynamic IDs in error messages
Error messages like `f"Competition with ID {competition_id} not found"` were simplified to `"Competition not found"` because the ID is already in the request context logs.

**Exemplar PRs:** #5000 (changed 404 message)
**Confidence:** Medium

### AP-4: Parametrized test including the happy path case
In PR #4936, a parametrized test for forbidden statuses incorrectly included `IN_PROGRESS` as a parameter, then had to special-case it inside the test body. This was not explicitly flagged but represents an anti-pattern in test design.

**Exemplar PRs:** #4936
**Confidence:** Medium

---

## 5. Connections to Other Domains

### CD-1: Validation <-> Auth
Validation error types include auth-related types (`UNAUTHORIZED_APPLICATION_ACCESS`). The `auth_utils.py` service uses validation infrastructure (`raise_flask_error` with validation_issues). Auth access checks are interwoven with service-layer validation.

**Exemplar PRs:** #5076, #5434
**Connection strength:** Strong

### CD-2: Validation <-> Frontend Hooks
The `ValidationErrorType` enum values are a contract consumed by the frontend. The frontend maps error types to localized user messages. Changes to error types require frontend coordination.

**Exemplar PRs:** #5000 (reviewer: "The type is effectively what the frontend will use")
**Connection strength:** Strong (contractual)

### CD-3: Validation <-> Competition/Application Models
Validation functions depend on model relationships (competition forms, application status). The `Competition.is_open` property was introduced as a validation convenience that is also exposed in the API response.

**Exemplar PRs:** #5146
**Connection strength:** Strong

### CD-4: Validation <-> JSON Schema / Rule Processing
Form validation has two layers: standard JSON Schema validation and custom rule processing. Both feed into the same `ValidationErrorDetail` error structure.

**Exemplar PRs:** #5073, #5264
**Connection strength:** Strong
