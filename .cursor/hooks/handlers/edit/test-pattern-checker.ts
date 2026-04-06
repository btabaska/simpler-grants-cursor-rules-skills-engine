import { readFileSync } from "fs";
import type { AfterFileEditPayload } from "../../types.ts";

export function testPatternChecker(payload: AfterFileEditPayload): string[] {
  const { file_path } = payload;
  const warnings: string[] = [];

  let content: string;
  try {
    content = readFileSync(file_path, "utf-8");
  } catch {
    return warnings;
  }

  // Python test patterns
  if (file_path.endsWith(".py") && /test_/.test(file_path)) {
    // api-tests: "Use factory .build() over .create()"
    const createMatches = content.match(/\.create\(\)/g);
    if (createMatches && createMatches.length > 0) {
      warnings.push(
        `CONVENTION WARNING [api-tests]: Found ${createMatches.length} factory .create() calls. Prefer .build() to avoid unnecessary database writes.`
      );
    }

    // api-tests: "NEVER hardcode values the factory generates"
    if (/assert.*==\s*["'][0-9a-f]{8}-/.test(content)) {
      warnings.push(
        `CONVENTION WARNING [api-tests]: Hardcoded UUID in assertion. Reference the factory object instead.`
      );
    }
  }

  // TypeScript test patterns
  if (/\.(test|spec)\.(ts|tsx)$/.test(file_path)) {
    // frontend-tests: "Use screen queries, not container queries"
    if (/container\.querySelector|container\.getElementsBy/.test(content)) {
      warnings.push(
        `CONVENTION VIOLATION [frontend-tests]: Direct DOM queries detected. Use RTL screen queries: screen.getByRole(), screen.getByText().`
      );
    }

    // frontend-tests: "Prefer getByRole over getByTestId"
    const testIdCount = (content.match(/getByTestId/g) || []).length;
    const roleCount = (content.match(/getByRole/g) || []).length;
    if (testIdCount > roleCount && testIdCount > 3) {
      warnings.push(
        `CONVENTION WARNING [frontend-tests]: Heavy use of getByTestId (${testIdCount}) vs getByRole (${roleCount}). Prefer getByRole for accessible testing.`
      );
    }

    // frontend-tests: "ALWAYS include jest-axe accessibility assertions"
    if (/\.tsx?$/.test(file_path) && /render\(/.test(content)) {
      if (!/jest-axe|axe|toHaveNoViolations/.test(content)) {
        warnings.push(
          `CONVENTION WARNING [frontend-tests]: No accessibility assertions found in component test. Include jest-axe.`
        );
      }
    }
  }

  return warnings;
}
