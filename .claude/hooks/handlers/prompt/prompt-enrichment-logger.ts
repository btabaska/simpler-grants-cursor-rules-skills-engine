import type { BeforeSubmitPromptPayload } from "../../types.ts";
import { appendLog } from "../../lib/logger.ts";

export function promptEnrichmentLogger(
  payload: BeforeSubmitPromptPayload
): { continue: boolean } {
  appendLog("prompt-audit.jsonl", {
    timestamp: new Date().toISOString(),
    event: "prompt_submitted",
    prompt_length: payload.prompt.length,
    attachment_count: payload.attachments?.length ?? 0,
    conversation_id: payload.conversation_id,
    generation_id: payload.generation_id,
  });

  return { continue: true };
}
