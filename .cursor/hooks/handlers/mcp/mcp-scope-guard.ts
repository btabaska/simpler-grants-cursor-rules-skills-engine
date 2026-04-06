import type { BeforeMCPPayload, HookResponse } from "../../types.ts";

const ALLOWED_ROOTS = [
  "/Users/btabaska/GitHub/simpler-grants-gov",
  "/Users/btabaska/GitHub/simpler-grants-documentation-automation",
];

export function mcpScopeGuard(payload: BeforeMCPPayload): HookResponse {
  const { tool_name, tool_input } = payload;

  if (tool_name !== "filesystem") return { permission: "allow" };

  let input: Record<string, unknown>;
  try {
    input = JSON.parse(tool_input);
  } catch {
    return { permission: "allow" };
  }

  const path = input.path as string | undefined;
  if (path && !ALLOWED_ROOTS.some((root) => path.startsWith(root))) {
    return {
      permission: "deny",
      userMessage: `Blocked: MCP filesystem access outside project scope: ${path}`,
      agentMessage: `Filesystem access was blocked — the path is outside the project directory. Only access files within simpler-grants-gov or simpler-grants-documentation-automation.`,
    };
  }

  return { permission: "allow" };
}
