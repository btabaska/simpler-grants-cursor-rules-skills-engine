#!/usr/bin/env bun
/**
 * Dispatcher: afterFileEdit (notification-only — cannot modify files)
 * Handlers: auto-formatter → convention-checker → import-validator →
 *           test-pattern-checker → error-pattern-checker →
 *           accessibility-checker → todo-scanner
 */
import type { AfterFileEditPayload } from "../types.ts";
import { DISPATCHER_TIMEOUT_MS } from "../lib/config.ts";
import { log } from "../lib/logger.ts";
import { classifyFile } from "../lib/file-classifier.ts";
import { autoFormatter } from "../handlers/edit/auto-formatter.ts";
import { conventionChecker } from "../handlers/edit/convention-checker.ts";
import { importValidator } from "../handlers/edit/import-validator.ts";
import { testPatternChecker } from "../handlers/edit/test-pattern-checker.ts";
import { errorPatternChecker } from "../handlers/edit/error-pattern-checker.ts";
import { accessibilityChecker } from "../handlers/edit/accessibility-checker.ts";
import { todoScanner } from "../handlers/edit/todo-scanner.ts";

async function main(): Promise<void> {
  const timeout = setTimeout(() => {
    console.error("[dispatcher:after-file-edit] Timeout");
    process.exit(0);
  }, DISPATCHER_TIMEOUT_MS);

  try {
    const input = await Bun.stdin.text();
    const payload: AfterFileEditPayload = JSON.parse(input);
    const allWarnings: string[] = [];
    const fileType = classifyFile(payload.file_path);

    // Determine language for convention/import checks
    const lang = fileType.language === "python" ? "python" : "typescript";

    // 1. Auto-format the file
    allWarnings.push(...autoFormatter(payload));

    // 2. Convention checks (language-aware)
    if (lang === "python" || lang === "typescript") {
      allWarnings.push(...conventionChecker(payload, lang));
    }

    // 3. Import validation (language-aware)
    if (lang === "python" || lang === "typescript") {
      allWarnings.push(...importValidator(payload, lang));
    }

    // 4. Test pattern checks (only for test files)
    if (fileType.isTest) {
      allWarnings.push(...testPatternChecker(payload));
    }

    // 5. Error pattern checks (API only)
    if (fileType.isAPI) {
      allWarnings.push(...errorPatternChecker(payload));
    }

    // 6. Accessibility checks (frontend components/pages)
    if (fileType.surface === "frontend" && (fileType.isComponent || fileType.isPage)) {
      allWarnings.push(...accessibilityChecker(payload));
    }

    // 7. TODO/FIXME scanning
    allWarnings.push(...todoScanner(payload));

    // Log and output warnings
    log("afterFileEdit", payload, allWarnings);

    if (allWarnings.length > 0) {
      console.error(
        `\n[hooks:afterFileEdit] ${allWarnings.length} issue(s) in ${payload.file_path}:`
      );
      for (const w of allWarnings) {
        console.error(`  ⚠ ${w}`);
      }
    }

    clearTimeout(timeout);
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[dispatcher:after-file-edit] Error: ${err}`);
  }
}

main();
