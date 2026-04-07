# Glossary Auto-Updater

Propose glossary entries for new domain terms, jargon, and acronyms introduced by a simpler-grants-gov PR.

## What I Need From You

1. A PR number, JSON view, or unified diff
2. Optional file focus list

## What Happens Next

The Glossary Auto-Updater Agent will:
1. Tokenize the diff for candidate terms and filter common English / existing glossary terms
2. Extract definitions from PR descriptions, code comments, and commits
3. Mark terms with no extractable definition as "Needs Definition" (never invented)
4. Write a proposal at `documentation/glossary-proposals/PR-<num>.md`
5. Include a human review checklist

## Tips

- Define new terms in the PR body for instant pickup
- Expand acronyms parenthetically the first time they appear
- The canonical glossary is never modified directly — review then merge
