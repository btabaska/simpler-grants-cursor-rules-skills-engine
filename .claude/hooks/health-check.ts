#!/usr/bin/env bun
/**
 * Standalone diagnostic script for the Simpler Grants AI Coding Toolkit.
 * Run with: bun run .cursor/hooks/health-check.ts
 *
 * Returns JSON with full health check results across all categories.
 * This is NOT a hook — it's an on-demand utility invoked by the
 * /tooling-health-check command.
 */

import { existsSync, statSync, readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { execSync } from "child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckResult {
  category: string;
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
  fix?: string;
}

interface HealthReport {
  timestamp: string;
  hostname: string;
  projectRoot: string;
  results: CheckResult[];
  summary: { passed: number; warnings: number; failed: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ROOT = resolve(import.meta.dir, "../..");

function run(cmd: string): string | null {
  try {
    return execSync(cmd, {
      cwd: PROJECT_ROOT,
      timeout: 10_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function fileExists(rel: string): boolean {
  return existsSync(join(PROJECT_ROOT, rel));
}

function dirExists(rel: string): boolean {
  const p = join(PROJECT_ROOT, rel);
  return existsSync(p) && statSync(p).isDirectory();
}

function isExecutable(rel: string): boolean {
  try {
    const s = statSync(join(PROJECT_ROOT, rel));
    return (s.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

function readText(rel: string): string | null {
  try {
    return readFileSync(join(PROJECT_ROOT, rel), "utf-8");
  } catch {
    return null;
  }
}

function hostname(): string {
  return run("hostname") ?? "unknown";
}

// ---------------------------------------------------------------------------
// Category 1: Runtime Dependencies
// ---------------------------------------------------------------------------

interface DepCheck {
  name: string;
  cmd: string;
  requiredBy: string;
  installHint: string;
  minVersion?: string;
}

const DEPS: DepCheck[] = [
  { name: "Node.js", cmd: "node --version", requiredBy: "Frontend, commands, skills", installHint: "brew install node  # or: nvm install 22", minVersion: "18" },
  { name: "npm", cmd: "npm --version", requiredBy: "Frontend dependencies", installHint: "Installed with Node.js" },
  { name: "Python", cmd: "python3 --version", requiredBy: "API", installHint: "brew install python@3.12", minVersion: "3.11" },
  { name: "pip", cmd: "pip3 --version", requiredBy: "API dependencies", installHint: "Installed with Python" },
  { name: "Bun", cmd: "bun --version", requiredBy: "Hooks (TypeScript dispatchers)", installHint: "curl -fsSL https://bun.sh/install | bash" },
  { name: "ruff", cmd: "ruff --version", requiredBy: "Hooks (auto-formatter for Python)", installHint: "pip install ruff" },
  { name: "Terraform", cmd: "terraform --version", requiredBy: "Infra rules, hooks", installHint: "brew install terraform" },
  { name: "jq", cmd: "jq --version", requiredBy: "Hooks (JSON parsing fallback)", installHint: "brew install jq" },
  { name: "git", cmd: "git --version", requiredBy: "Agents, hooks", installHint: "brew install git" },
  { name: "gh (GitHub CLI)", cmd: "gh --version", requiredBy: "PR review skill, GitHub MCP", installHint: "brew install gh && gh auth login" },
  { name: "Prettier", cmd: "npx prettier --version", requiredBy: "Hooks (auto-formatter)", installHint: "cd frontend && npm install" },
  { name: "ESLint", cmd: "npx eslint --version", requiredBy: "Frontend convention checks", installHint: "cd frontend && npm install" },
  { name: "pytest", cmd: "python3 -m pytest --version", requiredBy: "API test runner hook", installHint: "pip install pytest" },
  { name: "Playwright", cmd: "npx playwright --version", requiredBy: "E2E test agent workflows", installHint: "cd frontend && npx playwright install" },
];

function checkDependencies(results: CheckResult[]): void {
  for (const dep of DEPS) {
    const output = run(dep.cmd);
    if (output) {
      // Extract version number
      const versionMatch = output.match(/(\d+\.\d+[\.\d]*)/);
      const version = versionMatch ? versionMatch[1] : output;

      if (dep.minVersion) {
        const major = parseInt(version.split(".")[0], 10);
        const minMajor = parseInt(dep.minVersion.split(".")[0], 10);
        if (major < minMajor) {
          results.push({
            category: "Runtime Dependencies",
            name: dep.name,
            status: "warn",
            message: `v${version} (minimum v${dep.minVersion} required)`,
            fix: dep.installHint,
          });
          continue;
        }
      }

      results.push({
        category: "Runtime Dependencies",
        name: dep.name,
        status: "pass",
        message: `v${version}`,
      });
    } else {
      results.push({
        category: "Runtime Dependencies",
        name: dep.name,
        status: "fail",
        message: `NOT FOUND — required by ${dep.requiredBy}`,
        fix: dep.installHint,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Category 2: Directory Structure
// ---------------------------------------------------------------------------

const EXPECTED_RULES = [
  "api-routes.mdc", "api-services.mdc", "api-database.mdc", "api-auth.mdc",
  "api-validation.mdc", "api-error-handling.mdc", "api-form-schema.mdc",
  "api-tests.mdc", "api-tasks.mdc", "api-adapters.mdc", "api-workflow.mdc",
  "api-search.mdc", "frontend-components.mdc", "frontend-hooks.mdc",
  "frontend-services.mdc", "frontend-i18n.mdc", "frontend-tests.mdc",
  "frontend-e2e-tests.mdc", "frontend-app-pages.mdc", "accessibility.mdc",
  "cross-domain.mdc", "forms-vertical.mdc", "ci-cd.mdc", "infra.mdc",
];

const EXPECTED_AGENTS = [
  "debugging.md", "refactor.md", "new-endpoint.md", "orchestrator.md",
  "code-generation.md", "test-generation.md", "migration.md", "i18n.md", "adr.md",
];

const EXPECTED_COMMANDS = [
  "debug.md", "refactor.md", "new-endpoint.md", "generate.md", "test.md",
  "migration.md", "i18n.md", "adr.md", "review-pr.md", "check-conventions.md",
  "explain-architecture.md", "tooling-health-check.md",
];

const EXPECTED_SKILLS = ["pr-review", "quality-gate", "onboarding", "flag-cleanup"];

const EXPECTED_DISPATCHERS = [
  "after-file-edit.ts", "before-mcp.ts", "before-read-file.ts",
  "before-shell.ts", "before-submit-prompt.ts", "on-stop.ts",
];

function checkDirectoryStructure(results: CheckResult[]): void {
  const checks: { dir: string; expected: string[]; label: string }[] = [
    { dir: ".cursor/rules", expected: EXPECTED_RULES, label: "Rules" },
    { dir: ".cursor/agents", expected: EXPECTED_AGENTS, label: "Agents" },
    { dir: ".cursor/commands", expected: EXPECTED_COMMANDS, label: "Commands" },
    { dir: ".cursor/hooks/dispatchers", expected: EXPECTED_DISPATCHERS, label: "Dispatchers" },
  ];

  for (const { dir, expected, label } of checks) {
    if (!dirExists(dir)) {
      results.push({
        category: "Directory Structure",
        name: `${label} directory`,
        status: "fail",
        message: `${dir}/ does not exist`,
      });
      continue;
    }

    let found = 0;
    for (const file of expected) {
      if (fileExists(join(dir, file))) {
        found++;
      } else {
        results.push({
          category: "Directory Structure",
          name: `${label}: ${file}`,
          status: "fail",
          message: `MISSING: ${dir}/${file}`,
        });
      }
    }

    // Check for unexpected files
    try {
      const actual = readdirSync(join(PROJECT_ROOT, dir));
      const expectedSet = new Set(expected);
      for (const f of actual) {
        if (!expectedSet.has(f) && !f.startsWith(".")) {
          results.push({
            category: "Directory Structure",
            name: `${label}: ${f}`,
            status: "warn",
            message: `Unexpected file: ${dir}/${f}`,
          });
        }
      }
    } catch { /* ignore */ }

    results.push({
      category: "Directory Structure",
      name: `${label} summary`,
      status: found === expected.length ? "pass" : "fail",
      message: `${found}/${expected.length} ${label.toLowerCase()} present`,
    });
  }

  // Skills (directory-based)
  for (const skill of EXPECTED_SKILLS) {
    const skillDir = `.cursor/skills/${skill}`;
    const skillFile = `${skillDir}/SKILL.md`;
    if (!dirExists(skillDir)) {
      results.push({
        category: "Directory Structure",
        name: `Skill: ${skill}`,
        status: "fail",
        message: `MISSING: ${skillDir}/`,
      });
    } else if (!fileExists(skillFile)) {
      results.push({
        category: "Directory Structure",
        name: `Skill: ${skill}`,
        status: "fail",
        message: `MISSING: ${skillFile}`,
      });
    }
  }

  const skillsFound = EXPECTED_SKILLS.filter(s => fileExists(`.cursor/skills/${s}/SKILL.md`)).length;
  results.push({
    category: "Directory Structure",
    name: "Skills summary",
    status: skillsFound === EXPECTED_SKILLS.length ? "pass" : "fail",
    message: `${skillsFound}/${EXPECTED_SKILLS.length} skills present`,
  });

  // Core files
  for (const f of ["hooks.json", "mcp.json"]) {
    const path = `.cursor/${f}`;
    results.push({
      category: "Directory Structure",
      name: f,
      status: fileExists(path) ? "pass" : "fail",
      message: fileExists(path) ? "Present" : `MISSING: ${path}`,
    });
  }

  for (const f of ["hooks/types.ts", "hooks/package.json"]) {
    const path = `.cursor/${f}`;
    results.push({
      category: "Directory Structure",
      name: f,
      status: fileExists(path) ? "pass" : "fail",
      message: fileExists(path) ? "Present" : `MISSING: ${path}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Category 3: Rule File Integrity
// ---------------------------------------------------------------------------

function checkRuleIntegrity(results: CheckResult[]): void {
  const rulesDir = join(PROJECT_ROOT, ".cursor/rules");
  if (!dirExists(".cursor/rules")) return;

  for (const file of EXPECTED_RULES) {
    const content = readText(`.cursor/rules/${file}`);
    if (!content) {
      results.push({
        category: "Rule Integrity",
        name: file,
        status: "fail",
        message: "Cannot read file",
      });
      continue;
    }

    // Check frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      results.push({
        category: "Rule Integrity",
        name: file,
        status: "fail",
        message: "Missing YAML frontmatter",
      });
      continue;
    }

    const frontmatter = fmMatch[1];
    const hasDescription = /description\s*:/.test(frontmatter);
    const hasGlobs = /globs\s*:/.test(frontmatter);
    const hasAlwaysApply = /alwaysApply\s*:/.test(frontmatter);

    if (!hasDescription || !hasAlwaysApply) {
      results.push({
        category: "Rule Integrity",
        name: file,
        status: "fail",
        message: `Frontmatter missing: ${[!hasDescription && "description", !hasAlwaysApply && "alwaysApply"].filter(Boolean).join(", ")}`,
      });
      continue;
    }

    // Check body length
    const body = content.slice(fmMatch[0].length).trim();
    const bodyLines = body.split("\n").length;
    if (bodyLines < 10) {
      results.push({
        category: "Rule Integrity",
        name: file,
        status: "warn",
        message: `Body only has ${bodyLines} lines (expected at least 10)`,
      });
      continue;
    }

    // Check globs match files (if globs specified)
    const isAlwaysApply = /alwaysApply\s*:\s*true/.test(frontmatter);
    if (!hasGlobs && !isAlwaysApply) {
      results.push({
        category: "Rule Integrity",
        name: file,
        status: "warn",
        message: "No globs specified and alwaysApply is false — rule may never activate",
      });
      continue;
    }

    results.push({
      category: "Rule Integrity",
      name: file,
      status: "pass",
      message: `Frontmatter OK, ${bodyLines} lines${isAlwaysApply ? ", alwaysApply" : ""}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Category 4: Agent File Integrity
// ---------------------------------------------------------------------------

function checkAgentIntegrity(results: CheckResult[]): void {
  if (!dirExists(".cursor/agents")) return;

  for (const file of EXPECTED_AGENTS) {
    const content = readText(`.cursor/agents/${file}`);
    if (!content) {
      results.push({
        category: "Agent Integrity",
        name: file,
        status: "fail",
        message: "Cannot read file",
      });
      continue;
    }

    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      results.push({
        category: "Agent Integrity",
        name: file,
        status: "fail",
        message: "Missing YAML frontmatter (expected name, description, model)",
      });
      continue;
    }

    const fm = fmMatch[1];
    const hasName = /name\s*:/.test(fm);
    const hasDescription = /description\s*:/.test(fm);

    if (!hasName || !hasDescription) {
      results.push({
        category: "Agent Integrity",
        name: file,
        status: "fail",
        message: `Frontmatter missing: ${[!hasName && "name", !hasDescription && "description"].filter(Boolean).join(", ")}`,
      });
      continue;
    }

    const body = content.slice(fmMatch[0].length).trim();
    const bodyLines = body.split("\n").length;

    results.push({
      category: "Agent Integrity",
      name: file,
      status: bodyLines >= 50 ? "pass" : "warn",
      message: bodyLines >= 50 ? `Frontmatter OK, ${bodyLines} lines` : `Only ${bodyLines} lines (expected at least 50)`,
    });
  }
}

// ---------------------------------------------------------------------------
// Category 5: Command File Integrity
// ---------------------------------------------------------------------------

function checkCommandIntegrity(results: CheckResult[]): void {
  if (!dirExists(".cursor/commands")) return;

  for (const file of EXPECTED_COMMANDS) {
    const content = readText(`.cursor/commands/${file}`);
    if (!content) {
      results.push({
        category: "Command Integrity",
        name: file,
        status: "fail",
        message: "Cannot read file",
      });
      continue;
    }

    // Commands should NOT have frontmatter
    if (content.startsWith("---\n")) {
      results.push({
        category: "Command Integrity",
        name: file,
        status: "warn",
        message: "Has YAML frontmatter — commands should be plain Markdown",
      });
    }

    const lines = content.trim().split("\n").length;
    results.push({
      category: "Command Integrity",
      name: file,
      status: lines >= 5 ? "pass" : "warn",
      message: lines >= 5 ? `${lines} lines, no frontmatter` : `Only ${lines} lines (expected at least 5)`,
    });
  }
}

// ---------------------------------------------------------------------------
// Category 6: Skill Integrity
// ---------------------------------------------------------------------------

function checkSkillIntegrity(results: CheckResult[]): void {
  for (const skill of EXPECTED_SKILLS) {
    const content = readText(`.cursor/skills/${skill}/SKILL.md`);
    if (!content) {
      results.push({
        category: "Skill Integrity",
        name: skill,
        status: "fail",
        message: "SKILL.md not found or unreadable",
      });
      continue;
    }

    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      results.push({
        category: "Skill Integrity",
        name: skill,
        status: "fail",
        message: "Missing YAML frontmatter in SKILL.md",
      });
      continue;
    }

    const fm = fmMatch[1];
    const hasName = /name\s*:/.test(fm);
    const hasDescription = /description\s*:/.test(fm);

    if (!hasName || !hasDescription) {
      results.push({
        category: "Skill Integrity",
        name: skill,
        status: "fail",
        message: `SKILL.md frontmatter missing: ${[!hasName && "name", !hasDescription && "description"].filter(Boolean).join(", ")}`,
      });
      continue;
    }

    const body = content.slice(fmMatch[0].length).trim();
    const bodyLines = body.split("\n").length;

    // Check for supporting files
    let supportingFiles: string[] = [];
    try {
      supportingFiles = readdirSync(join(PROJECT_ROOT, `.cursor/skills/${skill}`))
        .filter(f => f !== "SKILL.md" && !f.startsWith("."));
    } catch { /* ignore */ }

    results.push({
      category: "Skill Integrity",
      name: skill,
      status: bodyLines >= 20 ? "pass" : "warn",
      message: `${bodyLines} lines${supportingFiles.length > 0 ? `, supporting files: ${supportingFiles.join(", ")}` : ""}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Category 7: Hooks Integrity
// ---------------------------------------------------------------------------

function checkHooksIntegrity(results: CheckResult[]): void {
  // hooks.json validity
  const hooksContent = readText(".cursor/hooks.json");
  if (!hooksContent) {
    results.push({
      category: "Hooks Integrity",
      name: "hooks.json",
      status: "fail",
      message: "Cannot read .cursor/hooks.json",
    });
    return;
  }

  let hooksJson: any;
  try {
    hooksJson = JSON.parse(hooksContent);
    results.push({
      category: "Hooks Integrity",
      name: "hooks.json parse",
      status: "pass",
      message: "Valid JSON",
    });
  } catch (e) {
    results.push({
      category: "Hooks Integrity",
      name: "hooks.json parse",
      status: "fail",
      message: `Invalid JSON: ${e}`,
    });
    return;
  }

  // Check version
  if (hooksJson.version === 1) {
    results.push({
      category: "Hooks Integrity",
      name: "hooks.json version",
      status: "pass",
      message: "version: 1",
    });
  } else {
    results.push({
      category: "Hooks Integrity",
      name: "hooks.json version",
      status: "warn",
      message: `version: ${hooksJson.version ?? "missing"} (expected 1)`,
    });
  }

  // Check lifecycle events
  const expectedEvents = [
    "beforeShellExecution", "beforeMCPExecution", "beforeReadFile",
    "beforeSubmitPrompt", "afterFileEdit", "stop",
  ];
  for (const event of expectedEvents) {
    if (hooksJson[event] || hooksJson.hooks?.[event]) {
      results.push({
        category: "Hooks Integrity",
        name: `Event: ${event}`,
        status: "pass",
        message: "Configured",
      });
    } else {
      results.push({
        category: "Hooks Integrity",
        name: `Event: ${event}`,
        status: "warn",
        message: "Not configured in hooks.json",
      });
    }
  }

  // Dispatcher permissions
  for (const dispatcher of EXPECTED_DISPATCHERS) {
    const path = `.cursor/hooks/dispatchers/${dispatcher}`;
    if (!fileExists(path)) {
      results.push({
        category: "Hooks Integrity",
        name: `Dispatcher: ${dispatcher}`,
        status: "fail",
        message: "File not found",
      });
      continue;
    }

    const executable = isExecutable(path);
    results.push({
      category: "Hooks Integrity",
      name: `Dispatcher: ${dispatcher}`,
      status: executable ? "pass" : "warn",
      message: executable ? "Present and executable" : "Present but NOT executable — run: chmod +x .cursor/hooks/dispatchers/*.ts",
      fix: executable ? undefined : `chmod +x .cursor/hooks/dispatchers/${dispatcher}`,
    });
  }

  // Hook dependencies
  if (fileExists(".cursor/hooks/package.json")) {
    results.push({
      category: "Hooks Integrity",
      name: "package.json",
      status: "pass",
      message: "Present",
    });
  }

  const hasNodeModules = dirExists(".cursor/hooks/node_modules");
  const hasLockfile = fileExists(".cursor/hooks/bun.lockb") || fileExists(".cursor/hooks/bun.lock");
  results.push({
    category: "Hooks Integrity",
    name: "Hook dependencies installed",
    status: hasNodeModules || hasLockfile ? "pass" : "warn",
    message: hasNodeModules || hasLockfile ? "Dependencies installed" : "Dependencies not installed",
    fix: "cd .cursor/hooks && bun install",
  });

  // Logs directory
  const hasLogsDir = dirExists(".cursor/hooks/logs");
  results.push({
    category: "Hooks Integrity",
    name: "Logs directory",
    status: hasLogsDir ? "pass" : "warn",
    message: hasLogsDir ? "Present" : "Missing — create with: mkdir -p .cursor/hooks/logs",
    fix: "mkdir -p .cursor/hooks/logs",
  });
}

// ---------------------------------------------------------------------------
// Category 8: MCP Server Configuration
// ---------------------------------------------------------------------------

function checkMCPConfig(results: CheckResult[]): void {
  const mcpContent = readText(".cursor/mcp.json");
  if (!mcpContent) {
    results.push({
      category: "MCP Configuration",
      name: "mcp.json",
      status: "fail",
      message: "Cannot read .cursor/mcp.json",
    });
    return;
  }

  let mcpJson: any;
  try {
    mcpJson = JSON.parse(mcpContent);
    results.push({
      category: "MCP Configuration",
      name: "mcp.json parse",
      status: "pass",
      message: "Valid JSON",
    });
  } catch (e) {
    results.push({
      category: "MCP Configuration",
      name: "mcp.json parse",
      status: "fail",
      message: `Invalid JSON: ${e}`,
    });
    return;
  }

  // List configured servers
  const servers = mcpJson.mcpServers || mcpJson.servers || {};
  const serverNames = Object.keys(servers);

  if (serverNames.length === 0) {
    results.push({
      category: "MCP Configuration",
      name: "MCP servers",
      status: "fail",
      message: "No servers configured in mcp.json",
    });
  } else {
    results.push({
      category: "MCP Configuration",
      name: "MCP servers",
      status: "pass",
      message: `${serverNames.length} server(s) configured: ${serverNames.join(", ")}`,
    });
  }

  // Note: actual connectivity must be tested by the agent via MCP tool calls
  results.push({
    category: "MCP Configuration",
    name: "Server connectivity",
    status: "warn",
    message: "Cannot verify from CLI — agent should test by calling list_rules() and other MCP tools",
  });
}

// ---------------------------------------------------------------------------
// Category 9: Plugin Configuration
// ---------------------------------------------------------------------------

function checkPlugins(results: CheckResult[]): void {
  // Plugins cannot be verified programmatically from CLI
  results.push({
    category: "Plugin Configuration",
    name: "Compound Engineering",
    status: "warn",
    message: "Cannot verify from CLI — check Cursor Settings > Extensions for compound-engineering plugin",
  });

  results.push({
    category: "Plugin Configuration",
    name: "Compound Knowledge",
    status: "warn",
    message: "Cannot verify from CLI — check Cursor Settings > Extensions for compound-knowledge plugin",
  });
}

// ---------------------------------------------------------------------------
// Category 10: Repository Health
// ---------------------------------------------------------------------------

function checkRepoHealth(results: CheckResult[]): void {
  // Git status
  const gitStatus = run("git status --porcelain");
  if (gitStatus === null) {
    results.push({
      category: "Repository Health",
      name: "Git repository",
      status: "fail",
      message: "Not a git repository or git not available",
    });
  } else if (gitStatus === "") {
    results.push({
      category: "Repository Health",
      name: "Git status",
      status: "pass",
      message: "Working tree clean",
    });
  } else {
    const changedFiles = gitStatus.split("\n").length;
    results.push({
      category: "Repository Health",
      name: "Git status",
      status: "warn",
      message: `${changedFiles} uncommitted change(s)`,
    });
  }

  // Branch info
  const branch = run("git branch --show-current");
  if (branch) {
    results.push({
      category: "Repository Health",
      name: "Current branch",
      status: "pass",
      message: branch,
    });
  }

  // Python environment
  const pythonImport = run('python3 -c "import flask; print(flask.__version__)" 2>&1');
  if (pythonImport && !pythonImport.includes("Error") && !pythonImport.includes("No module")) {
    results.push({
      category: "Repository Health",
      name: "Python Flask",
      status: "pass",
      message: `Flask v${pythonImport}`,
    });
  } else {
    results.push({
      category: "Repository Health",
      name: "Python Flask",
      status: "warn",
      message: "Flask not importable — API dependencies may not be installed",
      fix: "cd api && pip install -r requirements.txt",
    });
  }

  // Node modules (check for frontend/)
  if (dirExists("frontend/node_modules")) {
    results.push({
      category: "Repository Health",
      name: "Frontend node_modules",
      status: "pass",
      message: "Present",
    });
  } else if (dirExists("frontend")) {
    results.push({
      category: "Repository Health",
      name: "Frontend node_modules",
      status: "warn",
      message: "frontend/ exists but node_modules/ missing",
      fix: "cd frontend && npm install",
    });
  }

  // Terraform
  if (dirExists("infra")) {
    const hasTfState = dirExists("infra/.terraform");
    results.push({
      category: "Repository Health",
      name: "Terraform initialized",
      status: hasTfState ? "pass" : "warn",
      message: hasTfState ? ".terraform/ present" : "terraform init has not been run",
      fix: "cd infra && terraform init",
    });
  }

  // Environment files
  for (const envFile of [".env", ".env.development", ".env.local"]) {
    if (fileExists(envFile)) {
      results.push({
        category: "Repository Health",
        name: `Environment: ${envFile}`,
        status: "pass",
        message: "Present",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const results: CheckResult[] = [];

  checkDependencies(results);
  checkDirectoryStructure(results);
  checkRuleIntegrity(results);
  checkAgentIntegrity(results);
  checkCommandIntegrity(results);
  checkSkillIntegrity(results);
  checkHooksIntegrity(results);
  checkMCPConfig(results);
  checkPlugins(results);
  checkRepoHealth(results);

  const report: HealthReport = {
    timestamp: new Date().toISOString(),
    hostname: hostname(),
    projectRoot: PROJECT_ROOT,
    results,
    summary: {
      passed: results.filter(r => r.status === "pass").length,
      warnings: results.filter(r => r.status === "warn").length,
      failed: results.filter(r => r.status === "fail").length,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
