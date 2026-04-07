# Check Conventions

Run a convention compliance check on the current file or a specified file.

## What I Need From You

Either:
- Open the file you want checked (agent will check the active file)
- Or specify: "Check conventions for `api/src/services/grant_service.py`"

## What Happens Next

1. Loads all applicable rules for the file via MCP (`get_rules_for_file`)
2. Checks every ALWAYS/NEVER/MUST directive against the actual code
3. Reports violations with line numbers and fix suggestions
4. Invokes `codebase-conventions-reviewer` specialist for deep analysis
5. Reports a pass/fail summary
