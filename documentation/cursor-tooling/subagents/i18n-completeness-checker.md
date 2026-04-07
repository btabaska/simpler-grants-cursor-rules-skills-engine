# i18n-completeness-checker

## Purpose

Specialist reviewer subagent that verifies every user-facing frontend string is wrapped in a translation function, present in every supported locale bundle, and free of hardcoded English fallbacks.

## Who calls it

- `i18n` (Gate 2)
- Optional gate for `user-guide-updater`, `codemod`, `new-endpoint`, `refactor`

## What it checks

- Hardcoded string literals in JSX children, `alt`, `aria-label`, `title`, `placeholder`
- Missing translation keys in any locale bundle
- Orphan keys (present in bundle, unused in code)
- ICU placeholder parity across locales
- Namespace imports match usage
- Validation and error messages localized

## Output format

JSON with severity summary and per-string findings. See `.cursor/agents/i18n-completeness-checker.md`.

## Example

```
Invoke i18n-completeness-checker with:
  files: ["frontend/src/components/application/summary.tsx"]
  locale_bundles: ["frontend/src/i18n/messages/en/application.json", "frontend/src/i18n/messages/es/application.json"]
  calling_agent: "i18n"
```

## Policy

Any hardcoded user-facing English string blocks the `i18n` gate.
