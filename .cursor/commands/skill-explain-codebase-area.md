# Explain Codebase Area

Walkthrough of a directory or subsystem.

## What I Need From You

- Path (directory or glob).
- Optional depth: `overview` (default) or `deep`.

## What Happens Next

1. Classifies files by role.
2. Identifies entry points and traces the dominant data flow.
3. Lists key types and external dependencies.
4. Links applicable rules and ADRs.
5. Emits a Markdown brief.

## Tips

- Use for onboarding, handoffs, and reviewer context.
- Pair with `/skill-explain-pattern` for single-file detail.
- Ask for `depth=deep` when writing long-form docs.
