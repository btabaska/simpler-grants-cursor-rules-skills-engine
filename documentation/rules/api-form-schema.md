# API Form Schema -- Conventions & Rules

> **Status:** Draft -- pending tech lead validation. Items marked with a note are
> awaiting team confirmation. All other patterns reflect high-confidence
> conventions observed consistently across the codebase.

## Overview

The form schema domain (`api/src/form_schema/`) defines the architecture for federal grant application forms (SF-424, SF-424A, SF-424B, SFLLL, attachment forms, and others). Every form is defined as a static Python object bundling three co-located schemas: a JSON Schema for validation, a UI Schema for frontend rendering, and a Rule Schema for pre/post population and custom business logic. Forms are registered in `get_active_forms()` and synced to environments via CLI tasks -- they are not fetched from the database at runtime.

The validation strategy is deliberately non-blocking: users can save partial form data at any time, with validation issues returned as warnings in the PUT response. Blocking validation occurs only at submission time. This design supports the multi-page, multi-session form-filling workflow required for complex federal applications. JSON Schema Draft 2020-12 is the canonical validation standard, extended with a custom required-field validator (`OUR_VALIDATOR`) that fixes a long-standing path-reporting gap in the `jsonschema` library.

The domain also includes XML generation for legacy Grants.gov compatibility, using declarative transform rules that map form fields to XML elements with strict namespace, element ordering, and attribute fidelity requirements. Shared schemas enable field reuse across forms via URI-based `$ref` resolution without network calls. See also: [forms-vertical architecture guide] for the end-to-end form lifecycle, and [api-validation](./api-validation.md) for the broader validation error structure.

## Rules

### Form Definition Architecture

#### Rule: Three-Schema Architecture (JSON Schema + UI Schema + Rule Schema)
**Confidence:** High
**Observed in:** 30+ PRs (universal) | PR refs: #6846, #5264, #4466

ALWAYS define every form with three co-located schemas: `FORM_JSON_SCHEMA` (validation), `FORM_UI_SCHEMA` (rendering), and `FORM_RULE_SCHEMA` (pre/post population and custom validation). ALWAYS bundle these into a static `Form` model instance exported from the form file and registered in `get_active_forms()`.

**DO:**
```python
# From PR #6846 -- api/src/form_schema/forms/__init__.py
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
# Anti-pattern -- fetching forms from the database at runtime
def get_forms(db_session):
    return db_session.execute(select(Form)).scalars().all()
# Creates environment drift and DB dependency for form management
```

> **Rationale:** Bundling three schemas per form keeps validation, rendering, and business-rule logic co-located. Defining forms as static Python objects (not DB-fetched) eliminates environment drift and DB dependency for form management tasks.

---

#### Rule: JSON Schema Draft 2020-12 as Canonical Validation Standard
**Confidence:** High
**Observed in:** Universal -- every validation path | PR refs: #4314, #5416

ALWAYS use JSON Schema Draft 2020-12 via the `jsonschema` Python library for form validation. ALWAYS enable format validation via `format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER`. ALWAYS use the custom `OUR_VALIDATOR` (which extends Draft 2020-12 with correct required-field paths) rather than the stock validator.

**DO:**
```python
# From PR #5416 -- Custom validator with correct required-field paths
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
# Anti-pattern -- using the stock validator without the path fix
validator = jsonschema.Draft202012Validator(json_schema)
# Required field errors will be reported at parent path ($) not field path ($.field_name)
```

> **Rationale:** The custom `_required` validator fixes a 10+ year gap in the jsonschema library where required-field errors are reported at the parent path (`$`) rather than the missing field's path (`$.field_name`). Format validation must be explicitly enabled since the JSON Schema spec leaves it off by default.

---

#### Rule: Fail Loudly on Invalid Schemas
**Confidence:** High
**Observed in:** Every validation call | PR refs: #4314

ALWAYS call `check_schema()` on every JSON schema before using it for validation. ALWAYS let `SchemaError` propagate (resulting in a 500 response in the API). NEVER silently accept invalid schemas.

**DO:**
```python
# From PR #4314 -- api/src/form_schema/jsonschema_validator.py
try:
    OUR_VALIDATOR.check_schema(json_schema)
except jsonschema.exceptions.SchemaError:
    logger.exception("Invalid json schema found, cannot validate")
    raise
```

**DON'T:**
```python
# Anti-pattern -- skipping schema validation or catching silently
try:
    OUR_VALIDATOR.check_schema(json_schema)
except jsonschema.exceptions.SchemaError:
    pass  # silently accept invalid schema -- undefined behavior follows
```

> **Rationale:** The jsonschema library silently produces undefined behavior with invalid schemas. An invalid schema in production is a critical bug that should surface immediately as a 500, not produce silent incorrect validation results. Reviewer (joshtonava) in PR #4314: "I think it would be better to fail loudly in this case."

---

### Validation Lifecycle

#### Rule: Non-Blocking Validation with Warnings
**Confidence:** High
**Observed in:** Foundational pattern -- every form save and validation call | PR refs: #4314

ALWAYS return validation issues as `warnings` in the PUT response body. NEVER block a user from saving partial form data due to validation errors. Only block at submission time.

**DO:**
```python
# From PR #4314 -- api/src/services/applications/update_application_form.py
warnings: list[ValidationErrorDetail] = validate_json_schema_for_form(
    application_response, form
)
```

```python
# From PR #4314 -- Test showing warnings are returned but save succeeds
@pytest.mark.parametrize(
    "application_response,expected_warnings",
    [
        # Missing required field -- still saves, returns warning
        ({}, [{"field": "$.name", "message": "'name' is a required property", "type": "required"}]),
        # Extra fields are fine
        ({"name": "bob", "age": 50, "something_else": ""}, []),
    ],
)
def test_application_form_update_with_validation_warnings(...):
    response = client.put(...)
    assert response.status_code == 200
    assert response.json["warnings"] == expected_warnings
```

**DON'T:**
```python
# Anti-pattern -- blocking saves on validation errors
def update_form(application_form, new_response):
    errors = validate_json_schema_for_form(new_response, form)
    if errors:
        raise_flask_error(422, "Form has validation errors", validation_issues=errors)
    # User cannot save partial progress
```

> **Rationale:** Users fill out complex federal forms across multiple sessions and pages. Blocking saves on partial data would make the UX unusable. Validation issues surface as warnings during editing and become blocking only at submission.

---

### UI Schema Conventions

#### Rule: UI Schema Section Labels Must Match PDF Form Numbering
**Confidence:** High
**Observed in:** 6+ PRs with systematic alignment | PR refs: #6584, #6589, #6652, #6634, #6759

ALWAYS number and label UI schema sections to match the official PDF form. When the PDF and the legacy instructions conflict, use the PDF as the source of truth.

**DO:**
```python
# From PR #6584 -- Renumbering SFLLL sections to match the PDF
{"type": "section", "label": "1. Type of Federal Action", ...}
{"type": "section", "label": "2. Status of Federal Action", ...}
{"type": "section", "label": "6. Federal Department/Agency", ...}
{"type": "section", "label": "7. Federal Program Name/Description", ...}
```

**DON'T:**
```python
# Anti-pattern -- labels that don't match PDF numbering
{"type": "section", "label": "1. Background", ...}
{"type": "section", "label": "5. Details", ...}
# Confuses applicants familiar with the official PDF form
```

> **Rationale:** Federal applicants are familiar with the PDF forms. Matching section numbers and labels reduces confusion. Legacy Grants.gov instructions are often outdated and inconsistent with the actual PDFs and XSDs. Reviewer (doug-s-nava) in PR #6584: "directions have likely outdated names here... I think what's here is better, and it matches pdf."

---

### XML Transform

#### Rule: Declarative XML Transform Rules
**Confidence:** High
**Observed in:** 15+ PRs (every form with XML generation) | PR refs: #8422, #8460, #8633

ALWAYS define XML generation rules as a declarative `FORM_XML_TRANSFORM_RULES` dict co-located with the form. ALWAYS include a `_metadata` key with namespace declarations, root element config, and XSD URL. ALWAYS include `att`, `glob`, and `globLib` namespaces even if the form does not currently use attachments.

**DO:**
```python
# From PR #8422 -- SF424B transform rules with required namespaces
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
# Anti-pattern -- missing att namespace (from PR #8633, before fix)
"namespaces": {
    "default": "...", "GG_LobbyingForm": "...",
    "globLib": "...", "glob": "...",
}
# Missing att namespace causes legacy XSD validation failures
```

> **Rationale:** Declarative transform rules keep XML generation logic separate from the generation engine. Legacy Grants.gov systems expect all four namespace prefixes in the XML output for XSD validation; omitting even unused namespaces causes validation failures.

---

#### Rule: Static Values for Non-Input XML Fields
**Confidence:** High
**Observed in:** 5+ PRs | PR refs: #8422, #8452, #8460

ALWAYS use `"static_value"` in the XML transform config for fields that exist in the XSD but are NOT user-input (e.g., `FormVersionIdentifier`, `programType`). NEVER implement non-input XML fields as form fields in the JSON schema to avoid backwards compatibility issues.

**DO:**
```python
# From PR #8422 -- FormVersionIdentifier as static value
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
# Anti-pattern -- mapping from input when field isn't user-controlled (from PR #8452)
"root_attributes": {
    "programType": "program_type",  # Maps to input field -- but this isn't a form field
}
```

> **Rationale:** Adding non-input fields to the JSON schema creates form versioning problems. When the XSD requires a field that isn't user-controlled, it should live entirely in the XML transform layer using `static_value`. Reviewer (chouinar) in PR #8452: "This isn't a field in the form... I'd not try to implement it like this, I'd recommend moving any of this to just XML logic if it's not in the form itself otherwise you might hit a backwards compatibility problem."

---

#### Rule: Legacy XML Format Matching
**Confidence:** High
**Observed in:** 6 PRs with explicit legacy comparison | PR refs: #8422, #8452, #8460, #8633

ALWAYS verify generated XML matches legacy Grants.gov XML output including: (1) `FormVersionIdentifier` as the first child element per XSD, (2) all namespace declarations present, (3) element order matching XSD sequence, (4) attribute values matching legacy format. ALWAYS include legacy XML comparison tests for each form.

**DO:**
```python
# From PR #8422 -- Test verifying FormVersionIdentifier is first child
def test_generate_sf424b_xml_matches_legacy_format(self):
    ...
    first_child = next(iter(root))
    assert (
        first_child.tag == "{http://apply.grants.gov/system/Global-V1.0}FormVersionIdentifier"
    ), "FormVersionIdentifier must be the first child element per XSD"

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
# Anti-pattern -- only checking that XML parses, not checking structure
def test_generate_xml():
    xml = generate_xml(form_data)
    assert xml is not None  # insufficient: doesn't verify structure, order, or namespaces
```

> **Rationale:** Grants.gov downstream systems are sensitive to XML structure. Element ordering, namespace declarations, and attribute presence must match the XSD schemas exactly. Legacy XML samples serve as the ground truth.

---

### Rule Schema Processing

#### Rule: Recursive Rule Schema with Handler Mapping
**Confidence:** High
**Observed in:** 8+ PRs (core pattern) | PR refs: #5264, #8408

ALWAYS structure rule schemas to mirror the JSON response shape. ALWAYS use the `handlers` dict (`gg_pre_population`, `gg_post_population`, `gg_validation`) to dispatch processing. ALWAYS use `JsonRuleContext` with a deep-copied `json_data` to avoid partial mutations on error.

**DO:**
```python
# From PR #5264 -- Recursive processor
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

```python
# From PR #5264 -- JsonRuleContext with deep copy
class JsonRuleContext:
    def __init__(self, application_form: ApplicationForm, config: JsonRuleConfig):
        self.application_form = application_form
        self.config = config
        # We create a copy of the json answers, just in case there
        # is any problem we won't immediately change the answer in the DB
        self.json_data = copy.deepcopy(self.application_form.application_response)
        self.validation_issues: list[ValidationErrorDetail] = []
```

**DON'T:**
```python
# Anti-pattern -- mutating the original data without deep copy
def process_rules(application_form):
    data = application_form.application_response  # direct reference, no copy
    data["info"]["opportunity_number"] = "..."  # if processing fails midway, data is corrupted
```

> **Rationale:** The recursive approach means adding a new rule only requires: (1) a handler function, (2) a mapper entry, (3) the rule in the form's rule schema. Deep-copying prevents partial mutations from corrupting saved data if rule processing fails partway through. Note: rule schemas currently do not support list fields (arrays of objects) -- this is a known limitation.

---

### Shared Schemas

#### Rule: Shared Schemas with URI-Based `$ref` Resolution
**Confidence:** High
**Observed in:** 3+ PRs establishing the pattern, all forms with shared types | PR refs: #6727, #6846

ALWAYS reference shared schema fields via `"$ref": shared_schema.field_ref("field_name")`. ALWAYS resolve all `$ref` references before storing schemas in the DB or using them for validation (using `resolve_jsonschema()` with the `jsonref` library, `lazy_load=False`, `proxies=False`). NEVER require network calls for schema resolution.

**DO:**
```python
# From PR #6727 -- SharedSchema class
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

```python
# From PR #6727 -- Resolver with custom loader
def resolve_jsonschema(unresolved_schema: dict[str, Any]) -> dict[str, Any]:
    return jsonref.replace_refs(
        unresolved_schema,
        loader=_loader,     # Resolve URIs without network calls
        lazy_load=False,    # Actually do the resolution, don't defer
        proxies=False,      # Use python dicts, not jsonref internal types
    )
```

**DON'T:**
```python
# Anti-pattern -- leaving $ref unresolved for consumers to handle
def get_form_schema(form):
    return form.form_json_schema  # still contains $ref pointers
# Frontend/validators must now resolve references themselves, possibly via network
```

> **Rationale:** Resolving `$ref` before storage means consumers (frontend, validators) never need to fetch external schemas. The custom loader maps URIs to in-memory shared schema objects, avoiding network dependency. Deep-copying before resolution prevents mutating global form objects.

---

#### Rule: Enum Values as "Code: Label" Format
**Confidence:** High
**Observed in:** All forms with state/country fields | PR refs: #4525, #6727

ALWAYS format enum values for states and countries as `"XX: Full Name"` (e.g., `"NY: New York"`, `"USA: UNITED STATES"`). ALWAYS source these from `shared_form_constants.py` (originally derived from `UniversalCodes-V2.0.xsd`).

**DO:**
```python
# From PR #6727 -- Address shared schema using enum constants
"state": {
    "allOf": [{"$ref": "#/state_code"}],
    "title": "State",
    "description": "Enter the state.",
},
...
"state_code": {
    "type": "string",
    "title": "State",
    "description": "US State or Territory Code",
    "enum": shared_form_constants.STATES,
}
# Where STATES contains entries like "AL: Alabama", "AK: Alaska", etc.
```

**DON'T:**
```python
# Anti-pattern -- using bare codes or bare labels
"enum": ["NY", "CA", "TX"]  # no labels for human readability
"enum": ["New York", "California", "Texas"]  # no codes for machine parsing
```

> **Rationale:** The "Code: Label" format allows both machine parsing (split on `:`) and human readability in dropdowns. Sourced from the Grants.gov universal codes XSD for compatibility.

---

#### Rule: Conditional Address Validation (US-Specific Required Fields)
**Confidence:** High
**Observed in:** All forms with address fields | PR refs: #6727

ALWAYS use JSON Schema `allOf` with `if/then` to conditionally require `state` and `zip_code` when `country` is `"USA: UNITED STATES"`. This pattern applies to every address schema in shared and form-specific definitions.

**DO:**
```python
# From PR #6727 -- api/src/form_schema/shared/address_shared.py
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
# Anti-pattern -- always requiring state/zip regardless of country
"required": ["street1", "city", "state", "zip_code", "country"]
# Forces non-US addresses to provide US-specific fields
```

> **Rationale:** State and zip code are only meaningful for US addresses. The `required: ["country"]` guard ensures the conditional only fires when the country field is actually provided, preventing false positives on partially filled forms.

---

### ORM Conventions

#### Rule: Set Relationships, Not Foreign Keys Directly
**Confidence:** High
**Observed in:** 2 review comments in PR #8408, applies broadly | PR refs: #8408

ALWAYS set SQLAlchemy relationships (e.g., `application.submitted_by_user = user`) rather than directly setting foreign keys (e.g., `application.submitted_by = user.user_id`). NEVER set both the relationship and the FK.

**DO:**
```python
# From PR #8408 -- Correct: set the relationship
application.submitted_by_user = user

# From PR #8408 -- Testing the relationship
assert application.submitted_by_user.user_id == user.user_id
```

**DON'T:**
```python
# Anti-pattern -- setting the FK directly (from PR #8408)
application.submitted_by = user.user_id
# Bypasses ORM tracking, FK may not populate until flush
```

> **Rationale:** Setting the relationship lets SQLAlchemy manage the FK transparently. Direct FK assignment bypasses ORM tracking and can cause subtle bugs. Reviewer (chouinar) in PR #8408: "Setting a relationship should also immediately/implicitly set the ID, we almost never directly set IDs."

---

### Testing

#### Rule: Minimal/Full/Empty Validation Test Triad
**Confidence:** High
**Observed in:** Every form | PR refs: #6846

ALWAYS write three core validation tests for every form: `test_*_minimal_valid_json` (only required fields), `test_*_full_valid_json` (all fields populated), and `test_*_empty_json` (verifying exact count and paths of required-field errors). ALWAYS use the shared `validate_required()` helper and session-scoped resolved-form fixtures from `conftest.py`.

**DO:**
```python
# From PR #6846 -- Shared conftest with resolved forms and validate_required
def validate_required(data: dict, expected_required_fields: list[str], form: Form):
    validation_issues = validate_json_schema_for_form(data, form)
    assert len(validation_issues) == len(expected_required_fields)
    for validation_issue in validation_issues:
        assert validation_issue.type == "required"
        assert validation_issue.field in expected_required_fields

@pytest.fixture(scope="session")
def sf424b_v1_1():
    return setup_resolved_form(SF424b_v1_1)
```

```python
# From PR #6846 -- Tests using the shared pattern
def test_budget_narrative_v1_2_empty_json(budget_narrative_attachment_v1_2):
    validate_required({}, ["$.attachments"], budget_narrative_attachment_v1_2)

def test_budget_narrative_v1_2_minimal_valid_json(
    minimal_valid_budget_narrative_v1_2, budget_narrative_attachment_v1_2
):
    validation_issues = validate_json_schema_for_form(
        minimal_valid_budget_narrative_v1_2, budget_narrative_attachment_v1_2
    )
    assert len(validation_issues) == 0
```

**DON'T:**
```python
# Anti-pattern -- only testing the happy path
def test_form_valid():
    issues = validate_json_schema_for_form(full_data, form)
    assert len(issues) == 0
# Missing: empty test (required field coverage), minimal test (no over-constraining)
```

> **Rationale:** The triad ensures: (1) required fields are correctly specified (empty test), (2) a minimal valid payload passes (no over-constraining), (3) a fully populated payload passes (no type mismatches). Session-scoped fixtures avoid repeated schema resolution overhead.

---

#### Rule: Factory-Based Test Data Setup
**Confidence:** High
**Observed in:** Universal in all form-related tests | PR refs: #4314, #5264, #8408

ALWAYS use factory classes (`FormFactory`, `ApplicationFactory`, `CompetitionFactory`, `ApplicationFormFactory`, `CompetitionFormFactory`) to create test data. ALWAYS pass schemas via kwargs. Use `setup_application_for_form_validation()` to create the full hierarchy.

**DO:**
```python
# From PR #4314 -- Factory usage in route tests
application = ApplicationFactory.create()
form = FormFactory.create(form_json_schema=SIMPLE_JSON_SCHEMA)
CompetitionFormFactory.create(competition=application.competition, form=form)
existing_form = ApplicationFormFactory.create(
    application=application, form=form, application_response={"name": "Original Name"},
)
```

**DON'T:**
```python
# Anti-pattern -- manually constructing models with raw SQL or manual FK assignment
form = Form()
form.form_id = uuid4()
form.form_json_schema = {...}
db_session.add(form)
db_session.commit()
```

> **Rationale:** Factories ensure test data is consistent and reduce boilerplate. The helper function encapsulates the multi-table relationship setup that every form validation test needs.

---

### Builder and Pipeline

#### Rule: Keep the Builder Dumb
**Confidence:** High
**Observed in:** 3 reviewer corrections | PR refs: #4350, #4525, #4466

NEVER put domain-specific logic (e.g., state/country detection, standard definitions) in `JsonSchemaBuilder`. ALWAYS keep detection and mapping logic in the calling layer (`csv_to_jsonschema.py`). The builder should only know about JSON Schema types, not form-specific semantics.

**DO:**
```python
# From PR #4466 -- Builder provides only generic methods
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
# Anti-pattern -- domain-specific logic in the builder
class JsonSchemaBuilder:
    def add_property(self, name, field_type, ...):
        if name in ["state", "country"]:  # domain-specific detection
            self._add_state_or_country_enum(name)
        # Builder should not know what "state" or "country" means
```

> **Rationale:** Keeping the builder generic makes it reusable across different form-parsing pipelines. Domain-specific logic (which fields are states, which are dates) belongs in the layer that understands the source data format. Reviewer (chouinar) enforced this across PRs #4350 and #4525.

---

#### Rule: Single Path, No Fallbacks for Malformed Data
**Confidence:** High
**Observed in:** 3+ reviewer corrections | PR refs: #6712, #8408

NEVER add placeholder values, fallback paths, or silent error handling for malformed form data. ALWAYS let errors propagate. If data is malformed, it should error, not silently produce incorrect output.

**DO:**
```python
# From PR #8408 -- Signature population with explicit fallback only for known case
def get_signature(context: JsonRuleContext, json_rule: JsonRule) -> str | None:
    application = context.application_form.application
    if application.submitted_by_user and application.submitted_by_user.email:
        return application.submitted_by_user.email
    return UNKNOWN_VALUE
```

**DON'T:**
```python
# Anti-pattern -- placeholder on error (from PR #6712, before fix)
def get_attachment_info(attachment_id):
    try:
        return attachment_mapping[attachment_id]
    except KeyError:
        return PlaceholderAttachment()  # silently masks missing data
```

> **Rationale:** Silent fallbacks mask bugs. In a federal form submission system, silently producing wrong data is worse than erroring. Reviewer (chouinar) in PR #6712: "If data is ever malformed just let it error."

---

### Attachment Handling

#### Rule: String-Keyed UUID Attachment Mapping
**Confidence:** High
**Observed in:** 3 PRs | PR refs: #6712, #5264

ALWAYS use `str(UUID)` as mapping keys for attachment lookups (not `UUID` objects). ALWAYS store attachment fields in form JSON as UUID strings referencing `application_attachment` records.

**DO:**
```python
# From PR #5264 -- Attachment validation using string comparison
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
# Anti-pattern -- UUID objects as dict keys
attachment_map = {att.application_attachment_id: att for att in attachments}
# Requires UUID conversion at every lookup since JSON stores strings
```

> **Rationale:** JSON stores UUIDs as strings. Using `UUID` objects as keys requires conversion at every lookup. String keys eliminate unnecessary conversion and reduce bugs from type mismatches.

---

#### Rule: DAT-to-Schema CLI as Rough Starting Point
**Confidence:** High
**Observed in:** 4 PRs | PR refs: #4350, #4466, #4525, #4611

ALWAYS treat the output of `make dat-to-jsonschema` as a rough starting point requiring manual field-by-field cleanup. ALWAYS use `Agency Field Name` (not `Field ID`) as the JSON property key. ALWAYS skip "button" and "radio" field implementations.

**DO:**
```python
# From PR #4466 -- CLI generates both JSON schema and UI schema
def csv_to_jsonschema(csv_content: str) -> tuple[dict[str, Any], list]:
    ...
    json_schema = schema_builder.build()
    ui_schema = schema_builder.build_ui_schema()
    return json_schema, ui_schema
```

**DON'T:**
```python
# Anti-pattern -- treating CLI output as production-ready
# Running `make dat-to-jsonschema` and committing output without review
# The XLS/DAT files contain inconsistencies and legacy naming
```

> **Rationale:** The XLS/DAT files from Grants.gov contain inconsistencies, missing information, and legacy naming. Automated conversion gets the structure right but human review is essential for field names, enum values, conditional logic, and PDF alignment.

---

## Anti-Patterns

### AP-1: Hardcoded Configuration in Transformer Code
**Confidence:** High (PR #6712)

Attachment field names and XML elements were hardcoded in the transformer class. Fix: moved to form-specific configuration dicts (`attachment_fields` in transform rules).

### AP-2: Using Field ID Instead of Agency Field Name
**Confidence:** High (PR #4350)

Initial CSV-to-schema used `Field ID` (human-readable label) as the property key. Fix: switched to `Agency Field Name` which matches the XML/XSD field naming convention.

### AP-3: Redundant `validate_required` Helper Per Test File
**Confidence:** High (PR #6846)

Each form test file defined its own `validate_required()` helper function with identical logic. Fix: consolidated into `tests/src/form_schema/forms/conftest.py`.

### AP-4: DB-Dependent Form Task Scripts
**Confidence:** High (PR #6846)

Form management CLI tasks required a DB session to fetch forms, mixing local DB state with deployment. Fix: forms are now defined in code; tasks no longer need DB sessions.

### AP-5: Section Labels Not Matching PDF
**Confidence:** High (PRs #6584, #6589, #6652)

Section labels and field titles drifted from the official PDF forms. Fix: systematic alignment pass matching section numbers and labels to the PDF versions. PDFs are the source of truth, not legacy instructions.

---

## Known Inconsistencies

- **Namespace ordering in config dict:** Legacy XML has a specific namespace declaration order. Python dicts preserve insertion order since 3.7, so config dict order effectively controls output order. No formal convention exists for whether this ordering matters or should be enforced.
- **Rule schema list field support:** The recursive rule processor does not support list fields (arrays of objects). This is acknowledged as a known limitation for future work.
- **Auto-discovery vs. manual registration:** As the number of forms grows, `get_active_forms()` may need to be replaced with an auto-discovery mechanism (e.g., a registry decorator). This is an open question.

---

## Related Documents

- [api-validation](./api-validation.md) -- Validation error types, `raise_flask_error` pattern, `ValidationErrorDetail` structure
- [api-tests](./api-tests.md) -- Factory patterns, `enable_factory_create`, parametrize, session-scoped fixtures
- Cross-domain synthesis: AP-1 (Fail Loudly), AP-2 (Separation of Concerns), AP-5 (Non-Blocking UX), AP-7 (Legacy Grants.gov Compatibility)
- Forms domain architecture guide (recommended Tier 1 document per cross-domain synthesis)
