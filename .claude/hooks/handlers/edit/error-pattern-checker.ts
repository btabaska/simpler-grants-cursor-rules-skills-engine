import { readFileSync } from "fs";
import type { AfterFileEditPayload } from "../../types.ts";

export function errorPatternChecker(payload: AfterFileEditPayload): string[] {
  const { file_path } = payload;
  const warnings: string[] = [];

  if (!file_path.includes("api/src/")) return warnings;

  let content: string;
  try {
    content = readFileSync(file_path, "utf-8");
  } catch {
    return warnings;
  }

  // api-error-handling: raise_flask_error used but ValidationErrorDetail not imported
  if (/raise_flask_error/.test(content) && !/ValidationErrorDetail/.test(content)) {
    warnings.push(
      `CONVENTION WARNING [api-error-handling]: raise_flask_error() used but ValidationErrorDetail not found. Ensure error details use the contract.`
    );
  }

  // api-error-handling: bare except clause
  if (/except\s*:/.test(content)) {
    warnings.push(
      `CONVENTION VIOLATION [api-error-handling]: Bare except clause found. Always catch specific exceptions.`
    );
  }

  // api-error-handling: swallowed exceptions
  const swallowed = content.match(/except\s+\w+[^:]*:\s*\n\s*pass/g);
  if (swallowed && swallowed.length > 0) {
    warnings.push(
      `CONVENTION WARNING [api-error-handling]: ${swallowed.length} swallowed exception(s) (except ... pass). At minimum, log the exception.`
    );
  }

  return warnings;
}
