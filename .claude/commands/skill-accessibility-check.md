# Accessibility Check

Run a WCAG 2.1 AA audit on the active frontend file or a specified path.

## What I Need From You

Either:
- Open a `.tsx`/`.jsx` file in the `frontend/` tree, or
- Specify: "Run a11y check on `frontend/src/components/search/SearchBar.tsx`"
- Optionally: `scope=changed` to audit only added lines from the current diff.

## What Happens Next

1. Resolves target and confirms it is a frontend component file.
2. Runs the deterministic WCAG check list (ARIA, semantics, keyboard, labels, headings, color tokens).
3. Cross-references findings with `documentation/rules/frontend-*.md`.
4. Emits an error/warning/info report with line numbers and concrete fixes.
5. Does not modify files.

## Tips

- Pair with `/check-conventions` for a full frontend pre-push sweep.
- Use `scope=changed` inside large legacy files to avoid noise.
- Treat the report as block/warn/advisory — fix errors before pushing.
