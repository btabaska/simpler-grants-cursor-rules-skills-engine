# Forms Domain (Vertical Slice) — Conventions & Rules

> **Status:** Draft — pending tech lead validation. Items marked (⏳) are
> awaiting team confirmation. All other patterns reflect high-confidence
> conventions observed consistently across the codebase.

## Overview

The grant application forms domain (SF-424, SF-424A, SF-424B, SF-424D, SFLLL, CD511, attachment forms, budget narratives) is a self-contained vertical slice that spans multiple API layers with unique characteristics not shared by other domains. It is built on a three-schema architecture (JSON Schema for validation, UI Schema for rendering, Rule Schema for business logic), with XML output generation that must match legacy Grants.gov format exactly. The domain touches database models (`Application`, `ApplicationForm`, `CompetitionForm`, `Form`, `ApplicationAttachment`), service layer functions, route handlers, validation infrastructure, and XML generation.

The forms domain operates under a non-blocking validation model: users can save partial form data at any point, receiving validation issues as warnings. Only at submission time do validation errors become blocking. This design supports the reality that complex federal forms are filled out across multiple sessions and pages. Legacy Grants.gov compatibility is a hard constraint — XML output must match element ordering, namespace declarations, and attribute values expected by downstream systems.

**chouinar** is the primary authority on form schema architecture, validation patterns, and XML transform design. **doug-s-nava** enforces PDF-aligned UI section labels. For general API patterns (logging, error handling, service layer separation), see the domain-specific rule documents. For cross-cutting patterns, see [Cross-Domain Conventions](cross-domain.md).

## Rules

### Three-Schema Architecture

#### Rule: Three-Schema Form Definition (JSON Schema + UI Schema + Rule Schema)
**Confidence:** High
**Observed in:** 30+ of 108 PRs | PR refs: #6846, #5264

ALWAYS define every form with three co-located schemas: `FORM_JSON_SCHEMA` (validation), `FORM_UI_SCHEMA` (rendering), and `FORM_RULE_SCHEMA` (pre/post population and custom validation). ALWAYS bundle these into a static `Form` model instance exported from the form file and registered in `get_active_forms()`.

**DO:**
```python
# From PR #6846 — form registration in get_active_forms()
# api/src/form_schema/forms/__init__.py
def get_active_forms() -> list[Form]:
    """Get all active forms."""
    return [
        SF424_v4_0,
        SF424a_v1_0,
        SF424b_v1_1,
        SFLLL_v2_0,
        ProjectAbstractSummary_v2_0,
        BudgetNarrativeAttachment_v1_2,
        ProjectNarrativeAttachment_v1_2,
    ]
```

**DON'T:**
```python
# Anti-pattern — fetching forms from the database at runtime
# Forms were initially DB-fetched; PR #6846 changed this to static Python objects
def get_forms(db_session):
    return db_session.query(Form).all()  # WRONG: introduces environment drift and DB dependency
```

> **Rationale:** Bundling three schemas per form keeps validation, rendering, and business-rule logic co-located. Defining forms as static Python objects (not DB-fetched) eliminates environment drift and DB dependency for form management tasks.

---

#### Rule: JSON Schema Draft 2020-12 with Custom Validator
**Confidence:** High
**Observed in:** Universal across all validation paths | PR refs: #4314, #5416

ALWAYS use JSON Schema Draft 2020-12 via the `jsonschema` Python library for form validation. ALWAYS enable format validation via `format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER`. ALWAYS use the custom `OUR_VALIDATOR` (which extends Draft2020-12 with correct required-field paths) rather than the stock validator.

**DO:**
```python
# From PR #5416 — custom validator with correct required-field paths
# api/src/form_schema/jsonschema_validator.py
def _required(
    validator: jsonschema.Draft202012Validator,
    required: typing.Any,
    instance: typing.Any,
    _: typing.Any,
) -> typing.Generator[jsonschema.ValidationError]:
    if not validator.is_type(instance, "object"):
        return
    for field_name in required:
        if field_name not in instance:
            yield jsonschema.ValidationError(
                f"{field_name!r} is a required property", path=[field_name]
            )

OUR_VALIDATOR = jsonschema.validators.extend(
    validator=jsonschema.Draft202012Validator, validators={"required": _required}
)
```

**DON'T:**
```python
# Anti-pattern — using stock validator reports errors at parent path
validator = jsonschema.Draft202012Validator(json_schema)
# Stock validator reports required field errors at $ instead of $.field_name
```

> **Rationale:** The custom `_required` validator fixes a 10+ year gap in the jsonschema library where required-field errors are reported at the parent path (`$`) rather than the missing field's path (`$.field_name`). Format validation must be explicitly enabled since the JSON Schema spec leaves it off by default.

---

#### Rule: Fail Loudly on Invalid Schemas
**Confidence:** High
**Observed in:** Every validation call | PR refs: #4314

ALWAYS call `check_schema()` on every JSON schema before using it for validation. ALWAYS let `SchemaError` propagate (resulting in a 500 response in the API). NEVER silently accept invalid schemas.

**DO:**
```python
# From PR #4314 — schema validity check
# api/src/form_schema/jsonschema_validator.py
try:
    OUR_VALIDATOR.check_schema(json_schema)
except jsonschema.exceptions.SchemaError:
    logger.exception("Invalid json schema found, cannot validate")
    raise
```

**DON'T:**
```python
# Anti-pattern — proceeding with validation on an invalid schema
# The jsonschema library silently produces undefined behavior with invalid schemas
validator = OUR_VALIDATOR(json_schema)  # WRONG: no check_schema() call
errors = list(validator.iter_errors(data))
# Reviewer joshtonava: "I think it would be better to fail loudly in this case"
```

> **Rationale:** The jsonschema library silently produces undefined behavior with invalid schemas. An invalid schema in production is a critical bug that should surface immediately as a 500, not produce silent incorrect validation results.

---

#### Rule: Shared Schemas with URI-Based $ref Resolution
**Confidence:** High
**Observed in:** All forms with shared types | PR refs: #6727, #6846

ALWAYS reference shared schema fields via `"$ref": shared_schema.field_ref("field_name")`. ALWAYS resolve all `$ref` references before storing schemas in the DB or using them for validation (using `resolve_jsonschema()` with the `jsonref` library, `lazy_load=False`, `proxies=False`). NEVER require network calls for schema resolution.

**DO:**
```python
# From PR #6727 — SharedSchema class with URI-based references
# api/src/form_schema/shared/shared_schema.py
@dataclasses.dataclass
class SharedSchema:
    schema_name: str
    json_schema: dict[str, Any]
    schema_uri: str = dataclasses.field(init=False)

    def __post_init__(self) -> None:
        config = get_shared_schema_config()
        self.schema_uri = file_util.join(config.shared_schema_base_uri, self.schema_name + ".json")

    def field_ref(self, field: str) -> str:
        return f"{self.schema_uri}#/{field}"
```

**DON'T:**
```python
# Anti-pattern — using $ref URIs that require network fetching
# or leaving $ref unresolved in stored schemas
{"$ref": "https://external-server.com/schemas/address.json"}  # WRONG: requires network call
```

> **Rationale:** Resolving `$ref` before storage means consumers (frontend, validators) never need to fetch external schemas. The custom loader maps URIs to in-memory shared schema objects, avoiding network dependency. Deep-copying before resolution prevents mutating global form objects.

---

### Non-Blocking Validation

#### Rule: Non-Blocking Validation with Warnings
**Confidence:** High
**Observed in:** Every form save and validation call | PR refs: #4314

ALWAYS return validation issues as `warnings` in the PUT response body. NEVER block a user from saving partial form data due to validation errors. Only block at submission time.

**DO:**
```python
# From PR #4314 — warnings returned but save succeeds
# api/src/services/applications/update_application_form.py
warnings: list[ValidationErrorDetail] = validate_json_schema_for_form(
    application_response, form
)
# Save proceeds regardless of warnings
```

**DON'T:**
```python
# Anti-pattern — blocking save on validation errors
if validation_issues:
    raise_flask_error(422, "Validation failed", validation_issues=validation_issues)
    # WRONG: user cannot save partial form data
```

> **Rationale:** Users fill out complex federal forms across multiple sessions and pages. Blocking saves on partial data would make the UX unusable. From PR #4314: "The validation doesn't prevent or in any way block a users answers from being filled out, it's just the current set of open issues."

---

#### Rule: Recursive Rule Schema Processing
**Confidence:** High
**Observed in:** 8+ PRs | PR refs: #5264, #8408

ALWAYS structure rule schemas to mirror the JSON response shape. ALWAYS use the `handlers` dict (`gg_pre_population`, `gg_post_population`, `gg_validation`) to dispatch processing. ALWAYS use `JsonRuleContext` with a deep-copied `json_data` to avoid partial mutations on error.

**DO:**
```python
# From PR #5264 — recursive processor with handler mapping
# api/src/form_schema/rule_processing/json_rule_processor.py
handlers: dict[str, Callable[...]] = {
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

**DON'T:**
```python
# Anti-pattern — processing rules without deep copy risks partial mutations
context.json_data = context.application_form.application_response  # WRONG: no deep copy
# If rule processing fails midway, the original data is partially corrupted
```

> **Rationale:** The recursive approach means adding a new rule only requires: (1) a handler function, (2) a mapper entry, (3) the rule in the form's rule schema. Deep-copying prevents partial mutations from corrupting saved data if rule processing fails partway through.

---

### XML Transform

#### Rule: Declarative XML Transform Rules
**Confidence:** High
**Observed in:** 15+ PRs | PR refs: #8422, #8460, #8633

ALWAYS define XML generation rules as a declarative `FORM_XML_TRANSFORM_RULES` dict co-located with the form. ALWAYS include a `_metadata` key with namespace declarations, root element config, and XSD URL. ALWAYS include `att`, `glob`, and `globLib` namespaces even if the form does not currently use attachments.

**DO:**
```python
# From PR #8422 — SF424B transform rules with required namespaces
"_metadata": {
    "namespaces": {
        "default": "http://apply.grants.gov/forms/SF424B-V1.1",
        "SF424B": "http://apply.grants.gov/forms/SF424B-V1.1",
        "att": "http://apply.grants.gov/system/Attachments-V1.0",
        "globLib": "http://apply.grants.gov/system/GlobalLibrary-V2.0",
        "glob": "http://apply.grants.gov/system/Global-V1.0",
    },
    ...
}
```

**DON'T:**
```python
# Anti-pattern — missing att namespace (fixed in PR #8633)
# Before (missing att):
"namespaces": {
    "default": "...", "GG_LobbyingForm": "...",
    "globLib": "...", "glob": "...",
}
# Legacy Grants.gov systems expect all four namespace prefixes; omitting even
# unused namespaces causes XSD validation failures
```

> **Rationale:** Declarative transform rules keep XML generation logic separate from the generation engine. Legacy Grants.gov systems expect all four namespace prefixes in the XML output for XSD validation; omitting even unused namespaces causes validation failures.

---

#### Rule: Static Values for Non-Input XML Fields
**Confidence:** High
**Observed in:** 5+ PRs | PR refs: #8422, #8452

ALWAYS use `"static_value"` in the XML transform config for fields that exist in the XSD but are NOT user-input (e.g., `FormVersionIdentifier`, `programType`). NEVER implement non-input XML fields as form fields in the JSON schema to avoid backwards compatibility issues.

**DO:**
```python
# From PR #8422 — FormVersionIdentifier as static value
"form_version_identifier": {
    "xml_transform": {
        "target": "FormVersionIdentifier",
        "namespace": "glob",
        "static_value": "1.1",
    }
}
```

**DON'T:**
```python
# Anti-pattern — mapping non-form field from input data
# Reviewer chouinar in PR #8452 warned against this:
# "This isn't a field in the form... I'd recommend moving any of this to just XML logic
#  if it's not in the form itself otherwise you might hit a backwards compatibility problem"
"root_attributes": {
    "programType": "program_type",  # WRONG: maps from input field
}
```

> **Rationale:** Adding non-input fields to the JSON schema creates form versioning problems. When the XSD requires a field that isn't user-controlled, it should live entirely in the XML transform layer using `static_value`.

---

#### Rule: Legacy Grants.gov XML Fidelity
**Confidence:** High
**Observed in:** 6 PRs | PR refs: #8422, #8452, #8460, #8633

ALWAYS verify generated XML matches legacy Grants.gov XML output including: (1) `FormVersionIdentifier` as the first child element per XSD, (2) all namespace declarations present, (3) element order matching XSD sequence, (4) attribute values matching legacy format. ALWAYS include legacy XML comparison tests for each form.

**DO:**
```python
# From PR #8422 — test verifying FormVersionIdentifier is first child
def test_generate_sf424b_xml_matches_legacy_format(self):
    ...
    # Verify FormVersionIdentifier is the FIRST child element
    first_child = next(iter(root))
    assert (
        first_child.tag == "{http://apply.grants.gov/system/Global-V1.0}FormVersionIdentifier"
    ), "FormVersionIdentifier must be the first child element per XSD"

    # Verify element order (critical for XSD compliance)
    children = list(root)
    child_tags = [child.tag for child in children]
    expected_order = [
        "{http://apply.grants.gov/system/Global-V1.0}FormVersionIdentifier",
        "{http://apply.grants.gov/forms/SF424B-V1.1}AuthorizedRepresentative",
        "{http://apply.grants.gov/forms/SF424B-V1.1}ApplicantOrganizationName",
        "{http://apply.grants.gov/forms/SF424B-V1.1}SubmittedDate",
    ]
    assert child_tags == expected_order
```

**DON'T:**
```python
# Anti-pattern — generating XML without verifying legacy format compliance
def test_generate_xml(self):
    xml = generate_xml(form_data)
    assert xml is not None  # WRONG: no structure, ordering, or namespace verification
```

> **Rationale:** Grants.gov downstream systems are sensitive to XML structure. Element ordering, namespace declarations, and attribute presence must match the XSD schemas exactly. Legacy XML samples serve as the ground truth.

---

### Form-Specific Conventions

#### Rule: UI Schema Section Labels Must Match PDF Form Numbering
**Confidence:** High
**Observed in:** 6+ PRs | PR refs: #6584, #6589, #6652

ALWAYS number and label UI schema sections to match the official PDF form. When the PDF and the legacy instructions conflict, use the PDF as the source of truth.

**DO:**
```python
# From PR #6584 — section labels matching the PDF
{"type": "section", "label": "1. Type of Federal Action", ...}
{"type": "section", "label": "2. Status of Federal Action", ...}
{"type": "section", "label": "6. Federal Department/Agency", ...}
{"type": "section", "label": "7. Federal Program Name/Description", ...}
```

**DON'T:**
```python
# Anti-pattern — section labels that don't match PDF numbering
{"type": "section", "label": "1. Background", ...}  # WRONG: not the PDF label
{"type": "section", "label": "5. Details", ...}  # WRONG: skips numbers, wrong label
# Reviewer doug-s-nava: "directions have likely outdated names here... I think
# what's here is better, and it matches pdf"
```

> **Rationale:** Federal applicants are familiar with the PDF forms. Matching section numbers and labels reduces confusion. Legacy Grants.gov instructions are often outdated and inconsistent with the actual PDFs and XSDs.

---

#### Rule: Enum Values as "Code: Label" Format
**Confidence:** High
**Observed in:** All forms with state/country fields | PR refs: #4525, #6727

ALWAYS format enum values for states and countries as `"XX: Full Name"` (e.g., `"NY: New York"`, `"USA: UNITED STATES"`). ALWAYS source these from `shared_form_constants.py` (originally derived from `UniversalCodes-V2.0.xsd`).

**DO:**
```python
# From PR #6727 — address schema using enum constants
"state_code": {
    "type": "string",
    "title": "State",
    "description": "US State or Territory Code",
    "enum": shared_form_constants.STATES,  # Contains "AL: Alabama", "AK: Alaska", etc.
},
```

**DON'T:**
```python
# Anti-pattern — enum values without code prefix
"state": {
    "enum": ["Alabama", "Alaska", ...],  # WRONG: no code prefix for machine parsing
}
```

> **Rationale:** The "Code: Label" format allows both machine parsing (split on `:`) and human readability in dropdowns. Sourced from the Grants.gov universal codes XSD for compatibility.

---

#### Rule: Conditional US Address Validation via allOf/if-then
**Confidence:** High
**Observed in:** All forms with address fields | PR refs: #6727

ALWAYS use JSON Schema `allOf` with `if/then` to conditionally require `state` and `zip_code` when `country` is `"USA: UNITED STATES"`.

**DO:**
```python
# From PR #6727 — conditional address validation
# api/src/form_schema/shared/address_shared.py
"allOf": [
    {
        "if": {
            "properties": {"country": {"const": "USA: UNITED STATES"}},
            "required": ["country"],  # Only run rule if country is set
        },
        "then": {"required": ["state", "zip_code"]},
    },
],
```

**DON'T:**
```python
# Anti-pattern — always requiring state and zip_code
"required": ["street", "city", "state", "zip_code", "country"]
# WRONG: state and zip_code are only meaningful for US addresses
```

> **Rationale:** State and zip code are only meaningful for US addresses. The `required: ["country"]` guard ensures the conditional only fires when the country field is actually provided, preventing false positives on partially filled forms.

---

#### Rule: Set Relationships, Not Foreign Keys Directly
**Confidence:** High
**Observed in:** Reviewer-enforced across form domain | PR refs: #8408

ALWAYS set SQLAlchemy relationships (e.g., `application.submitted_by_user = user`) rather than directly setting foreign keys (e.g., `application.submitted_by = user.user_id`). NEVER set both the relationship and the FK.

**DO:**
```python
# From PR #8408 — correct relationship assignment
application.submitted_by_user = user
```

**DON'T:**
```python
# Anti-pattern — setting FK directly
application.submitted_by = user.user_id
# Reviewer chouinar: "Setting a relationship should also immediately/implicitly set
# the ID, we almost never directly set IDs... If you're seeing an issue by not having
# both, my immediate assumption would be that there is a bug somewhere"
```

> **Rationale:** Setting the relationship lets SQLAlchemy manage the FK transparently. Direct FK assignment bypasses ORM tracking and can cause subtle bugs (e.g., the FK not being populated until a flush).

---

#### Rule: Keep the Builder Dumb
**Confidence:** High
**Observed in:** 3 reviewer corrections | PR refs: #4350, #4525

NEVER put domain-specific logic (e.g., state/country detection, standard definitions) in `JsonSchemaBuilder`. ALWAYS keep detection and mapping logic in the calling layer (`csv_to_jsonschema.py`). The builder should only know about JSON Schema types, not form-specific semantics.

**DO:**
```python
# From PR #4466 — builder provides only generic methods
class JsonSchemaBuilder:
    def add_string_property(self, name, is_required, ...) -> Self: ...
    def add_bool_property(self, name, is_required, ...) -> Self: ...
    def add_int_property(self, name, is_required, ...) -> Self: ...
    def add_sub_object(self, name, is_required, builder, ...) -> Self: ...
    def build(self) -> dict: ...
    def build_ui_schema(self) -> list: ...
```

**DON'T:**
```python
# Anti-pattern — domain-specific logic in the builder
class JsonSchemaBuilder:
    def add_state_field(self, name):  # WRONG: builder knows about states
        self.add_string_property(name, enum=STATES)
```

> **Rationale:** Keeping the builder generic makes it reusable across different form-parsing pipelines. Domain-specific logic (which fields are states, which are dates) belongs in the layer that understands the source data format.

---

#### Rule: Single Path, No Fallbacks for Malformed Data
**Confidence:** High
**Observed in:** 3+ reviewer corrections | PR refs: #6712, #8408

NEVER add placeholder values, fallback paths, or silent error handling for malformed form data. ALWAYS let errors propagate. If data is malformed, it should error, not silently produce incorrect output.

**DO:**
```python
# From PR #8408 — explicit handling only for known incomplete states
def get_signature(context: JsonRuleContext, json_rule: JsonRule) -> str | None:
    application = context.application_form.application
    if application.submitted_by_user and application.submitted_by_user.email:
        return application.submitted_by_user.email
    return UNKNOWN_VALUE  # Known case: no email yet, explicitly logged
```

**DON'T:**
```python
# Anti-pattern — silent fallback on malformed data
# Reviewer chouinar in PR #6712: "If data is ever malformed just let it error."
try:
    attachment = process_attachment(data)
except Exception:
    attachment = PlaceholderAttachment()  # WRONG: masks the bug
```

> **Rationale:** Silent fallbacks mask bugs. In a federal form submission system, silently producing wrong data is worse than erroring.

---

#### Rule: Attachment Transform via String UUID Mapping
**Confidence:** High
**Observed in:** 3 PRs | PR refs: #5264, #6712

ALWAYS use `str(UUID)` as mapping keys for attachment lookups (not `UUID` objects). ALWAYS store attachment fields in form JSON as UUID strings referencing `application_attachment` records. ALWAYS make attachment field configuration data-driven (in the transform config), not hardcoded in transformer code.

**DO:**
```python
# From PR #5264 — attachment validation using string comparison
application_attachment_ids = [
    str(application_attachment.application_attachment_id)
    for application_attachment in context.application_form.application.application_attachments
]
if isinstance(value, str) and value not in application_attachment_ids:
    context.validation_issues.append(
        ValidationErrorDetail(
            type=ValidationErrorType.UNKNOWN_APPLICATION_ATTACHMENT,
            message="Field references application_attachment_id not on the application",
            field=build_path_str(path),
            value=value,
        )
    )
```

**DON'T:**
```python
# Anti-pattern — using UUID objects as keys
attachment_map = {att.application_attachment_id: att for att in attachments}
# WRONG: JSON data stores UUIDs as strings; UUID objects require conversion at every lookup
```

> **Rationale:** JSON stores UUIDs as strings. Using `UUID` objects as keys requires conversion at every lookup. String keys eliminate unnecessary conversion and reduce bugs from type mismatches.

---

#### Rule: DAT-to-Schema CLI as Rough Starting Point
**Confidence:** High
**Observed in:** 4 PRs | PR refs: #4350, #4466, #4525

ALWAYS treat the output of `make dat-to-jsonschema` as a rough starting point requiring manual field-by-field cleanup. ALWAYS use `Agency Field Name` (not `Field ID`) as the JSON property key. ALWAYS skip "button" and "radio" field implementations.

**DO:**
```python
# From PR #4466 — CLI generates both JSON schema and UI schema
def csv_to_jsonschema(csv_content: str) -> tuple[dict[str, Any], list]:
    ...
    json_schema = schema_builder.build()
    ui_schema = schema_builder.build_ui_schema()
    return json_schema, ui_schema
```

**DON'T:**
```python
# Anti-pattern — using CLI output directly without manual review
# The XLS/DAT files from Grants.gov contain inconsistencies, missing information,
# and legacy naming. CLI output requires manual cleanup for field names, enum values,
# conditional logic, and PDF alignment.
```

> **Rationale:** Automated conversion gets the structure right but human review is essential for field names, enum values, conditional logic, and PDF alignment.

---

### Form Testing

#### Rule: Minimal/Full/Empty Validation Test Triad
**Confidence:** High
**Observed in:** Every form | PR refs: #6846

ALWAYS write three core validation tests for every form: `test_*_minimal_valid_json` (only required fields), `test_*_full_valid_json` (all fields populated), and `test_*_empty_json` (verifying exact count and paths of required-field errors). ALWAYS use the shared `validate_required()` helper and session-scoped resolved-form fixtures from `conftest.py`.

**DO:**
```python
# From PR #6846 — shared conftest with resolved forms and validate_required
# api/tests/src/form_schema/forms/conftest.py
def validate_required(data: dict, expected_required_fields: list[str], form: Form):
    validation_issues = validate_json_schema_for_form(data, form)
    assert len(validation_issues) == len(expected_required_fields)
    for validation_issue in validation_issues:
        assert validation_issue.type == "required"
        assert validation_issue.field in expected_required_fields

def test_budget_narrative_v1_2_empty_json(budget_narrative_attachment_v1_2):
    validate_required({}, ["$.attachments"], budget_narrative_attachment_v1_2)
```

**DON'T:**
```python
# Anti-pattern — per-file validate_required helper (pre-#6846)
# Each form test file defined its own identical validate_required() function.
# Consolidated into conftest.py in PR #6846.
```

> **Rationale:** The triad ensures: (1) required fields are correctly specified (empty test), (2) a minimal valid payload passes (no over-constraining), (3) a fully populated payload passes (no type mismatches). Session-scoped fixtures avoid repeated schema resolution overhead.

---

#### Rule: Factory-Based Test Data Setup
**Confidence:** High
**Observed in:** All form-related tests | PR refs: #4314, #8408

ALWAYS use factory classes (`FormFactory`, `ApplicationFactory`, `CompetitionFactory`, `ApplicationFormFactory`, `CompetitionFormFactory`) to create test data. ALWAYS pass schemas via kwargs (e.g., `form_json_schema=...`, `form_rule_schema=...`). Use `setup_application_for_form_validation()` to create the full hierarchy.

**DO:**
```python
# From PR #4314 — factory usage in route tests
application = ApplicationFactory.create()
form = FormFactory.create(form_json_schema=SIMPLE_JSON_SCHEMA)
CompetitionFormFactory.create(competition=application.competition, form=form)
existing_form = ApplicationFormFactory.create(
    application=application, form=form, application_response={"name": "Original Name"},
)
```

**DON'T:**
```python
# Anti-pattern — manually constructing test data without factories
form = Form(form_id=uuid4(), form_json_schema={...})
db_session.add(form)
# WRONG: bypasses factory defaults and consistency checks
```

> **Rationale:** Factories ensure test data is consistent and reduce boilerplate. The `setup_application_for_form_validation()` helper encapsulates the multi-table relationship setup that every form validation test needs.

---

#### Rule: Page Object Model for E2E Form Tests (⏳)
**Confidence:** Medium
**Observed in:** 2 PRs (newly introduced) | PR refs: #8867

For E2E tests involving complex form interactions, ALWAYS use the Page Object Model (POM) pattern: separate test data into fixture files, form metadata/field mappings into page object files, and generic form-filling logic into shared utility files.

**DO:**
```typescript
// From PR #8867 — page object for SF-LLL form
// page-objects/sflll-form.page.ts
export const SFLLL_FORM_CONFIG = {
  formName: "Disclosure of Lobbying Activities (SF-LLL)",
  ...FORM_DEFAULTS,
} as const;

export function getSflllFillFields(data: SflllEntityData): FillFieldDefinition[] {
  return [
    { selector: "#federal_action_type", value: data.federalAction.type, type: "dropdown", section: "Section 1", field: "Type of Federal Action" },
    { testId: "material_change_year", value: data.materialChange.year, type: "text", section: "Section 3", field: "Material Change Year" },
  ];
}
```

**DON'T:**
```typescript
// Anti-pattern — all form-filling logic inline in spec file
test("should fill SFLLL form", async ({ page }) => {
  await page.locator("#federal_action_type").selectOption("Grant");
  await page.locator("#material_change_year").fill("2026");
  // ... hundreds of lines of inline form interaction
});
```

> **Rationale:** As the application adds more complex government forms, separating test data, page objects, and interaction logic prevents spec files from becoming unmanageably long and makes it easy to add tests for new form types.

---

## Anti-Patterns

### Hardcoded Configuration in Transformer Code
PR #6712: Attachment field names and XML elements were hardcoded in the transformer class. Fixed by moving to form-specific configuration dicts (`attachment_fields` in transform rules).

### Using Field ID Instead of Agency Field Name
PR #4350: Initial CSV-to-schema used `Field ID` (human-readable label) as the property key. Fixed by switching to `Agency Field Name` which matches the XML/XSD field naming convention.

### DB-Dependent Form Task Scripts
PR #6846: Form management CLI tasks required a DB session to fetch forms. Fixed by making forms static Python objects; tasks no longer need DB sessions.

### Section Labels Not Matching PDF
PRs #6584, #6589, #6652: Section labels drifted from the official PDF forms. Fixed by systematic alignment pass. Reviewer noted that legacy instructions are "outdated and inconsistent" so PDFs should be the source of truth.

---

## Known Inconsistencies

1. **Rule Schema Array Support:** Rule schemas currently do not support list fields (arrays of objects). This is called out in the README as a known limitation for future work.

2. **Legacy XML Sample Management:** It is unclear whether there is a centralized set of legacy XML samples for regression testing, or if each PR author produces their own.

3. **Feature Flag for Forms Endpoints:** The forms endpoints may be gated behind `ENABLE_APPLY_ENDPOINTS` but the specific flag naming and lifecycle is not documented in the forms domain.

---

## Related Documents

- [Cross-Domain Conventions](cross-domain.md) — AP-5 (Non-Blocking UX), AP-7 (Legacy Compatibility), CCP-3 (Factory Pattern), CCP-4 (ValidationErrorDetail)
- [Infrastructure Conventions](infra.md) — SSM parameters for form-related feature flags
- [CI/CD Conventions](ci-cd.md) — E2E test sharding, Playwright configuration
- `analysis/pass2/api-form-schema.md` — Full Pass 2 codification with all 19 rules
- `analysis/pass1/api-form-schema.md` — Pass 1 pattern discovery
- `analysis/pass3/cross-domain-synthesis.md` — Forms domain assessment and recommendation
