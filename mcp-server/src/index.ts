import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve documentation directory relative to the project root
const PROJECT_ROOT = resolve(__dirname, "../..");
const DOCS_DIR = join(PROJECT_ROOT, "documentation");
const RULES_DIR = join(DOCS_DIR, "rules");
const ARCH_GUIDE = join(DOCS_DIR, "architecture-guide.md");
const CURSORRULES = join(PROJECT_ROOT, ".cursorrules");

// File path → rule mapping (mirrors pr-review.mdc dispatch table)
const FILE_RULE_MAP: Array<{ pattern: RegExp; rules: string[] }> = [
  { pattern: /api\/src\/api\//, rules: ["api-routes", "api-error-handling"] },
  { pattern: /api\/src\/services\//, rules: ["api-services", "api-error-handling"] },
  { pattern: /api\/src\/db\//, rules: ["api-database"] },
  { pattern: /api\/src\/auth\//, rules: ["api-auth"] },
  { pattern: /api\/src\/validation\//, rules: ["api-validation"] },
  { pattern: /api\/src\/form_schema\//, rules: ["api-form-schema", "forms-vertical"] },
  { pattern: /api\/tests\//, rules: ["api-tests"] },
  { pattern: /frontend\/src\/components\//, rules: ["frontend-components"] },
  { pattern: /frontend\/src\/hooks\//, rules: ["frontend-hooks"] },
  { pattern: /frontend\/src\/services\//, rules: ["frontend-services"] },
  { pattern: /frontend\/src\/i18n\//, rules: ["frontend-i18n"] },
  { pattern: /frontend\/tests\/|frontend\/e2e\//, rules: ["frontend-tests"] },
  { pattern: /infra\//, rules: ["infra"] },
  { pattern: /\.github\//, rules: ["ci-cd"] },
  { pattern: /form/, rules: ["forms-vertical"] },
];

// Parse architecture guide into sections
function parseArchitectureSections(): Map<string, string> {
  const sections = new Map<string, string>();

  if (!existsSync(ARCH_GUIDE)) {
    return sections;
  }

  const content = readFileSync(ARCH_GUIDE, "utf-8");
  const lines = content.split("\n");

  let currentSection = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const match = line.match(/^## (\d+\.\s+.+)/);
    if (match) {
      if (currentSection) {
        sections.set(currentSection, currentContent.join("\n").trim());
      }
      currentSection = match[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentSection) {
    sections.set(currentSection, currentContent.join("\n").trim());
  }

  return sections;
}

// Load rule documents
function loadRules(): Map<string, string> {
  const rules = new Map<string, string>();

  if (!existsSync(RULES_DIR)) {
    return rules;
  }

  const files = readdirSync(RULES_DIR).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const name = file.replace(".md", "");
    rules.set(name, readFileSync(join(RULES_DIR, file), "utf-8"));
  }

  return rules;
}

// Initialize data
const archSections = parseArchitectureSections();
const ruleDocuments = loadRules();

// Create MCP server
const server = new McpServer({
  name: "simpler-grants-context",
  version: "1.0.0",
});

// Tool: Get architecture section
server.tool(
  "get_architecture_section",
  "Get a specific section of the simpler-grants-gov architecture guide. Available sections: " +
    Array.from(archSections.keys()).join(", "),
  {
    section: z
      .string()
      .describe(
        "Section name or number (e.g., '1. Mission & Context', '4. API Architecture', or just '4')"
      ),
  },
  async ({ section }) => {
    // Try exact match first
    let content = archSections.get(section);

    // Try matching by number prefix
    if (!content) {
      for (const [key, value] of archSections) {
        if (key.startsWith(section)) {
          content = value;
          break;
        }
      }
    }

    // Try fuzzy match
    if (!content) {
      const lower = section.toLowerCase();
      for (const [key, value] of archSections) {
        if (key.toLowerCase().includes(lower)) {
          content = value;
          break;
        }
      }
    }

    if (!content) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Section "${section}" not found. Available sections:\n${Array.from(archSections.keys())
              .map((k) => `  - ${k}`)
              .join("\n")}`,
          },
        ],
      };
    }

    return { content: [{ type: "text" as const, text: content }] };
  }
);

// Tool: Get rules for a file path
server.tool(
  "get_rules_for_file",
  "Get the applicable coding rules for a given file path in the simpler-grants-gov monorepo",
  {
    file_path: z
      .string()
      .describe(
        "File path relative to the monorepo root (e.g., 'api/src/api/users/user_routes.py')"
      ),
  },
  async ({ file_path }) => {
    const matchedRules = new Set<string>();

    // Always include cross-domain
    matchedRules.add("cross-domain");

    for (const { pattern, rules } of FILE_RULE_MAP) {
      if (pattern.test(file_path)) {
        rules.forEach((r) => matchedRules.add(r));
      }
    }

    const results: string[] = [];
    for (const ruleName of matchedRules) {
      const doc = ruleDocuments.get(ruleName);
      if (doc) {
        // Return a summary (first 100 lines) to save context
        const lines = doc.split("\n").slice(0, 100);
        results.push(`## ${ruleName}\n\n${lines.join("\n")}\n\n---`);
      } else {
        results.push(
          `## ${ruleName}\n\n(Detailed documentation not found. Check .cursor/rules/${ruleName}.mdc for the Cursor rule.)\n\n---`
        );
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Rules applicable to \`${file_path}\`:\n\n${results.join("\n\n")}`,
        },
      ],
    };
  }
);

// Tool: Get full rule detail
server.tool(
  "get_rule_detail",
  "Get the full detailed documentation for a specific coding rule. Available rules: " +
    Array.from(ruleDocuments.keys()).join(", "),
  {
    rule_name: z
      .string()
      .describe(
        "Rule name (e.g., 'api-routes', 'frontend-components', 'api-database')"
      ),
  },
  async ({ rule_name }) => {
    const doc = ruleDocuments.get(rule_name);

    if (!doc) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Rule "${rule_name}" not found. Available rules:\n${Array.from(ruleDocuments.keys())
              .map((k) => `  - ${k}`)
              .join("\n")}`,
          },
        ],
      };
    }

    return { content: [{ type: "text" as const, text: doc }] };
  }
);

// Tool: Get conventions summary
server.tool(
  "get_conventions_summary",
  "Get a summary of the key coding conventions for simpler-grants-gov",
  {},
  async () => {
    let cursorrules = "";
    if (existsSync(CURSORRULES)) {
      cursorrules = readFileSync(CURSORRULES, "utf-8");
    }

    const summary = `# Simpler.Grants.gov Key Conventions

${cursorrules}

## Available Detailed Rules

${Array.from(ruleDocuments.keys())
  .map((k) => `- **${k}**: ${ruleDocuments.get(k)?.split("\n").find((l) => l.startsWith("#"))?.replace(/^#+\s*/, "") || k}`)
  .join("\n")}

## Architecture Guide Sections

${Array.from(archSections.keys())
  .map((k) => `- ${k}`)
  .join("\n")}
`;

    return { content: [{ type: "text" as const, text: summary }] };
  }
);

// Tool: List all available rules
server.tool(
  "list_rules",
  "List all available coding rules and their descriptions",
  {},
  async () => {
    const entries: string[] = [];
    for (const [name, content] of ruleDocuments) {
      const title =
        content
          .split("\n")
          .find((l) => l.startsWith("# "))
          ?.replace(/^#\s*/, "") || name;
      const firstParagraph = content
        .split("\n\n")
        .find((p) => p.length > 20 && !p.startsWith("#"));
      entries.push(
        `**${name}** — ${title}\n${firstParagraph?.slice(0, 200) || ""}...`
      );
    }
    return {
      content: [
        {
          type: "text" as const,
          text: `# Available Rules\n\n${entries.join("\n\n")}`,
        },
      ],
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
