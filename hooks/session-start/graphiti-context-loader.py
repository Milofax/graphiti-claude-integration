#!/usr/bin/env python3
"""
Graphiti Context Loader Hook (SessionStart)

Loads relevant knowledge from Graphiti at session start.
Injects Learnings, Decisions, Procedures, Preferences as additionalContext.

This hook runs once at the beginning of each Claude Code session.
"""

import json
import sys
import os
import re
import subprocess
from pathlib import Path


def find_git_root(start_path: str) -> str | None:
    """Find Git root from a path."""
    path = Path(start_path)
    while path != path.parent:
        if (path / ".git").exists():
            return str(path)
        path = path.parent
    return None


def get_github_repo(git_root: str) -> str | None:
    """Extract owner/repo from GitHub remote URL."""
    try:
        result = subprocess.run(
            ["git", "-C", git_root, "remote", "get-url", "origin"],
            capture_output=True, text=True, timeout=3
        )
        if result.returncode != 0:
            return None

        remote_url = result.stdout.strip()

        # git@github.com:owner/repo.git
        if remote_url.startswith("git@github.com:"):
            repo = remote_url[len("git@github.com:"):]
            return repo.removesuffix(".git")

        # https://github.com/owner/repo.git
        if remote_url.startswith("https://github.com/"):
            repo = remote_url[len("https://github.com/"):]
            return repo.removesuffix(".git")

        return None
    except Exception:
        return None


def detect_group_id(working_dir: str) -> tuple[str, str]:
    """
    Detect group_id from various sources.
    Returns (group_id, project_name).
    """
    if not working_dir:
        return "main", ""

    cwd_path = Path(working_dir)

    # 1. Check .graphiti-group file
    for check_path in [cwd_path] + list(cwd_path.parents):
        graphiti_file = check_path / ".graphiti-group"
        if graphiti_file.exists():
            try:
                content = graphiti_file.read_text().strip()
                if content:
                    if ":" in content:
                        group_id, name = content.split(":", 1)
                        return group_id.strip(), name.strip()
                    return content, check_path.name
            except Exception:
                pass

    # 2. Check CLAUDE.md for graphiti_group_id
    for check_path in [cwd_path] + list(cwd_path.parents):
        claude_md = check_path / "CLAUDE.md"
        if claude_md.exists():
            try:
                content = claude_md.read_text()
                match = re.search(r'graphiti_group_id:\s*(\S+)', content)
                if match:
                    group_id = match.group(1).strip()
                    return group_id, check_path.name
            except Exception:
                pass

    # 3. Git-based: GitHub remote or local folder name
    git_root = find_git_root(working_dir)
    if git_root:
        project_name = Path(git_root).name

        # GitHub remote has priority
        github_repo = get_github_repo(git_root)
        if github_repo:
            return github_repo, project_name

        # Fallback: local folder name
        return f"project-{project_name.lower()}", project_name

    return "main", ""


def main():
    try:
        hook_input = json.load(sys.stdin)
    except json.JSONDecodeError:
        # No input, nothing to output
        return

    cwd = hook_input.get("cwd", "")
    group_id, project_name = detect_group_id(cwd)

    # Build context message
    context_parts = []

    if group_id != "main" and project_name:
        context_parts.append(f"📁 Projekt: {project_name}")
        context_parts.append(f"   group_id: {group_id}")
    else:
        context_parts.append("📁 Kontext: main (persönlich)")

    context_parts.append("")
    context_parts.append("💡 Graphiti verfügbar für:")
    context_parts.append("   - search_nodes() → Wissen abrufen")
    context_parts.append("   - add_memory() → Wissen speichern")

    # Note: Actually loading from Graphiti would require MCP call
    # which isn't available in SessionStart hooks. This provides context info.

    context = "\n".join(context_parts)

    # Plain text output - Claude Code adds this as context
    print(context)


if __name__ == "__main__":
    main()
