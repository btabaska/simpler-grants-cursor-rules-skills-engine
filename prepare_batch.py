#!/usr/bin/env python3
"""
Prepare a batch of PRs for LLM analysis by extracting key signals
and trimming verbose content to fit within context windows.

Usage:
    python3 prepare_batch.py <domain> [batch_num] [batch_size] [max_patch_lines]

Outputs a condensed markdown summary of PRs suitable for pattern analysis.
"""

import json
import sys
from pathlib import Path

PRS_DIR = Path("extracted_data/prs")
GROUPS_DIR = Path("extracted_data/groups")


def load_group(domain: str) -> list[int]:
    group_file = GROUPS_DIR / f"{domain}.json"
    data = json.loads(group_file.read_text())
    return sorted(data["pr_numbers"])


def summarize_pr(pr: dict, max_patch_lines: int = 60) -> str:
    """Create a condensed summary of a PR for pattern analysis."""
    lines = []
    lines.append(f"## PR #{pr['number']}: {pr['title']}")
    lines.append(f"**Author:** {pr['author']} | **Merged:** {pr['merged_at'][:10]}")

    if pr.get("labels"):
        lines.append(f"**Labels:** {', '.join(pr['labels'])}")

    # PR body (truncate if very long)
    body = (pr.get("body") or "").strip()
    if body:
        if len(body) > 800:
            body = body[:800] + "\n... (truncated)"
        lines.append(f"\n**Description:**\n{body}")

    # Files changed - always include full list
    lines.append(f"\n**Files changed ({len(pr.get('files', []))}):**")
    for f in pr.get("files", []):
        status = f.get("status", "modified")
        lines.append(f"- `{f['filename']}` ({status}, +{f.get('additions', 0)}/-{f.get('deletions', 0)})")

    # Diffs - include but cap per file
    has_diffs = False
    for f in pr.get("files", []):
        patch = f.get("patch")
        if not patch:
            continue
        if not has_diffs:
            lines.append("\n**Key diffs:**")
            has_diffs = True
        patch_lines = patch.split("\n")
        if len(patch_lines) > max_patch_lines:
            patch = "\n".join(patch_lines[:max_patch_lines]) + f"\n... ({len(patch_lines) - max_patch_lines} more lines)"
            truncated = True
        else:
            truncated = False

        lines.append(f"\n### `{f['filename']}`" + (" (diff truncated)" if truncated or f.get("patch_truncated") else ""))
        lines.append(f"```\n{patch}\n```")

    # Review comments - these are high signal for patterns
    comments = pr.get("review_comments", [])
    if comments:
        lines.append(f"\n**Review comments ({len(comments)}):**")
        for c in comments:
            body = c.get("body", "").strip()
            if not body:
                continue
            path = c.get("path", "")
            reply = f" (reply to #{c['in_reply_to_id']})" if c.get("in_reply_to_id") else ""
            lines.append(f"\n> **{c['user']}** on `{path}`{reply}:")
            if len(body) > 400:
                body = body[:400] + "... (truncated)"
            lines.append(f"> {body}")

    # Reviews - only substantive ones
    reviews = pr.get("reviews", [])
    substantive = [r for r in reviews if r.get("body", "").strip()]
    if substantive:
        lines.append(f"\n**Reviews:**")
        for r in substantive:
            body = r["body"].strip()
            if len(body) > 400:
                body = body[:400] + "... (truncated)"
            lines.append(f"- **{r['user']}** ({r['state']}): {body}")

    lines.append("\n---\n")
    return "\n".join(lines)


def main():
    domain = sys.argv[1]
    batch_num = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    batch_size = int(sys.argv[3]) if len(sys.argv) > 3 else 50
    max_patch = int(sys.argv[4]) if len(sys.argv) > 4 else 60

    pr_numbers = load_group(domain)
    total_batches = (len(pr_numbers) + batch_size - 1) // batch_size

    start = batch_num * batch_size
    end = min(start + batch_size, len(pr_numbers))
    batch = pr_numbers[start:end]

    print(f"# {domain} — Batch {batch_num + 1}/{total_batches} (PRs {start + 1}-{end} of {len(pr_numbers)})\n")

    for num in batch:
        pr_file = PRS_DIR / f"{num}.json"
        if not pr_file.exists():
            continue
        pr = json.loads(pr_file.read_text())
        print(summarize_pr(pr, max_patch_lines=max_patch))


if __name__ == "__main__":
    main()
