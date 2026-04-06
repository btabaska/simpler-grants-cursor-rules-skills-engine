#!/usr/bin/env bun
/**
 * Dispatcher: beforeMCPExecution
 * Handlers: mcp-scope-guard → mcp-tool-logger
 */
import type { BeforeMCPPayload, HookResponse } from "../types.ts";
import { DISPATCHER_TIMEOUT_MS } from "../lib/config.ts";
import { log } from "../lib/logger.ts";
import { mcpScopeGuard } from "../handlers/mcp/mcp-scope-guard.ts";
import { mcpToolLogger } from "../handlers/mcp/mcp-tool-logger.ts";

async function main(): Promise<void> {
  const timeout = setTimeout(() => {
    console.error("[dispatcher:before-mcp] Timeout — allowing by default");
    console.log(JSON.stringify({ permission: "allow" }));
    process.exit(0);
  }, DISPATCHER_TIMEOUT_MS);

  try {
    const input = await Bun.stdin.text();
    const payload: BeforeMCPPayload = JSON.parse(input);

    // 1. Security: block out-of-scope filesystem access
    const guardResult = mcpScopeGuard(payload);
    if (guardResult.permission === "deny") {
      log("beforeMCPExecution", payload, [`BLOCKED: ${guardResult.userMessage}`]);
      clearTimeout(timeout);
      console.log(JSON.stringify(guardResult));
      return;
    }

    // 2. Audit: log the tool call
    mcpToolLogger(payload);

    log("beforeMCPExecution", payload, []);
    clearTimeout(timeout);
    console.log(JSON.stringify({ permission: "allow" }));
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[dispatcher:before-mcp] Error: ${err}`);
    console.log(JSON.stringify({ permission: "allow" }));
  }
}

main();
