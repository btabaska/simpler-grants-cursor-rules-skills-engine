import { readFileSync } from "fs";
import type { AfterFileEditPayload } from "../../types.ts";

export function importValidator(
  payload: AfterFileEditPayload,
  language: "python" | "typescript"
): string[] {
  const { file_path } = payload;
  const warnings: string[] = [];

  let content: string;
  try {
    content = readFileSync(file_path, "utf-8");
  } catch {
    return warnings;
  }

  if (language === "python") {
    if (file_path.includes("api/src/")) {
      const relativeImports = content.match(/from\s+\.\./g);
      if (relativeImports && relativeImports.length > 0) {
        warnings.push(
          `CONVENTION WARNING [api-routes]: ${relativeImports.length} relative import(s) found. Use absolute imports from package root.`
        );
      }
    }
  }

  if (language === "typescript") {
    const deepImports = content.match(/from\s+['"]\.\.\/\.\.\/\.\.\//g);
    if (deepImports && deepImports.length > 0) {
      warnings.push(
        `CONVENTION WARNING [frontend-components]: Deep relative imports found (3+ levels). Consider using path aliases.`
      );
    }
  }

  return warnings;
}
