# Pattern Discovery: API Form Schema (`api/src/form_schema/`)

**Source:** 108 merged PRs from HHS/simpler-grants-gov
**Analysis date:** 2026-03-27
**Domain:** Form definition, validation, rule processing, XML generation, shared schemas

---

## 1. Form Definition Patterns

### 1a. Three-Schema Architecture (JSON Schema + UI Schema + Rule Schema)

**Frequency:** Core to every form; established across ~30+ PRs
**Exemplar PRs:** #5410 (SF424 initial), #5264 (rule schema), #4466 (UI schema generation), #6846 (resolution pipeline)
**Trend:** Established early (April 2025), refined through October 2025, stable since
**Confidence:** Very High

Forms are defined with three co-located schemas:
- `FORM_JSON_SCHEMA` -- a JSON Schema Draft 2020-12 object defining field types, constraints, required fields, and conditional validation
- `FORM_UI_SCHEMA` -- a list of section/field descriptors controlling frontend rendering order and grouping
- `FORM_RULE_SCHEMA` -- a dict mirroring the JSON response shape, containing pre-population, post-population, and custom validation rules

Each form file (e.g., `sf424.py`, `sflll.py`, `sf424a.py`) exports a `Form` model instance (e.g., `SF424_v4_0`) that bundles all three schemas plus metadata (form_id, form_name, version, form_type). Forms are registered in `api/src/form_schema/forms/__init__.py` via `get_active_forms()`.

### 1b. JSON Schema Draft 2020-12 as the Canonical Validation Standard

**Frequency:** Universal (every form)
**Exemplar PRs:** #4314 (first validator), #5416 (custom required validator), #5410 (SF424)
**Trend:** Locked in from day one
**Confidence:** Very High

All form validation uses JSON Schema Draft 2020-12 with the `jsonschema` Python library. Key conventions:
- Top-level schema is always `{"type": "object", "required": [...], "properties": {...}}`
- Conditional validation uses `allOf` with `if/then/else` blocks (e.g., "if application_type is Revision, then revision_type is required")
- Format validation is explicitly enabled via `format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER`
- Custom `_required` validator function overrides the default to include the field name in the path (`$.field_name` instead of `$`)

### 1c. UI Schema Structure: Section/Field/MultiField Hierarchy

**Frequency:** Every form with a UI; ~15+ PRs modifying UI schemas
**Exemplar PRs:** #6584, #6589, #6652, #6634, #6759
**Trend:** Evolved from flat sections (June 2025) to numbered, PDF-aligned sections (October 2025)
**Confidence:** High

UI schema is a list of objects with `type` ("section", "field", "multiField"), `label`, `name`, and `children`. Field definitions use JSON Pointer syntax: `"/properties/field_name"` or `"/properties/nested/properties/sub_field"`. Sections are labeled with numbers matching the PDF form (e.g., "1. Type of Submission", "8e. Organizational Unit").

Reviewer feedback repeatedly pushed for alignment between section labels and the official PDF/instructions. Inconsistencies in the legacy Grants.gov instructions vs. PDFs vs. XSD were a recurring friction point.

### 1d. Form Object as Static Python Instance (Not DB-driven)

**Frequency:** All forms follow this pattern post-#6846
**Exemplar PRs:** #5410 (initial), #6846 (resolved forms from code, not DB)
**Trend:** Shifted from DB-fetched forms to code-defined static Form instances in October 2025
**Confidence:** High

Forms were initially loaded from the DB for seeding/deployment. PR #6846 changed this so forms are defined purely in code and resolved at usage time. `get_active_forms()` returns a static list. The `BaseFormTask` no longer requires a DB session. Forms are synced to environments via CLI tasks (`update_form_task.py`, `list_forms_task.py`).

---

## 2. Validation Patterns

### 2a. Non-Blocking Validation with Warnings

**Frequency:** Foundational pattern, referenced in ~10+ PRs
**Exemplar PRs:** #4314 (initial validator)
**Trend:** Established early, stable throughout
**Confidence:** Very High

Validation does NOT block a user from saving partial form data. The PUT endpoint returns validation issues as `warnings` in the response body (list of `ValidationErrorDetail`). Blocking occurs only at submission time. This enables multi-page progressive form filling on the frontend.

Key data type: `ValidationErrorDetail(type, message, field, value)` -- frozen dataclass, hashable, with `field` using JSON path notation (`$.path.to.field`).

### 2b. Custom Validator Extension for Required Field Paths

**Frequency:** Single PR, but universal impact
**Exemplar PRs:** #5416
**Trend:** One-time fix to a known 10+ year gap in the jsonschema library
**Confidence:** Very High

The default jsonschema library reports required field errors at the parent path (`$`) rather than the missing field path (`$.field_name`). The codebase extends `Draft202012Validator` with a custom `_required` function that yields errors with `path=[field_name]`, producing paths like `$.nested.missing_field`. This is stored in `OUR_VALIDATOR`.

### 2c. Schema Validity Check Before Validation

**Frequency:** Every validation call
**Exemplar PRs:** #4314 (introduced after reviewer question)
**Trend:** Added after reviewer explicitly asked "Does this throw if the json_schema is invalid?"
**Confidence:** High

The validator calls `check_schema()` on every schema before using it and raises `SchemaError` on invalid schemas. Reviewer comment (joshtonava): "I think it would be better to fail loudly in this case." This became the established pattern.

### 2d. Resolved Schema Testing Pattern

**Frequency:** All form tests post-#6846
**Exemplar PRs:** #6846 (conftest with resolved forms)
**Trend:** Standardized in October 2025
**Confidence:** High

Form tests use a `conftest.py` that provides session-scoped fixtures of resolved forms. The `setup_resolved_form()` function deep-copies the form and resolves `$ref` references. A shared `validate_required()` helper asserts the exact count and paths of required field errors. Every form test follows the pattern: `test_*_minimal_valid_json`, `test_*_full_valid_json`, `test_*_empty_json` (checking required fields).

---

## 3. Transform Patterns

### 3a. XML Transform Configuration (FORM_XML_TRANSFORM_RULES)

**Frequency:** Every form that needs XML generation; ~15+ PRs
**Exemplar PRs:** #6712 (attachments), #8422 (SF424B), #8452 (SF424A fix), #8460 (SF424D), #8633 (lobbying form)
**Trend:** Growing complexity from simple field mappings (June 2025) to complex transforms with attachments, conditionals, and array decomposition (Feb 2026)
**Confidence:** High

XML transform rules are a dict keyed by form field names. The `_metadata` key contains XML namespace declarations, root element config, and XSD URLs. Field entries have `"xml_transform": {"target": "XMLElementName"}` with optional `namespace`, `static_value`, `value_transform`, `compose_object`, and `type` attributes.

Key namespace convention: `"namespaces"` dict always includes `"default"`, the form-specific prefix (e.g., `"SF424B"`), `"att"` (Attachments-V1.0), `"glob"` (Global-V1.0), and `"globLib"` (GlobalLibrary-V2.0).

### 3b. Legacy XML Format Matching

**Frequency:** ~6 PRs (SF424B, SF424D, SF424A, SFLLL, GG Lobbying)
**Exemplar PRs:** #8422, #8460, #8633, #8452
**Trend:** Strong push in Feb 2026 to match legacy Grants.gov XML exactly
**Confidence:** High

A clear pattern of comparing generated XML against legacy Grants.gov samples. Tests verify:
- Exact namespace declaration order matching legacy
- `FormVersionIdentifier` as the first child element per XSD
- `static_value` for version identifiers (not mapped from input data)
- `att` namespace added to all forms (even if no current attachments)
- `programType` root attribute as static literal, not dynamic mapping

Reviewer (chouinar) warned against treating non-form-fields as form fields to avoid backwards compatibility problems.

### 3c. Attachment Transform via UUID Mapping

**Frequency:** ~3 PRs
**Exemplar PRs:** #6712 (initial), reviewer comments drove major simplification
**Trend:** Evolved from complex multi-path code to simplified UUID-string-keyed mapping
**Confidence:** High

Attachments in form JSON are stored as UUID strings referencing `application_attachment` records. At XML generation time, a mapping of `str(UUID) -> AttachmentInfo` is created from the application's attachment records. The `AttachmentTransformer` resolves UUIDs to `AttachmentFile` objects (filename, mime_type, file_location, SHA-1 hash) and generates XML with the `att:` namespace.

Reviewer (chouinar) pushed for: string UUIDs as keys (not UUID objects), configuration-driven attachment field config (not hardcoded), removing placeholder/fallback paths, and letting errors propagate on malformed data.

### 3d. Static Values for Non-Input Fields

**Frequency:** ~5 PRs
**Exemplar PRs:** #8422, #8452, #8460
**Trend:** Emerged Feb 2026 as a pattern for XML-only fields
**Confidence:** High

Fields that exist in the XSD but are not user-input (e.g., `FormVersionIdentifier`, `programType`) use `"static_value"` in the transform config rather than mapping from input data. Example:
```python
"form_version_identifier": {
    "xml_transform": {
        "target": "FormVersionIdentifier",
        "namespace": "glob",
        "static_value": "1.1",
    }
}
```

### 3e. Field Override Pattern for Array Decomposition

**Frequency:** 1-2 PRs
**Exemplar PRs:** #8452 (SF424A fix)
**Trend:** Emerging pattern for complex budget forms
**Confidence:** Medium

The `_transform_nested_field_names` function supports `field_overrides` -- a dict mapping source field names to override XML target names. This allows array items (like budget line items) to have different XML element names than the global mapping would produce.

---

## 4. Rule Processing / Form Lifecycle Patterns

### 4a. Recursive Rule Schema Processing (Pre/Post Population + Validation)

**Frequency:** Core pattern, ~8+ PRs
**Exemplar PRs:** #5264 (foundation), #8408 (signature update)
**Trend:** Established June 2025, incrementally extended with new rules
**Confidence:** Very High

Rule schemas mirror the JSON response structure. The processor recursively walks the rule schema, matching keys to handlers (`gg_pre_population`, `gg_post_population`, `gg_validation`). Each handler looks up the rule name in a mapper dict that maps to a function.

Pre-population rules: `opportunity_number`, `opportunity_title`, `agency_name` -- run when form is created/modified.
Post-population rules: `current_date`, `signature`, `competition_title` -- run at submission.
Validation rules: `attachment` -- validates attachment UUIDs exist on the application.

The `JsonRuleContext` holds a deep copy of the JSON data (to avoid partial mutations on error), the `ApplicationForm`, validation issues list, and a `JsonRuleConfig` controlling which rule groups to execute.

### 4b. Form-Competition-Application Relationship

**Frequency:** Implicit in all form PRs
**Exemplar PRs:** #4314, #5410, #6846
**Trend:** Stable
**Confidence:** High

Forms are attached to competitions via `CompetitionForm` (with `is_required` flag). Applications are linked to competitions. Application responses are stored in `ApplicationForm` with `application_response` (JSONB). The validation flow: load Form -> find CompetitionForm -> check Application -> validate ApplicationForm response.

### 4c. Signature Population Uses Submitting User

**Frequency:** 1 PR but corrective
**Exemplar PRs:** #8408
**Trend:** Bug fix in Feb 2026
**Confidence:** High

Initially, signature grabbed the first application user's email (arbitrary). PR #8408 fixed this to use `application.submitted_by_user.email`. The `submitted_by_user` relationship is set before validation runs but only persists if submission succeeds (transaction rollback on failure).

Reviewer discussion revealed a SQLAlchemy subtlety: setting a relationship (`application.submitted_by_user = user`) does not immediately populate the foreign key (`submitted_by`) until a flush occurs.

---

## 5. Shared Schema / Reuse Patterns

### 5a. Shared Schema with URI-Based $ref Resolution

**Frequency:** ~3 PRs
**Exemplar PRs:** #6727 (foundation), #6846 (resolution at usage)
**Trend:** Established October 2025
**Confidence:** High

Shared schemas (`address_shared`, `common_shared`) define reusable types (address, person_name, attachment). They are referenced in form schemas via `"$ref": shared_schema.field_ref("field_name")` which produces URIs like `https://files.simpler.grants.gov/schemas/address_shared_v1.json#/address`.

The `resolve_jsonschema()` function uses the `jsonref` library with a custom loader to resolve URIs to the shared schema definitions without network calls. Schemas are resolved before being stored in the DB or used for validation. The `jsonref` library is configured with `lazy_load=False` and `proxies=False` to produce plain dicts.

### 5b. Address Schema with Conditional US Validation

**Frequency:** Used in SF424, SFLLL, and shared schemas
**Exemplar PRs:** #6727
**Trend:** Stable shared pattern
**Confidence:** High

The shared address schema uses `allOf` with `if/then` to conditionally require `state` and `zip_code` when `country` is `"USA: UNITED STATES"`. State and country fields use enum lists from `shared_form_constants.py`.

### 5c. Enum Values as "Code: Label" Format

**Frequency:** All forms with state/country fields
**Exemplar PRs:** #4525 (enums), #5410 (SF424 usage)
**Trend:** Established early, stable
**Confidence:** High

Enum values follow the format `"XX: Full Name"` (e.g., `"NY: New York"`, `"USA: UNITED STATES"`). State and country enums are sourced from the Grants.gov `UniversalCodes-V2.0.xsd`. Shared definitions use `$defs` with `$ref` pointers for reuse.

---

## 6. DAT-to-Schema Conversion Pipeline

### 6a. XLS/DAT to JSON Schema CLI Tool

**Frequency:** ~4 PRs
**Exemplar PRs:** #4350 (initial), #4466 (UI schema), #4525 (enums), #4611 (title fix)
**Trend:** Built April 2025, incrementally improved, acknowledged as "rough" starting point
**Confidence:** High

Pipeline: XLS file -> pandas `read_excel` -> CSV string -> `csv_to_jsonschema()` -> `(json_schema, ui_schema)`. The CLI is `make dat-to-jsonschema args="path/to/file.xls"`. Output is explicitly described as a rough starting point requiring manual field-by-field cleanup.

Key design decisions (from reviewer feedback):
- Use `Agency Field Name` (not `Field ID`) as the property key to match XML/PDF naming
- Use `Field ID` as the `title` for display
- Skip "button" and "radio" field implementations
- Replace known enum placeholders with actual enum lists (states, countries)
- Keep the `JsonSchemaBuilder` "dumb and generic" -- detection logic belongs in the parsing layer

### 6b. JsonSchemaBuilder (Fluent Builder Pattern)

**Frequency:** ~5 PRs
**Exemplar PRs:** #4350, #4466, #4525
**Trend:** Evolved with new property types and features
**Confidence:** High

The `JsonSchemaBuilder` provides fluent methods: `add_string_property()`, `add_bool_property()`, `add_int_property()`, `add_float_property()`, `add_sub_object()`, `add_ref_property()`, `build()`, `build_ui_schema()`. Each method accepts `is_nullable`, `is_required`, optional `title` and `description`. The builder accumulates `properties`, `required_fields`, and `defs`, then produces a JSON Schema dict.

Reviewer enforced: builder should not contain domain-specific logic (e.g., state/country detection belongs in csv_to_jsonschema, not in the builder).

---

## 7. Corrective Patterns (Reviewer Enforcement)

### 7a. "Keep the Builder Dumb"

**Frequency:** 3 review comments
**Exemplar PRs:** #4525, #4350
**Reviewer:** chouinar
**Confidence:** High

State/country detection logic was initially placed in `JsonSchemaBuilder`. Reviewer moved it to `csv_to_jsonschema.py`. Standard definitions were initially auto-added by the builder; reviewer moved that to the calling code. Pattern: domain-specific logic belongs in the parsing/calling layer, not in generic utilities.

### 7b. "Fail Loudly on Invalid Schemas"

**Frequency:** 2 review comments
**Exemplar PRs:** #4314
**Reviewers:** joshtonava, chouinar
**Confidence:** High

The jsonschema library silently produces undefined behavior with invalid schemas. Reviewers demanded explicit `check_schema()` calls that raise on invalid schemas, plus test coverage for the invalid schema case.

### 7c. "Don't Implement Non-Form Fields as Form Fields"

**Frequency:** 2 review comments
**Exemplar PRs:** #8452 (SF424A fix)
**Reviewer:** chouinar
**Confidence:** High

For XML-only fields (e.g., `FormVersionIdentifier`, `programType`), reviewer warned against implementing them as form fields, which could cause backwards compatibility issues. Recommended: keep them as XML-only logic with `static_value`.

### 7d. "Use String UUIDs, Not UUID Objects, for Mapping Keys"

**Frequency:** 2 review comments
**Exemplar PRs:** #6712
**Reviewer:** chouinar
**Confidence:** High

Attachment mapping was initially keyed on `UUID` objects, requiring conversion everywhere. Reviewer simplified to `str(UUID)` keys since JSON data is already strings.

### 7e. "Remove Unnecessary Code Paths"

**Frequency:** 3+ review comments
**Exemplar PRs:** #6712 (attachment transformer)
**Reviewer:** chouinar
**Confidence:** High

Attachment transformer initially had multiple code paths for different data formats, placeholder attachments on error, and fallback behavior. Reviewer: "If data is ever malformed just let it error." Simplified to a single path assuming AttachmentInfo objects.

### 7f. "Set Relationships, Not Foreign Keys Directly"

**Frequency:** 2 review comments
**Exemplar PRs:** #8408
**Reviewer:** chouinar
**Confidence:** High

Setting `application.submitted_by = user.user_id` directly was flagged as an anti-pattern. Correct: `application.submitted_by_user = user`. The relationship handles the FK. If both are set, something is likely wrong.

---

## 8. Anti-Patterns Identified

### 8a. Hardcoded Configuration in Transformer Code

**Exemplar PRs:** #6712
**What happened:** Attachment field names and XML elements were hardcoded in the transformer class.
**Fix:** Moved to form-specific configuration dicts (`attachment_fields` in transform rules).

### 8b. Using Field ID Instead of Agency Field Name

**Exemplar PRs:** #4350
**What happened:** Initial CSV-to-schema used `Field ID` (human-readable label) as the property key.
**Fix:** Switched to `Agency Field Name` which matches the XML/XSD field naming convention.

### 8c. Redundant `validate_required` Helper Per Test File

**Exemplar PRs:** #6846
**What happened:** Each form test file defined its own `validate_required()` helper function with identical logic.
**Fix:** Consolidated into `tests/src/form_schema/forms/conftest.py`.

### 8d. DB-Dependent Form Task Scripts

**Exemplar PRs:** #6846
**What happened:** Form management CLI tasks required a DB session to fetch forms, mixing local DB state with deployment.
**Fix:** Forms are now defined in code; tasks no longer need DB sessions.

### 8e. Section Labels Not Matching PDF

**Exemplar PRs:** #6584, #6589, #6652
**What happened:** Section labels and field titles drifted from the official PDF forms.
**Fix:** Systematic alignment pass matching section numbers and labels to the PDF versions. Reviewer noted that instructions are "outdated and inconsistent" so PDFs should be the source of truth.

---

## 9. Testing Patterns

### 9a. Minimal/Full/Empty Validation Test Triad

**Frequency:** Every form
**Exemplar PRs:** #5410, #6846
**Confidence:** Very High

Every form has three core tests: `test_*_minimal_valid_json` (only required fields), `test_*_full_valid_json` (all fields populated), `test_*_empty_json` (verifying all required field errors). The empty test asserts exact count and paths.

### 9b. Legacy XML Comparison Tests

**Frequency:** ~5 PRs
**Exemplar PRs:** #8422, #8460
**Confidence:** High

XML generation tests parse generated XML with lxml, verify root element tags/attributes, check `FormVersionIdentifier` is the first child, and compare element order against XSD sequence requirements.

### 9c. Factory-Based Test Data Setup

**Frequency:** Universal
**Exemplar PRs:** #5264, #8408
**Confidence:** Very High

Tests use factory classes (`FormFactory`, `ApplicationFactory`, `CompetitionFactory`, `ApplicationFormFactory`, `CompetitionFormFactory`) to create test data. Form schemas are passed via `form_json_schema=...` and `form_rule_schema=...` kwargs. A `setup_application_for_form_validation()` helper in `tests/lib/data_factories.py` creates the full Application -> Competition -> Form -> ApplicationForm hierarchy.

---

## Summary of Key Conventions

| Convention | Status | Since |
|---|---|---|
| JSON Schema Draft 2020-12 | Locked | Apr 2025 |
| Three-schema architecture (JSON + UI + Rule) | Locked | Jun 2025 |
| Non-blocking validation (warnings not errors) | Locked | Apr 2025 |
| Forms defined as static Python objects | Locked | Oct 2025 |
| Shared schemas with URI-based $ref | Active | Oct 2025 |
| XML transforms via declarative config | Active | Oct 2025 |
| Legacy XML format matching | Active | Feb 2026 |
| Section labels matching PDF numbering | Active | Oct 2025 |
| DAT-to-schema CLI as rough starting point | Stable tool | Apr 2025 |
| Fail loudly on invalid schemas | Convention | Apr 2025 |
| Relationships over FK assignment | Convention | Feb 2026 |
