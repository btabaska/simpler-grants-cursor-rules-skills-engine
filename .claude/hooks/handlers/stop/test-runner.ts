import { execSync } from "child_process";
import type { StopPayload } from "../../types.ts";
import { STOP_HANDLER_TIMEOUT_MS } from "../../lib/config.ts";

export function testRunner(payload: StopPayload): void {
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
      console.error("[test-runner] Running API tests...");
      try {
        const result = execSync(
          "cd api && python -m pytest tests/ --tb=short -q",
          { timeout: STOP_HANDLER_TIMEOUT_MS, encoding: "utf-8", stdio: "pipe" }
        );
        console.error("[test-runner] API tests: PASSED");
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string };
        console.error(
          `[test-runner] API tests: FAILED\n${e.stdout || e.stderr || ""}`
        );
      }
    }

    if (touchedFrontend) {
      console.error("[test-runner] Running frontend tests...");
      try {
        execSync(
          "cd frontend && npm test -- --watchAll=false --reporters=default",
          { timeout: STOP_HANDLER_TIMEOUT_MS, encoding: "utf-8", stdio: "pipe" }
        );
        console.error("[test-runner] Frontend tests: PASSED");
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string };
        console.error(
          `[test-runner] Frontend tests: FAILED\n${e.stdout || e.stderr || ""}`
        );
      }
    }
  } catch {
    console.error("[test-runner] Could not determine changed files");
  }
}
