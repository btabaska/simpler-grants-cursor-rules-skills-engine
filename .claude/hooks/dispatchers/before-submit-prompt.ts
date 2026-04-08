#!/usr/bin/env bun
/**
 * Dispatcher: beforeSubmitPrompt
 * Handlers: prompt-enrichment-logger
 */
import type { BeforeSubmitPromptPayload } from "../types.ts";
import { DISPATCHER_TIMEOUT_MS } from "../lib/config.ts";
import { log } from "../lib/logger.ts";
import { promptEnrichmentLogger } from "../handlers/prompt/prompt-enrichment-logger.ts";

async function main(): Promise<void> {
  const timeout = setTimeout(() => {
    console.error("[dispatcher:before-submit-prompt] Timeout — allowing by default");
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }, DISPATCHER_TIMEOUT_MS);

  try {
    const input = await Bun.stdin.text();
    const payload: BeforeSubmitPromptPayload = JSON.parse(input);

    // 1. Audit: log prompt metadata
    const result = promptEnrichmentLogger(payload);

    log("beforeSubmitPrompt", payload, []);
    clearTimeout(timeout);
    console.log(JSON.stringify(result));
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[dispatcher:before-submit-prompt] Error: ${err}`);
    console.log(JSON.stringify({ continue: true }));
  }
}

main();
