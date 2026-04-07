# Section 508 Report Generator

Generate a Section 508 / VPAT 2.4 Rev 508 conformance report from jest-axe and pa11y JSON output.

## What I Need From You

1. Path(s) to jest-axe JSON output (RTL accessibility scans)
2. Path(s) to pa11y JSON output (full-page scans)
3. Optional list of routes scanned

## What Happens Next

The Section 508 Report Generator Agent will:
1. Parse all violations and normalize across both tools
2. Map each finding to a WCAG 2.1 A/AA criterion and Section 508 chapter
3. Assign Supports / Partially Supports / Does Not Support per criterion
4. Write VPAT-formatted prose for each criterion with `path:line` evidence
5. Emit a remediation backlog ordered by impact
6. Save to `documentation/compliance/section-508/<date>-vpat.md`

## Tips

- Run jest-axe on every component test and pa11y on representative routes
- Save artifacts to a stable path so the report can cite them
- The agent never claims Supports without evidence
