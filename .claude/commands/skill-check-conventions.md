# Skill: Check Conventions

Run a convention compliance check as a reusable skill (distinct from the `/check-conventions` command which wraps the conventions reviewer specialist).

## What I Need From You

- Active file or an explicit path.
- Optional `scope=diff` to restrict to added lines.

## What Happens Next

1. Determines the rule scope from the path.
2. Loads applicable rules from `documentation/rules/*.md` and `.cursor/rules/*.mdc`.
3. Applies each ALWAYS/NEVER/MUST directive and reports PASS/FAIL with line numbers.
4. Does not modify files.

## Tips

- Run before every push on edited API or frontend files.
- Use `scope=diff` in legacy files to avoid pre-existing-violation noise.
- Pair with `/skill-accessibility-check` on frontend files for a full sweep.
