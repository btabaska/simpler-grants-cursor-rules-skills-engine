import { readFileSync } from "fs";
import type { AfterFileEditPayload } from "../../types.ts";
import { classifyFile } from "../../lib/file-classifier.ts";

export function conventionChecker(
  payload: AfterFileEditPayload,
  language: "python" | "typescript"
): string[] {
  const { file_path } = payload;
  const warnings: string[] = [];
  const fileType = classifyFile(file_path);

  let content: string;
  try {
    content = readFileSync(file_path, "utf-8");
  } catch {
    return warnings;
  }

  // ===== PYTHON CONVENTIONS =====
  if (language === "python") {
    // api-services: "NEVER put business logic in route handlers"
    if (fileType.isRoute) {
      if (/db_session\.(query|execute|add|delete|commit|flush)/.test(content)) {
        warnings.push(
          `CONVENTION VIOLATION [api-services]: Direct db_session usage in route handler ${file_path}. Business logic must be in the service layer.`
        );
      }
      if (/\.filter\(|\.join\(.*Model/.test(content)) {
        warnings.push(
          `CONVENTION VIOLATION [api-services]: SQLAlchemy query building in route handler. Queries belong in the service or database layer.`
        );
      }
    }

    // api-error-handling: "ALWAYS use raise_flask_error()"
    if (fileType.isAPI) {
      if (/raise\s+(HTTPException|abort\s*\()/.test(content)) {
        warnings.push(
          `CONVENTION VIOLATION [api-error-handling]: Raw HTTP exception found. ALWAYS use raise_flask_error() with ValidationErrorDetail.`
        );
      }
    }

    // api-database: "NEVER use legacy Column() syntax"
    if (fileType.isDatabase) {
      if (/=\s*Column\(/.test(content) && !/Mapped\[/.test(content)) {
        warnings.push(
          `CONVENTION VIOLATION [api-database]: Legacy Column() syntax detected. Use Mapped[T] with mapped_column().`
        );
      }
    }

    // api-database: "NEVER use raw SQL strings"
    if (fileType.isDatabase || fileType.isService) {
      if (/execute\s*\(\s*["'`]/.test(content) || /text\s*\(\s*["'`]SELECT/.test(content)) {
        warnings.push(
          `CONVENTION VIOLATION [api-database]: Raw SQL string detected. Use SQLAlchemy ORM queries.`
        );
      }
    }

    // cross-domain: "Structured logging — static messages + extra={}"
    if (fileType.isAPI) {
      if (/logger\.(info|warning|error|debug)\s*\(f["']/.test(content)) {
        warnings.push(
          `CONVENTION VIOLATION [cross-domain]: f-string in log message. Use static messages with extra={} for structured logging.`
        );
      }
    }

    // cross-domain: "NEVER log PII"
    if (fileType.isAPI) {
      if (/logger\..*\b(email|name|ssn|password|phone)\b/.test(content) && !/extra=/.test(content)) {
        warnings.push(
          `CONVENTION WARNING [cross-domain]: Possible PII in log message. Use UUIDs instead of personal information.`
        );
      }
    }

    // api-error-handling: "NEVER use bare except"
    if (/except\s*:/.test(content)) {
      warnings.push(
        `CONVENTION VIOLATION [api-error-handling]: Bare except clause found. Always catch specific exceptions.`
      );
    }

    // api-database: "ALWAYS use back_populates, not backref"
    if (fileType.isDatabase) {
      if (/backref\s*=/.test(content)) {
        warnings.push(
          `CONVENTION VIOLATION [api-database]: backref= detected. ALWAYS use back_populates= and define both sides of the relationship.`
        );
      }
    }

    // api-database: "ALWAYS use schema='api'"
    if (fileType.isMigration) {
      if (/op\.(create_table|add_column|drop_column|create_index)/.test(content)) {
        if (!/schema\s*=\s*["']api["']/.test(content)) {
          warnings.push(
            `CONVENTION VIOLATION [api-database]: Migration operation missing schema="api". All operations must specify the api schema.`
          );
        }
      }
    }
  }

  // ===== TYPESCRIPT CONVENTIONS =====
  if (language === "typescript") {
    // frontend-components: "No inline styles"
    if (fileType.isComponent) {
      if (/style\s*=\s*\{\{/.test(content)) {
        warnings.push(
          `CONVENTION VIOLATION [frontend-components]: Inline styles detected. Use USWDS utility classes.`
        );
      }
    }

    // frontend-components: "Server components by default"
    if ((fileType.isComponent || fileType.isPage) && !fileType.isTest) {
      if (/useState|useEffect|useRef|useCallback|useMemo/.test(content)) {
        if (!/['"]use client['"]/.test(content)) {
          warnings.push(
            `CONVENTION VIOLATION [frontend-components]: React hooks used without "use client" directive. Add it at the top or refactor to server component patterns.`
          );
        }
      }
    }

    // frontend-components: "NO barrel files"
    if (/\/index\.(ts|tsx)$/.test(file_path) && fileType.surface === "frontend") {
      if (/export\s*\{/.test(content) || /export\s+\*\s+from/.test(content)) {
        warnings.push(
          `CONVENTION VIOLATION [frontend-components]: Barrel file (index.ts re-export) detected. Import directly from source files.`
        );
      }
    }

    // frontend-i18n: "NEVER hardcode user-facing strings"
    if ((fileType.isComponent || fileType.isPage) && !fileType.isTest) {
      const jsxTextMatches = content.match(/>[\s]*[A-Z][a-z]+[\s\w]{5,}</g);
      if (jsxTextMatches && jsxTextMatches.length > 3) {
        warnings.push(
          `CONVENTION WARNING [frontend-i18n]: Multiple hardcoded strings detected in JSX. Use the translation system (useTranslations).`
        );
      }
    }

    // TypeScript: No 'any' types
    if (/:\s*any\b/.test(content)) {
      const anyCount = (content.match(/:\s*any\b/g) || []).length;
      warnings.push(
        `CONVENTION WARNING [cross-domain]: ${anyCount} 'any' type annotation(s) found. Use specific types.`
      );
    }

    // frontend-services: "Use requesterForEndpoint / useClientFetch"
    if (fileType.isService || fileType.isHook) {
      if (/\bfetch\s*\(/.test(content) && !/requesterForEndpoint|useClientFetch/.test(content)) {
        warnings.push(
          `CONVENTION WARNING [frontend-services]: Raw fetch() detected. Use requesterForEndpoint (server) or useClientFetch (client).`
        );
      }
    }
  }

  return warnings;
}
