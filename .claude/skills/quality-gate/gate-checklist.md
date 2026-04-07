# Gate Pass/Fail Criteria

## Gate 1: Convention Compliance
- **Pass**: Zero violations of ALWAYS/NEVER/MUST directives from applicable rules
- **Fail**: Any violation of a high-confidence rule directive
- **Warn**: Violation of a pending/emerging convention (fix recommended, not blocking)

## Gate 2: Language Quality
- **Pass**: Code is idiomatic, type-safe, handles errors correctly
- **Fail**: Non-idiomatic patterns, missing type safety, unhandled errors
- **Warn**: Minor style issues that don't affect correctness

## Gate 3: Code Simplicity
- **Pass**: Code is appropriately simple for the task, no YAGNI violations
- **Fail**: Unnecessary abstractions, over-engineering, premature optimization
- **Warn**: Code could be simpler but isn't harmful as-is

## Gate 4: Domain-Specific
- **Pass**: Domain specialist finds no issues
- **Fail**: Domain-specific anti-patterns, safety issues, or architectural violations
- **Warn**: Suggestions for improvement within the domain

## Gate 5: Pattern Consistency
- **Pass**: New patterns are consistent with existing codebase patterns
- **Fail**: One-off patterns that deviate from conventions without justification
- **Warn**: Minor inconsistencies

## Overall Quality Gate Result

- **PASS**: All mandatory gates pass, no fails in conditional gates
- **FAIL**: Any mandatory gate fails, or a conditional gate finds a blocking issue
- **PASS WITH WARNINGS**: All gates pass but warnings present — report to developer
