import { execSync } from "child_process";
import type { StopPayload } from "../../types.ts";
import { STOP_HANDLER_TIMEOUT_MS } from "../../lib/config.ts";

export function coverageReporter(payload: StopPayload): void {
  if (payload.status !== "completed") return;

  try {
    const changedFiles = execSync("git diff --name-only HEAD", {
      timeout: 5000,
      encoding: "utf-8",
    }).trim();
    const files = changedFiles.split("\n");

    const touchedAPI = files.some((f) => f.startsWith("api/"));
    const touchedFrontend = files.some((f) => f.startsWith("frontend/"));

    if (touchedAPI) {
      try {
        const output = execSync(
          "cd api && python -m pytest tests/ --cov=src --cov-report=term-missing --tb=no -q 2>/dev/null | tail -5",
          { timeout: STOP_HANDLER_TIMEOUT_MS, encoding: "utf-8", stdio: "pipe" }
        );
        console.error(`[coverage] API coverage:\n${output}`);
      } catch {
        console.error("[coverage] Could not generate API coverage report");
      }
    }

    if (touchedFrontend) {
      try {
        const output = execSync(
          "cd frontend && npm test -- --watchAll=false --coverage --reporters=default 2>/dev/null | tail -20",
          { timeout: STOP_HANDLER_TIMEOUT_MS, encoding: "utf-8", stdio: "pipe" }
        );
        console.error(`[coverage] Frontend coverage:\n${output}`);
      } catch {
        console.error("[coverage] Could not generate frontend coverage report");
      }
    }
  } catch {
    console.error("[coverage] Could not determine changed files");
  }
}
