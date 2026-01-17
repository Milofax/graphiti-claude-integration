#!/usr/bin/env python3
"""
Session Reminder Hook (UserPromptSubmit)

Shows a concise reminder at each prompt about:
- Current group_id
- Checklist for Graphiti workflow

No threats, just helpful reminders.
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

        if remote_url.startswith("git@github.com:"):
            repo = remote_url[len("git@github.com:"):]
            return repo.removesuffix(".git")

        if remote_url.startswith("https://github.com/"):
            repo = remote_url[len("https://github.com/"):]
            return repo.removesuffix(".git")

        return None
    except Exception:
        return None


def detect_group_id(working_dir: str) -> tuple[str, str]:
    """Detect group_id from various sources."""
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
                    return match.group(1).strip(), check_path.name
            except Exception:
                pass

    # 3. Git-based
    git_root = find_git_root(working_dir)
    if git_root:
        project_name = Path(git_root).name
        github_repo = get_github_repo(git_root)
        if github_repo:
            return github_repo, project_name
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

    # Build concise reminder
    if group_id != "main" and project_name:
        add_memory_hint = f'add_memory(group_id="{group_id}")'
        group_line = f"📁 {project_name} → {group_id}"
        main_hint = "main = Zettelkasten | projekt-spezifisch? → abstrahieren!"
    else:
        add_memory_hint = "add_memory()"
        group_line = "📁 main (persönlich)"
        main_hint = "main = Kontakte, Learnings, Decisions, Preferences..."

    context = f"""📋 Session-Checklist:
- Graphiti gefragt? (search_nodes)
- Wissen gespeichert? ({add_memory_hint})
  {main_hint}

{group_line}"""

    # Plain text output - Claude Code adds this as context
    print(context)


if __name__ == "__main__":
    main()
