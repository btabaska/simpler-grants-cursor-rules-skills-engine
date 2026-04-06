import type { BeforeReadFilePayload, ReadFileResponse } from "../../types.ts";

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /\/auth\//i,
    message:
      "This file handles authentication/authorization. Any changes must be reviewed by the security-sentinel specialist.",
  },
  {
    pattern: /\/migrations?\//i,
    message:
      "This is a database migration file. Migrations are append-only — never modify an existing migration, always create a new one.",
  },
  {
    pattern: /terraform\.tfstate/,
    message:
      "This is Terraform state. NEVER modify state files directly. Use terraform import/state mv commands.",
  },
  {
    pattern: /\/infra\/.*\.tf$/,
    message:
      "This is infrastructure code. Changes here affect real AWS resources. Always run terraform plan before apply.",
  },
];

export function sensitiveFileGuard(payload: BeforeReadFilePayload): ReadFileResponse {
  const { file_path } = payload;

  for (const { pattern, message } of SENSITIVE_PATTERNS) {
    if (pattern.test(file_path)) {
      return {
        permission: "allow",
        agentMessage: `[HOOK ADVISORY] ${message}`,
      };
    }
  }

  return { permission: "allow" };
}
