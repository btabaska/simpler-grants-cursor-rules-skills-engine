import type { BeforeShellPayload } from "../../types.ts";
import { appendLog } from "../../lib/logger.ts";

export function commandLogger(payload: BeforeShellPayload): void {
  appendLog("shell-audit.jsonl", {
    timestamp: new Date().toISOString(),
    event: "shell_execution",
    command: payload.command,
    cwd: payload.cwd,
    conversation_id: payload.conversation_id,
    generation_id: payload.generation_id,
  });
}
