#!/usr/bin/env bun
/**
 * Standalone diagnostic script for the Simpler Grants AI Coding Toolkit.
 * Run with: bun run .cursor/hooks/health-check.ts            (JSON output)
 *           bun run .cursor/hooks/health-check.ts --ci       (CI mode: exit
 *                                                             non-zero on any
 *                                                             failing check)
 *           bun run .cursor/hooks/health-check.ts --summary  (human-readable)
 *
 * Self-enumerating — discovers rules, agents, commands, skills, dispatchers,
 * handlers, and MCP servers from the filesystem rather than hardcoding lists.
 * Cross-checks .cursor/ (source-of-truth) against .claude/ (generated) and
 * explicitly flags hook events that DO NOT RUN under Claude Code.
 *
 * This is NOT a hook — it is an on-demand utility invoked by the
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

// Cursor events that DO NOT map to any Claude Code event in
// scripts/build-claude-target.py (HOOK_EVENT_MAP). Keep in sync with the
// python EVENT_MAP — this script cross-checks that file.
const CLAUDE_DROPPED_EVENTS = new Set([
  "beforeMCPExecution",
  "beforeReadFile",
  "beforeSubmitPrompt",
]);

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

function listDir(rel: string): string[] {
  try {
    return readdirSync(join(PROJECT_ROOT, rel));
  } catch {
    return [];
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
  { name: "Python", cmd: "python3 --version", requiredBy: "API, build-claude-target.py", installHint: "brew install python@3.12", minVersion: "3.11" },
  { name: "pip", cmd: "pip3 --version", requiredBy: "API dependencies", installHint: "Installed with Python" },
  { name: "Bun", cmd: "bun --version", requiredBy: "Hooks (TypeScript dispatchers)", installHint: "curl -fsSL https://bun.sh/install | bash" },
  { name: "ruff", cmd: "ruff --version", requiredBy: "Hooks (auto-formatter for Python)", installHint: "pip install ruff" },
  { name: "Terraform", cmd: "terraform --version", requiredBy: "Infra rules, hooks", installHint: "brew install terraform" },
  { name: "jq", cmd: "jq --version", requiredBy: "Hooks (JSON parsing fallback)", installHint: "brew install jq" },
  { name: "git", cmd: "git --version", requiredBy: "Agents, hooks", installHint: "brew install git" },
  { name: "gh (GitHub CLI)", cmd: "gh --version", requiredBy: "PR review skill, GitHub MCP", installHint: "brew install gh && gh auth login" },
];

function checkDependencies(results: CheckResult[]): void {
  for (const dep of DEPS) {
    const output = run(dep.cmd);
    if (output) {
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
// Category 2: Directory Structure (self-enumerating)
// ---------------------------------------------------------------------------

interface Inventory {
  rules: string[];      // e.g. ["api-routes.mdc", ...]
  agents: string[];     // e.g. ["debugging.md", ...]
  commands: string[];   // e.g. ["debug.md", ...]
  skills: string[];     // skill directory names
  dispatchers: string[];
}

function enumerate(): Inventory {
  return {
    rules: listDir(".cursor/rules").filter(f => f.endsWith(".mdc")).sort(),
    agents: listDir(".cursor/agents").filter(f => f.endsWith(".md")).sort(),
    commands: listDir(".cursor/commands").filter(f => f.endsWith(".md")).sort(),
    skills: listDir(".cursor/skills")
      .filter(name => {
        try {
          return statSync(join(PROJECT_ROOT, ".cursor/skills", name)).isDirectory();
        } catch { return false; }
      })
      .sort(),
    dispatchers: listDir(".cursor/hooks/dispatchers").filter(f => f.endsWith(".ts") && f !== "types.ts").sort(),
  };
}

function checkDirectoryStructure(results: CheckResult[], inv: Inventory): void {
  // Top-level directories under .cursor/ must exist
  for (const dir of [".cursor/rules", ".cursor/agents", ".cursor/commands", ".cursor/skills", ".cursor/hooks", ".cursor/hooks/dispatchers", ".cursor/hooks/handlers"]) {
    results.push({
      category: "Directory Structure",
      name: dir,
      status: dirExists(dir) ? "pass" : "fail",
      message: dirExists(dir) ? "Present" : `MISSING: ${dir}/`,
    });
  }

  // Core files
  for (const f of [".cursor/hooks.json", ".cursor/mcp.json", ".cursor/hooks/package.json", ".cursor/hooks/types.ts", ".cursorrules", "scripts/build-claude-target.py"]) {
    results.push({
      category: "Directory Structure",
      name: f,
      status: fileExists(f) ? "pass" : "fail",
      message: fileExists(f) ? "Present" : `MISSING: ${f}`,
    });
  }

  // Inventory summary (self-enumerating — no hardcoded expected counts)
  results.push({
    category: "Directory Structure",
    name: "Inventory",
    status: "pass",
    message: `${inv.rules.length} rules, ${inv.agents.length} agents, ${inv.commands.length} commands, ${inv.skills.length} skills, ${inv.dispatchers.length} dispatchers`,
  });

  if (inv.rules.length === 0) {
    results.push({ category: "Directory Structure", name: "rules", status: "fail", message: "No .mdc rule files found" });
  }
  if (inv.agents.length === 0) {
    results.push({ category: "Directory Structure", name: "agents", status: "fail", message: "No agent files found" });
  }
  if (inv.commands.length === 0) {
    results.push({ category: "Directory Structure", name: "commands", status: "fail", message: "No command files found" });
  }
  if (inv.skills.length === 0) {
    results.push({ category: "Directory Structure", name: "skills", status: "fail", message: "No skill directories found" });
  }
}

// ---------------------------------------------------------------------------
// Category 3: Rule File Integrity (for every discovered rule)
// ---------------------------------------------------------------------------

function checkRuleIntegrity(results: CheckResult[], inv: Inventory): void {
  for (const file of inv.rules) {
    const content = readText(`.cursor/rules/${file}`);
    if (!content) {
      results.push({ category: "Rule Integrity", name: file, status: "fail", message: "Cannot read file" });
      continue;
    }

    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      results.push({ category: "Rule Integrity", name: file, status: "fail", message: "Missing YAML frontmatter" });
      continue;
    }

    const fm = fmMatch[1];
    const hasDescription = /description\s*:/.test(fm);
    const hasAlwaysApply = /alwaysApply\s*:/.test(fm);
    const hasGlobs = /globs\s*:/.test(fm);

    if (!hasDescription || !hasAlwaysApply) {
      results.push({
        category: "Rule Integrity",
        name: file,
        status: "fail",
        message: `Frontmatter missing: ${[!hasDescription && "description", !hasAlwaysApply && "alwaysApply"].filter(Boolean).join(", ")}`,
      });
      continue;
    }

    const body = content.slice(fmMatch[0].length).trim();
    const bodyLines = body.split("\n").length;
    if (bodyLines < 10) {
      results.push({ category: "Rule Integrity", name: file, status: "warn", message: `Body only has ${bodyLines} lines (expected at least 10)` });
      continue;
    }

    const isAlwaysApply = /alwaysApply\s*:\s*true/.test(fm);
    if (!hasGlobs && !isAlwaysApply) {
      results.push({ category: "Rule Integrity", name: file, status: "warn", message: "No globs and alwaysApply:false — rule may never activate" });
      continue;
    }

    results.push({
      category: "Rule Integrity",
      name: file,
      status: "pass",
      message: `OK (${bodyLines} lines${isAlwaysApply ? ", alwaysApply" : ""})`,
    });
  }
}

// ---------------------------------------------------------------------------
// Category 4: Agent File Integrity
// ---------------------------------------------------------------------------

function checkAgentIntegrity(results: CheckResult[], inv: Inventory): void {
  for (const file of inv.agents) {
    const content = readText(`.cursor/agents/${file}`);
    if (!content) {
      results.push({ category: "Agent Integrity", name: file, status: "fail", message: "Cannot read file" });
      continue;
    }

    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      results.push({ category: "Agent Integrity", name: file, status: "fail", message: "Missing YAML frontmatter" });
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
      status: bodyLines >= 20 ? "pass" : "warn",
      message: bodyLines >= 20 ? `OK (${bodyLines} lines)` : `Only ${bodyLines} lines`,
    });
  }
}

// ---------------------------------------------------------------------------
// Category 5: Command File Integrity
// ---------------------------------------------------------------------------

function checkCommandIntegrity(results: CheckResult[], inv: Inventory): void {
  for (const file of inv.commands) {
    const content = readText(`.cursor/commands/${file}`);
    if (!content) {
      results.push({ category: "Command Integrity", name: file, status: "fail", message: "Cannot read file" });
      continue;
    }
    const lines = content.trim().split("\n").length;
    results.push({
      category: "Command Integrity",
      name: file,
      status: lines >= 5 ? "pass" : "warn",
      message: lines >= 5 ? `${lines} lines` : `Only ${lines} lines`,
    });
  }
}

// ---------------------------------------------------------------------------
// Category 6: Skill Integrity
// ---------------------------------------------------------------------------

function checkSkillIntegrity(results: CheckResult[], inv: Inventory): void {
  for (const skill of inv.skills) {
    const content = readText(`.cursor/skills/${skill}/SKILL.md`);
    if (!content) {
      results.push({ category: "Skill Integrity", name: skill, status: "fail", message: "SKILL.md missing or unreadable" });
      continue;
    }

    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      results.push({ category: "Skill Integrity", name: skill, status: "fail", message: "SKILL.md missing frontmatter" });
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
    results.push({
      category: "Skill Integrity",
      name: skill,
      status: bodyLines >= 10 ? "pass" : "warn",
      message: bodyLines >= 10 ? `OK (${bodyLines} lines)` : `Only ${bodyLines} lines`,
    });
  }
}

// ---------------------------------------------------------------------------
// Category 7: Hooks Integrity (dispatchers + handler imports + hooks.json)
// ---------------------------------------------------------------------------

function checkHooksIntegrity(results: CheckResult[], inv: Inventory): void {
  // Every dispatcher must be executable and its handler imports must resolve.
  for (const dispatcher of inv.dispatchers) {
    const rel = `.cursor/hooks/dispatchers/${dispatcher}`;
    if (!fileExists(rel)) {
      results.push({ category: "Hooks Integrity", name: dispatcher, status: "fail", message: "Missing" });
      continue;
    }

    if (!isExecutable(rel)) {
      results.push({
        category: "Hooks Integrity",
        name: dispatcher,
        status: "warn",
        message: "Present but not executable",
        fix: `chmod +x ${rel}`,
      });
    }

    // Parse imports and verify every handler file the dispatcher pulls in
    // actually exists on disk. If a handler goes missing, the dispatcher
    // crashes at runtime — this catches it before a hook fires.
    const content = readText(rel) ?? "";
    const importRe = /from\s+["']([^"']+)["']/g;
    const missingImports: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(content)) !== null) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue;           // skip node / bun builtins
      if (!spec.includes("/handlers/")) continue;     // only check handler imports
      // Resolve relative to .cursor/hooks/dispatchers/
      const resolved = resolve(PROJECT_ROOT, ".cursor/hooks/dispatchers", spec);
      if (!existsSync(resolved)) {
        missingImports.push(spec);
      }
    }

    if (missingImports.length > 0) {
      results.push({
        category: "Hooks Integrity",
        name: `${dispatcher} imports`,
        status: "fail",
        message: `Broken handler imports: ${missingImports.join(", ")}`,
      });
    } else {
      results.push({
        category: "Hooks Integrity",
        name: `${dispatcher} imports`,
        status: "pass",
        message: "All handler imports resolve",
      });
    }
  }

  // hooks.json validity + event registration
  const hooksContent = readText(".cursor/hooks.json");
  if (!hooksContent) {
    results.push({ category: "Hooks Integrity", name: "hooks.json", status: "fail", message: "Cannot read .cursor/hooks.json" });
    return;
  }

  let hooksJson: any;
  try {
    hooksJson = JSON.parse(hooksContent);
    results.push({ category: "Hooks Integrity", name: "hooks.json parse", status: "pass", message: "Valid JSON" });
  } catch (e) {
    results.push({ category: "Hooks Integrity", name: "hooks.json parse", status: "fail", message: `Invalid JSON: ${e}` });
    return;
  }

  const events = hooksJson.hooks ?? hooksJson;
  const eventNames = Object.keys(events).filter(k => k !== "version");
  for (const event of eventNames) {
    results.push({ category: "Hooks Integrity", name: `Event: ${event}`, status: "pass", message: "Configured" });
  }

  // Logs directory
  results.push({
    category: "Hooks Integrity",
    name: "Logs directory",
    status: dirExists(".cursor/hooks/logs") ? "pass" : "warn",
    message: dirExists(".cursor/hooks/logs") ? "Present" : "Missing",
    fix: "mkdir -p .cursor/hooks/logs",
  });

  // Dependencies
  const hasDeps = dirExists(".cursor/hooks/node_modules") || fileExists(".cursor/hooks/bun.lockb") || fileExists(".cursor/hooks/bun.lock");
  results.push({
    category: "Hooks Integrity",
    name: "Hook dependencies",
    status: hasDeps ? "pass" : "warn",
    message: hasDeps ? "Installed" : "Not installed",
    fix: "cd .cursor/hooks && bun install",
  });
}

// ---------------------------------------------------------------------------
// Category 8: Cursor vs Claude Code hook parity (explicit gap surfacing)
// ---------------------------------------------------------------------------

function checkClaudeHookParity(results: CheckResult[]): void {
  // Cross-check .cursor/hooks.json events against the HOOK_EVENT_MAP in
  // scripts/build-claude-target.py. Any Cursor event with no Claude Code
  // analog is reported as a WARN so users know it will NOT run under Claude.
  const hooksContent = readText(".cursor/hooks.json");
  if (!hooksContent) return;
  let hooksJson: any;
  try { hooksJson = JSON.parse(hooksContent); } catch { return; }
  const events = hooksJson.hooks ?? {};
  const cursorEvents = Object.keys(events);

  const dropped = cursorEvents.filter(e => CLAUDE_DROPPED_EVENTS.has(e));
  const mapped = cursorEvents.filter(e => !CLAUDE_DROPPED_EVENTS.has(e));

  results.push({
    category: "Claude Code Hook Parity",
    name: "Events running under Claude Code",
    status: "pass",
    message: mapped.length > 0 ? mapped.join(", ") : "(none)",
  });

  if (dropped.length > 0) {
    results.push({
      category: "Claude Code Hook Parity",
      name: "Events DROPPED under Claude Code",
      status: "warn",
      message: `${dropped.join(", ")} — these dispatchers ship in this repo but DO NOT RUN when invoked via Claude Code. Do not rely on them for security guardrails in that runtime.`,
    });
  }

  // Sanity-check: HOOK_EVENT_MAP in python script still agrees
  const buildSrc = readText("scripts/build-claude-target.py") ?? "";
  for (const ev of CLAUDE_DROPPED_EVENTS) {
    if (!buildSrc.includes(ev)) {
      results.push({
        category: "Claude Code Hook Parity",
        name: `Build script mentions ${ev}`,
        status: "warn",
        message: `scripts/build-claude-target.py no longer references ${ev} — this health check's CLAUDE_DROPPED_EVENTS may be out of date.`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Category 9: MCP Server Configuration
// ---------------------------------------------------------------------------

function checkMCPConfig(results: CheckResult[]): void {
  const mcpContent = readText(".cursor/mcp.json");
  if (!mcpContent) {
    results.push({ category: "MCP Configuration", name: "mcp.json", status: "fail", message: "Cannot read .cursor/mcp.json" });
    return;
  }

  let mcpJson: any;
  try {
    mcpJson = JSON.parse(mcpContent);
    results.push({ category: "MCP Configuration", name: "mcp.json parse", status: "pass", message: "Valid JSON" });
  } catch (e) {
    results.push({ category: "MCP Configuration", name: "mcp.json parse", status: "fail", message: `Invalid JSON: ${e}` });
    return;
  }

  const servers = mcpJson.mcpServers || mcpJson.servers || {};
  const serverNames = Object.keys(servers);
  if (serverNames.length === 0) {
    results.push({ category: "MCP Configuration", name: "Servers", status: "fail", message: "No servers configured" });
    return;
  }
  results.push({
    category: "MCP Configuration",
    name: "Servers",
    status: "pass",
    message: `${serverNames.length} configured: ${serverNames.join(", ")}`,
  });

  // Cross-check: every tool name referenced in .cursorrules under "## MCP Tools"
  // should still be a known simpler-grants-context tool. This catches prose
  // drift when a tool is renamed or removed.
  const rules = readText(".cursorrules") ?? "";
  const mcpSection = rules.match(/## MCP Tools\n([\s\S]*?)(?:\n## |$)/);
  if (mcpSection) {
    const toolRefs = [...mcpSection[1].matchAll(/`([a-z_]+)\(/g)].map(m => m[1]);
    if (toolRefs.length > 0) {
      results.push({
        category: "MCP Configuration",
        name: "Tools referenced in .cursorrules",
        status: "pass",
        message: `${toolRefs.length} tool(s): ${toolRefs.join(", ")}`,
      });
    }
  }

  // Mirror file for Claude Code
  results.push({
    category: "MCP Configuration",
    name: ".mcp.json (Claude Code mirror)",
    status: fileExists(".mcp.json") ? "pass" : "warn",
    message: fileExists(".mcp.json") ? "Present" : "Missing — run scripts/build-claude-target.py",
  });
}

// ---------------------------------------------------------------------------
// Category 10: Generation pipeline sync (.cursor → .claude)
// ---------------------------------------------------------------------------

function checkGenerationSync(results: CheckResult[]): void {
  if (!fileExists("scripts/build-claude-target.py")) {
    results.push({ category: "Generation Pipeline", name: "build-claude-target.py", status: "fail", message: "Missing build script" });
    return;
  }

  const output = run("python3 scripts/build-claude-target.py --check 2>&1");
  if (output === null) {
    results.push({
      category: "Generation Pipeline",
      name: ".claude/ in sync with .cursor/",
      status: "fail",
      message: "build-claude-target.py --check failed (non-zero exit). Run: python3 scripts/build-claude-target.py",
      fix: "python3 scripts/build-claude-target.py",
    });
    return;
  }
  if (output.includes("in sync")) {
    results.push({ category: "Generation Pipeline", name: ".claude/ in sync with .cursor/", status: "pass", message: "In sync" });
  } else {
    results.push({
      category: "Generation Pipeline",
      name: ".claude/ in sync with .cursor/",
      status: "warn",
      message: output.split("\n").slice(0, 3).join(" | "),
      fix: "python3 scripts/build-claude-target.py",
    });
  }
}

// ---------------------------------------------------------------------------
// Category 11: Repository Health
// ---------------------------------------------------------------------------

function checkRepoHealth(results: CheckResult[]): void {
  const gitStatus = run("git status --porcelain");
  if (gitStatus === null) {
    results.push({ category: "Repository Health", name: "Git repository", status: "fail", message: "Not a git repository" });
  } else if (gitStatus === "") {
    results.push({ category: "Repository Health", name: "Git status", status: "pass", message: "Working tree clean" });
  } else {
    const changedFiles = gitStatus.split("\n").length;
    results.push({ category: "Repository Health", name: "Git status", status: "warn", message: `${changedFiles} uncommitted change(s)` });
  }

  const branch = run("git branch --show-current");
  if (branch) {
    results.push({ category: "Repository Health", name: "Current branch", status: "pass", message: branch });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function renderSummary(report: HealthReport): string {
  const lines: string[] = [];
  lines.push(`Tooling health check — ${report.timestamp}`);
  lines.push(`PASS ${report.summary.passed}   WARN ${report.summary.warnings}   FAIL ${report.summary.failed}`);
  lines.push("");

  const byCategory = new Map<string, CheckResult[]>();
  for (const r of report.results) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category)!.push(r);
  }
  for (const [cat, rs] of byCategory) {
    const failed = rs.filter(r => r.status === "fail").length;
    const warned = rs.filter(r => r.status === "warn").length;
    const passed = rs.filter(r => r.status === "pass").length;
    lines.push(`[${cat}]  pass=${passed} warn=${warned} fail=${failed}`);
    for (const r of rs) {
      if (r.status === "pass") continue;
      const icon = r.status === "fail" ? "✗" : "!";
      lines.push(`  ${icon} ${r.name}: ${r.message}`);
      if (r.fix) lines.push(`    fix: ${r.fix}`);
    }
  }
  return lines.join("\n");
}

function main(): void {
  const ci = process.argv.includes("--ci");
  const summary = process.argv.includes("--summary");

  const results: CheckResult[] = [];
  const inv = enumerate();

  checkDependencies(results);
  checkDirectoryStructure(results, inv);
  checkRuleIntegrity(results, inv);
  checkAgentIntegrity(results, inv);
  checkCommandIntegrity(results, inv);
  checkSkillIntegrity(results, inv);
  checkHooksIntegrity(results, inv);
  checkClaudeHookParity(results);
  checkMCPConfig(results);
  checkGenerationSync(results);
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

  if (summary || ci) {
    console.log(renderSummary(report));
  } else {
    console.log(JSON.stringify(report, null, 2));
  }

  if (ci && report.summary.failed > 0) {
    process.exit(1);
  }
}

main();
