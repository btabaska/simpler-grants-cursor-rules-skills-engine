# Grant Application Forms (Vertical) -- Pattern Review

**Reviewer(s):** chouinar, doug-s-nava
**Related domains:** api-form-schema, frontend-components, frontend-tests, api-tests
**Rules proposed:** 16

---

> **IMPORTANT: A note on inconsistencies**
>
> This extraction will surface patterns that are inconsistent -- where the codebase
> does things two or three different ways. Some of these inconsistencies may be
> intentional (different contexts warranting different approaches) or evolutionary
> (the team moved from approach A to approach B but hasn't migrated everything).
>
> A big part of this review is resolving that ambiguity -- deciding which patterns
> are canonical, which are legacy, and which represent intentional variation.
> Please don't assume that the most common pattern is automatically the right one.

---

## How to Review

For each pattern below, use the checkbox block to record your assessment:

- **Accurate?** -- Does this rule correctly describe what the team does (or should do)?
- **Canonical?** -- Should this be a documented, enforced rule going forward?
- **Wording** -- Is the rule statement clear, or does it need revision?
- **Missing context** -- Is there nuance or exception the extraction missed?

This document contains ONLY patterns unique to the forms domain or patterns that have form-specific variations. General patterns (structured logging, factory testing, service layer separation, etc.) are covered in their respective domain review documents and the cross-domain synthesis.

---

## Patterns

### FORM-1: Three-Schema Architecture (JSON Schema + UI Schema + Rule Schema)

**Rule:** ALWAYS define every form with three co-located schemas: `FORM_JSON_SCHEMA` (validation), `FORM_UI_SCHEMA` (rendering), and `FORM_RULE_SCHEMA` (pre/post population and custom validation). ALWAYS bundle these into a static `Form` model instance exported from the form file and registered in `get_active_forms()`.

**Evidence:**
- Universal across every form in the codebase (SF424, SF424A, SF424B, SFLLL, attachment forms, etc.) across 30+ PRs
- PR #6846 established the registration pattern via `get_active_forms()`
- PR #5410 (SF424 initial), PR #5264 (rule schema), PR #4466 (UI schema generation)

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

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### FORM-2: JSON Schema Draft 2020-12 with Custom `OUR_VALIDATOR`

**Rule:** ALWAYS use JSON Schema Draft 2020-12 via the `jsonschema` Python library for form validation. ALWAYS enable format validation via `format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER`. ALWAYS use the custom `OUR_VALIDATOR` (which extends Draft2020-12 with correct required-field paths) rather than the stock validator.

**Evidence:**
- Universal across every validation path. Established PR #4314, extended PR #5416
- The custom `_required` validator fixes a 10+ year gap in the jsonschema library where required-field errors are reported at the parent path (`$`) rather than the missing field's path (`$.field_name`)

From PR #5416 -- `api/src/form_schema/jsonschema_validator.py`:
```python
OUR_VALIDATOR = jsonschema.validators.extend(
    validator=jsonschema.Draft202012Validator, validators={"required": _required}
)
```

From PR #4314 -- Validator with format checking:
```python
validator = OUR_VALIDATOR(
    json_schema, format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER
)
```

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### FORM-3: Non-Blocking Validation (Warnings During Save, Blocking at Submit)

**Rule:** ALWAYS return validation issues as `warnings` in the PUT response body. NEVER block a user from saving partial form data due to validation errors. Only block at submission time.

**Evidence:**
- Foundational pattern established in PR #4314, stable throughout all form work
- PR #4314 PR body: "The validation doesn't prevent or in any way block a users answers from being filled out, it's just the current set of open issues."

From PR #4314 -- `api/src/services/applications/update_application_form.py`:
```python
warnings: list[ValidationErrorDetail] = validate_json_schema_for_form(
    application_response, form
)
```

From PR #4314 -- Test showing save succeeds despite missing required fields:
```python
@pytest.mark.parametrize(
    "application_response,expected_warnings",
    [
        ({}, [{"field": "$.name", "message": "'name' is a required property", "type": "required"}]),
        ({"name": "bob", "age": 50, "something_else": ""}, []),
    ],
)
def test_application_form_update_with_validation_warnings(...):
    response = client.put(...)
    assert response.status_code == 200
    assert response.json["warnings"] == expected_warnings
```

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### FORM-4: UI Schema Section Labels Must Match PDF Form Numbering

**Rule:** ALWAYS number and label UI schema sections to match the official PDF form. When the PDF and the legacy instructions conflict, use the PDF as the source of truth.

Source-of-truth hierarchy: **PDF form > XSD > Legacy Grants.gov instructions**

**Evidence:**
- 6+ PRs with systematic alignment (PRs #6584, #6589, #6652, #6634, #6759)
- PR #6584 reviewer (doug-s-nava): "directions have likely outdated names here (CFDA number and title), and in a different order. I think what's here is better, and it matches pdf, but wanted to call it out, especially since this means we really shouldn't always be trusting the instructions."

From PR #6584 -- Renumbering SFLLL sections to match PDF:
```python
# Before:
{"type": "section", "label": "1. Background", ...}
{"type": "section", "label": "5. Details", ...}

# After (matching PDF):
{"type": "section", "label": "1. Type of Federal Action", ...}
{"type": "section", "label": "2. Status of Federal Action", ...}
{"type": "section", "label": "6. Federal Department/Agency", ...}
```

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### FORM-5: Declarative XML Transform Rules with Mandatory Namespaces

**Rule:** ALWAYS define XML generation rules as a declarative `FORM_XML_TRANSFORM_RULES` dict co-located with the form. ALWAYS include a `_metadata` key with namespace declarations, root element config, and XSD URL. ALWAYS include `att`, `glob`, and `globLib` namespaces even if the form does not currently use attachments.

**Evidence:**
- Every form with XML generation (15+ PRs). Namespace convention reinforced in PRs #8422, #8460, #8633
- PR #8633 added missing `att` namespace to lobbying form after validation failure

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

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### FORM-6: Static Values for Non-Input XML Fields

**Rule:** ALWAYS use `"static_value"` in the XML transform config for fields that exist in the XSD but are NOT user-input (e.g., `FormVersionIdentifier`, `programType`). NEVER implement non-input XML fields as form fields in the JSON schema to avoid backwards compatibility issues.

**Evidence:**
- 5+ PRs (PRs #8422, #8452, #8460)
- PR #8452 reviewer (chouinar): "This isn't a field in the form, is it something that is needed in just the XML? If so, I'd not try to implement it like this, I'd recommend moving any of this to just XML logic if it's not in the form itself otherwise you might hit a backwards compatibility problem and need to make a completely new form."

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
    "programType": "program_type",
}
# After (static value):
"root_attributes": {
    "programType": "Non-Construction",
}
```

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### FORM-7: Legacy XML Format Matching with Fidelity Tests

**Rule:** ALWAYS verify generated XML matches legacy Grants.gov XML output including: (1) `FormVersionIdentifier` as the first child element per XSD, (2) all namespace declarations present, (3) element order matching XSD sequence, (4) attribute values matching legacy format. ALWAYS include legacy XML comparison tests for each form.

**Evidence:**
- 6 PRs with explicit legacy comparison (PRs #8422, #8452, #8460, #8633)

From PR #8422 -- Test verifying FormVersionIdentifier is first child:
```python
def test_generate_sf424b_xml_matches_legacy_format(self):
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

From PR #8460 -- Namespace verification test:
```python
def test_generate_sf424d_xml_namespaces_match_legacy(self):
    required_namespaces = {
        'xmlns:SF424D="http://apply.grants.gov/forms/SF424D-V1.1"',
        'xmlns:att="http://apply.grants.gov/system/Attachments-V1.0"',
        'xmlns:globLib="http://apply.grants.gov/system/GlobalLibrary-V2.0"',
        'xmlns:glob="http://apply.grants.gov/system/Global-V1.0"',
    }
    for namespace_decl in required_namespaces:
        assert namespace_decl in xml_data
```

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### FORM-8: Recursive Rule Schema Processing with Handler Mapping

**Rule:** ALWAYS structure rule schemas to mirror the JSON response shape. ALWAYS use the `handlers` dict (`gg_pre_population`, `gg_post_population`, `gg_validation`) to dispatch processing. ALWAYS use `JsonRuleContext` with a deep-copied `json_data` to avoid partial mutations on error.

**Evidence:**
- Core pattern across 8+ PRs (foundation PR #5264, extended in #8408 and others)

From PR #5264 -- `api/src/form_schema/rule_processing/json_rule_processor.py`:
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
        self.json_data = copy.deepcopy(self.application_form.application_response)
        self.validation_issues: list[ValidationErrorDetail] = []
```

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### FORM-9: Shared Schemas with URI-Based $ref Resolution

**Rule:** ALWAYS reference shared schema fields via `"$ref": shared_schema.field_ref("field_name")`. ALWAYS resolve all `$ref` references before storing schemas in the DB or using them for validation (using `resolve_jsonschema()` with `jsonref` library, `lazy_load=False`, `proxies=False`). NEVER require network calls for schema resolution.

**Evidence:**
- 3+ PRs establishing the pattern (PRs #6727, #6846). All forms with shared types use it

From PR #6727 -- SharedSchema class:
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

From PR #6727 -- Resolver with custom loader:
```python
def resolve_jsonschema(unresolved_schema: dict[str, Any]) -> dict[str, Any]:
    return jsonref.replace_refs(
        unresolved_schema,
        loader=_loader,
        lazy_load=False,
        proxies=False,
    )
```

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### FORM-10: Code-Label Enum Format (`"XX: Full Name"`)

**Rule:** ALWAYS format enum values for states and countries as `"XX: Full Name"` (e.g., `"NY: New York"`, `"USA: UNITED STATES"`). ALWAYS source these from `shared_form_constants.py` (originally derived from `UniversalCodes-V2.0.xsd`).

**Evidence:**
- All forms with state/country fields. Established early (PR #4525), stable throughout

From PR #6727 -- Address shared schema using enum constants:
```python
"state_code": {
    "type": "string",
    "title": "State",
    "description": "US State or Territory Code",
    "enum": shared_form_constants.STATES,
},
```

Where `STATES` contains entries like `"AL: Alabama"`, `"AK: Alaska"`, etc.

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### FORM-11: Conditional US Address Validation via `allOf/if-then`

**Rule:** ALWAYS use JSON Schema `allOf` with `if/then` to conditionally require `state` and `zip_code` when `country` is `"USA: UNITED STATES"`. The `required: ["country"]` guard ensures the conditional only fires when the country field is actually provided.

**Evidence:**
- All forms with address fields. Defined in shared address schema (PR #6727)

From PR #6727 -- `api/src/form_schema/shared/address_shared.py`:
```python
"allOf": [
    {
        "if": {
            "properties": {"country": {"const": "USA: UNITED STATES"}},
            "required": ["country"],
        },
        "then": {"required": ["state", "zip_code"]},
    },
],
```

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### FORM-12: Minimal/Full/Empty Validation Test Triad

**Rule:** ALWAYS write three core validation tests for every form: `test_*_minimal_valid_json` (only required fields), `test_*_full_valid_json` (all fields populated), and `test_*_empty_json` (verifying exact count and paths of required-field errors). ALWAYS use the shared `validate_required()` helper and session-scoped resolved-form fixtures from `conftest.py`.

**Evidence:**
- Every form follows this pattern since PR #6846

From PR #6846 -- Shared conftest with resolved forms and `validate_required`:
```python
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
```

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### FORM-13: Keep the Builder Dumb -- Domain Logic in Callers

**Rule:** NEVER put domain-specific logic (e.g., state/country detection, standard definitions) in `JsonSchemaBuilder`. ALWAYS keep detection and mapping logic in the calling layer (`csv_to_jsonschema.py`). The builder should only know about JSON Schema types, not form-specific semantics.

**Evidence:**
- 3 reviewer corrections in PRs #4350, #4525 (reviewer: chouinar)

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

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### FORM-14: Attachment Transform via String UUID Mapping

**Rule:** ALWAYS use `str(UUID)` as mapping keys for attachment lookups (not `UUID` objects). ALWAYS store attachment fields in form JSON as UUID strings referencing `application_attachment` records. ALWAYS make attachment field configuration data-driven (in the transform config), not hardcoded in transformer code.

**Evidence:**
- 3 PRs (PR #6712 primary, with reviewer corrections)
- PR #6712 reviewer (chouinar): Use string UUIDs as keys since JSON data is already strings
- Attachment validation in PR #5264 uses string comparison against `application_attachment_ids`

From PR #5264 -- Attachment validation:
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

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### FORM-15: Page Object Model for Form E2E Tests

**Rule:** For E2E tests involving complex form interactions, use the Page Object Model (POM) pattern: separate test data into fixture files, form metadata/field mappings into page object files, and generic form-filling logic into shared utility files.

**Evidence:**
- Newly introduced pattern (2026). PR #8867 established it for the SF-LLL form

From PR #8867 -- Page object for SF-LLL form:
```ts
// page-objects/sflll-form.page.ts
export const SFLLL_FORM_CONFIG = {
  formName: "Disclosure of Lobbying Activities (SF-LLL)",
  ...FORM_DEFAULTS,
} as const;

export function getSflllFillFields(data: SflllEntityData): FillFieldDefinition[] {
  return [
    { selector: "#federal_action_type", value: data.federalAction.type, type: "dropdown",
      section: "Section 1", field: "Type of Federal Action" },
    { testId: "material_change_year", value: data.materialChange.year, type: "text",
      section: "Section 3", field: "Material Change Year" },
  ];
}
```

From PR #8867 -- Generic form-filling utility:
```ts
// utils/forms/general-forms-filling.ts
export async function fillForm(testInfo: TestInfo, page: Page, config: FillFormConfig): Promise<void> {
  const { formName, fields, saveButtonTestId } = config;
  await page.getByRole("link", { name: formName }).click();
  for (const field of fields) {
    await fillField(testInfo, page, field);
  }
  await page.getByTestId(saveButtonTestId).click();
}
```

From PR #8867 -- Test data fixture:
```ts
// fixtures/test-data-for-sflll-forms.fixture.ts
export const FORMS_TEST_DATA = {
  sflll: {
    form: { name: "Disclosure of Lobbying Activities (SF-LLL)" },
    federalAction: { type: "Grant", status: "BidOffer", reportType: "MaterialChange" },
  },
} as const;
```

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be the standard for all form E2E tests
- [ ] Wording is clear
- [ ] This should apply to: [ ] All forms [ ] Only complex multi-section forms [ ] _______________
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### FORM-16: DAT-to-Schema CLI as Rough Starting Point

**Rule:** ALWAYS treat the output of `make dat-to-jsonschema` as a rough starting point requiring manual field-by-field cleanup. ALWAYS use `Agency Field Name` (not `Field ID`) as the JSON property key. ALWAYS skip "button" and "radio" field implementations.

**Evidence:**
- 4 PRs (PRs #4350, #4466, #4525, #4611)
- Output is explicitly described as a rough starting point requiring manual cleanup

From PR #4466 -- CLI generates both JSON schema and UI schema:
```python
def csv_to_jsonschema(csv_content: str) -> tuple[dict[str, Any], list]:
    json_schema = schema_builder.build()
    ui_schema = schema_builder.build_ui_schema()
    return json_schema, ui_schema
```

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

## Coverage Gaps

### GAP-F1: Rule Schema Does Not Support List Fields

Rule schemas currently do not support list fields (arrays of objects). This is called out in the README as a known limitation for future work.

```
- [ ] Should create a convention / design for this
- [ ] Not needed yet -- no forms require it
- [ ] Notes: _______________
```

---

### GAP-F2: No Centralized Legacy XML Sample Registry

Each PR that adds legacy XML comparison tests produces its own reference XML. There is no centralized directory of legacy XML samples for regression testing.

```
- [ ] Should create a centralized sample registry
- [ ] Current approach is sufficient
- [ ] Notes: _______________
```

---

### GAP-F3: Namespace Ordering in Config Dicts

Python dicts preserve insertion order since 3.7, so config dict order effectively controls XML namespace declaration order. It is unclear whether this is intentional or accidental. Legacy Grants.gov XML has a specific namespace declaration order.

```
- [ ] Should document that dict ordering matters and is intentional
- [ ] Should add tests to enforce namespace order
- [ ] Not important -- namespace order does not affect validation
- [ ] Notes: _______________
```

---

### GAP-F4: Conditional-Visibility Field Labeling

Some fields exist in the XSD/data model but not on the PDF (e.g., "tier" field on SFLLL appears only for SubAwardee). There is no documented convention for how to label these conditional-visibility fields in the UI schema.

```
- [ ] Should create a convention for this
- [ ] Handle case by case
- [ ] Notes: _______________
```

---

### GAP-F5: Page Object Model Adoption Scope

The POM pattern for form E2E tests (FORM-15) has only been applied to one form type (SF-LLL). It is unclear whether this should be the standard for all future form E2E tests.

```
- [ ] Should be the standard for all form E2E tests
- [ ] Only for complex multi-section forms
- [ ] Not ready to standardize yet
- [ ] Notes: _______________
```

---

## Inconsistencies Requiring Resolution

### INC-F1: Form Object Registration -- Manual List vs. Auto-Discovery

Forms are currently registered via a manually maintained list in `get_active_forms()`. As the number of forms grows, this could become a maintenance burden. The Pass 2 analysis raised whether a registry decorator or auto-discovery mechanism should replace it.

**Decision needed:** Should `get_active_forms()` remain a manual list, or should a decorator/auto-discovery pattern be introduced?

```
- [ ] This inconsistency is real and needs resolution
- [ ] Decision: _______________
- [ ] Current approach is fine for the foreseeable future
- [ ] Notes: _______________
```

---

### INC-F2: Rule Processing Error Handling -- Fail-Fast vs. Warn-and-Continue

The rule processing layer (PR #5264) uses log-and-continue for some configuration errors (missing rule code, missing mapper). The broader project principle is "fail loudly" (AP-1). The form validation layer aggregates errors rather than failing fast. These two approaches are in tension.

**Decision needed:** Should rule processing configuration errors (missing handler, unknown rule) fail fast with an exception, or warn and continue?

```
- [ ] This inconsistency is real and needs resolution
- [ ] Decision: _______________
- [ ] Intentional variation -- validation aggregates, configuration errors should _______________
- [ ] Notes: _______________
```
