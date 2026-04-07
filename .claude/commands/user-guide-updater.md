# User Guide Updater

Find user-facing documentation that references a changed feature or workflow, and draft updates to keep help content in sync with the new behavior.

## What I Need From You

1. **Change** — what feature or workflow changed, in plain language
2. **Before/After** (optional) — old and new behavior summary
3. **Scope** (optional) — specific guide directory to limit the search

## What Happens Next

The User Guide Updater Agent will:
1. Extract user-visible noun phrases from the change description
2. Grep the user-guide directories for every term and synonym
3. Classify hits as real references vs. coincidental matches
4. Draft paragraph-level rewrites preserving the guide's voice
5. Flag screenshots, diagrams, and translated strings as human follow-ups
6. Summarize every file touched

The agent never edits API reference docs, images, or translation files.

## Tips for Better Results
- Name the feature as a noun phrase the guide actually uses
- Provide before/after to speed up classification
- Pair with `/changelog` and `/api-docs-sync` for full doc coverage
