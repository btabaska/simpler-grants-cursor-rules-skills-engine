# `skill-update-translations` Skill — Usage Guide

## Purpose

Maintain `frontend/src/i18n/messages/<locale>/*.json` files. Detects keys present in code but missing from a locale, keys unused by code, and proposes namespaced keys for new JSX strings with `TODO_TRANSLATE` placeholders.

## When to Use

- A developer adds a hard-coded string in a JSX/TSX file.
- Pre-release sweep for locale drift.
- Reviewing a PR that introduces new user-facing copy.

## When NOT to Use

- Backend strings (the API does not localize user copy in this repo).
- Programmatic-only error keys.
- As a substitute for human translation review.

## Invocation

```
/skill-update-translations
@skill-update-translations frontend/src/components/search/SearchBar.tsx
@skill-update-translations mode=audit
@skill-update-translations mode=prune
```

## Examples

### Example 1 — New button label

"Clear" added to `SearchBar.tsx`. Skill proposes `searchBar.clearButton` and emits the locale patch.

### Example 2 — Audit drift

`mode=audit` reports 12 keys missing from `es` and 3 unused keys in `en`.

### Example 3 — Prune unused

`mode=prune` lists candidates for removal across both locales.

### Example 4 — Aria-label miss

`/skill-accessibility-check` flags an icon-only button. Re-running this skill proposes the i18n key for the new aria-label.

## Tips

- Treat `TODO_TRANSLATE` markers as block-merge.
- Always run before release tagging.
- Use the proposed namespace as a starting point — adjust for clarity.

## Pitfalls

- Auto-extraction misses strings built via template concatenation; wrap them in `t()` manually.
- Pruning is conservative — verify before deleting.
- Skill cannot translate; non-English placeholders need a human reviewer.
