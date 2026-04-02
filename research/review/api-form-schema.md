# API Form Schema — Pattern Review

**Reviewer(s):** chouinar
**PRs analyzed:** 108
**Rules proposed:** 19
**Open questions:** 4

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

### 1. Three-Schema Architecture

**Confidence:** High
**Frequency:** Universal -- every form in the codebase (30+ PRs)
**Source PRs:** #6846

**Proposed Rule:**
> ALWAYS define every form with three co-located schemas: `FORM_JSON_SCHEMA` (validation), `FORM_UI_SCHEMA` (rendering), and `FORM_RULE_SCHEMA` (pre/post population and custom validation). ALWAYS bundle these into a static `Form` model instance exported from the form file and registered in `get_active_forms()`.

**Rationale:**
Bundling three schemas per form keeps validation, rendering, and business-rule logic co-located. Defining forms as static Python objects (not DB-fetched) eliminates environment drift and DB dependency for form management tasks.

**Code Examples:**
```python
# From PR #6846 — api/src/form_schema/forms/__init__.py
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

```python
# From PR #6846 — Form instances are static Python objects, not DB-fetched
class BaseFormTask(abc.ABC):
    def __init__(self) -> None:
        self.config = FormTaskConfig()
        ...

    def get_forms(self) -> list[Form]:
        """Utility function to get active forms in derived classes"""
        return get_active_forms()
```

**Conflicting Examples:**
None found. Open question: As the number of forms grows, should `get_active_forms()` be replaced with an auto-discovery mechanism (e.g., registry decorator)?

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 2. JSON Schema Draft 2020-12 as Canonical Validation Standard

**Confidence:** High
**Frequency:** Universal -- every validation path. Established PR #4314, extended PR #5416.
**Source PRs:** #5416, #4314

**Proposed Rule:**
> ALWAYS use JSON Schema Draft 2020-12 via the `jsonschema` Python library for form validation. ALWAYS enable format validation via `format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER`. ALWAYS use the custom `OUR_VALIDATOR` (which extends Draft2020-12 with correct required-field paths) rather than the stock validator.

**Rationale:**
The custom `_required` validator fixes a 10+ year gap in the jsonschema library where required-field errors are reported at the parent path (`$`) rather than the missing field's path (`$.field_name`). Format validation must be explicitly enabled since the JSON Schema spec leaves it off by default.

**Code Examples:**
```python
# From PR #5416 — Custom validator with correct required-field paths
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

```python
# From PR #4314 — Validator with format checking enabled
validator = OUR_VALIDATOR(
    json_schema, format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER
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

### 3. Fail Loudly on Invalid Schemas

**Confidence:** High
**Frequency:** Every validation call. Established in PR #4314 after explicit reviewer request.
**Source PRs:** #4314

**Proposed Rule:**
> ALWAYS call `check_schema()` on every JSON schema before using it for validation. ALWAYS let `SchemaError` propagate (resulting in a 500 response in the API). NEVER silently accept invalid schemas.

**Rationale:**
The jsonschema library silently produces undefined behavior with invalid schemas. An invalid schema in production is a critical bug that should surface immediately as a 500, not produce silent incorrect validation results.

**Code Examples:**
```python
# From PR #4314 — api/src/form_schema/jsonschema_validator.py
try:
    OUR_VALIDATOR.check_schema(json_schema)
except jsonschema.exceptions.SchemaError:
    logger.exception("Invalid json schema found, cannot validate")
    raise
```

```python
# From PR #4314 — Test for invalid schema (reviewer joshtonava requested this)
def test_validate_json_schema_for_invalid_schema():
    with pytest.raises(jsonschema.exceptions.SchemaError, match="Failed validating"):
        validate_json_schema({}, {"properties": ["hello"]})
```

**Conflicting Examples:**
None found. Reviewer exchange: joshtonava: "Does this throw if the json_schema is invalid?" chouinar: "Weirdly no... behavior is undefined." joshtonava: "I think it would be better to fail loudly in this case"

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 4. Non-Blocking Validation with Warnings

**Confidence:** High
**Frequency:** Foundational pattern -- every form save and every validation call. Established PR #4314.
**Source PRs:** #4314

**Proposed Rule:**
> ALWAYS return validation issues as `warnings` in the PUT response body. NEVER block a user from saving partial form data due to validation errors. Only block at submission time.

**Rationale:**
Users fill out complex federal forms across multiple sessions and pages. Blocking saves on partial data would make the UX unusable. Validation issues surface as warnings during editing and become blocking only at submission.

**Code Examples:**
```python
# From PR #4314 — api/src/services/applications/update_application_form.py
warnings: list[ValidationErrorDetail] = validate_json_schema_for_form(
    application_response, form
)
```

```python
# From PR #4314 — Test showing warnings are returned but save succeeds
@pytest.mark.parametrize(
    "application_response,expected_warnings",
    [
        # Missing required field — still saves, returns warning
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

### 5. UI Schema Section Labels Must Match PDF Form Numbering

**Confidence:** High
**Frequency:** 6+ PRs with systematic alignment (PRs #6584, #6589, #6652, #6634, #6759)
**Source PRs:** #6584

**Proposed Rule:**
> ALWAYS number and label UI schema sections to match the official PDF form. When the PDF and the legacy instructions conflict, use the PDF as the source of truth.

**Rationale:**
Federal applicants are familiar with the PDF forms. Matching section numbers and labels reduces confusion. Legacy Grants.gov instructions are often outdated and inconsistent with the actual PDFs and XSDs.

**Code Examples:**
```python
# From PR #6584 — Renumbering SFLLL sections to match the PDF
# Before:
{"type": "section", "label": "1. Background", ...}
{"type": "section", "label": "5. Details", ...}

# After (matching PDF):
{"type": "section", "label": "1. Type of Federal Action", ...}
{"type": "section", "label": "2. Status of Federal Action", ...}
{"type": "section", "label": "6. Federal Department/Agency", ...}
{"type": "section", "label": "7. Federal Program Name/Description", ...}
```

**Conflicting Examples:**
Reviewer (doug-s-nava) noting instruction inconsistencies: "directions have likely outdated names here (CFDA number and title), and in a different order. I think what's here is better, and it matches pdf, but wanted to call it out."

Open question: Some fields exist in the XSD/data model but not on the PDF (e.g., "tier" field on SFLLL appears only for SubAwardee). How should conditional-visibility fields be labeled?

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 6. XML Transform Configuration via Declarative Dict

**Confidence:** High
**Frequency:** Every form with XML generation -- 15+ PRs
**Source PRs:** #8422, #8633

**Proposed Rule:**
> ALWAYS define XML generation rules as a declarative `FORM_XML_TRANSFORM_RULES` dict co-located with the form. ALWAYS include a `_metadata` key with namespace declarations, root element config, and XSD URL. ALWAYS include `att`, `glob`, and `globLib` namespaces even if the form does not currently use attachments.

**Rationale:**
Declarative transform rules keep XML generation logic separate from the generation engine. Legacy Grants.gov systems expect all four namespace prefixes in the XML output for XSD validation; omitting even unused namespaces causes validation failures.

**Code Examples:**
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

```python
# From PR #8633 — Adding missing att namespace to lobbying form
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

**Conflicting Examples:**
None found. Open question: Should namespace ordering in the config dict matter? Legacy XML has a specific namespace declaration order; Python dicts preserve insertion order since 3.7, so config dict order effectively controls output order.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 7. Static Values for Non-Input XML Fields

**Confidence:** High
**Frequency:** 5+ PRs (PRs #8422, #8452, #8460)
**Source PRs:** #8422, #8452

**Proposed Rule:**
> ALWAYS use `"static_value"` in the XML transform config for fields that exist in the XSD but are NOT user-input (e.g., `FormVersionIdentifier`, `programType`). NEVER implement non-input XML fields as form fields in the JSON schema to avoid backwards compatibility issues.

**Rationale:**
Adding non-input fields to the JSON schema creates form versioning problems. When the XSD requires a field that isn't user-controlled, it should live entirely in the XML transform layer using `static_value`.

**Code Examples:**
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

```python
# From PR #8452 — programType changed from dynamic mapping to static literal
# Before (incorrectly mapping from input):
"root_attributes": {
    "programType": "program_type",  # Maps to input field
}
# After (static value):
"root_attributes": {
    "programType": "Non-Construction",
}
```

**Conflicting Examples:**
None found. Reviewer (chouinar) warning: "This isn't a field in the form, is it something that is needed in just the XML? If so, I'd not try to implement it like this, I'd recommend moving any of this to just XML logic if it's not in the form itself otherwise you might hit a backwards compatibility problem and need to make a completely new form."

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 8. Legacy XML Format Matching

**Confidence:** High
**Frequency:** 6 PRs with explicit legacy comparison (PRs #8422, #8452, #8460, #8633)
**Source PRs:** #8422, #8460

**Proposed Rule:**
> ALWAYS verify generated XML matches legacy Grants.gov XML output including: (1) `FormVersionIdentifier` as the first child element per XSD, (2) all namespace declarations present, (3) element order matching XSD sequence, (4) attribute values matching legacy format. ALWAYS include legacy XML comparison tests for each form.

**Rationale:**
Grants.gov downstream systems are sensitive to XML structure. Element ordering, namespace declarations, and attribute presence must match the XSD schemas exactly.

**Code Examples:**
```python
# From PR #8422 — Test verifying FormVersionIdentifier is first child
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

```python
# From PR #8460 — Namespace verification test
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

**Conflicting Examples:**
None found. Open question: Is there a centralized set of legacy XML samples for regression testing, or does each PR author produce their own?

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 9. Recursive Rule Schema Processing

**Confidence:** High
**Frequency:** Core pattern -- 8+ PRs (foundation PR #5264)
**Source PRs:** #5264

**Proposed Rule:**
> ALWAYS structure rule schemas to mirror the JSON response shape. ALWAYS use the `handlers` dict (`gg_pre_population`, `gg_post_population`, `gg_validation`) to dispatch processing. ALWAYS use `JsonRuleContext` with a deep-copied `json_data` to avoid partial mutations on error.

**Rationale:**
The recursive approach means adding a new rule only requires: (1) a handler function, (2) a mapper entry, (3) the rule in the form's rule schema. Deep-copying prevents partial mutations from corrupting saved data if rule processing fails partway through.

**Code Examples:**
```python
# From PR #5264 — Recursive processor
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
# From PR #5264 — JsonRuleContext with deep copy
class JsonRuleContext:
    def __init__(self, application_form: ApplicationForm, config: JsonRuleConfig):
        self.application_form = application_form
        self.config = config
        self.json_data = copy.deepcopy(self.application_form.application_response)
        self.validation_issues: list[ValidationErrorDetail] = []
```

**Conflicting Examples:**
None found. Open question: Rule schemas currently do not support list fields (arrays of objects). This is a known limitation for future work.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 10. Shared Schemas with URI-Based $ref Resolution

**Confidence:** High
**Frequency:** 3+ PRs establishing the pattern (PRs #6727, #6846)
**Source PRs:** #6727, #6846

**Proposed Rule:**
> ALWAYS reference shared schema fields via `"$ref": shared_schema.field_ref("field_name")`. ALWAYS resolve all `$ref` references before storing schemas in the DB or using them for validation (using `resolve_jsonschema()` with the `jsonref` library, `lazy_load=False`, `proxies=False`). NEVER require network calls for schema resolution.

**Rationale:**
Resolving `$ref` before storage means consumers (frontend, validators) never need to fetch external schemas. The custom loader maps URIs to in-memory shared schema objects, avoiding network dependency.

**Code Examples:**
```python
# From PR #6727 — SharedSchema class
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
# From PR #6727 — Resolver with custom loader
def resolve_jsonschema(unresolved_schema: dict[str, Any]) -> dict[str, Any]:
    return jsonref.replace_refs(
        unresolved_schema,
        loader=_loader,     # Resolve URIs without network calls
        lazy_load=False,    # Actually do the resolution, don't defer
        proxies=False,      # Use python dicts, not jsonref internal types
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

### 11. Enum Values as "Code: Label" Format

**Confidence:** High
**Frequency:** All forms with state/country fields. Established early (PR #4525).
**Source PRs:** #6727, #4525

**Proposed Rule:**
> ALWAYS format enum values for states and countries as `"XX: Full Name"` (e.g., `"NY: New York"`, `"USA: UNITED STATES"`). ALWAYS source these from `shared_form_constants.py` (originally derived from `UniversalCodes-V2.0.xsd`).

**Rationale:**
The "Code: Label" format allows both machine parsing (split on `:`) and human readability in dropdowns. Sourced from the Grants.gov universal codes XSD for compatibility.

**Code Examples:**
```python
# From PR #6727 — Address shared schema using enum constants
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

### 12. Conditional Address Validation (US-Specific Required Fields)

**Confidence:** High
**Frequency:** All forms with address fields. Defined in shared address schema (PR #6727).
**Source PRs:** #6727

**Proposed Rule:**
> ALWAYS use JSON Schema `allOf` with `if/then` to conditionally require `state` and `zip_code` when `country` is `"USA: UNITED STATES"`.

**Rationale:**
State and zip code are only meaningful for US addresses. The `required: ["country"]` guard ensures the conditional only fires when the country field is actually provided.

**Code Examples:**
```python
# From PR #6727 — api/src/form_schema/shared/address_shared.py
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

### 13. Set Relationships, Not Foreign Keys Directly

**Confidence:** High
**Frequency:** Reviewer-enforced convention -- 2 review comments in PR #8408
**Source PRs:** #8408

**Proposed Rule:**
> ALWAYS set SQLAlchemy relationships (e.g., `application.submitted_by_user = user`) rather than directly setting foreign keys (e.g., `application.submitted_by = user.user_id`). NEVER set both the relationship and the FK.

**Rationale:**
Setting the relationship lets SQLAlchemy manage the FK transparently. Direct FK assignment bypasses ORM tracking and can cause subtle bugs.

**Code Examples:**
```python
# From PR #8408 — Reviewer (chouinar) correction
# Wrong:
application.submitted_by = user.user_id

# Correct:
application.submitted_by_user = user
```

**Conflicting Examples:**
None found. Reviewer explanation: "Setting a relationship should also immediately/implicitly set the ID, we almost never directly set IDs..."

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 14. Minimal/Full/Empty Validation Test Triad

**Confidence:** High
**Frequency:** Every form -- established in PR #6846
**Source PRs:** #6846

**Proposed Rule:**
> ALWAYS write three core validation tests for every form: `test_*_minimal_valid_json` (only required fields), `test_*_full_valid_json` (all fields populated), and `test_*_empty_json` (verifying exact count and paths of required-field errors). ALWAYS use the shared `validate_required()` helper and session-scoped resolved-form fixtures from `conftest.py`.

**Rationale:**
The triad ensures: (1) required fields are correctly specified (empty test), (2) a minimal valid payload passes (no over-constraining), (3) a fully populated payload passes (no type mismatches).

**Code Examples:**
```python
# From PR #6846 — Shared conftest with resolved forms and validate_required
def validate_required(data: dict, expected_required_fields: list[str], form: Form):
    validation_issues = validate_json_schema_for_form(data, form)
    assert len(validation_issues) == len(expected_required_fields)
    for validation_issue in validation_issues:
        assert validation_issue.type == "required"
        assert validation_issue.field in expected_required_fields
```

```python
# From PR #6846 — Test using the shared pattern
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

### 15. Factory-Based Test Data Setup

**Confidence:** High
**Frequency:** Universal in all form-related tests (PRs #4314, #5264, #8408)
**Source PRs:** #4314, #8408

**Proposed Rule:**
> ALWAYS use factory classes (`FormFactory`, `ApplicationFactory`, `CompetitionFactory`, `ApplicationFormFactory`, `CompetitionFormFactory`) to create test data. ALWAYS pass schemas via kwargs. Use `setup_application_for_form_validation()` to create the full hierarchy.

**Rationale:**
Factories ensure test data is consistent and reduce boilerplate. The helper function encapsulates the multi-table relationship setup that every form validation test needs.

**Code Examples:**
```python
# From PR #4314 — Factory usage in route tests
application = ApplicationFactory.create()
form = FormFactory.create(form_json_schema=SIMPLE_JSON_SCHEMA)
CompetitionFormFactory.create(competition=application.competition, form=form)
existing_form = ApplicationFormFactory.create(
    application=application, form=form, application_response={"name": "Original Name"},
)
```

```python
# From PR #8408 — setup_application_for_form_validation helper
def setup_application_for_form_validation(...):
    ...
    if user_email is not None:
        app_user = ApplicationUserFactory.create(application=application)
        LinkExternalUserFactory.create(email=user_email, user=app_user.user)
        application.submitted_by_user = app_user.user
    return application_form
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

### 16. Keep the Builder Dumb

**Confidence:** High
**Frequency:** 3 reviewer corrections in PRs #4350, #4525
**Source PRs:** #4466

**Proposed Rule:**
> NEVER put domain-specific logic (e.g., state/country detection, standard definitions) in `JsonSchemaBuilder`. ALWAYS keep detection and mapping logic in the calling layer (`csv_to_jsonschema.py`). The builder should only know about JSON Schema types, not form-specific semantics.

**Rationale:**
Keeping the builder generic makes it reusable across different form-parsing pipelines. Domain-specific logic belongs in the layer that understands the source data format.

**Code Examples:**
```python
# From PR #4466 — Builder provides only generic methods
class JsonSchemaBuilder:
    def add_string_property(self, name, is_required, ...) -> Self: ...
    def add_bool_property(self, name, is_required, ...) -> Self: ...
    def add_int_property(self, name, is_required, ...) -> Self: ...
    def add_sub_object(self, name, is_required, builder, ...) -> Self: ...
    def build(self) -> dict: ...
    def build_ui_schema(self) -> list: ...
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

### 17. Remove Unnecessary Code Paths / Let Errors Propagate

**Confidence:** High
**Frequency:** 3+ reviewer corrections (PR #6712 primary)
**Source PRs:** #6712, #8408

**Proposed Rule:**
> NEVER add placeholder values, fallback paths, or silent error handling for malformed form data. ALWAYS let errors propagate. If data is malformed, it should error, not silently produce incorrect output.

**Rationale:**
Silent fallbacks mask bugs. In a federal form submission system, silently producing wrong data is worse than erroring.

**Code Examples:**
```python
# From PR #6712 — Reviewer (chouinar) on attachment transformer:
# "If data is ever malformed just let it error."
```

```python
# From PR #8408 — Signature population with explicit fallback only for known case
def get_signature(context: JsonRuleContext, json_rule: JsonRule) -> str | None:
    application = context.application_form.application
    if application.submitted_by_user and application.submitted_by_user.email:
        return application.submitted_by_user.email
    return UNKNOWN_VALUE
```

**Conflicting Examples:**
The rule processing layer (PR #5264) does log-and-continue for some configuration errors (missing rule code, missing mapper). Open question: Should this be tightened to fail-fast, or is "warn but proceed" appropriate for non-blocking rules?

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 18. Attachment Transform via String UUID Mapping

**Confidence:** High
**Frequency:** 3 PRs (PR #6712 primary)
**Source PRs:** #5264, #6712

**Proposed Rule:**
> ALWAYS use `str(UUID)` as mapping keys for attachment lookups (not `UUID` objects). ALWAYS store attachment fields in form JSON as UUID strings referencing `application_attachment` records. ALWAYS make attachment field configuration data-driven (in the transform config), not hardcoded in transformer code.

**Rationale:**
JSON stores UUIDs as strings. Using `UUID` objects as keys requires conversion at every lookup. String keys eliminate unnecessary conversion and reduce bugs from type mismatches.

**Code Examples:**
```python
# From PR #5264 — Attachment validation using string comparison
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

### 19. DAT-to-Schema CLI as Rough Starting Point

**Confidence:** High
**Frequency:** 4 PRs (PRs #4350, #4466, #4525, #4611)
**Source PRs:** #4466

**Proposed Rule:**
> ALWAYS treat the output of `make dat-to-jsonschema` as a rough starting point requiring manual field-by-field cleanup. ALWAYS use `Agency Field Name` (not `Field ID`) as the JSON property key. ALWAYS skip "button" and "radio" field implementations.

**Rationale:**
The XLS/DAT files from Grants.gov contain inconsistencies, missing information, and legacy naming. Automated conversion gets the structure right but human review is essential.

**Code Examples:**
```python
# From PR #4466 — CLI generates both JSON schema and UI schema
def csv_to_jsonschema(csv_content: str) -> tuple[dict[str, Any], list]:
    ...
    json_schema = schema_builder.build()
    ui_schema = schema_builder.build_ui_schema()
    return json_schema, ui_schema
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

## Coverage Gaps

1. **No formal API versioning strategy (Cross-domain GAP-3).** The form schema domain's `static_value` pattern (Rule 7) explicitly avoids versioning problems, suggesting awareness but not a formal strategy for when to promote alpha to v1 or how breaking changes are managed.

2. **No centralized legacy XML sample repository.** Each PR author appears to produce their own reference XML. A shared repository of legacy XML samples would improve consistency of regression testing.

3. **Rule schemas do not support list fields.** This is a known limitation called out in the README as future work.

4. **Validation framework dual stack (Cross-domain INC-3).** The form domain uses JSON Schema Draft 2020-12, while the route layer uses Marshmallow and the service layer uses Pydantic. This is acknowledged but not resolved.

## Inconsistencies Requiring Resolution

1. **Namespace ordering significance:** Should the order of namespace declarations in the XML transform config dict be explicitly documented as significant (since Python dict insertion order controls XML output)?

2. **Rule processing error handling:** The rule processing layer does "warn but proceed" for missing rule codes/mappers. Should this be tightened to fail-fast, or is the current approach appropriate for non-blocking validation rules?

3. **Auto-discovery for forms:** As the number of forms grows, should `get_active_forms()` be replaced with an auto-discovery mechanism?

4. **Conditional-visibility field labeling:** How should fields that exist in the XSD but not on the PDF (e.g., "tier" on SFLLL) be labeled in the UI schema?
