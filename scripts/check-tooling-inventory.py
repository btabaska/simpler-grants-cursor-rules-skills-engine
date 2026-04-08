#!/usr/bin/env python3
"""CI-friendly drift check for the Simpler Grants AI coding toolkit.

Runs two checks in sequence:

  1. `bun run .cursor/hooks/health-check.ts --ci` — self-enumerating
     health check over rules, agents, commands, skills, dispatchers,
     handler imports, hooks.json, mcp.json, and Claude-vs-Cursor hook
     parity. Non-zero on any failing check.
  2. `python3 scripts/build-claude-target.py --check` — fails if the
     generated `.claude/` tree has drifted from `.cursor/`.

Exit code is the OR of the two checks. Intended for `pre-commit`, CI,
or a local `make check-tooling` target.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run(label: str, cmd: list[str]) -> int:
    print(f"==> {label}")
    print(f"    $ {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode == 0:
        print(f"    OK ({label})")
    else:
        print(f"    FAIL ({label}) — exit {result.returncode}")
    print()
    return result.returncode


def main() -> int:
    failures = 0

    if shutil.which("bun") is None:
        print("FAIL: bun is not installed — required to run health-check.ts")
        print("      install: curl -fsSL https://bun.sh/install | bash")
        failures += 1
    else:
        failures += 1 if run(
            "health-check (self-enumerating, --ci)",
            ["bun", "run", ".cursor/hooks/health-check.ts", "--ci"],
        ) else 0

    failures += 1 if run(
        "build-claude-target.py --check (.claude/ ↔ .cursor/ sync)",
        ["python3", "scripts/build-claude-target.py", "--check"],
    ) else 0

    if failures:
        print(f"check-tooling-inventory: {failures} check(s) failed", file=sys.stderr)
        return 1
    print("check-tooling-inventory: all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
