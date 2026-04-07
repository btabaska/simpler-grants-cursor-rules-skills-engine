#!/usr/bin/env bun
/**
 * Dispatcher: beforeShellExecution
 * Handlers: dangerous-command-guard → environment-protection → command-logger
 */
import type { BeforeShellPayload, HookResponse } from "../types.ts";
import { DISPATCHER_TIMEOUT_MS } from "../lib/config.ts";
import { log } from "../lib/logger.ts";
import { dangerousCommandGuard } from "../handlers/shell/dangerous-command-guard.ts";
import { environmentProtection } from "../handlers/shell/environment-protection.ts";
import { commandLogger } from "../handlers/shell/command-logger.ts";

async function main(): Promise<void> {
  const timeout = setTimeout(() => {
    console.error("[dispatcher:before-shell] Timeout — allowing by default");
    console.log(JSON.stringify({ permission: "allow" }));
    process.exit(0);
  }, DISPATCHER_TIMEOUT_MS);

  try {
    const input = await Bun.stdin.text();
    const payload: BeforeShellPayload = JSON.parse(input);
    const warnings: string[] = [];

    // 1. Security: block dangerous commands
    const guardResult = dangerousCommandGuard(payload);
    if (guardResult.permission === "deny") {
      log("beforeShellExecution", payload, [`BLOCKED: ${guardResult.userMessage}`]);
      clearTimeout(timeout);
      console.log(JSON.stringify(guardResult));
      return;
    }

    // 2. Security: protect sensitive files from writes
    const envResult = environmentProtection(payload);
    if (envResult.permission === "deny") {
      log("beforeShellExecution", payload, [`BLOCKED: ${envResult.userMessage}`]);
      clearTimeout(timeout);
      console.log(JSON.stringify(envResult));
      return;
    }

    // 3. Audit: log the command
    commandLogger(payload);

    // Merge any advisory messages
    const response: HookResponse = { permission: "allow" };
    if (guardResult.agentMessage || envResult.agentMessage) {
      response.agentMessage = [guardResult.agentMessage, envResult.agentMessage]
        .filter(Boolean)
        .join("\n");
    }

    log("beforeShellExecution", payload, warnings);
    clearTimeout(timeout);
    console.log(JSON.stringify(response));
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[dispatcher:before-shell] Error: ${err}`);
    console.log(JSON.stringify({ permission: "allow" }));
  }
}

main();
