# Update Translations

Add new i18n keys, audit drift across locales, or report unused keys.

## What I Need From You

Either:
- Open a `.tsx`/`.jsx` file containing strings, or
- Specify a path or git diff range.
- Optional: `mode=add|audit|prune` (default `add`).

## What Happens Next

1. Scans target for JSX text nodes and `t('...')` calls.
2. Compares against `frontend/src/i18n/messages/<locale>/*.json`.
3. Reports MISSING_IN_LOCALE, MISSING_IN_CODE, and UNUSED keys.
4. In `add` mode, proposes namespaced keys following project convention and emits a unified diff with `TODO_TRANSLATE` markers in non-English locales.
5. Read-only — never writes files.

## Tips

- Run `mode=audit` before tagging a release to catch locale drift.
- Treat `TODO_TRANSLATE` as a blocker for merge.
- Wrap aria-labels and alt text — they are user-facing.
- Pair with `/skill-accessibility-check` for full frontend hygiene.
