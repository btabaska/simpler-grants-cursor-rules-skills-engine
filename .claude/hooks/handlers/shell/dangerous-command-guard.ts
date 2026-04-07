import type { BeforeShellPayload, HookResponse } from "../../types.ts";
import { BLOCKED_SHELL_PATTERNS } from "../../lib/config.ts";

export function dangerousCommandGuard(payload: BeforeShellPayload): HookResponse {
  const { command } = payload;

  for (const pattern of BLOCKED_SHELL_PATTERNS) {
    if (pattern.test(command)) {
      return {
        permission: "deny",
        userMessage: `Blocked: "${command.substring(0, 80)}" matches a dangerous pattern. Run it manually if needed.`,
        agentMessage: `Command blocked by dangerous-command-guard hook. This matches a destructive pattern. Suggest a safer alternative or ask the developer to run it manually.`,
      };
    }
  }

  return { permission: "allow" };
}
