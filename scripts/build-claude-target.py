#!/usr/bin/env python3
"""Generate .claude/ tree from canonical .cursor/ tree.

Mechanical translation only — preserves bodies, rewrites frontmatter and
file locations to match Claude Code's spec. Idempotent. Pass --check to
fail (exit 1) if the generated tree differs from what's already on disk.

See documentation/architecture-guide.md "Multi-target Layout" and
docs/16-claude-code-vs-cursor.md for the parity matrix.
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CURSOR = ROOT / ".cursor"
CLAUDE = ROOT / ".claude"
MCP_OUT = ROOT / ".mcp.json"

# Agents that should run on opus rather than the sonnet default.
OPUS_AGENTS = {
    "orchestrator",
    "new-endpoint",
    "refactor",
    "debugging",
    "code-generation",
    "incident-response",
}

# Cursor hook event -> Claude Code (event name, matcher or None)
HOOK_EVENT_MAP = {
    "beforeShellExecution": ("PreToolUse", "Bash"),
    "afterFileEdit":        ("PostToolUse", "Edit|Write|MultiEdit"),
    "stop":                 ("Stop", None),
    # No first-class Claude Code analog — documented in .claude/hooks/README.md
    "beforeMCPExecution":   None,
    "beforeReadFile":       None,
    "beforeSubmitPrompt":   None,
}

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n?", re.DOTALL)


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Naive YAML frontmatter parser — handles the limited shapes we use:
    `key: value` and `key: ["a", "b"]`. Quoted values keep their quotes
    stripped. Returns (fields, body)."""
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    fields: dict = {}
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if ":" not in line:
            continue
        k, _, v = line.partition(":")
        v = v.strip()
        if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
            v = v[1:-1]
        fields[k.strip()] = v
    return fields, text[m.end():]


def emit_frontmatter(fields: dict) -> str:
    out = ["---"]
    for k, v in fields.items():
        if isinstance(v, str) and (":" in v or "#" in v or v.startswith("[")):
            out.append(f'{k}: "{v}"')
        else:
            out.append(f"{k}: {v}")
    out.append("---\n")
    return "\n".join(out)


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", name.lower()).strip("-")


# ---------------------------------------------------------------------------
# Per-artifact builders

def build_agents() -> None:
    src = CURSOR / "agents"
    dst = CLAUDE / "agents"
    if dst.exists():
        shutil.rmtree(dst)
    for f in sorted(src.glob("*.md")):
        text = f.read_text()
        fm, body = parse_frontmatter(text)
        stem = f.stem
        new_fm = {
            "name": fm.get("name", stem),
            "description": fm.get("description", ""),
            "model": "opus" if stem in OPUS_AGENTS else "sonnet",
        }
        write(dst / f.name, emit_frontmatter(new_fm) + "\n" + body.lstrip("\n"))


def build_rules_as_skills() -> None:
    src = CURSOR / "rules"
    for f in sorted(src.glob("*.mdc")):
        text = f.read_text()
        fm, body = parse_frontmatter(text)
        stem = f.stem
        globs = fm.get("globs", "")
        desc = fm.get("description", "")
        new_desc = f"MANDATORY when editing files matching {globs}. {desc}".strip()
        new_fm = {"name": f"rule-{stem}", "description": new_desc}
        out = CLAUDE / "skills" / f"rule-{stem}" / "SKILL.md"
        write(out, emit_frontmatter(new_fm) + "\n" + body.lstrip("\n"))


def build_skills() -> None:
    src = CURSOR / "skills"
    for skill_dir in sorted(p for p in src.iterdir() if p.is_dir()):
        for f in skill_dir.rglob("*"):
            if f.is_dir():
                continue
            rel = f.relative_to(src)
            out = CLAUDE / "skills" / rel
            if f.name == "SKILL.md":
                text = f.read_text()
                fm, body = parse_frontmatter(text)
                # Drop unknown fields, keep only name + description
                new_fm = {
                    "name": fm.get("name", skill_dir.name),
                    "description": fm.get("description", ""),
                }
                write(out, emit_frontmatter(new_fm) + "\n" + body.lstrip("\n"))
            else:
                out.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, out)


def build_notepads_as_skills() -> None:
    src = CURSOR / "notepads"
    if not src.exists():
        return
    for f in sorted(src.glob("*.md")):
        stem = f.stem
        text = f.read_text()
        # Notepads have no frontmatter; first H1 = title
        title_match = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
        title = title_match.group(1).strip() if title_match else stem
        new_fm = {
            "name": f"notepad-{stem}",
            "description": f"Reference doc: {title}",
        }
        out = CLAUDE / "skills" / f"notepad-{stem}" / "SKILL.md"
        write(out, emit_frontmatter(new_fm) + "\n" + text)


def build_commands() -> None:
    src = CURSOR / "commands"
    dst = CLAUDE / "commands"
    if dst.exists():
        shutil.rmtree(dst)
    for f in sorted(src.glob("*.md")):
        text = f.read_text()
        # Cursor commands are plain markdown; $ARGUMENTS is the Claude convention
        # (no Cursor-specific tokens to strip in this repo).
        write(dst / f.name, text)


def build_hooks_tree() -> None:
    src = CURSOR / "hooks"
    dst = CLAUDE / "hooks"
    if dst.exists():
        shutil.rmtree(dst)
    # Copy entire hooks tree, excluding node_modules and logs
    def ignore(_dir, names):
        return [n for n in names if n in ("node_modules", "logs")]
    shutil.copytree(src, dst, ignore=ignore)
    # README documenting the gap
    (dst / "README.md").write_text(
        "# Claude Code hooks\n\n"
        "This tree is generated from `.cursor/hooks/` by `scripts/build-claude-target.py`.\n"
        "Hook commands are unchanged; only their registration in `.claude/settings.json`\n"
        "differs from `.cursor/hooks.json`.\n\n"
        "## Event mapping\n\n"
        "| Cursor event | Claude Code event | Notes |\n"
        "|---|---|---|\n"
        "| `beforeShellExecution` | `PreToolUse` (matcher `Bash`) | Direct analog |\n"
        "| `afterFileEdit`        | `PostToolUse` (matcher `Edit|Write|MultiEdit`) | Direct analog |\n"
        "| `stop`                 | `Stop` | Direct analog |\n"
        "| `beforeMCPExecution`   | — | No first-class analog. Run via wrapper if needed. |\n"
        "| `beforeReadFile`       | — | No first-class analog. |\n"
        "| `beforeSubmitPrompt`   | — | Closest equivalent: `UserPromptSubmit`. Not auto-mapped — verify before enabling. |\n\n"
        "Hooks still require the [Bun](https://bun.sh) runtime.\n"
    )


def build_settings_json() -> None:
    cursor_hooks = json.loads((CURSOR / "hooks.json").read_text())
    claude_hooks: dict[str, list] = {}
    for cursor_event, entries in cursor_hooks.get("hooks", {}).items():
        mapped = HOOK_EVENT_MAP.get(cursor_event)
        if mapped is None:
            continue  # Unmappable; documented in hooks/README.md
        cc_event, matcher = mapped
        bucket: dict[str, list] = {}
        for entry in entries:
            cmd = entry["command"].replace(".cursor/hooks/", ".claude/hooks/")
            key = matcher or "*"
            bucket.setdefault(key, []).append({"type": "command", "command": cmd})
        for key, hooks_list in bucket.items():
            block = {"hooks": hooks_list}
            if matcher is not None:
                block = {"matcher": matcher, "hooks": hooks_list}
            claude_hooks.setdefault(cc_event, []).append(block)
    settings = {"hooks": claude_hooks}
    write(CLAUDE / "settings.json", json.dumps(settings, indent=2) + "\n")


def build_mcp_json() -> None:
    src = CURSOR / "mcp.json"
    content = src.read_text()
    MCP_OUT.write_text(content)
    # Claude Code reads MCP config from .claude/mcp.json, not .mcp.json
    write(CLAUDE / "mcp.json", content)


def build_claude_md() -> None:
    cursorrules = (ROOT / ".cursorrules").read_text()
    translated = cursorrules.replace(".cursor/", ".claude/").replace(
        ".cursor/hooks.json", ".claude/settings.json"
    )
    rule_skills = sorted((CLAUDE / "skills").glob("rule-*/SKILL.md"))
    index_lines = ["", "## Rule index (auto-generated)", ""]
    index_lines += [
        f"- `skills/{p.parent.name}/` — see `.claude/skills/{p.parent.name}/SKILL.md`"
        for p in rule_skills
    ]
    header = (
        "# simpler-grants-gov — Claude Code project memory\n\n"
        "_Generated from `.cursorrules` by `scripts/build-claude-target.py`._\n\n"
    )
    write(CLAUDE / "CLAUDE.md", header + translated + "\n" + "\n".join(index_lines) + "\n")


# ---------------------------------------------------------------------------

def build_all() -> None:
    # Wipe generated subtrees but preserve .claude/settings.local.json
    for sub in ("agents", "skills", "commands", "hooks"):
        p = CLAUDE / sub
        if p.exists():
            shutil.rmtree(p)
    for f in ("CLAUDE.md", "settings.json"):
        fp = CLAUDE / f
        if fp.exists():
            fp.unlink()
    CLAUDE.mkdir(exist_ok=True)
    build_agents()
    build_rules_as_skills()
    build_skills()
    build_notepads_as_skills()
    build_commands()
    build_hooks_tree()
    build_settings_json()
    build_mcp_json()
    build_claude_md()


def snapshot() -> dict[str, str]:
    out = {}
    for p in sorted(CLAUDE.rglob("*")):
        if p.is_file() and "settings.local.json" not in p.name and "node_modules" not in p.parts:
            out[str(p.relative_to(ROOT))] = p.read_text(errors="replace")
    if MCP_OUT.exists():
        out[str(MCP_OUT.relative_to(ROOT))] = MCP_OUT.read_text()
    return out


def main() -> int:
    check = "--check" in sys.argv
    if check:
        before = snapshot()
        build_all()
        after = snapshot()
        diffs = [k for k in set(before) | set(after) if before.get(k) != after.get(k)]
        if diffs:
            print("Drift detected in generated Claude Code tree:", file=sys.stderr)
            for d in sorted(diffs):
                print(f"  {d}", file=sys.stderr)
            print("\nRun: scripts/build-claude-target.py", file=sys.stderr)
            return 1
        print("Claude Code tree in sync.")
        return 0
    build_all()
    print(f"Generated {sum(1 for _ in CLAUDE.rglob('*') if _.is_file())} files under .claude/")
    print(f"Generated {MCP_OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
