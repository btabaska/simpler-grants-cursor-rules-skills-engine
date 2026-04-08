#!/usr/bin/env bun
/**
 * Dispatcher: beforeReadFile
 * Handlers: secret-redactor → sensitive-file-guard
 *
 * This is the ONLY hook that can modify file content (via content field).
 */
import type { BeforeReadFilePayload, ReadFileResponse } from "../types.ts";
import { DISPATCHER_TIMEOUT_MS } from "../lib/config.ts";
import { log } from "../lib/logger.ts";
import { secretRedactor } from "../handlers/read-file/secret-redactor.ts";
import { sensitiveFileGuard } from "../handlers/read-file/sensitive-file-guard.ts";

async function main(): Promise<void> {
  const timeout = setTimeout(() => {
    console.error("[dispatcher:before-read-file] Timeout — allowing by default");
    console.log(JSON.stringify({ permission: "allow" }));
    process.exit(0);
  }, DISPATCHER_TIMEOUT_MS);

  try {
    const input = await Bun.stdin.text();
    const payload: BeforeReadFilePayload = JSON.parse(input);
    const warnings: string[] = [];

    // 1. Security: block or redact secrets
    const redactResult = secretRedactor(payload);
    if (redactResult.permission === "deny") {
      warnings.push(`BLOCKED: ${payload.file_path}`);
      log("beforeReadFile", payload, warnings);
      clearTimeout(timeout);
      console.log(JSON.stringify(redactResult));
      return;
    }

    // 2. Advisory: warn about sensitive files
    const guardResult = sensitiveFileGuard(payload);

    // Merge responses — redactor may have modified content
    const response: ReadFileResponse = {
      permission: "allow",
    };

    if (redactResult.content !== undefined) {
      response.file_path = redactResult.file_path;
      response.content = redactResult.content;
      warnings.push(`REDACTED: ${payload.file_path}`);
    }

    if (guardResult.agentMessage) {
      response.agentMessage = guardResult.agentMessage;
    }

    log("beforeReadFile", payload, warnings);
    clearTimeout(timeout);
    console.log(JSON.stringify(response));
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[dispatcher:before-read-file] Error: ${err}`);
    console.log(JSON.stringify({ permission: "allow" }));
  }
}

main();
