# Pass 2: Pattern Codification -- API Form Schema

**Domain:** `api/src/form_schema/`
**Source:** 108 merged PRs from HHS/simpler-grants-gov
**Pass 1 reference:** `analysis/pass1/api-form-schema.md`
**Codification date:** 2026-03-30

---

## Rule 1: Three-Schema Architecture

**Pattern Name:** Three-Schema Form Definition (JSON Schema + UI Schema + Rule Schema)

**Rule Statement:** ALWAYS define every form with three co-located schemas: `FORM_JSON_SCHEMA` (validation), `FORM_UI_SCHEMA` (rendering), and `FORM_RULE_SCHEMA` (pre/post population and custom validation). ALWAYS bundle these into a static `Form` model instance exported from the form file and registered in `get_active_forms()`.

**Confidence:** High

**Frequency:** Universal -- every form in the codebase (SF424, SF424A, SF424B, SF424D, SFLLL, attachment forms, etc.) follows this structure across 30+ PRs.

**Code Examples:**

From PR #6846 -- `api/src/form_schema/forms/__init__.py`:
```python
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

From PR #6846 -- Form instances are static Python objects, not DB-fetched:
```python
# api/src/task/forms/form_task_shared.py
class BaseFormTask(abc.ABC):
    def __init__(self) -> None:
        self.config = FormTaskConfig()
        ...

    def get_forms(self) -> list[Form]:
        """Utility function to get active forms in derived classes"""
        return get_active_forms()
```

**Rationale:** Bundling three schemas per form keeps validation, rendering, and business-rule logic co-located. Defining forms as static Python objects (not DB-fetched) eliminates environment drift and DB dependency for form management tasks.

**Open Questions:**
- As the number of forms grows, should `get_active_forms()` be replaced with an auto-discovery mechanism (e.g., registry decorator)?

---

## Rule 2: JSON Schema Draft 2020-12 as Canonical Validation Standard

**Pattern Name:** JSON Schema Draft 2020-12 Validation

**Rule Statement:** ALWAYS use JSON Schema Draft 2020-12 via the `jsonschema` Python library for form validation. ALWAYS enable format validation via `format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER`. ALWAYS use the custom `OUR_VALIDATOR` (which extends Draft2020-12 with correct required-field paths) rather than the stock validator.

**Confidence:** High

**Frequency:** Universal -- every validation path uses this. Established PR #4314, extended PR #5416.

**Code Examples:**

From PR #5416 -- Custom validator with correct required-field paths (`api/src/form_schema/jsonschema_validator.py`):
```python
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

From PR #4314 -- Validator with format checking enabled:
```python
validator = OUR_VALIDATOR(
    json_schema, format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER
)
```

From PR #5416 -- Test verifying nested required field paths:
```python
def test_validate_json_schema_required_path():
    validation_issues = validate_json_schema_for_form({"nested": {}}, NESTED_REQUIRED)
    assert set(validation_issues) == {
        ValidationErrorDetail(
            type="required",
            message="'nested_field' is a required property",
            field="$.nested.nested_field",
        ),
        ...
    }
```

**Rationale:** The custom `_required` validator fixes a 10+ year gap in the jsonschema library where required-field errors are reported at the parent path (`$`) rather than the missing field's path (`$.field_name`). Format validation must be explicitly enabled since the JSON Schema spec leaves it off by default.

**Open Questions:** None -- this is locked in.

---

## Rule 3: Fail Loudly on Invalid Schemas

**Pattern Name:** Schema Validity Pre-Check

**Rule Statement:** ALWAYS call `check_schema()` on every JSON schema before using it for validation. ALWAYS let `SchemaError` propagate (resulting in a 500 response in the API). NEVER silently accept invalid schemas.

**Confidence:** High

**Frequency:** Every validation call. Established in PR #4314 after explicit reviewer request.

**Code Examples:**

From PR #4314 -- `api/src/form_schema/jsonschema_validator.py`:
```python
try:
    OUR_VALIDATOR.check_schema(json_schema)
except jsonschema.exceptions.SchemaError:
    logger.exception("Invalid json schema found, cannot validate")
    raise
```

From PR #4314 -- Test for invalid schema (reviewer joshtonava requested this):
```python
def test_validate_json_schema_for_invalid_schema():
    with pytest.raises(jsonschema.exceptions.SchemaError, match="Failed validating"):
        validate_json_schema({}, {"properties": ["hello"]})
```

From PR #4314 -- Reviewer exchange:
> joshtonava: "Does this throw if the json_schema is invalid?"
> chouinar: "Weirdly no... behavior is undefined."
> joshtonava: "I think it would be better to fail loudly in this case"

**Rationale:** The jsonschema library silently produces undefined behavior with invalid schemas. An invalid schema in production is a critical bug that should surface immediately as a 500, not produce silent incorrect validation results.

**Open Questions:** None -- reviewer-enforced convention since day one.

---

## Rule 4: Non-Blocking Validation with Warnings

**Pattern Name:** Non-Blocking Validation (Warnings, Not Errors)

**Rule Statement:** ALWAYS return validation issues as `warnings` in the PUT response body. NEVER block a user from saving partial form data due to validation errors. Only block at submission time.

**Confidence:** High

**Frequency:** Foundational pattern -- every form save and every validation call. Established PR #4314.

**Code Examples:**

From PR #4314 -- `api/src/services/applications/update_application_form.py`:
```python
warnings: list[ValidationErrorDetail] = validate_json_schema_for_form(
    application_response, form
)
```

From PR #4314 -- Test showing warnings are returned but save succeeds:
```python
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

From PR #4314 -- PR body explains the design rationale:
> "The validation doesn't prevent or in any way block a users answers from being filled out, it's just the current set of open issues. This is so if a user partially fills out a form, we'll note down what is still needed/incorrect, but not block them from saving their answers."

**Rationale:** Users fill out complex federal forms across multiple sessions and pages. Blocking saves on partial data would make the UX unusable. Validation issues surface as warnings during editing and become blocking only at submission.

**Open Questions:** None.

---

## Rule 5: UI Schema Section Labels Must Match PDF Form Numbering

**Pattern Name:** PDF-Aligned Section Labels

**Rule Statement:** ALWAYS number and label UI schema sections to match the official PDF form. When the PDF and the legacy instructions conflict, use the PDF as the source of truth.

**Confidence:** High

**Frequency:** 6+ PRs with systematic alignment (PRs #6584, #6589, #6652, #6634, #6759). Multiple reviewer comments enforcing this.

**Code Examples:**

From PR #6584 -- Renumbering SFLLL sections to match the PDF:
```python
# Before:
{"type": "section", "label": "1. Background", ...}
{"type": "section", "label": "5. Details", ...}

# After (matching PDF):
{"type": "section", "label": "1. Type of Federal Action", ...}
{"type": "section", "label": "2. Status of Federal Action", ...}
{"type": "section", "label": "6. Federal Department/Agency", ...}
{"type": "section", "label": "7. Federal Program Name/Description", ...}
```

From PR #6584 -- Reviewer (doug-s-nava) noting instruction inconsistencies:
> "directions have likely outdated names here (CFDA number and title), and in a different order. I think what's here is better, and it matches pdf, but wanted to call it out, especially since this means we really shouldn't always be trusting the instructions."

**Rationale:** Federal applicants are familiar with the PDF forms. Matching section numbers and labels reduces confusion. Legacy Grants.gov instructions are often outdated and inconsistent with the actual PDFs and XSDs.

**Open Questions:**
- Some fields exist in the XSD/data model but not on the PDF (e.g., "tier" field on SFLLL appears only for SubAwardee). How should conditional-visibility fields be labeled?

---

## Rule 6: XML Transform Configuration via Declarative Dict

**Pattern Name:** Declarative XML Transform Rules

**Rule Statement:** ALWAYS define XML generation rules as a declarative `FORM_XML_TRANSFORM_RULES` dict co-located with the form. ALWAYS include a `_metadata` key with namespace declarations, root element config, and XSD URL. ALWAYS include `att`, `glob`, and `globLib` namespaces even if the form does not currently use attachments.

**Confidence:** High

**Frequency:** Every form with XML generation -- 15+ PRs. Namespace convention reinforced in PRs #8422, #8460, #8633.

**Code Examples:**

From PR #8422 -- SF424B transform rules with required namespaces:
```python
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

From PR #8633 -- Adding missing `att` namespace to lobbying form:
```python
# Before (missing att):
"namespaces": {
    "default": "...", "GG_LobbyingForm": "...",
    "globLib": "...", "glob": "...",
}
# After:
"namespaces": {
    "default": "...", "GG_LobbyingForm": "...",
    "att": "http://apply.grants.gov/system/Attachments-V1.0",
    "glob": "...", "globLib": "...",
}
```

**Rationale:** Declarative transform rules keep XML generation logic separate from the generation engine. Legacy Grants.gov systems expect all four namespace prefixes in the XML output for XSD validation; omitting even unused namespaces causes validation failures.

**Open Questions:**
- Should namespace ordering in the config dict matter? Legacy XML has a specific namespace declaration order; Python dicts preserve insertion order since 3.7, so config dict order effectively controls output order.

---

## Rule 7: Static Values for Non-Input XML Fields

**Pattern Name:** Static Value Transform for Non-Form Fields

**Rule Statement:** ALWAYS use `"static_value"` in the XML transform config for fields that exist in the XSD but are NOT user-input (e.g., `FormVersionIdentifier`, `programType`). NEVER implement non-input XML fields as form fields in the JSON schema to avoid backwards compatibility issues.

**Confidence:** High

**Frequency:** 5+ PRs (PRs #8422, #8452, #8460). Reviewer (chouinar) explicitly warned against the alternative.

**Code Examples:**

From PR #8422 -- FormVersionIdentifier as static value:
```python
"form_version_identifier": {
    "xml_transform": {
        "target": "FormVersionIdentifier",
        "namespace": "glob",
        "static_value": "1.1",
    }
}
```

From PR #8452 -- programType changed from dynamic mapping to static literal:
```python
# Before (incorrectly mapping from input):
"root_attributes": {
    "programType": "program_type",  # Maps to input field
}
# After (static value):
"root_attributes": {
    "programType": "Non-Construction",
}
```

From PR #8452 -- Reviewer (chouinar) warning:
> "This isn't a field in the form, is it something that is needed in just the XML? If so, I'd not try to implement it like this, I'd recommend moving any of this to just XML logic if it's not in the form itself otherwise you might hit a backwards compatibility problem and need to make a completely new form."

**Rationale:** Adding non-input fields to the JSON schema creates form versioning problems. When the XSD requires a field that isn't user-controlled, it should live entirely in the XML transform layer using `static_value`.

**Open Questions:** None -- reviewer-enforced convention.

---

## Rule 8: Legacy XML Format Matching

**Pattern Name:** Legacy Grants.gov XML Fidelity

**Rule Statement:** ALWAYS verify generated XML matches legacy Grants.gov XML output including: (1) `FormVersionIdentifier` as the first child element per XSD, (2) all namespace declarations present, (3) element order matching XSD sequence, (4) attribute values matching legacy format. ALWAYS include legacy XML comparison tests for each form.

**Confidence:** High

**Frequency:** 6 PRs with explicit legacy comparison (PRs #8422, #8452, #8460, #8633).

**Code Examples:**

From PR #8422 -- Test verifying FormVersionIdentifier is first child:
```python
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

From PR #8460 -- Namespace verification test:
```python
def test_generate_sf424d_xml_namespaces_match_legacy(self):
    ...
    required_namespaces = {
        'xmlns:SF424D="http://apply.grants.gov/forms/SF424D-V1.1"',
        'xmlns:att="http://apply.grants.gov/system/Attachments-V1.0"',
        'xmlns:globLib="http://apply.grants.gov/system/GlobalLibrary-V2.0"',
        'xmlns:glob="http://apply.grants.gov/system/Global-V1.0"',
    }
    for namespace_decl in required_namespaces:
        assert namespace_decl in xml_data
```

**Rationale:** Grants.gov downstream systems are sensitive to XML structure. Element ordering, namespace declarations, and attribute presence must match the XSD schemas exactly. Legacy XML samples serve as the ground truth.

**Open Questions:**
- Is there a centralized set of legacy XML samples for regression testing, or does each PR author produce their own?

---

## Rule 9: Recursive Rule Schema Processing

**Pattern Name:** Recursive Rule Schema with Handler Mapping

**Rule Statement:** ALWAYS structure rule schemas to mirror the JSON response shape. ALWAYS use the `handlers` dict (`gg_pre_population`, `gg_post_population`, `gg_validation`) to dispatch processing. ALWAYS use `JsonRuleContext` with a deep-copied `json_data` to avoid partial mutations on error.

**Confidence:** High

**Frequency:** Core pattern -- 8+ PRs (foundation PR #5264, extended in #8408 and others).

**Code Examples:**

From PR #5264 -- Recursive processor (`api/src/form_schema/rule_processing/json_rule_processor.py`):
```python
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

From PR #5264 -- JsonRuleContext with deep copy:
```python
class JsonRuleContext:
    def __init__(self, application_form: ApplicationForm, config: JsonRuleConfig):
        self.application_form = application_form
        self.config = config
        # We create a copy of the json answers, just in case there
        # is any problem we won't immediately change the answer in the DB
        self.json_data = copy.deepcopy(self.application_form.application_response)
        self.validation_issues: list[ValidationErrorDetail] = []
```

**Rationale:** The recursive approach means adding a new rule only requires: (1) a handler function, (2) a mapper entry, (3) the rule in the form's rule schema. Deep-copying prevents partial mutations from corrupting saved data if rule processing fails partway through.

**Open Questions:**
- Rule schemas currently do not support list fields (arrays of objects). This is called out in the README as a known limitation for future work.

---

## Rule 10: Shared Schemas with URI-Based $ref Resolution

**Pattern Name:** Shared Schema with Local URI Resolution

**Rule Statement:** ALWAYS reference shared schema fields via `"$ref": shared_schema.field_ref("field_name")`. ALWAYS resolve all `$ref` references before storing schemas in the DB or using them for validation (using `resolve_jsonschema()` with the `jsonref` library, `lazy_load=False`, `proxies=False`). NEVER require network calls for schema resolution.

**Confidence:** High

**Frequency:** 3+ PRs establishing the pattern (PRs #6727, #6846). All forms with shared types use it.

**Code Examples:**

From PR #6727 -- SharedSchema class (`api/src/form_schema/shared/shared_schema.py`):
```python
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

From PR #6727 -- Resolver with custom loader (`api/src/form_schema/jsonschema_resolver.py`):
```python
def resolve_jsonschema(unresolved_schema: dict[str, Any]) -> dict[str, Any]:
    return jsonref.replace_refs(
        unresolved_schema,
        loader=_loader,     # Resolve URIs without network calls
        lazy_load=False,    # Actually do the resolution, don't defer
        proxies=False,      # Use python dicts, not jsonref internal types
    )
```

From PR #6846 -- Resolution at test setup time:
```python
def setup_resolved_form(form: Form):
    copied_form = copy.deepcopy(form)
    copied_form.form_json_schema = resolve_jsonschema(form.form_json_schema)
    return copied_form
```

**Rationale:** Resolving `$ref` before storage means consumers (frontend, validators) never need to fetch external schemas. The custom loader maps URIs to in-memory shared schema objects, avoiding network dependency. Deep-copying before resolution prevents mutating global form objects.

**Open Questions:** None.

---

## Rule 11: Enum Values as "Code: Label" Format

**Pattern Name:** Code-Label Enum Format

**Rule Statement:** ALWAYS format enum values for states and countries as `"XX: Full Name"` (e.g., `"NY: New York"`, `"USA: UNITED STATES"`). ALWAYS source these from `shared_form_constants.py` (originally derived from `UniversalCodes-V2.0.xsd`).

**Confidence:** High

**Frequency:** All forms with state/country fields. Established early (PR #4525), stable throughout.

**Code Examples:**

From PR #6727 -- Address shared schema using enum constants:
```python
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
},
```

Where `STATES` contains entries like `"AL: Alabama"`, `"AK: Alaska"`, etc.

**Rationale:** The "Code: Label" format allows both machine parsing (split on `:`) and human readability in dropdowns. Sourced from the Grants.gov universal codes XSD for compatibility.

**Open Questions:** None.

---

## Rule 12: Conditional Address Validation (US-Specific Required Fields)

**Pattern Name:** Conditional US Address Validation via allOf/if-then

**Rule Statement:** ALWAYS use JSON Schema `allOf` with `if/then` to conditionally require `state` and `zip_code` when `country` is `"USA: UNITED STATES"`. This pattern applies to every address schema in shared and form-specific definitions.

**Confidence:** High

**Frequency:** All forms with address fields. Defined in shared address schema (PR #6727).

**Code Examples:**

From PR #6727 -- `api/src/form_schema/shared/address_shared.py`:
```python
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

**Rationale:** State and zip code are only meaningful for US addresses. The `required: ["country"]` guard ensures the conditional only fires when the country field is actually provided, preventing false positives on partially filled forms.

**Open Questions:** None.

---

## Rule 13: Set Relationships, Not Foreign Keys Directly

**Pattern Name:** SQLAlchemy Relationship Assignment Over FK Assignment

**Rule Statement:** ALWAYS set SQLAlchemy relationships (e.g., `application.submitted_by_user = user`) rather than directly setting foreign keys (e.g., `application.submitted_by = user.user_id`). NEVER set both the relationship and the FK -- if both are set, something is likely wrong.

**Confidence:** High

**Frequency:** Reviewer-enforced convention -- 2 review comments in PR #8408, applies broadly.

**Code Examples:**

From PR #8408 -- Reviewer (chouinar) correction:
```python
# Wrong:
application.submitted_by = user.user_id

# Correct:
application.submitted_by_user = user
```

From PR #8408 -- Reviewer explanation:
> "Setting a relationship should also immediately/implicitly set the ID, we almost never directly set IDs... If you're seeing an issue by not having both, my immediate assumption would be that there is a bug somewhere and this is just masking that."

From PR #8408 -- Testing the relationship (not the FK):
```python
assert application.submitted_by_user.user_id == user.user_id
```

**Rationale:** Setting the relationship lets SQLAlchemy manage the FK transparently. Direct FK assignment bypasses ORM tracking and can cause subtle bugs (e.g., the FK not being populated until a flush). Testing via the relationship object tests both the relationship and the FK in one assertion.

**Open Questions:** None.

---

## Rule 14: Minimal/Full/Empty Validation Test Triad

**Pattern Name:** Three-Test Validation Coverage per Form

**Rule Statement:** ALWAYS write three core validation tests for every form: `test_*_minimal_valid_json` (only required fields), `test_*_full_valid_json` (all fields populated), and `test_*_empty_json` (verifying exact count and paths of required-field errors). ALWAYS use the shared `validate_required()` helper and session-scoped resolved-form fixtures from `conftest.py`.

**Confidence:** High

**Frequency:** Every form -- established in PR #6846 which consolidated the pattern.

**Code Examples:**

From PR #6846 -- Shared conftest with resolved forms and `validate_required`:
```python
# api/tests/src/form_schema/forms/conftest.py
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

From PR #6846 -- Test using the shared pattern:
```python
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

**Rationale:** The triad ensures: (1) required fields are correctly specified (empty test), (2) a minimal valid payload passes (no over-constraining), (3) a fully populated payload passes (no type mismatches). Session-scoped fixtures avoid repeated schema resolution overhead.

**Open Questions:** None.

---

## Rule 15: Factory-Based Test Data Setup

**Pattern Name:** Factory Hierarchy for Form Test Data

**Rule Statement:** ALWAYS use factory classes (`FormFactory`, `ApplicationFactory`, `CompetitionFactory`, `ApplicationFormFactory`, `CompetitionFormFactory`) to create test data. ALWAYS pass schemas via kwargs (e.g., `form_json_schema=...`, `form_rule_schema=...`). Use `setup_application_for_form_validation()` to create the full Application -> Competition -> Form -> ApplicationForm hierarchy.

**Confidence:** High

**Frequency:** Universal in all form-related tests -- PRs #4314, #5264, #8408, and all form test files.

**Code Examples:**

From PR #4314 -- Factory usage in route tests:
```python
application = ApplicationFactory.create()
form = FormFactory.create(form_json_schema=SIMPLE_JSON_SCHEMA)
CompetitionFormFactory.create(competition=application.competition, form=form)
existing_form = ApplicationFormFactory.create(
    application=application, form=form, application_response={"name": "Original Name"},
)
```

From PR #8408 -- `setup_application_for_form_validation` helper:
```python
# api/tests/lib/data_factories.py
def setup_application_for_form_validation(...):
    ...
    if user_email is not None:
        app_user = ApplicationUserFactory.create(application=application)
        LinkExternalUserFactory.create(email=user_email, user=app_user.user)
        application.submitted_by_user = app_user.user
    return application_form
```

**Rationale:** Factories ensure test data is consistent and reduce boilerplate. The helper function encapsulates the multi-table relationship setup that every form validation test needs.

**Open Questions:** None.

---

## Rule 16: Keep the Builder Dumb

**Pattern Name:** Generic Builder, Domain Logic in Callers

**Rule Statement:** NEVER put domain-specific logic (e.g., state/country detection, standard definitions) in `JsonSchemaBuilder`. ALWAYS keep detection and mapping logic in the calling layer (`csv_to_jsonschema.py`). The builder should only know about JSON Schema types, not form-specific semantics.

**Confidence:** High

**Frequency:** 3 reviewer corrections in PRs #4350, #4525 (reviewer: chouinar).

**Code Examples:**

From PR #4466 -- Builder provides only generic methods:
```python
class JsonSchemaBuilder:
    def add_string_property(self, name, is_required, ...) -> Self: ...
    def add_bool_property(self, name, is_required, ...) -> Self: ...
    def add_int_property(self, name, is_required, ...) -> Self: ...
    def add_sub_object(self, name, is_required, builder, ...) -> Self: ...
    def build(self) -> dict: ...
    def build_ui_schema(self) -> list: ...
```

**Rationale:** Keeping the builder generic makes it reusable across different form-parsing pipelines. Domain-specific logic (which fields are states, which are dates) belongs in the layer that understands the source data format.

**Open Questions:** None.

---

## Rule 17: Remove Unnecessary Code Paths / Let Errors Propagate

**Pattern Name:** Single Path, No Fallbacks for Malformed Data

**Rule Statement:** NEVER add placeholder values, fallback paths, or silent error handling for malformed form data. ALWAYS let errors propagate. If data is malformed, it should error, not silently produce incorrect output.

**Confidence:** High

**Frequency:** 3+ reviewer corrections (PR #6712 was the primary example). Reviewer: chouinar.

**Code Examples:**

From PR #6712 -- Reviewer (chouinar) on attachment transformer:
> "If data is ever malformed just let it error."

From PR #8408 -- Signature population with explicit fallback only for known case:
```python
def get_signature(context: JsonRuleContext, json_rule: JsonRule) -> str | None:
    application = context.application_form.application
    if application.submitted_by_user and application.submitted_by_user.email:
        return application.submitted_by_user.email
    return UNKNOWN_VALUE
```

**Rationale:** Silent fallbacks mask bugs. In a federal form submission system, silently producing wrong data is worse than erroring. The one exception is when a known incomplete state is expected (e.g., `UNKNOWN_VALUE` for signature when no email exists) -- but this is explicitly logged.

**Open Questions:**
- The rule processing layer (PR #5264) does log-and-continue for some configuration errors (missing rule code, missing mapper). Should this be tightened to fail-fast as well, or is the current "warn but proceed" approach appropriate for rules that are not blocking?

---

## Rule 18: Attachment Transform via String UUID Mapping

**Pattern Name:** String-Keyed UUID Attachment Mapping

**Rule Statement:** ALWAYS use `str(UUID)` as mapping keys for attachment lookups (not `UUID` objects). ALWAYS store attachment fields in form JSON as UUID strings referencing `application_attachment` records. ALWAYS make attachment field configuration data-driven (in the transform config), not hardcoded in transformer code.

**Confidence:** High

**Frequency:** 3 PRs (PR #6712 primary, with reviewer corrections).

**Code Examples:**

From PR #5264 -- Attachment validation using string comparison:
```python
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

From PR #6712 -- Reviewer (chouinar) on key types:
> Use string UUIDs as keys since JSON data is already strings.

**Rationale:** JSON stores UUIDs as strings. Using `UUID` objects as keys requires conversion at every lookup. String keys eliminate unnecessary conversion and reduce bugs from type mismatches.

**Open Questions:** None.

---

## Rule 19: DAT-to-Schema CLI as Rough Starting Point

**Pattern Name:** CLI Pipeline Produces Rough Draft, Not Final Schema

**Rule Statement:** ALWAYS treat the output of `make dat-to-jsonschema` as a rough starting point requiring manual field-by-field cleanup. ALWAYS use `Agency Field Name` (not `Field ID`) as the JSON property key. ALWAYS skip "button" and "radio" field implementations.

**Confidence:** High

**Frequency:** 4 PRs (PRs #4350, #4466, #4525, #4611).

**Code Examples:**

From PR #4466 -- CLI generates both JSON schema and UI schema:
```python
def csv_to_jsonschema(csv_content: str) -> tuple[dict[str, Any], list]:
    ...
    json_schema = schema_builder.build()
    ui_schema = schema_builder.build_ui_schema()
    return json_schema, ui_schema
```

From PR #4466 -- UI schema items use JSON Pointer syntax:
```python
def build_ui_schema(self) -> list:
    ui_schema = []
    for field_name in self.properties:
        ui_schema.append({"type": "field", "definition": f"/properties/{field_name}"})
    return ui_schema
```

**Rationale:** The XLS/DAT files from Grants.gov contain inconsistencies, missing information, and legacy naming. Automated conversion gets the structure right but human review is essential for field names, enum values, conditional logic, and PDF alignment.

**Open Questions:** None.

---

## Summary of Codified Rules

| # | Rule Name | Confidence | Enforcement |
|---|-----------|------------|-------------|
| 1 | Three-Schema Architecture | High | Structural |
| 2 | JSON Schema Draft 2020-12 + Custom Validator | High | Code convention |
| 3 | Fail Loudly on Invalid Schemas | High | Reviewer-enforced |
| 4 | Non-Blocking Validation (Warnings) | High | Architectural |
| 5 | PDF-Aligned Section Labels | High | Reviewer-enforced |
| 6 | Declarative XML Transform Rules | High | Structural |
| 7 | Static Values for Non-Input XML Fields | High | Reviewer-enforced |
| 8 | Legacy XML Format Matching | High | Test-enforced |
| 9 | Recursive Rule Schema Processing | High | Architectural |
| 10 | Shared Schemas with URI-Based $ref | High | Structural |
| 11 | Code-Label Enum Format | High | Convention |
| 12 | Conditional US Address Validation | High | Shared schema |
| 13 | Relationships Over FK Assignment | High | Reviewer-enforced |
| 14 | Minimal/Full/Empty Test Triad | High | Convention |
| 15 | Factory-Based Test Data Setup | High | Convention |
| 16 | Keep the Builder Dumb | High | Reviewer-enforced |
| 17 | Single Path, No Fallbacks | High | Reviewer-enforced |
| 18 | String-Keyed UUID Mapping | High | Reviewer-enforced |
| 19 | DAT-to-Schema as Rough Starting Point | High | Convention |
