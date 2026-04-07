import type { BeforeShellPayload, HookResponse } from "../../types.ts";
import { PROTECTED_FILE_PATTERNS, WRITE_COMMAND_PATTERN } from "../../lib/config.ts";

export function environmentProtection(payload: BeforeShellPayload): HookResponse {
  const { command } = payload;

  if (WRITE_COMMAND_PATTERN.test(command)) {
    for (const pattern of PROTECTED_FILE_PATTERNS) {
      if (pattern.test(command)) {
        return {
          permission: "deny",
          userMessage: `Blocked: This command would modify a sensitive file. Environment files and credentials should be edited manually.`,
          agentMessage: `Command blocked — it would modify a protected file (environment, credentials, or secrets). Tell the developer what changes are needed and let them make the edit manually.`,
        };
      }
    }
  }

  return { permission: "allow" };
}
