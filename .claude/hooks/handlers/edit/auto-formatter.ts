import { execSync } from "child_process";
import type { AfterFileEditPayload } from "../../types.ts";
import { HANDLER_TIMEOUT_MS } from "../../lib/config.ts";

export function autoFormatter(payload: AfterFileEditPayload): string[] {
  const { file_path } = payload;
  const warnings: string[] = [];

  try {
    if (file_path.endsWith(".py")) {
      try {
        execSync(`ruff format "${file_path}"`, { timeout: HANDLER_TIMEOUT_MS, stdio: "pipe" });
      } catch { /* formatter not available */ }
      try {
        execSync(`ruff check --fix "${file_path}"`, { timeout: HANDLER_TIMEOUT_MS, stdio: "pipe" });
      } catch { /* linter not available or found issues */ }
    } else if (/\.(ts|tsx|js|jsx)$/.test(file_path)) {
      try {
        execSync(`npx prettier --write "${file_path}"`, { timeout: HANDLER_TIMEOUT_MS, stdio: "pipe" });
      } catch { /* prettier not available */ }
    } else if (file_path.endsWith(".tf")) {
      try {
        execSync(`terraform fmt "${file_path}"`, { timeout: HANDLER_TIMEOUT_MS, stdio: "pipe" });
      } catch { /* terraform not available */ }
    }
  } catch (err) {
    warnings.push(`Formatter failed for ${file_path}: ${(err as Error).message}`);
  }

  return warnings;
}
