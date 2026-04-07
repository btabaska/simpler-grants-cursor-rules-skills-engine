import { appendFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";

export interface LogEntry {
  timestamp: string;
  event: string;
  file_path?: string;
  warnings: string[];
  conversation_id?: string;
  generation_id?: string;
  [key: string]: unknown;
}

const LOG_DIR = ".cursor/hooks/logs";

function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function appendLog(filename: string, entry: Record<string, unknown>): void {
  ensureLogDir();
  const path = `${LOG_DIR}/${filename}`;
  appendFileSync(path, JSON.stringify(entry) + "\n");
}

export function log(
  event: string,
  payload: { file_path?: string; conversation_id?: string; generation_id?: string },
  warnings: string[]
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    event,
    file_path: payload.file_path,
    warnings,
    conversation_id: payload.conversation_id,
    generation_id: payload.generation_id,
  };

  // Always log to stderr for Hooks output panel
  if (warnings.length > 0) {
    console.error(
      `[hooks:${event}] ${warnings.length} warning(s) for ${payload.file_path || "session"}`
    );
  }

  // Append to structured log (non-blocking best-effort)
  try {
    appendLog("hooks.jsonl", entry);
  } catch {
    // Silently ignore log failures
  }
}
