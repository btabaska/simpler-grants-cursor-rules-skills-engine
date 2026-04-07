import { readFileSync } from "fs";
import type { AfterFileEditPayload } from "../../types.ts";

export function todoScanner(payload: AfterFileEditPayload): string[] {
  const { file_path } = payload;
  const warnings: string[] = [];

  let content: string;
  try {
    content = readFileSync(file_path, "utf-8");
  } catch {
    return warnings;
  }

  const todoMatches = [...content.matchAll(/(TODO|FIXME|HACK|XXX|TEMP)\b[:(]?\s*(.*)/gi)];
  if (todoMatches.length > 0) {
    const items = todoMatches.map(
      (m) => `${m[1]}: ${m[2].trim().substring(0, 80)}`
    );
    warnings.push(
      `INFO: ${todoMatches.length} TODO/FIXME marker(s) in ${file_path}:\n` +
        items.map((t) => `  - ${t}`).join("\n")
    );
  }

  // Feature flag cleanup markers
  const cleanupMatches = [...content.matchAll(/TODO\(cleanup\):?\s*(.*)/gi)];
  for (const match of cleanupMatches) {
    warnings.push(
      `FEATURE FLAG CLEANUP MARKER: "${match[1].trim()}" — track this in the flag cleanup skill.`
    );
  }

  return warnings;
}
