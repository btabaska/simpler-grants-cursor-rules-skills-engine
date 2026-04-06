import { execSync } from "child_process";
import type { StopPayload } from "../../types.ts";
import { appendLog } from "../../lib/logger.ts";

export function sessionSummary(payload: StopPayload): void {
  try {
    const diffStat = execSync("git diff --stat HEAD", {
      timeout: 5000,
      encoding: "utf-8",
    }).trim();
    const untracked = execSync(
      "git ls-files --others --exclude-standard",
      { timeout: 5000, encoding: "utf-8" }
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(0, 20);

    const summary = {
      timestamp: new Date().toISOString(),
      conversation_id: payload.conversation_id,
      status: payload.status,
      loop_count: payload.loop_count,
      changes: diffStat,
      new_files: untracked,
    };

    appendLog("sessions.jsonl", summary);

    console.error(`\n=== Session Complete (${payload.status}) ===`);
    console.error(`Loops: ${payload.loop_count}`);
    console.error(`Changes:\n${diffStat || "(none)"}`);
    if (untracked.length > 0) {
      console.error(`New files:\n${untracked.join("\n")}`);
    }
  } catch {
    console.error("[session-summary] Failed to generate summary");
  }
}
