// Hook configuration constants

/** Maximum time any single handler should take (ms) */
export const HANDLER_TIMEOUT_MS = 5000;

/** Maximum time the entire dispatcher should take (ms) */
export const DISPATCHER_TIMEOUT_MS = 10000;

/** Maximum time for stop-event handlers (tests can be slow) */
export const STOP_HANDLER_TIMEOUT_MS = 120000;

/** Patterns for files that should never be read by the LLM */
export const BLOCKED_FILE_PATTERNS = [
  /\.env\.production$/,
  /\.env\.staging$/,
  /credentials\.json$/,
  /\.pem$/,
  /id_rsa/,
  /\.key$/,
  /terraform\.tfstate$/,
];

/** Patterns for secret values that should be redacted */
export const SECRET_VALUE_PATTERNS = [
  /^sk-/, // OpenAI/Stripe keys
  /^pk-/, // Stripe public keys
  /^ghp_/, // GitHub PATs
  /^ghs_/, // GitHub app tokens
  /^xox[bps]-/, // Slack tokens
  /^Bearer\s/i,
  /^Basic\s/i,
  /^eyJ/, // JWTs
];

/** Safe placeholder values that don't need redaction */
export const SAFE_VALUE_PATTERNS =
  /^(true|false|localhost|127\.0\.0\.1|example|your-|changeme|TODO|PLACEHOLDER|\d+)$/i;

/** Shell commands that are always blocked */
export const BLOCKED_SHELL_PATTERNS = [
  /rm\s+-rf\s+\//, // rm -rf with absolute root path
  /DROP\s+(TABLE|DATABASE)/i,
  /sudo\s+/,
  /chmod\s+777/,
  /git\s+push\s+.*--force/,
  /git\s+reset\s+--hard/,
  /terraform\s+destroy/,
  /truncate\s+/i,
  />\s*\/dev\/sd/,
];

/** File patterns that should not be modified by the agent */
export const PROTECTED_FILE_PATTERNS = [
  /\.env(?:\.\w+)?(?:\s|$|")/,
  /credentials/,
  /\.pem\b/,
  /secrets?\./i,
  /terraform\.tfvars/,
  /aws\/credentials/,
];

/** Commands that write to files */
export const WRITE_COMMAND_PATTERN =
  /^(echo|cat|tee|sed|awk|perl|python|node|>|>>|mv|cp|rm)\s/;
