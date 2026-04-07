import { readFileSync } from "fs";
import type { AfterFileEditPayload } from "../../types.ts";
import { classifyFile } from "../../lib/file-classifier.ts";

export function accessibilityChecker(payload: AfterFileEditPayload): string[] {
  const { file_path } = payload;
  const warnings: string[] = [];
  const fileType = classifyFile(file_path);

  if (!fileType.isComponent && !fileType.isPage) return warnings;

  let content: string;
  try {
    content = readFileSync(file_path, "utf-8");
  } catch {
    return warnings;
  }

  // accessibility: onClick on non-interactive elements
  if (/<div[^>]*onClick/.test(content)) {
    warnings.push(
      `CONVENTION VIOLATION [accessibility]: onClick on <div>. Use <button> for interactive elements, or add onKeyDown + role="button" + tabIndex={0}.`
    );
  }

  // accessibility: images without alt text
  if (/<img\s(?![^>]*alt\s*=)/.test(content)) {
    warnings.push(
      `CONVENTION VIOLATION [accessibility]: <img> tag without alt attribute. All images must have descriptive alt text.`
    );
  }

  // accessibility: heading hierarchy — skip check (too complex for regex)

  // accessibility: form inputs without labels
  if (/<input\b/.test(content) && !/<label\b/.test(content) && !/aria-label/.test(content)) {
    warnings.push(
      `CONVENTION WARNING [accessibility]: <input> found without visible <label> or aria-label. Ensure form inputs are labeled.`
    );
  }

  // accessibility: tabIndex > 0
  if (/tabIndex\s*=\s*\{?\s*[1-9]/.test(content)) {
    warnings.push(
      `CONVENTION VIOLATION [accessibility]: tabIndex > 0 detected. NEVER use tabIndex values greater than 0 (disrupts natural tab order).`
    );
  }

  return warnings;
}
