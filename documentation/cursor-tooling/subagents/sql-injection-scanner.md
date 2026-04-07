# sql-injection-scanner

## Purpose

Specialist reviewer subagent that scans Python database access code for string-interpolated SQL, unsafe `text()` usage, and ORM escape hatches that bypass parameterization. simpler-grants-gov runs FedRAMP Moderate; any injection sink is blocking.

## Who calls it

Optional gate for: `codebase-conventions-reviewer`, `kieran-python-reviewer`, `new-endpoint`, `debugging` when diff touches database code.

## What it checks

- `text(f"...")`, `.execute(f"...")`, `.execute("..." + var)` patterns
- Missing `:bindparam` placeholders on `text()` calls
- `literal_column(user_input)` and dynamic column/order_by without allowlist
- Raw SQL loaded from files then concatenated with user data
- OpenSearch DSL injection (via `api-search.mdc` concerns)

## Output format

JSON with severity summary and per-sink findings. See `.cursor/agents/sql-injection-scanner.md`.

## Example

```
Invoke sql-injection-scanner with:
  files: ["api/src/services/grant_service.py"]
  calling_agent: "kieran-python-reviewer"
```

## Policy

Any confirmed or pattern-level injection sink always blocks.
