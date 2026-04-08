#!/usr/bin/env bun
/**
 * Dispatcher: stop
 * Handlers: session-summary → test-runner → coverage-reporter → audit-log-finalizer
 *
 * Stop handlers run after the agent finishes and can take longer (up to 120s).
 */
import type { StopPayload } from "../types.ts";
import { STOP_HANDLER_TIMEOUT_MS } from "../lib/config.ts";
import { sessionSummary } from "../handlers/stop/session-summary.ts";
import { testRunner } from "../handlers/stop/test-runner.ts";
import { coverageReporter } from "../handlers/stop/coverage-reporter.ts";
import { auditLogFinalizer } from "../handlers/stop/audit-log-finalizer.ts";

async function main(): Promise<void> {
  const timeout = setTimeout(() => {
    console.error("[dispatcher:on-stop] Timeout");
    process.exit(0);
  }, STOP_HANDLER_TIMEOUT_MS);

  try {
    const input = await Bun.stdin.text();
    const payload: StopPayload = JSON.parse(input);

    // 1. Generate session summary
    sessionSummary(payload);

    // 2. Run relevant test suites
    testRunner(payload);

    // 3. Report coverage delta
    coverageReporter(payload);

    // 4. Finalize audit log
    auditLogFinalizer(payload);

    clearTimeout(timeout);
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[dispatcher:on-stop] Error: ${err}`);
  }
}

main();
