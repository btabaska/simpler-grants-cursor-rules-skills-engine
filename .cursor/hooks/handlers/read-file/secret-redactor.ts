import type { BeforeReadFilePayload, ReadFileResponse } from "../../types.ts";
import {
  BLOCKED_FILE_PATTERNS,
  SECRET_VALUE_PATTERNS,
  SAFE_VALUE_PATTERNS,
} from "../../lib/config.ts";

export function secretRedactor(payload: BeforeReadFilePayload): ReadFileResponse {
  const { file_path, content } = payload;

  // Files that should never be read by the LLM
  for (const pattern of BLOCKED_FILE_PATTERNS) {
    if (pattern.test(file_path)) {
      return {
        permission: "deny",
        userMessage: `Blocked: ${file_path} may contain production secrets and was not sent to the AI model.`,
        agentMessage: `File ${file_path} was blocked by the secret-redactor hook. Ask the developer for the specific non-secret information you need.`,
      };
    }
  }

  // For .env files, redact actual secret values
  if (/\.env/.test(file_path)) {
    const redacted = content.replace(
      /^(\w+)=(.+)$/gm,
      (match: string, key: string, value: string) => {
        const trimmed = value.trim();
        if (SAFE_VALUE_PATTERNS.test(trimmed)) return match;
        for (const secretPattern of SECRET_VALUE_PATTERNS) {
          if (secretPattern.test(trimmed)) return `${key}=[REDACTED_SECRET]`;
        }
        return match;
      }
    );

    return { permission: "allow", file_path, content: redacted };
  }

  return { permission: "allow" };
}
