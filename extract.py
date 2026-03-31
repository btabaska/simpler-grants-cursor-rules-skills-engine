#!/usr/bin/env python3
"""
GitHub PR Data Extraction Script for HHS/simpler-grants-gov.

Extracts 12 months of merged PR data (metadata, diffs, review comments, reviews)
and stores it as structured JSON for LLM analysis.

Usage:
    export GITHUB_PAT=your_token_here
    python3 extract.py
"""

import json
import os
import sys
import time
import base64
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

# --- Configuration ---

REPO = "HHS/simpler-grants-gov"
API_BASE = "https://api.github.com"
MONTHS_BACK = 12
DIFF_LINE_CAP = 500
REQUEST_DELAY = 0.5  # seconds between requests

OUTPUT_DIR = Path("extracted_data")
PRS_DIR = OUTPUT_DIR / "prs"
GROUPS_DIR = OUTPUT_DIR / "groups"
DOCS_DIR = OUTPUT_DIR / "docs"
METADATA_FILE = OUTPUT_DIR / "metadata.json"

# Domain grouping rules: prefix -> group name
DOMAIN_RULES = [
    ("api/src/api/", "api-routes"),
    ("api/src/services/", "api-services"),
    ("api/src/db/", "api-database"),
    ("api/src/auth/", "api-auth"),
    ("api/src/validation/", "api-validation"),
    ("api/src/form_schema/", "api-form-schema"),
    ("api/tests/", "api-tests"),
    ("frontend/src/components/", "frontend-components"),
    ("frontend/src/hooks/", "frontend-hooks"),
    ("frontend/src/services/", "frontend-services"),
    ("frontend/src/i18n/", "frontend-i18n"),
    ("frontend/tests/", "frontend-tests"),
    ("infra/", "infra"),
    (".github/", "ci-cd"),
]

# Bot suffixes to filter out
BOT_SUFFIX = "[bot]"

# Documentation paths to fetch
DOC_PATHS = [
    "documentation",
    "CONTRIBUTING.md",
    "README.md",
    "CLAUDE.md",
    ".cursorrules",
]


class GitHubClient:
    """Thin wrapper around the GitHub REST API with rate limiting and retries."""

    def __init__(self, token: str):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json",
            }
        )
        self.requests_made = 0

    def get(self, url: str, params: dict | None = None) -> requests.Response:
        """Make a GET request with rate limiting, delay, and retry."""
        if not url.startswith("http"):
            url = f"{API_BASE}{url}"

        for attempt in range(5):
            time.sleep(REQUEST_DELAY)
            resp = self.session.get(url, params=params)
            self.requests_made += 1

            # Check rate limit
            remaining = resp.headers.get("X-RateLimit-Remaining")
            if remaining and int(remaining) < 50:
                reset_at = int(resp.headers.get("X-RateLimit-Reset", 0))
                wait = max(reset_at - time.time(), 0) + 5
                print(f"  Rate limit low ({remaining} remaining), waiting {wait:.0f}s...")
                time.sleep(wait)

            if resp.status_code == 200:
                return resp
            if resp.status_code in (403, 429, 502, 503, 504):
                wait = 2 ** attempt * 5
                print(f"  Got {resp.status_code}, retrying in {wait}s (attempt {attempt + 1}/5)")
                time.sleep(wait)
                continue
            if resp.status_code == 404:
                return resp  # Caller handles 404

            resp.raise_for_status()

        print(f"  Failed after 5 retries for {url}")
        return resp

    def get_paginated(self, url: str, params: dict | None = None) -> list:
        """Fetch all pages of a paginated endpoint."""
        params = dict(params or {})
        params.setdefault("per_page", 100)
        results = []

        while url:
            resp = self.get(url, params)
            if resp.status_code != 200:
                break
            data = resp.json()
            if not data:
                break
            results.extend(data)

            # Follow Link: <next> header
            link = resp.headers.get("Link", "")
            url = None
            params = None  # URL from Link header includes params
            for part in link.split(","):
                if 'rel="next"' in part:
                    url = part.split("<")[1].split(">")[0]
                    break

        return results


def classify_pr(files: list[dict]) -> list[str]:
    """Classify a PR into domain groups based on file paths."""
    groups = set()
    for f in files:
        path = f.get("filename", "")
        for prefix, group in DOMAIN_RULES:
            if path.startswith(prefix):
                groups.add(group)
    return sorted(groups)


def cap_patch(patch: str | None) -> tuple[str | None, bool]:
    """Cap a file patch at DIFF_LINE_CAP lines. Returns (patch, was_truncated)."""
    if not patch:
        return patch, False
    lines = patch.split("\n")
    if len(lines) <= DIFF_LINE_CAP:
        return patch, False
    return "\n".join(lines[:DIFF_LINE_CAP]), True


def fetch_pr_detail(client: GitHubClient, pr_number: int) -> dict:
    """Fetch all detail for a single PR."""
    base = f"/repos/{REPO}/pulls/{pr_number}"

    # Files changed
    raw_files = client.get_paginated(f"{base}/files")
    files = []
    for f in raw_files:
        patch, truncated = cap_patch(f.get("patch"))
        files.append(
            {
                "filename": f.get("filename"),
                "status": f.get("status"),
                "additions": f.get("additions"),
                "deletions": f.get("deletions"),
                "changes": f.get("changes"),
                "patch": patch,
                "patch_truncated": truncated,
            }
        )

    # Review comments (inline code comments)
    review_comments = client.get_paginated(f"{base}/comments")
    comments = [
        {
            "id": c["id"],
            "user": c["user"]["login"],
            "body": c["body"],
            "path": c.get("path"),
            "line": c.get("line"),
            "created_at": c["created_at"],
            "in_reply_to_id": c.get("in_reply_to_id"),
        }
        for c in review_comments
    ]

    # Reviews (approve/request changes/comment)
    raw_reviews = client.get_paginated(f"{base}/reviews")
    reviews = [
        {
            "id": r["id"],
            "user": r["user"]["login"],
            "state": r["state"],
            "body": r.get("body", ""),
            "submitted_at": r.get("submitted_at"),
        }
        for r in raw_reviews
    ]

    return {
        "files": files,
        "review_comments": comments,
        "reviews": reviews,
        "domain_groups": classify_pr(raw_files),
    }


def fetch_merged_prs(client: GitHubClient, since: datetime) -> list[dict]:
    """Fetch all merged PRs since a given date, filtering bots."""
    print(f"Fetching merged PRs since {since.date()}...")
    all_prs = []
    page = 1

    while True:
        resp = client.get(
            f"/repos/{REPO}/pulls",
            params={
                "state": "closed",
                "sort": "updated",
                "direction": "desc",
                "per_page": 100,
                "page": page,
            },
        )
        if resp.status_code != 200:
            print(f"  Error fetching PRs page {page}: {resp.status_code}")
            break

        prs = resp.json()
        if not prs:
            break

        # Check if we've gone past our date window
        oldest_updated = prs[-1].get("updated_at", "")
        if oldest_updated:
            oldest_dt = datetime.fromisoformat(oldest_updated.replace("Z", "+00:00"))
            if oldest_dt < since:
                # Filter this page and stop
                for pr in prs:
                    merged_at = pr.get("merged_at")
                    if not merged_at:
                        continue
                    merged_dt = datetime.fromisoformat(merged_at.replace("Z", "+00:00"))
                    if merged_dt < since:
                        continue
                    author = pr.get("user", {}).get("login", "")
                    if author.endswith(BOT_SUFFIX):
                        continue
                    all_prs.append(pr)
                print(f"  Reached PRs older than cutoff on page {page}. Stopping pagination.")
                break

        for pr in prs:
            merged_at = pr.get("merged_at")
            if not merged_at:
                continue
            merged_dt = datetime.fromisoformat(merged_at.replace("Z", "+00:00"))
            if merged_dt < since:
                continue
            author = pr.get("user", {}).get("login", "")
            if author.endswith(BOT_SUFFIX):
                continue
            all_prs.append(pr)

        print(f"  Page {page}: {len(prs)} PRs fetched, {len(all_prs)} merged non-bot PRs so far")
        page += 1

    # Deduplicate by PR number (pagination overlap)
    seen = set()
    unique = []
    for pr in all_prs:
        if pr["number"] not in seen:
            seen.add(pr["number"])
            unique.append(pr)

    print(f"  Total: {len(unique)} merged non-bot PRs")
    return unique


def fetch_docs(client: GitHubClient) -> list[dict]:
    """Fetch existing documentation files from the repo."""
    print("Fetching documentation files...")
    docs = []

    for path in DOC_PATHS:
        resp = client.get(f"/repos/{REPO}/contents/{path}")
        if resp.status_code == 404:
            print(f"  {path}: not found, skipping")
            continue

        data = resp.json()

        # If it's a directory, recurse one level (or use recursive tree)
        if isinstance(data, list):
            for item in data:
                if item["type"] == "file" and item["name"].endswith((".md", ".txt", ".rst")):
                    file_resp = client.get(item["url"])
                    if file_resp.status_code == 200:
                        file_data = file_resp.json()
                        content = ""
                        if file_data.get("encoding") == "base64" and file_data.get("content"):
                            content = base64.b64decode(file_data["content"]).decode("utf-8", errors="replace")
                        docs.append(
                            {
                                "path": item["path"],
                                "name": item["name"],
                                "content": content,
                            }
                        )
                        print(f"  Fetched: {item['path']}")
        else:
            # Single file
            content = ""
            if data.get("encoding") == "base64" and data.get("content"):
                content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
            docs.append(
                {
                    "path": data.get("path", path),
                    "name": data.get("name", path),
                    "content": content,
                }
            )
            print(f"  Fetched: {path}")

    # Also try to find ADR files
    resp = client.get(f"/repos/{REPO}/git/trees/main", params={"recursive": "1"})
    if resp.status_code == 200:
        tree = resp.json().get("tree", [])
        adr_files = [t for t in tree if "adr" in t["path"].lower() and t["path"].endswith(".md") and t["type"] == "blob"]
        for item in adr_files[:50]:  # Cap to avoid too many requests
            file_resp = client.get(f"/repos/{REPO}/contents/{item['path']}")
            if file_resp.status_code == 200:
                file_data = file_resp.json()
                content = ""
                if file_data.get("encoding") == "base64" and file_data.get("content"):
                    content = base64.b64decode(file_data["content"]).decode("utf-8", errors="replace")
                docs.append(
                    {
                        "path": item["path"],
                        "name": item["path"].split("/")[-1],
                        "content": content,
                    }
                )
                print(f"  Fetched ADR: {item['path']}")

    print(f"  Total docs fetched: {len(docs)}")
    return docs


def build_domain_groups(pr_dir: Path) -> dict[str, list[int]]:
    """Build domain group index from saved PR files."""
    groups: dict[str, list[int]] = {}
    for f in sorted(pr_dir.glob("*.json")):
        data = json.loads(f.read_text())
        pr_num = data["number"]
        for group in data.get("domain_groups", []):
            groups.setdefault(group, []).append(pr_num)
    return groups


def main():
    token = os.environ.get("GITHUB_PAT")
    if not token:
        print("Error: GITHUB_PAT environment variable not set.")
        print("  export GITHUB_PAT=your_token_here")
        sys.exit(1)

    # Setup output directories
    PRS_DIR.mkdir(parents=True, exist_ok=True)
    GROUPS_DIR.mkdir(parents=True, exist_ok=True)
    DOCS_DIR.mkdir(parents=True, exist_ok=True)

    client = GitHubClient(token)
    since = datetime.now(timezone.utc) - timedelta(days=365)

    # Step 1: Fetch PR list
    prs = fetch_merged_prs(client, since)

    # Step 2: Fetch detail for each PR (with resumability)
    total = len(prs)
    skipped = 0
    for i, pr in enumerate(prs, 1):
        pr_number = pr["number"]
        pr_file = PRS_DIR / f"{pr_number}.json"

        if pr_file.exists():
            skipped += 1
            continue

        print(f"[{i}/{total}] PR #{pr_number}: {pr['title'][:80]}")
        detail = fetch_pr_detail(client, pr_number)

        pr_data = {
            "number": pr_number,
            "title": pr["title"],
            "body": pr.get("body", ""),
            "author": pr["user"]["login"],
            "labels": [l["name"] for l in pr.get("labels", [])],
            "created_at": pr["created_at"],
            "merged_at": pr["merged_at"],
            "url": pr["html_url"],
            **detail,
        }

        pr_file.write_text(json.dumps(pr_data, indent=2))

    if skipped:
        print(f"  Skipped {skipped} already-extracted PRs")

    # Step 3: Fetch documentation
    docs = fetch_docs(client)
    for doc in docs:
        # Save each doc file
        safe_name = doc["path"].replace("/", "__")
        (DOCS_DIR / safe_name).write_text(json.dumps(doc, indent=2))

    # Step 4: Build domain groups
    print("Building domain group index...")
    groups = build_domain_groups(PRS_DIR)
    for group_name, pr_numbers in groups.items():
        group_file = GROUPS_DIR / f"{group_name}.json"
        group_file.write_text(
            json.dumps(
                {
                    "group": group_name,
                    "pr_count": len(pr_numbers),
                    "pr_numbers": sorted(pr_numbers),
                },
                indent=2,
            )
        )
        print(f"  {group_name}: {len(pr_numbers)} PRs")

    # Step 5: Write metadata
    pr_files = list(PRS_DIR.glob("*.json"))
    all_merged_dates = []
    for f in pr_files:
        data = json.loads(f.read_text())
        if data.get("merged_at"):
            all_merged_dates.append(data["merged_at"])

    all_merged_dates.sort()

    metadata = {
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "repo": REPO,
        "months_back": MONTHS_BACK,
        "since_date": since.isoformat(),
        "total_prs": len(pr_files),
        "date_range": {
            "earliest": all_merged_dates[0] if all_merged_dates else None,
            "latest": all_merged_dates[-1] if all_merged_dates else None,
        },
        "domain_groups": {name: len(nums) for name, nums in sorted(groups.items())},
        "docs_fetched": len(docs),
        "api_requests_made": client.requests_made,
    }
    METADATA_FILE.write_text(json.dumps(metadata, indent=2))

    print("\n--- Extraction Complete ---")
    print(f"Total PRs extracted: {len(pr_files)}")
    print(f"Domain groups: {len(groups)}")
    print(f"Docs fetched: {len(docs)}")
    print(f"API requests made: {client.requests_made}")
    print(f"Output: {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
