# Claude Code hooks

This tree is generated from `.cursor/hooks/` by `scripts/build-claude-target.py`.
Hook commands are unchanged; only their registration in `.claude/settings.json`
differs from `.cursor/hooks.json`.

## Event mapping

| Cursor event | Claude Code event | Notes |
|---|---|---|
| `beforeShellExecution` | `PreToolUse` (matcher `Bash`) | Direct analog |
| `afterFileEdit`        | `PostToolUse` (matcher `Edit|Write|MultiEdit`) | Direct analog |
| `stop`                 | `Stop` | Direct analog |
| `beforeMCPExecution`   | — | No first-class analog. Run via wrapper if needed. |
| `beforeReadFile`       | — | No first-class analog. |
| `beforeSubmitPrompt`   | — | Closest equivalent: `UserPromptSubmit`. Not auto-mapped — verify before enabling. |

Hooks still require the [Bun](https://bun.sh) runtime.
