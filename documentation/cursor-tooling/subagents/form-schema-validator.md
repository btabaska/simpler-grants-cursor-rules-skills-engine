# form-schema-validator

## Purpose

Specialist reviewer subagent that validates simpler-grants-gov three-schema form definitions (JSON Schema, UI Schema, Rule Schema) for structural validity, cross-schema consistency, and Grants.gov XML round-trip correctness.

## Who calls it

Optional gate for: `new-endpoint`, `codemod`, `refactor`, `api-docs-sync` when diff touches `api/src/form_schema/**`.

## What it checks

- Every UI Schema and Rule Schema field exists in the JSON Schema (and vice versa)
- Section labels match the source PDF form labels exactly
- Required fields not hidden by default Rule Schema conditions
- Widget type matches JSON Schema type
- XML namespace declarations (`att`, `globLib`, `glob`) present and in canonical order
- Round-trip loses no data

## Output format

JSON with severity summary and per-field findings. See `.cursor/agents/form-schema-validator.md`.

## Example

```
Invoke form-schema-validator with:
  files: ["api/src/form_schema/sf424/json_schema.py", "api/src/form_schema/sf424/ui_schema.py", "api/src/form_schema/sf424/rule_schema.py"]
  form_id: "sf424"
  calling_agent: "new-endpoint"
```

## Policy

Cross-schema inconsistency or XML data loss always blocks.
