# Sprint Summary Generator

Produce a stakeholder-ready sprint summary from merged PRs in a sprint window.

## What I Need From You

1. Sprint start and end date (or sprint number)
2. Optional workstream or contributor filters

## What Happens Next

The Sprint Summary Generator Agent will:
1. Pull merged PRs in the window
2. Bucket each as Feature / Operational / Quality / Docs / Tech Debt
3. Distill highlights, quality signals, risks, and follow-ups
4. List contributors with PR counts
5. Write `documentation/sprint-summaries/sprint-<n>-<date>.md`

## Tips

- Workstream labels make bucketing deterministic
- The summary targets a 1–2 minute executive read
- Pair with `/release-notes-drafter` at release cut
