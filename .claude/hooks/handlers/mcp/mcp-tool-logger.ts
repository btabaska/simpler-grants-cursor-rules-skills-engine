import type { BeforeMCPPayload } from "../../types.ts";
import { appendLog } from "../../lib/logger.ts";

export function mcpToolLogger(payload: BeforeMCPPayload): void {
  appendLog("mcp-audit.jsonl", {
    timestamp: new Date().toISOString(),
    event: "mcp_execution",
    tool_name: payload.tool_name,
    tool_input: payload.tool_input,
    conversation_id: payload.conversation_id,
    generation_id: payload.generation_id,
  });
}
