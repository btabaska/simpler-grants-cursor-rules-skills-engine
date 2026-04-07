import type { StopPayload } from "../../types.ts";
import { appendLog } from "../../lib/logger.ts";

export function auditLogFinalizer(payload: StopPayload): void {
  appendLog("audit.jsonl", {
    timestamp: new Date().toISOString(),
    event: "session_end",
    status: payload.status,
    loop_count: payload.loop_count,
    conversation_id: payload.conversation_id,
    generation_id: payload.generation_id,
  });
}
